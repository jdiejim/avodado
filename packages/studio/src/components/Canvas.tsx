/**
 * The canvas: a full-width surface with the rendered document centered on it.
 * Blocks reveal a floating mini-toolbar on hover; the gaps between blocks
 * reveal a hairline with a '+' that opens the insert picker anchored to the
 * gap; prose edits in place; typed blocks open the Edit Sheet.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { replaceProse, BLOCK_LABELS, type Segment } from '@avodado/core';
import {
  deleteSegment,
  duplicateSegment,
  moveSegmentDown,
  moveSegmentUp,
} from '../lib/actions.js';
import { importFileAt } from '../lib/importActions.js';
import { dropGapIndex, isFileDrag } from '../lib/importFile.js';
import { DirectLayer } from '../direct/DirectLayer.js';
import { canvasHost } from '../direct/host.js';
import { needsBlockDeleteConfirm } from '../lib/confirmDelete.js';
import { isEditableTarget } from '../lib/dom.js';
import { levelsBySegment } from '../lib/segDiagnostics.js';
import { slashUsed } from '../lib/prefs.js';
import { segmentLabel } from '../state/changes.js';
import { docSurface } from '../state/derive.js';
import { useDerived, useStudio } from '../state/store.js';
import {
  IconArrowDown,
  IconArrowUp,
  IconDuplicate,
  IconEdit,
  IconGrip,
  IconPlus,
  IconTrash,
} from './Icons.js';

/** Where a gap '+' was clicked: gap index + viewport point for the popover. */
interface InsertAnchor {
  readonly index: number;
  readonly x: number;
  readonly y: number;
}

/** Opens the unified insert picker compact + anchored, pinned to the gap. */
function openInsertAt(anchor: InsertAnchor): void {
  useStudio.getState().openPicker({
    view: 'compact',
    index: anchor.index,
    anchor: { x: anchor.x, y: anchor.y },
  });
}

/** Block DnD payload — only block MOVES ride the canvas drag (grip handle). */
type DragPayload = { kind: 'move'; from: number };

