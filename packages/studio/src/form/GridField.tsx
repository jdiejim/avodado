/**
 * The table GRID editor — the dedicated FormTab control for
 * array-of-rows-of-cells shapes (`table.rows`; anything whose schema is
 * `array<array<…>>` gets it via shape detection):
 *
 * - a spreadsheet-like grid of cell inputs (type-preserving: `42` stays a
 *   number when the cell union allows it);
 * - an editable HEADER row bound to the sibling `columns` field when the
 *   block has one (string | { label, align, highlight } unions supported);
 * - add/remove row and column — column ops are COMPOUND (columns + every
 *   row via the pure `grid.ts` ops, v8 padding semantics), committed
 *   together so they stay one consistent edit;
 * - a per-cell "⋯" popover exposing the DETAILED object form (tone, lead,
 *   highlight — whatever the union's object arm declares) plus a
 *   "Back to plain text" simplifier;
 * - Tab walks cells in DOM order; ⏎ follows the v6 rhythm cell-wise
 *   (`gridEnterAction`): next cell → next row → append a row on the last
 *   filled cell → exit on an empty last row.
 */

import { useEffect, useRef, useState } from 'react';
import type { FieldNode } from '@avodado/core';
import { coerceValue } from '../direct/paths.js';
import type { Ctx, YamlPath } from '../components/FormTab.js';
import { SmartControl } from './controls.js';
import { humanizeFieldName } from '../direct/paths.js';
import { resolveControl } from './fieldKind.js';
import {
  gridAddRow,
  gridColCount,
  gridEnterAction,
  gridInsertColumn,
  gridRemoveColumn,
  gridRemoveRow,
} from './grid.js';
import { toDetailedValue, toSimpleValue, unionObjectArm } from './union.js';

type ObjectNode = Extract<FieldNode, { kind: 'object' }>;
type UnionNode = Extract<FieldNode, { kind: 'union' }>;

function asArray(v: unknown): readonly unknown[] {
  return Array.isArray(v) ? v : [];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** The scalar text shown in a cell/header input for any union value. */
function cellText(value: unknown, arm: ObjectNode | null): string {
  if (isRecord(value)) {
    const simple = arm !== null ? toSimpleValue(value, arm) : '';
    return simple === null || simple === undefined ? '' : String(simple);
  }
  return value === null || value === undefined ? '' : String(value);
}

/**
 * The sibling `columns` field of the grid, when the block declares one at the
 * same level (top-level `rows` next to top-level `columns`).
 */
function columnsSpecFor(
  rootNode: FieldNode,
  path: YamlPath,
): { readonly node: FieldNode } | null {
  if (path.length !== 1 || rootNode.kind !== 'object') return null;
  const f = rootNode.fields.find((x) => x.name === 'columns');
  return f !== undefined && f.node.kind === 'array' ? { node: f.node.element } : null;
}

/** One cell (or header) input: draft locally, commit on blur/⏎, keep detail fields. */
function CellInput({ value, node, arm, gridPos, onCommit }: {
  value: unknown;
  /** The cell's schema node (the union) — drives type-preserving coercion. */
  node: FieldNode | null;
  arm: ObjectNode | null;
  /** `data-grid-cell` coordinate (focus routing). */
  gridPos: string;
  onCommit: (v: unknown) => void;
}): JSX.Element {
  const current = cellText(value, arm);
  const [draft, setDraft] = useState(current);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => setDraft(current), [current]);

  const commit = (): void => {
    if (draft === current) return;
    const c = coerceValue(draft, isRecord(value) ? undefined : value, node);
    if (!c.ok) {
      setInvalid(true);
      return;
    }
    // A detailed cell keeps its detail fields — typing edits just the text.
    if (isRecord(value) && arm !== null) {
      onCommit({ ...toDetailedValue(value, arm), ...toDetailedValue(c.value, arm) });
    } else {
      onCommit(c.value);
    }
  };

  return (
    <input
      className={`stu-input stu-grid-input ${invalid ? 'stu-input-invalid' : ''}`}
      type="text"
      value={draft}
      spellCheck={false}
      data-grid-cell={gridPos}
      onChange={(e) => {
        setDraft(e.target.value);
        setInvalid(false);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          // Commit here; the grid container routes the focus (v6 rhythm).
          commit();
        }
      }}
    />
  );
}

