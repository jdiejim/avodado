/**
 * The studio's single zustand store.
 *
 * The source string is the canonical client-side state — every mutation goes
 * through {@link StudioState.applyOp}, which runs a pure edit op from
 * `@avodado/core` against the CURRENT source + its parsed document, pushes an
 * undo snapshot, and schedules autosave. Derived views (parsed doc,
 * diagnostics, rendered HTML) live in `derive.ts`, memoised outside React.
 *
 * Sync rules for SSE events are pure functions in `sync.ts`; this module only
 * wires their decisions to fetches and state.
 */

import { create } from 'zustand';
import {
  DOC_TEMPLATES,
  moveSegment,
  parseDocument,
  replaceBlockBody,
  type Document,
} from '@avodado/core';
import { DEFAULT_THEME, type ThemeName } from '@avodado/render';
import {
  fetchDoc,
  fetchDocs,
  fetchMeta,
  saveDoc,
  type DocListItem,
  type SaveConflict,
  type StudioMeta,
} from '../api/client.js';
import { importDoc } from '../api/client.js';
import { readShareUrl } from '../lib/shareLink.js';
import type { ServerEvent } from '../api/events.js';
import { firstContentIndex } from '../lib/docTemplates.js';
import { derive, diskChoice, resolveChoice, sameDiskTheme } from './derive.js';
import { canMoveSegment, decideFsEvent, versionChanged } from './sync.js';

/** An edit operation: pure `(source, doc) → newSource`. May throw Range/TypeError. */
export type EditOp = (source: string, doc: Document) => string;

/** A transient toast message. */
export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly tone: 'error' | 'info';
}

const UNDO_CAP = 100;
const AUTOSAVE_MS = 800;

/** The studio's three surfaces: editing canvas, built-site preview, deck. */
export type StudioMode = 'home' | 'edit' | 'present';

/** The insert picker while open: which face, where it inserts, where it sits. */
export interface PickerOpenState {
  /** Compact popover (gap '+' / slash) or the expanded browse gallery. */
  readonly view: 'compact' | 'browse';
  /** Gap index the insert lands at; `null` = after selection, else doc end. */
  readonly index: number | null;
  /** Viewport point the compact popover anchors to; `null` = centered. */
  readonly anchor: { readonly x: number; readonly y: number } | null;
}