function parseDragPayload(text: string): DragPayload | null {
  try {
    const raw = JSON.parse(text) as { kind?: unknown; from?: unknown };
    if (raw.kind === 'move' && typeof raw.from === 'number') {
      return { kind: 'move', from: raw.from };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * OS-file drag-drop over the canvas: a window-level listener set that shows
 * the drop veil while a FILE drag hovers (block DnD carries `text/plain`,
 * never `Files` — `isFileDrag` is the discriminator) and routes the drop to
 * `importFileAt` at the gap nearest the pointer. Rendered only in Edit mode
 * (the canvas is Edit-only), so imports can't fire from Site/Present.
 */
function FileDropZone({ minIndex }: { minIndex: number }): JSX.Element | null {
  const [armed, setArmed] = useState(false);
  const depth = useRef(0);

  useEffect(() => {
    const reset = (): void => {
      depth.current = 0;
      setArmed(false);
    };
    const onEnter = (e: DragEvent): void => {
      if (!isFileDrag(e.dataTransfer?.types)) return;
      depth.current += 1;
      setArmed(true);
    };
    const onOver = (e: DragEvent): void => {
      if (!isFileDrag(e.dataTransfer?.types)) return;
      // preventDefault marks the window as a drop target (and keeps the
      // browser from navigating to the file).
      e.preventDefault();
      if (e.dataTransfer !== null) e.dataTransfer.dropEffect = 'copy';
    };
    const onLeave = (e: DragEvent): void => {
      if (!isFileDrag(e.dataTransfer?.types)) return;
      depth.current -= 1;
      if (depth.current <= 0) reset();
    };
    const onDrop = (e: DragEvent): void => {
      if (!isFileDrag(e.dataTransfer?.types)) return;
      e.preventDefault();
      reset();
      const file = e.dataTransfer?.files[0];
      if (file === undefined) return;
      const rects = Array.from(document.querySelectorAll('[data-seg]'))
        .map((el) => ({ el, index: Number(el.getAttribute('data-seg')) }))
        .sort((a, b) => a.index - b.index)
        .map(({ el }) => {
          const r = el.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom };
        });
      void importFileAt(file, dropGapIndex(e.clientY, rects, minIndex));
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    window.addEventListener('dragend', reset);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('dragend', reset);
    };
  }, [minIndex]);

  if (!armed) return null;
  return (
    <div className="stu-dropveil" aria-hidden="true">
      <div className="stu-dropveil-card">
        <div className="stu-dropveil-title">Drop to import</div>
        <div className="stu-dropveil-sub">
          <code>.csv</code> → table block · OpenAPI <code>.yaml</code>/<code>.json</code> → new doc
        </div>
      </div>
    </div>
  );
}

/** The hover-revealed gap between blocks: '+' button + DnD drop target. */
function Gap({ index, locked, onPlus }: {
  index: number;
  /** True for the gap ABOVE the meta cover — no inserts, no drops. */
  locked?: boolean | undefined;
  onPlus: (anchor: InsertAnchor) => void;
}): JSX.Element {
  const dragging = useStudio((s) => s.dragging);
  const [over, setOver] = useState(false);

  if (locked === true) return <div className="stu-gap stu-gap-locked" />;

  const onDrop = (e: React.DragEvent): void => {
    // OS-file drags belong to the FileDropZone (window-level handler) —
    // never read them as block payloads.
    if (isFileDrag(e.dataTransfer.types)) return;
    e.preventDefault();
    setOver(false);
    const s = useStudio.getState();
    const payload = parseDragPayload(e.dataTransfer.getData('text/plain')) ?? s.dragging;
    s.setDragging(null);
    if (payload === null) return;
    const from = payload.from;
    if (index === from || index === from + 1) return;
    s.moveBlock(from, index);
  };

  return (
    <div
      className={`stu-gap ${dragging !== null ? 'stu-gap-armed' : ''} ${over ? 'stu-gap-over' : ''}`}
      onDragOver={(e) => {
        if (isFileDrag(e.dataTransfer.types)) return; // veil owns file drags
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <div className="stu-gap-line" />
      {dragging === null && (
        <button
          type="button"
          className="stu-gap-plus"
          aria-label="Insert a block here"
          title="Insert a block"
          onClick={(e) => {
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            onPlus({ index, x: r.left + r.width / 2, y: r.bottom });
          }}
        >
          <IconPlus size={13} />
        </button>
      )}
    </div>
  );
}

function ProseEditor({ index, text, onDone }: {
  index: number;
  text: string;
  onDone: () => void;
}): JSX.Element {
  const [value, setValue] = useState(text);
  const ref = useRef<HTMLTextAreaElement>(null);
  const applyOp = useStudio((s) => s.applyOp);

  useEffect(() => {
    const el = ref.current;
    if (el !== null) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight + 2}px`;
    }
  }, []);

  const commit = (): void => {
    if (value !== text) applyOp((src, doc) => replaceProse(src, doc, index, value));
    onDone();
  };

  return (
    <textarea
      ref={ref}
      className="stu-prose-editor"
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight + 2}px`;
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          commit();
        }
        if (e.key === 'Escape') {
          e.stopPropagation();
          onDone();
        }
      }}
    />
  );
}

/** The floating mini-toolbar pinned to a hovered/selected block. */
function BlockToolbar({ index, count, isMeta, metaFirst, onEdit, onDelete }: {
  index: number;
  count: number;
  /** The meta cover is locked in place: its toolbar keeps only Edit. */
  isMeta: boolean;
  /** True when segment 0 is the meta cover — nothing moves above it. */
  metaFirst: boolean;
  onEdit: () => void;
  /** Owns the destructive-delete confirm; anchored to the clicked button. */
  onDelete: (e: React.MouseEvent<HTMLButtonElement>) => void;
}): JSX.Element {
  const setDragging = useStudio((s) => s.setDragging);

  if (isMeta) {
    return (
      <div className="stu-blocktools" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="stu-tool" title="Edit" aria-label="Edit" onClick={onEdit}>
          <IconEdit size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="stu-blocktools" onClick={(e) => e.stopPropagation()}>
      <span
        className="stu-tool stu-tool-grip"
        title="Drag to move"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'move', from: index }));
          e.dataTransfer.effectAllowed = 'move';
          setDragging({ kind: 'move', from: index });
        }}
        onDragEnd={() => setDragging(null)}
      >
        <IconGrip size={13} />
      </span>
      <button type="button" className="stu-tool" title="Edit" aria-label="Edit" onClick={onEdit}>
        <IconEdit size={13} />
      </button>
      <button
        type="button"
        className="stu-tool"
        title="Duplicate"
        aria-label="Duplicate"
        onClick={() => duplicateSegment(index)}
      >
        <IconDuplicate size={13} />
      </button>
      <button
        type="button"
        className="stu-tool"
        title="Move up"
        aria-label="Move up"
        disabled={index === 0 || (metaFirst && index === 1)}
        onClick={() => moveSegmentUp(index)}
      >
        <IconArrowUp size={13} />
      </button>
      <button
        type="button"
        className="stu-tool"
        title="Move down"
        aria-label="Move down"
        disabled={index === count - 1}
        onClick={() => moveSegmentDown(index)}
      >
        <IconArrowDown size={13} />
      </button>
      <button
        type="button"
        className="stu-tool stu-tool-danger"
        title="Delete"
        aria-label="Delete"
        onClick={onDelete}
      >
        <IconTrash size={13} />
      </button>
    </div>
  );
}