/** Viewport anchor of the button that opened a detail popover. */
interface Anchor {
  readonly left: number;
  readonly top: number;
  readonly bottom: number;
}

const POP_W = 224;
const POP_EST_H = 260;

/**
 * The "⋯" detail popover: the union's object-arm fields over one cell.
 * `position: fixed` (anchored to the opening button's viewport rect) so the
 * grid's own scroll container never clips it; flips above when the viewport
 * runs out below.
 */
function DetailPopover({ title, value, arm, node, ctx, path, anchor, onClose }: {
  title: string;
  value: unknown;
  arm: ObjectNode;
  /** The cell's union node (Simple input coercion inside the popover). */
  node: UnionNode | null;
  ctx: Ctx;
  path: YamlPath;
  anchor: Anchor;
  onClose: () => void;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const detailed = toDetailedValue(value, arm);
  const left = Math.max(8, Math.min(anchor.left - POP_W + 24, window.innerWidth - POP_W - 8));
  const flip = anchor.bottom + POP_EST_H > window.innerHeight - 8 && anchor.top - POP_EST_H > 8;
  const style: React.CSSProperties = flip
    ? { left, bottom: window.innerHeight - anchor.top + 4, top: 'auto' }
    : { left, top: anchor.bottom + 4 };

  useEffect(() => {
    const onDown = (e: PointerEvent): void => {
      const el = ref.current;
      if (el !== null && e.target instanceof Node && !el.contains(e.target)) {
        setTimeout(onClose, 0); // let a focused input blur-commit first
      }
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        const t = e.target instanceof HTMLElement ? e.target : null;
        if (t !== null && t.closest('[data-combo-open="true"]') !== null) return;
        e.stopPropagation();
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="stu-grid-pop"
      style={style}
      role="dialog"
      aria-label={`${title} details`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="stu-grid-pop-title">{title}</div>
      {arm.fields.map((f) => (
        <div key={f.name} className="stu-dx-field">
          <label className="stu-dx-label">{humanizeFieldName(f.name)}</label>
          <SmartControl
            resolved={resolveControl({
              blockKind: ctx.blockKind,
              name: f.name,
              node: f.node,
              value: detailed[f.name],
              data: ctx.rootData,
              path: [...path, f.name],
            })}
            node={f.node}
            value={detailed[f.name]}
            optional={f.node.optional}
            autoFocus={f.name === arm.fields[0]?.name}
            handlers={{
              onCommit: (v) => ctx.commitPath(path, { ...detailed, [f.name]: v }),
              onDelete: () => {
                const next = { ...detailed };
                delete next[f.name];
                ctx.commitPath(path, next);
              },
            }}
          />
        </div>
      ))}
      {node !== null && (
        <button
          type="button"
          className="stu-linkbtn stu-grid-pop-simplify"
          tabIndex={-1}
          onClick={() => {
            ctx.commitPath(path, toSimpleValue(value, arm));
            onClose();
          }}
        >
          Back to plain text
        </button>
      )}
    </div>
  );
}

export function GridField({ path, value, element, ctx }: {
  path: YamlPath;
  /** The rows value (array of arrays). */
  value: unknown;
  /** The INNER array node (one row) — its element is the cell union. */
  element: Extract<FieldNode, { kind: 'array' }>;
  ctx: Ctx;
}): JSX.Element {
  const rows = asArray(value).map((r) => asArray(r));
  const cellNode = element.element;
  const cellUnion = cellNode.kind === 'union' ? cellNode : null;
  const cellArm = cellUnion !== null ? unionObjectArm(cellUnion) : null;

  const colsSpec = columnsSpecFor(ctx.rootNode, path);
  const colNode = colsSpec?.node ?? null;
  const colUnion = colNode !== null && colNode.kind === 'union' ? colNode : null;
  const colArm = colUnion !== null ? unionObjectArm(colUnion) : null;
  const columnsValue =
    colsSpec !== null && isRecord(ctx.rootData) ? ctx.rootData['columns'] : undefined;
  /** Non-null only when the block HAS a header to edit (schema + value). */
  const columns = colsSpec !== null && Array.isArray(columnsValue) ? columnsValue : null;

  const colCount = Math.max(1, gridColCount(columns ?? undefined, rows));
  const rootRef = useRef<HTMLDivElement>(null);
  const [detail, setDetail] = useState<{
    kind: 'cell' | 'col';
    r: number;
    c: number;
    anchor: Anchor;
  } | null>(null);
  const toggleDetail = (
    kind: 'cell' | 'col',
    r: number,
    c: number,
    e: React.MouseEvent<HTMLButtonElement>,
  ): void => {
    if (detail !== null && detail.kind === kind && detail.r === r && detail.c === c) {
      setDetail(null);
      return;
    }
    const b = e.currentTarget.getBoundingClientRect();
    setDetail({ kind, r, c, anchor: { left: b.left, top: b.top, bottom: b.bottom } });
  };
  const [focusCell, setFocusCell] = useState<{ pos: string; n: number } | null>(null);
  const focusSeq = useRef(0);
  const requestCellFocus = (pos: string): void => setFocusCell({ pos, n: ++focusSeq.current });

  useEffect(() => {
    if (focusCell === null) return;
    const t = setTimeout(() => {
      const el = rootRef.current?.querySelector<HTMLElement>(
        `[data-grid-cell="${CSS.escape(focusCell.pos)}"]`,
      );
      if (el !== undefined && el !== null) {
        el.focus();
        if (el instanceof HTMLInputElement) el.select();
      }
    }, 60);
    return () => clearTimeout(t);
  }, [focusCell]);

  /** Column ops commit columns AND rows together (one consistent edit). */
  const commitColumnsResult = (res: { columns: unknown[] | null; rows: unknown[][] }): void => {
    if (colsSpec !== null && res.columns !== null) ctx.commitPath(['columns'], res.columns);
    ctx.commitPath(path, res.rows);
  };

  const addColumn = (): void => {
    commitColumnsResult(gridInsertColumn(columns ?? undefined, rows, colCount));
    requestCellFocus(colsSpec !== null ? `h-${colCount}` : `0-${colCount}`);
  };
  const removeColumn = (c: number): void => {
    setDetail(null);
    commitColumnsResult(gridRemoveColumn(columns ?? undefined, rows, c));
  };
  const addRow = (): void => {
    ctx.commitPath(path, gridAddRow(columns ?? undefined, rows));
    requestCellFocus(`${rows.length}-0`);
  };
  const removeRow = (r: number): void => {
    setDetail(null);
    ctx.commitPath(path, gridRemoveRow(rows, r));
  };

  /** The ⏎ rhythm — runs after the input's own Enter commit (microtask). */
  const onGridKey = (e: React.KeyboardEvent): void => {
    if (e.key !== 'Enter') return;
    const target = e.target as HTMLElement;
    const pos = target.getAttribute('data-grid-cell');
    if (pos === null || pos.startsWith('h-')) return; // headers: ⏎ just commits
    const [rs, cs] = pos.split('-');
    const r = Number(rs);
    const c = Number(cs);
    if (!Number.isInteger(r) || !Number.isInteger(c)) return;
    e.preventDefault();
    window.setTimeout(() => {
      const action = gridEnterAction({ rows, row: r, col: c, colCount });
      if (action.kind === 'advance') {
        requestCellFocus(`${action.row}-${action.col}`);
      } else if (action.kind === 'append') {
        ctx.commitPath(path, gridAddRow(columns ?? undefined, rows));
        requestCellFocus(`${rows.length}-0`);
      } else {
        // exit — drop the untouched row and move past the grid.
        ctx.deletePath([...path, r]);
        ctx.exitArray(path);
      }
    }, 0);
  };

  return (
    <div className="stu-grid" ref={rootRef} onKeyDown={onGridKey}>
      <div className="stu-grid-scroll">
        <table className="stu-grid-table">
          {columns !== null && (
            <thead>
              <tr>
                {Array.from({ length: colCount }, (_, c) => {
                  const col = columns[c];
                  const highlighted = isRecord(col) && col['highlight'] === true;
                  return (
                    <th key={c} className={highlighted ? 'stu-grid-th-hl' : ''}>
                      <div className="stu-grid-cellwrap" data-field-path={`columns.${c}`}>
                        <CellInput
                          value={col}
                          node={colNode}
                          arm={colArm}
                          gridPos={`h-${c}`}
                          onCommit={(v) => ctx.commitPath(['columns', c], v)}
                        />
                        <span className="stu-grid-celltools">
                          {colArm !== null && (
                            <button
                              type="button"
                              className="stu-grid-cellbtn"
                              title="Column details (align, highlight…)"
                              aria-label={`Column ${c + 1} details`}
                              tabIndex={-1}
                              onClick={(e) => toggleDetail('col', -1, c, e)}
                            >
                              ⋯
                            </button>
                          )}
                          <button
                            type="button"
                            className="stu-grid-cellbtn stu-grid-cellbtn-danger"
                            title="Remove column"
                            aria-label={`Remove column ${c + 1}`}
                            tabIndex={-1}
                            onClick={() => removeColumn(c)}
                          >
                            ×
                          </button>
                        </span>
                      </div>
                    </th>
                  );
                })}
                <th className="stu-grid-addcol-th">
                  <button
                    type="button"
                    className="stu-grid-addcol"
                    title="Add column"
                    aria-label="Add column"
                    onClick={addColumn}
                  >
                    ＋
                  </button>
                </th>
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {Array.from({ length: colCount }, (_, c) => {
                  const cell = row[c];
                  const toned = isRecord(cell) && typeof cell['tone'] === 'string';
                  return (
                    <td key={c}>
                      <div
                        className="stu-grid-cellwrap"
                        data-field-path={`${path.join('.')}.${r}.${c}`}
                      >
                        <CellInput
                          value={cell}
                          node={cellNode}
                          arm={cellArm}
                          gridPos={`${r}-${c}`}
                          onCommit={(v) => ctx.commitPath([...path, r, c], v)}
                        />
                        {toned && (
                          <span
                            className={`stu-grid-tonedot stu-grid-tone-${String((cell as Record<string, unknown>)['tone'])}`}
                            aria-hidden="true"
                          />
                        )}
                        {cellArm !== null && (
                          <span className="stu-grid-celltools">
                            <button
                              type="button"
                              className="stu-grid-cellbtn"
                              title="Cell details (tone, highlight…)"
                              aria-label={`Cell ${r + 1}·${c + 1} details`}
                              tabIndex={-1}
                              onClick={(e) => toggleDetail('cell', r, c, e)}
                            >
                              ⋯
                            </button>
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
                <td className="stu-grid-rowtools-td">
                  <button
                    type="button"
                    className="stu-grid-cellbtn stu-grid-cellbtn-danger stu-grid-rowdel"
                    title="Remove row"
                    aria-label={`Remove row ${r + 1}`}
                    tabIndex={-1}
                    onClick={() => removeRow(r)}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="stu-grid-foot">
        <button type="button" className="stu-addbtn stu-grid-addrow" onClick={addRow}>
          + Add row
        </button>
        {columns === null && (
          <button type="button" className="stu-addbtn stu-grid-addrow" onClick={addColumn}>
            + Add column
          </button>
        )}
        {columns === null && colsSpec !== null && rows.length > 0 && (
          <button
            type="button"
            className="stu-addbtn stu-grid-addrow"
            onClick={() => {
              ctx.commitPath(['columns'], Array.from({ length: colCount }, () => ''));
              requestCellFocus('h-0');
            }}
          >
            + Add header row
          </button>
        )}
      </div>
      {detail !== null && detail.kind === 'col' && colArm !== null && (
        <DetailPopover
          title={`Column ${detail.c + 1}`}
          value={(columns ?? [])[detail.c]}
          arm={colArm}
          node={colUnion}
          ctx={ctx}
          path={['columns', detail.c]}
          anchor={detail.anchor}
          onClose={() => setDetail(null)}
        />
      )}
      {detail !== null && detail.kind === 'cell' && cellArm !== null && (
        <DetailPopover
          title={`Row ${detail.r + 1} · Cell ${detail.c + 1}`}
          value={rows[detail.r]?.[detail.c]}
          arm={cellArm}
          node={cellUnion}
          ctx={ctx}
          path={[...path, detail.r, detail.c]}
          anchor={detail.anchor}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