/** Starter source for a brand-new doc. */
export function newDocTemplate(slug: string): string {
  const title = (slug.split('/').pop() ?? slug)
    .replace(/[-_]+/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
  return `\`\`\`meta\ntitle: ${title}\nsubtitle: One-line description.\ntag: DRAFT\n\`\`\`\n`;
}

export interface StudioState {
  meta: StudioMeta | null;
  docs: readonly DocListItem[];
  currentSlug: string | null;
  source: string;
  /**
   * The last SAVED source — the review dialog's diff baseline. Tracks
   * `baseHash`: set on openDoc/newDoc, save success, silent refetch, and
   * adopting "theirs" in a conflict.
   */
  savedSource: string;
  baseHash: string | null;
  dirty: boolean;
  saving: boolean;
  savedAt: number | null;
  autosave: boolean;
  /**
   * Review-before-write: non-null while the review dialog is open. `'save'`
   * came from an explicit save with autosave OFF; `'enable-autosave'` from
   * flipping autosave back ON while dirty (the toggle only commits on Apply).
   */
  review: 'save' | 'enable-autosave' | null;
  /**
   * A pending destructive delete awaiting its anchored confirm popover.
   * `run` performs the deletion (an applyOp closure owned by the trigger
   * site); `anchor` is a viewport point the popover attaches to.
   */
  pendingDelete: {
    readonly label: string;
    readonly anchor: { readonly x: number; readonly y: number };
    readonly run: () => void;
  } | null;
  /**
   * A pending OpenAPI import awaiting its confirm dialog (slug input).
   * `create` builds + opens the doc for the confirmed slug; owned by the
   * import flow in `lib/importActions.ts`.
   */
  pendingImport: {
    readonly title: string;
    readonly defaultSlug: string;
    readonly create: (slug: string) => void;
  } | null;
  /**
   * Which surface fills the area under the top bar: the Home doc grid, the
   * editing canvas, or the current doc as a slide deck (Present). The built
   * site opens in its own browser tab (`/site/…`) — it is a website, not a
   * mode. Edit state (source, selection, undo) survives mode switches.
   */
  mode: StudioMode;
  selection: number | null;
  /**
   * Part selection — one `data-bp` part of the selected block (a level
   * between block selection and the micro-editor). Cleared whenever the block
   * selection changes, a doc opens, the sheet opens, or history moves.
   */
  partSel: { readonly seg: number; readonly path: string } | null;
  /**
   * The theme PICKER's value: a built-in name, `saved:<slug>` (an installed
   * theme), or `custom` (the project's avodado.theme.json). Session-local
   * preview only — a disk change always resyncs it (disk is truth).
   */
  themeChoice: string;
  /** Resolved base theme of {@link themeChoice} — what rendering consumes. */
  theme: ThemeName;
  /** Resolved CSS-variable overrides of {@link themeChoice}. */
  themeVars: Readonly<Record<string, string>> | undefined;
  conflict: SaveConflict | null;
  undoStack: readonly string[];
  redoStack: readonly string[];
  toasts: readonly Toast[];
  /** Segment index open in the Edit Sheet, or `null`. */
  sheet: number | null;
  /** True once the sheet's draft diverged from the block's raw. */
  sheetDirty: boolean;
  /** True while the sheet edits a JUST-INSERTED block (keyboard-first mode). */
  sheetFresh: boolean;
  /**
   * Top-level YAML field the sheet should reveal (expand/scroll/flash/focus)
   * when it opens — set by the check popover's "Open field →", consumed (and
   * cleared) by the sheet on mount.
   */
  sheetReveal: string | null;
  /** Segment index for the "press / for the next block" affordance, or null. */
  slashHintAt: number | null;
  /**
   * The unified insert picker's open state, or `null` while closed. Browse
   * view is an OVERLAY, not a mode — it can open over Edit/Present alike;
   * only inserting from it requires (and switches back to) Edit.
   */
  picker: PickerOpenState | null;
  /** Live drag payload (HTML5 dataTransfer is unreadable during dragover). */
  dragging: { kind: 'move'; from: number } | null;
  loaded: boolean;
  /** The studio server version this tab was loaded against. */
  initialVersion: string | null;
  /** True once the server reports a NEWER version — this tab is stale. */
  updateAvailable: boolean;

  init: () => Promise<void>;
  refreshDocs: () => Promise<void>;
  openDoc: (slug: string) => Promise<void>;
  /**
   * Creates a doc via the PUT path. `source` overrides the blank starter
   * (the template picker passes a DOC_TEMPLATES body); the new doc opens
   * with its first content block selected and the Edit Sheet open.
   */
  newDoc: (slug: string, source?: string) => Promise<void>;
  applyOp: (op: EditOp, select?: number | null) => boolean;
  /**
   * Moves segment `from` to gap `to`, guarded: the meta cover never moves and
   * nothing moves above it ({@link canMoveSegment}). Silently no-ops on a
   * disallowed move.
   */
  moveBlock: (from: number, to: number) => boolean;
  /** Refetches `/api/meta` and flags `updateAvailable` on a version change. */
  checkVersion: () => Promise<void>;
  /**
   * Switches the mode. Transient edit chrome closes through its cancel paths
   * (the sheet is a draft, review/delete just dismiss) — no data loss, and no
   * modal can linger over a non-edit surface.
   */
  setMode: (mode: StudioMode) => void;
  select: (i: number | null) => void;
  setPartSel: (sel: StudioState['partSel']) => void;
  /**
   * Saves the doc. With autosave ON (or `force`) this writes immediately —
   * today's behaviour. With autosave OFF and a dirty doc it opens the review
   * dialog instead; nothing hits the disk until {@link applyReview}.
   */
  save: (force?: boolean) => Promise<void>;
  /** Review dialog "Apply": writes via the normal save path (409s intact). */
  applyReview: () => Promise<void>;
  /** Review dialog "Cancel": stays dirty, nothing written. */
  cancelReview: () => void;
  /** Arms the delete-confirm popover for a destructive delete. */
  requestDelete: (req: NonNullable<StudioState['pendingDelete']>) => void;
  /** Confirms the pending delete: runs its op and closes the popover. */
  confirmDelete: () => void;
  /** Dismisses the pending delete without touching the doc. */
  cancelDelete: () => void;
  /** Arms the OpenAPI-import confirm dialog. */
  requestImport: (req: NonNullable<StudioState['pendingImport']>) => void;
  /** Confirms the pending import: creates the doc under `slug` and closes. */
  confirmImport: (slug: string) => void;
  /** Dismisses the pending import without creating anything. */
  cancelImport: () => void;
  undo: () => void;
  redo: () => void;
  resolveConflict: (choice: 'theirs' | 'mine') => void;
  /**
   * Picks a theme in the UI — a session-local preview ({@link themeChoice}).
   * It never writes avodado.theme.json, and any disk change resyncs over it.
   * (A possible follow-up: write the choice back through the file bridge so
   * the picker and `avo theme` are the same control.)
   */
  setTheme: (choice: string) => void;
  /**
   * Live-preview arbitrary theme vars over a base (the Theme Generator), without
   * touching {@link themeChoice} — so cancelling can restore it via `setTheme`.
   */
  previewTheme: (theme: ThemeName, themeVars: Readonly<Record<string, string>> | undefined) => void;
  /** After a theme file is written on disk, refetch meta and activate it. */
  applySavedTheme: (slug: string) => Promise<void>;
  setAutosave: (on: boolean) => void;
  /**
   * Opens the sheet; `fresh` marks a just-inserted block (arrays pre-open);
   * `revealField` asks the sheet to reveal that top-level YAML field.
   */
  openSheet: (index: number, fresh?: boolean, revealField?: string) => void;
  /** Closes without committing; `showSlashHint` keeps the "/ next" affordance. */
  closeSheet: (showSlashHint?: boolean) => void;
  setSheetDirty: (dirty: boolean) => void;
  dismissSlashHint: () => void;
  /**
   * Opens the insert picker. Transient edit chrome closes through its cancel
   * paths first (sheet draft discarded, review/delete/import dismissed) —
   * the picker never stacks over another dialog. `index` pins the gap the
   * insert lands at (a gap '+' passes its index); `null` means "after the
   * selection, else at the doc end", resolved at pick time. `anchor` places
   * the compact popover at a viewport point; `null` centers it.
   */
  openPicker: (opts?: {
    readonly view?: 'compact' | 'browse';
    readonly index?: number | null;
    readonly anchor?: { readonly x: number; readonly y: number } | null;
  }) => void;
  closePicker: () => void;
  /** Compact → browse in place ("Browse all blocks"); keeps the pinned index. */
  expandPicker: () => void;
  /** The top bar's Library entry: the picker, straight into browse view. */
  openLibrary: () => void;
  /**
   * Commits an Edit-Sheet draft: ONE applyOp (one undo step, one autosave)
   * replacing the sheet block's YAML body, then closes the sheet.
   */
  commitSheet: (raw: string) => boolean;
  setDragging: (d: StudioState['dragging']) => void;
  handleServerEvent: (ev: ServerEvent) => void;
  toast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
}

let toastSeq = 0;
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

export const useStudio = create<StudioState>()((set, get) => {
  const scheduleAutosave = (): void => {
    if (autosaveTimer !== null) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null;
      const s = get();
      if (s.autosave && s.dirty && s.conflict === null && !s.saving) void s.save();
    }, AUTOSAVE_MS);
  };

  const setSourceEdited = (next: string, select?: number | null): void => {
    const s = get();
    set({
      undoStack: [...s.undoStack.slice(-(UNDO_CAP - 1)), s.source],
      redoStack: [],
      source: next,
      dirty: true,
      ...(select !== undefined ? { selection: select } : {}),
    });
    scheduleAutosave();
  };

  /** The actual write — `save()` routes here directly or via the review. */
  const doSave = async (force = false): Promise<void> => {
    const s = get();
    if (s.currentSlug === null || s.saving) return;
    const slug = s.currentSlug;
    const snapshot = s.source;
    set({ saving: true });
    try {
      const result = await saveDoc(slug, snapshot, s.baseHash ?? undefined, force);
      if (get().currentSlug !== slug) return; // user switched docs mid-flight
      if (result.ok) {
        set({
          baseHash: result.hash,
          savedSource: snapshot,
          savedAt: Date.now(),
          dirty: get().source !== snapshot,
          conflict: null,
        });
        void get().refreshDocs();
      } else {
        set({ conflict: result.conflict });
      }
    } catch (err) {
      get().toast(`Save failed: ${(err as Error).message}`, 'error');
    } finally {
      set({ saving: false });
    }
  };

  return {
    meta: null,
    docs: [],
    currentSlug: null,
    source: '',
    savedSource: '',
    baseHash: null,
    dirty: false,
    saving: false,
    savedAt: null,
    autosave: true,
    review: null,
    pendingDelete: null,
    pendingImport: null,
    mode: 'home',
    selection: null,
    partSel: null,
    themeChoice: DEFAULT_THEME,
    theme: DEFAULT_THEME,
    themeVars: undefined,
    conflict: null,
    undoStack: [],
    redoStack: [],
    toasts: [],
    sheet: null,
    sheetDirty: false,
    sheetFresh: false,
    sheetReveal: null,
    slashHintAt: null,
    picker: null,
    dragging: null,
    loaded: false,
    initialVersion: null,
    updateAvailable: false,

    init: async () => {
      try {
        // A share link brings its own document: import it before listing, so
        // the studio opens on what the link was sent for.
        let shared: string | null = null;
        let sharedMode: StudioMode | null = null;
        try {
          const link = await readShareUrl(window.location.href);
          if (link !== null) {
            shared = await importDoc(link.source, link.title ?? 'shared');
            // Drop the payload from the address bar — it has been stored, and
            // a multi-kilobyte URL left in history helps nobody.
            window.history.replaceState(null, '', window.location.pathname);
            // A link was sent for a document, so land on it rather than on the
            // library — `?present=1` opens straight into the deck. The mode is
            // applied after the document opens; present mode with nothing open
            // is an empty deck.
            sharedMode = link.present ? 'present' : 'edit';
          }
          /**
           * `?template=adr` opens straight into that template, already filled
           * in — the templates gallery links here, so a reader lands in a
           * finished document with no picker in between. A share link wins if
           * both are present: it carries a real document, and a template is
           * only ever a starting point.
           */
          const wanted =
            shared === null
              ? new URLSearchParams(window.location.search).get('template')
              : null;
          if (wanted !== null && wanted !== '') {
            const source = DOC_TEMPLATES[wanted];
            if (source === undefined) {
              get().toast(`There is no “${wanted}” template.`, 'error');
            } else {
              shared = await importDoc(source, wanted);
              window.history.replaceState(null, '', window.location.pathname);
              sharedMode = 'edit';
            }
          }
        } catch (err) {
          get().toast(`That link could not be opened: ${(err as Error).message}`, 'error');
        }

        const [meta, docs] = await Promise.all([fetchMeta(), fetchDocs()]);
        const choice = diskChoice(meta);
        const resolved = resolveChoice(choice, meta);
        set({
          meta,
          docs,
          themeChoice: choice,
          theme: resolved.theme,
          themeVars: resolved.themeVars,
          loaded: true,
          initialVersion: meta.version,
        });
        const first = docs[0];
        const open = shared ?? (get().currentSlug === null ? first?.slug : undefined);
        if (open !== undefined) await get().openDoc(open);
        if (sharedMode !== null) set({ mode: sharedMode });
      } catch (err) {
        set({ loaded: true });
        get().toast(`Could not reach the studio server: ${(err as Error).message}`, 'error');
      }
    },

    refreshDocs: async () => {
      try {
        set({ docs: await fetchDocs() });
      } catch {
        /* transient — the SSE stream will trigger another refresh */
      }
    },

    openDoc: async (slug) => {
      try {
        const payload = await fetchDoc(slug);
        set({
          currentSlug: slug,
          source: payload.source,
          savedSource: payload.source,
          baseHash: payload.hash,
          dirty: false,
          selection: null,
          partSel: null,
          sheet: null,
          sheetDirty: false,
          conflict: null,
          review: null,
          pendingDelete: null,
          pendingImport: null,
          undoStack: [],
          redoStack: [],
        });
      } catch (err) {
        get().toast(`Could not open ${slug}: ${(err as Error).message}`, 'error');
      }
    },

    newDoc: async (slug, templateSource) => {
      try {
        const source = templateSource ?? newDocTemplate(slug);
        const result = await saveDoc(slug, source); // no baseHash → create
        if (!result.ok) {
          get().toast(`A doc named "${slug}" already exists.`, 'error');
          return;
        }
        await get().refreshDocs();
        set({
          currentSlug: slug,
          source,
          savedSource: source,
          baseHash: result.hash,
          dirty: false,
          selection: null,
          partSel: null,
          sheet: null,
          sheetDirty: false,
          conflict: null,
          review: null,
          pendingDelete: null,
          pendingImport: null,
          undoStack: [],
          redoStack: [],
          savedAt: Date.now(),
        });
        // Fast path: land straight in "fill it out" mode — the cover editor
        // for a blank doc (Title focused; ⌘⏎ drops back on the canvas ready
        // for `/`), or the FIRST content block for a template so Tab/Enter
        // walks the author through every section.
        get().openSheet(firstContentIndex(source, slug), true);
      } catch (err) {
        get().toast(`Could not create ${slug}: ${(err as Error).message}`, 'error');
      }
    },

    applyOp: (op, select) => {
      const s = get();
      if (s.currentSlug === null) return false;
      try {
        const { doc } = derive(s.source, s.currentSlug, s.theme, s.themeVars);
        const next = op(s.source, doc);
        setSourceEdited(next, select);
        return true;
      } catch (err) {
        get().toast(`Edit failed: ${(err as Error).message}`, 'error');
        return false;
      }
    },

    moveBlock: (from, to) => {
      const s = get();
      if (s.currentSlug === null) return false;
      const { doc } = derive(s.source, s.currentSlug, s.theme, s.themeVars);
      if (!canMoveSegment(doc.segments.map((seg) => seg.kind), from, to)) return false;
      return s.applyOp((src, d) => moveSegment(src, d, from, to), to <= from ? to : to - 1);
    },

    checkVersion: async () => {
      const baseline = get().initialVersion;
      if (baseline === null || get().updateAvailable) return;
      try {
        const meta = await fetchMeta();
        if (versionChanged(baseline, meta.version)) set({ updateAvailable: true });
      } catch {
        /* server unreachable — the SSE layer surfaces that separately */
      }
    },

    setMode: (mode) => {
      const s = get();
      if (mode === s.mode) return;
      set({
        mode,
        // Close transient chrome via its cancel semantics: the sheet draft is
        // discarded (same as Esc), the review stays-dirty-nothing-written,
        // the delete popover dismisses. Part selection belongs to the canvas.
        ...(s.sheet !== null ? { sheet: null, sheetDirty: false, sheetFresh: false } : {}),
        ...(s.review !== null ? { review: null } : {}),
        ...(s.pendingDelete !== null ? { pendingDelete: null } : {}),
        ...(s.pendingImport !== null ? { pendingImport: null } : {}),
        ...(mode !== 'edit' ? { partSel: null } : {}),
      });
    },

    select: (i) =>
      set({
        selection: i,
        // A DIFFERENT block (or deselect) drops the part selection; re-clicks
        // inside the same block keep it (the click may be what set it).
        ...(i !== get().selection ? { partSel: null } : {}),
        ...(i !== get().slashHintAt ? { slashHintAt: null } : {}),
      }),

    setPartSel: (sel) => set({ partSel: sel }),

    save: async (force = false) => {
      const s = get();
      if (s.currentSlug === null || s.saving) return;
      // Review-before-write: with autosave OFF, a dirty save shows what would
      // change instead of writing. Forced saves (conflict "keep mine") and
      // clean saves keep today's instant path.
      if (!force && !s.autosave && s.dirty) {
        set({ review: 'save' });
        return;
      }
      await doSave(force);
    },

    applyReview: async () => {
      const intent = get().review;
      if (intent === null) return;
      set({ review: null });
      await doSave();
      // The autosave toggle only commits once its pending write is applied.
      if (intent === 'enable-autosave') set({ autosave: true });
    },

    cancelReview: () => set({ review: null }),

    requestDelete: (req) => set({ pendingDelete: req }),

    confirmDelete: () => {
      const p = get().pendingDelete;
      if (p === null) return;
      set({ pendingDelete: null });
      p.run();
    },

    cancelDelete: () => set({ pendingDelete: null }),

    requestImport: (req) => set({ pendingImport: req }),

    confirmImport: (slug) => {
      const p = get().pendingImport;
      if (p === null) return;
      set({ pendingImport: null });
      p.create(slug);
    },

    cancelImport: () => set({ pendingImport: null }),

    undo: () => {
      const s = get();
      const prev = s.undoStack[s.undoStack.length - 1];
      if (prev === undefined) return;
      set({
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, s.source],
        source: prev,
        dirty: true,
        selection: null,
        partSel: null,
      });
      scheduleAutosave();
    },

    redo: () => {
      const s = get();
      const next = s.redoStack[s.redoStack.length - 1];
      if (next === undefined) return;
      set({
        redoStack: s.redoStack.slice(0, -1),
        undoStack: [...s.undoStack.slice(-(UNDO_CAP - 1)), s.source],
        source: next,
        dirty: true,
        selection: null,
        partSel: null,
      });
      scheduleAutosave();
    },

    resolveConflict: (choice) => {
      const s = get();
      if (s.conflict === null) return;
      if (choice === 'theirs') {
        set({
          undoStack: [...s.undoStack.slice(-(UNDO_CAP - 1)), s.source],
          redoStack: [],
          source: s.conflict.currentSource,
          savedSource: s.conflict.currentSource,
          baseHash: s.conflict.currentHash,
          dirty: false,
          conflict: null,
          selection: null,
          partSel: null,
        });
      } else {
        set({ conflict: null });
        void get().save(true);
      }
    },

    setTheme: (choice) => {
      const resolved = resolveChoice(choice, get().meta);
      set({ themeChoice: choice, theme: resolved.theme, themeVars: resolved.themeVars });
    },

    previewTheme: (theme, themeVars) => set({ theme, themeVars }),

    applySavedTheme: async (slug) => {
      const meta = await fetchMeta();
      set({ meta });
      get().setTheme(`saved:${slug}`);
    },
    setAutosave: (on) => {
      // Flipping autosave back ON while dirty would immediately (and
      // silently) write the pending edits — route that through the review
      // too. The toggle itself only commits when the user applies.
      if (on && get().dirty && get().conflict === null) {
        set({ review: 'enable-autosave' });
        return;
      }
      set({ autosave: on });
      if (on) scheduleAutosave();
    },
    setDragging: (d) => set({ dragging: d }),

    openSheet: (index, fresh = false, revealField) =>
      set({
        sheet: index,
        sheetDirty: false,
        sheetFresh: fresh,
        sheetReveal: revealField ?? null,
        selection: index,
        partSel: null,
        slashHintAt: null,
      }),
    closeSheet: (showSlashHint = false) => {
      const index = get().sheet;
      set({
        sheet: null,
        sheetDirty: false,
        sheetFresh: false,
        sheetReveal: null,
        slashHintAt: showSlashHint && index !== null ? index : null,
      });
    },
    setSheetDirty: (dirty) => set({ sheetDirty: dirty }),
    dismissSlashHint: () => set({ slashHintAt: null }),

    openPicker: (opts = {}) => {
      const s = get();
      set({
        picker: {
          view: opts.view ?? 'compact',
          index: opts.index ?? null,
          anchor: opts.anchor ?? null,
        },
        // Same cancel semantics as setMode: the sheet draft is discarded, the
        // review stays-dirty-nothing-written, delete/import just dismiss.
        ...(s.sheet !== null ? { sheet: null, sheetDirty: false, sheetFresh: false } : {}),
        ...(s.review !== null ? { review: null } : {}),
        ...(s.pendingDelete !== null ? { pendingDelete: null } : {}),
        ...(s.pendingImport !== null ? { pendingImport: null } : {}),
      });
    },
    closePicker: () => set({ picker: null }),
    expandPicker: () => {
      const p = get().picker;
      if (p !== null && p.view === 'compact') set({ picker: { ...p, view: 'browse', anchor: null } });
    },
    openLibrary: () => get().openPicker({ view: 'browse' }),

    commitSheet: (raw) => {
      const s = get();
      const index = s.sheet;
      if (index === null) return false;
      const ok = s.applyOp((src, d) => {
        const seg = d.segments[index];
        if (seg === undefined || seg.kind === 'markdown') {
          throw new TypeError('the sheet block is gone — the doc changed under it');
        }
        return seg.raw === raw ? src : replaceBlockBody(src, d, index, raw);
      }, index);
      // Done lands back on the canvas with the block selected and the
      // "press / for the next block" affordance armed.
      if (ok) set({ sheet: null, sheetDirty: false, sheetFresh: false, slashHintAt: index });
      return ok;
    },

    handleServerEvent: (ev) => {
      if (ev.type === 'meta') {
        void fetchMeta().then((meta) => {
          const s = get();
          // Disk is truth: when the CONFIGURED theme changed on disk, the
          // picker resyncs to it, overriding any session-local preview. A
          // meta event that didn't change the disk theme (e.g. a config
          // tweak) keeps the user's choice, re-resolved against fresh meta
          // (an installed theme's vars may have been edited).
          const diskMoved = !sameDiskTheme(s.meta, meta);
          const choice = diskMoved ? diskChoice(meta) : s.themeChoice;
          const resolved = resolveChoice(choice, meta);
          const repainted =
            resolved.theme !== s.theme ||
            JSON.stringify(resolved.themeVars ?? null) !== JSON.stringify(s.themeVars ?? null);
          set({
            meta,
            themeChoice: choice,
            theme: resolved.theme,
            themeVars: resolved.themeVars,
            ...(versionChanged(s.initialVersion, meta.version) ? { updateAvailable: true } : {}),
          });
          if (diskMoved && repainted) s.toast('Theme changed on disk — applied');
        });
        return;
      }
      const s = get();
      const decision = decideFsEvent(ev, {
        currentSlug: s.currentSlug,
        baseHash: s.baseHash,
        dirty: s.dirty,
      });
      // The doc list is cheap to refresh and every fs event can change it
      // (titles, mtimes, new/removed files).
      void s.refreshDocs();
      if (decision === 'ignore-echo' || decision === 'refresh-list') return;
      const slug = s.currentSlug;
      if (slug === null) return;
      if (decision === 'silent-refetch' || decision === 'refetch-all') {
        // A dirty Edit-Sheet draft holds the document hostage: keep our (now
        // stale) base and let Done's save 409 into the conflict flow instead
        // of clobbering the canvas mid-edit.
        if (s.sheet !== null && s.sheetDirty) return;
        void fetchDoc(slug).then((payload) => {
          const cur = get();
          if (cur.currentSlug !== slug) return;
          if (cur.dirty) return; // an edit landed while fetching — don't clobber
          if (payload.hash === cur.baseHash) return;
          const keep = cur.selection;
          const segCount = parseDocument(payload.source, slug).segments.length;
          set({
            source: payload.source,
            savedSource: payload.source,
            baseHash: payload.hash,
            dirty: false,
            selection: keep !== null && keep < segCount ? keep : null,
          });
        });
        return;
      }
      // conflict — fetch the winning content so the banner can offer it.
      void fetchDoc(slug).then((payload) => {
        const cur = get();
        if (cur.currentSlug !== slug) return;
        if (payload.hash === cur.baseHash) return; // raced our own save echo
        set({ conflict: { currentHash: payload.hash, currentSource: payload.source } });
      });
    },

    toast: (message, tone = 'info') => {
      const id = ++toastSeq;
      set({ toasts: [...get().toasts, { id, message, tone }] });
      setTimeout(() => get().dismissToast(id), 5000);
    },

    dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  };
});

/** Convenience: the derived views for the store's current state. */
export function useDerived(): ReturnType<typeof derive> {
  const source = useStudio((s) => s.source);
  const slug = useStudio((s) => s.currentSlug) ?? 'untitled';
  const theme = useStudio((s) => s.theme);
  const themeVars = useStudio((s) => s.themeVars);
  return derive(source, slug, theme, themeVars);
}