/** A segment's diagnostic tallies, for the card badge + error ring. */
export interface SegLevels {
  readonly errors: number;
  readonly warnings: number;
}

const NO_LEVELS: SegLevels = { errors: 0, warnings: 0 };

function SegmentShell({ index, count, seg, html, metaFirst, levels }: {
  index: number;
  count: number;
  seg: Segment;
  html: string;
  metaFirst: boolean;
  levels: SegLevels;
}): JSX.Element {
  const selected = useStudio((s) => s.selection === index);
  const select = useStudio((s) => s.select);
  const openSheet = useStudio((s) => s.openSheet);
  const sheetOpen = useStudio((s) => s.sheet !== null);
  const [editing, setEditing] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const isProse = seg.kind === 'markdown';
  const isTyped = !isProse && seg.kind !== 'meta';
  // Direct on-diagram editing: live once the block is selected (and the modal
  // sheet is closed) — hover highlights, click-to-edit, +/× affordances.
  const direct = isTyped && selected && !sheetOpen && html !== '';
  const kind = seg.kind;
  const host = useMemo(
    () => (isTyped && kind !== 'markdown' ? canvasHost(index, kind) : null),
    [isTyped, index, kind],
  );

  const startEdit = (): void => {
    if (isProse) setEditing(true);
    else openSheet(index);
  };

  // Toolbar 🗑: pristine scaffolding deletes silently; content confirms via
  // the anchored popover (both autosave modes — deletes are destructive).
  const onDelete = (e: React.MouseEvent<HTMLButtonElement>): void => {
    if (!needsBlockDeleteConfirm(seg)) {
      deleteSegment(index);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    useStudio.getState().requestDelete({
      label: segmentLabel(seg),
      anchor: { x: r.left + r.width / 2, y: r.bottom },
      run: () => deleteSegment(index),
    });
  };

  // Keyboard: ⏎ on the selected block opens its editor (prose edits in place).
  useEffect(() => {
    if (!selected || sheetOpen || editing) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Enter' || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      startEdit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, sheetOpen, editing, index, isProse]);

  const onClickCapture = (e: React.MouseEvent): void => {
    const anchor = (e.target as HTMLElement).closest('a');
    if (anchor !== null) e.preventDefault();
    if (editing) return;
    select(index);
    // Prose is Notion-text: a click drops straight into in-place editing.
    if (isProse) setEditing(true);
  };

  const onDoubleClick = (e: React.MouseEvent): void => {
    if (editing) return;
    // A tagged element already opened its micro-editor on the second click —
    // don't stack the modal sheet on top of it.
    if (direct && (e.target as HTMLElement).closest('[data-bp]') !== null) return;
    startEdit();
  };

  let body: JSX.Element;
  if (isProse && editing) {
    body = <ProseEditor index={index} text={seg.text} onDone={() => setEditing(false)} />;
  } else if (seg.kind === 'meta') {
    body = (
      <div className="stu-placeholder stu-placeholder-meta">
        <span className="stu-placeholder-chip">cover</span>
        Document cover — title, subtitle &amp; tag. Double-click to edit.
      </div>
    );
  } else if (html === '') {
    body = (
      <div className="stu-placeholder stu-placeholder-empty">
        <span className="stu-placeholder-chip">{seg.kind}</span>
        Empty {seg.kind === 'markdown' ? 'text' : BLOCK_LABELS[seg.kind].toLowerCase()} block —
        double-click to fill it in.
      </div>
    );
  } else {
    body = <div className="stu-seg-html" dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return (
    <div
      ref={shellRef}
      className={`stu-seg ${selected ? 'stu-seg-selected' : ''} ${editing ? 'stu-seg-editing' : ''} ${!editing && levels.errors > 0 ? 'stu-seg-err' : ''}`}
      data-seg={index}
      onClickCapture={onClickCapture}
      onDoubleClick={onDoubleClick}
    >
      {!editing && (
        <BlockToolbar
          index={index}
          count={count}
          isMeta={seg.kind === 'meta'}
          metaFirst={metaFirst}
          onEdit={startEdit}
          onDelete={onDelete}
        />
      )}
      {!editing && (levels.errors > 0 || levels.warnings > 0) && (
        <span
          className={`stu-seg-diag ${levels.errors > 0 ? 'stu-seg-diag-err' : 'stu-seg-diag-warn'}`}
        >
          {seg.kind === 'markdown' ? 'text' : seg.kind} ·{' '}
          {levels.errors > 0
            ? `${levels.errors} error${levels.errors === 1 ? '' : 's'}`
            : `${levels.warnings} warning${levels.warnings === 1 ? '' : 's'}`}
        </span>
      )}
      {body}
      {direct && host !== null && (
        <DirectLayer host={host} data={seg.data} html={html} wrapperRef={shellRef} segIndex={index} />
      )}
    </div>
  );
}

function EmptyDocs(): JSX.Element {
  return (
    <div className="stu-hero">
      <div className="stu-hero-card">
        <div className="stu-hero-mark" aria-hidden="true" />
        <h1>Create your first doc</h1>
        <p>
          This project has no docs yet. Open the doc switcher in the top bar and pick{' '}
          <strong>New doc</strong>, or run <code>avo init</code> in your terminal.
        </p>
      </div>
    </div>
  );
}

export function Canvas(): JSX.Element {
  const { doc, rendered, renderError, diagnostics } = useDerived();
  const source = useStudio((s) => s.source);
  const docs = useStudio((s) => s.docs);
  const loaded = useStudio((s) => s.loaded);
  const currentSlug = useStudio((s) => s.currentSlug);
  const select = useStudio((s) => s.select);
  const slashHintAt = useStudio((s) => s.slashHintAt);
  const theme = useStudio((s) => s.theme);
  const themeVars = useStudio((s) => s.themeVars);
  const showSlashHint = slashHintAt !== null && !slashUsed();

  // Per-segment error/warning tallies for the card badges — derived from the
  // SAME whole-doc diagnostics the check chip shows, attributed by line span.
  const segLevels = useMemo(
    () => levelsBySegment(diagnostics, source, doc),
    [diagnostics, source, doc],
  );

  if (loaded && docs.length === 0) {
    return (
      <main className="stu-canvas">
        <EmptyDocs />
        {/* No docs yet — dropping an OpenAPI spec is a fine way to make the first one. */}
        <FileDropZone minIndex={0} />
      </main>
    );
  }
  if (currentSlug === null || rendered === null) {
    return (
      <main className="stu-canvas">
        {renderError !== null && <div className="stu-render-error">Render failed: {renderError}</div>}
      </main>
    );
  }

  const count = doc.segments.length;
  const metaFirst = doc.segments[0]?.kind === 'meta';

  return (
    <main className="stu-canvas" data-tour="canvas" onClick={() => select(null)}>
      <style>{rendered.css}</style>
      <style>{`.docskin{${rendered.themeVars}}`}</style>
      <div
        className="stu-page"
        data-doc-theme={docSurface(theme, themeVars)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="docskin">
          <div dangerouslySetInnerHTML={{ __html: rendered.defs }} />
          {/* The rendered cover IS the meta block's edit surface: click it to
              open the cover editor — no detached placeholder strip. */}
          {metaFirst ? (
            <div
              className="stu-cover"
              role="button"
              tabIndex={0}
              title="Edit the cover — title, subtitle & tag"
              onClick={(e) => {
                e.stopPropagation();
                useStudio.getState().openSheet(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  useStudio.getState().openSheet(0);
                }
              }}
            >
              <div dangerouslySetInnerHTML={{ __html: rendered.cover }} />
              <span className="stu-cover-edit">✎ Edit cover</span>
            </div>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: rendered.cover }} />
          )}
          <Gap index={0} locked={metaFirst} onPlus={openInsertAt} />
          {doc.segments.map((seg, i) => (
            <div key={i}>
              {/* The meta cover edits through the rendered cover above — no
                  strip in the flow. */}
              {!(metaFirst && i === 0) && (
                <SegmentShell
                  index={i}
                  count={count}
                  seg={seg}
                  html={rendered.segments[i]?.html ?? ''}
                  metaFirst={metaFirst}
                  levels={segLevels[i] ?? NO_LEVELS}
                />
              )}
              {showSlashHint && slashHintAt === i && (
                <div className="stu-slash-next" role="note">
                  press <kbd>/</kbd> for the next block
                </div>
              )}
              <Gap index={i + 1} onPlus={openInsertAt} />
            </div>
          ))}
          {count === 0 && (
            <div className="stu-ghost">
              <button
                type="button"
                className="stu-ghost-plus"
                aria-label="Add your first block"
                onClick={(e) => {
                  e.stopPropagation();
                  const r = e.currentTarget.getBoundingClientRect();
                  openInsertAt({ index: 0, x: r.left + r.width / 2, y: r.bottom });
                }}
              >
                <IconPlus size={16} />
              </button>
              <span>
                Press <kbd>+</kbd> or <kbd>/</kbd> to add your first block
              </span>
            </div>
          )}
        </div>
      </div>
      <FileDropZone minIndex={metaFirst ? 1 : 0} />
    </main>
  );
}
