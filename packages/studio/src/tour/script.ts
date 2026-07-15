/**
 * The interactive tour — pure data + pure state machine. The overlay UI and
 * store glue live in `TourOverlay.tsx` / `state.ts`; everything here is
 * unit-testable:
 *
 * - {@link TOUR_STEPS}: the ~9-step script over the REAL UI. Action steps
 *   advance when the user performs the actual action (insert, field commit,
 *   part select, …) — Next always works as a fallback (the tour never traps);
 * - {@link tourReducer}: idle → running → (interrupted ⇄ running) → finished;
 * - {@link resumeStepFor}: where Resume lands after the user wandered off —
 *   recomputed from what the playground doc actually contains now.
 */

/** A real user action the tour can advance on (emitted by the app's chrome). */
export type TourAction =
  | 'insert'
  | 'field-commit'
  | 'sheet-done'
  | 'part-select'
  | 'part-move'
  | 'micro-close';

export interface TourStep {
  readonly id: string;
  /** CSS selector of the anchor element (spotlit + card beside it). */
  readonly target: string;
  readonly title: string;
  readonly body: string;
  /** The kbd-style hint chips shown under the body. */
  readonly keys?: readonly string[];
  /** Real action that advances the step; null = Next-only. */
  readonly advance: TourAction | null;
  /** The step only makes sense with the Edit Sheet open (break detection). */
  readonly needsSheet?: boolean;
  /** The step needs the inserted block to exist (break detection / resume). */
  readonly needsBlock?: boolean;
}

/** Slug + starter source of the scratch playground doc the tour edits. */
export const TOUR_DOC_SLUG = 'tutorial-playground';
export const TOUR_DOC_SOURCE =
  '```meta\n' +
  'title: Tutorial playground\n' +
  'subtitle: A scratch doc for the studio tour — yours to keep or delete.\n' +
  'tag: TUTORIAL\n' +
  '```\n';

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'welcome',
    target: '[data-tour="topbar"]',
    title: 'Welcome to Avodado Studio',
    body:
      'This is a visual editor over plain Markdown files — every edit you make here rewrites ' +
      'a fenced YAML block in a real file on disk. The files stay the single source of truth; ' +
      'the studio is just a nicer pair of hands. You are in a scratch doc, so play freely.',
    advance: null,
  },
  {
    id: 'insert',
    target: '[data-tour="canvas"]',
    title: 'Insert your first block',
    body:
      'Press / to open the insert menu, type "seq", and hit ⏎ to insert a Sequence diagram. ' +
      'Every one of the 76 block types inserts this way.',
    keys: ['/', 'type seq', '⏎'],
    advance: 'insert',
  },
  {
    id: 'fill',
    target: '.stu-sheet-form',
    title: 'Fill it in — no YAML required',
    body:
      'The sheet is a real form over the block\'s schema. Type a title, then ride the rhythm: ' +
      '⇥ hops fields, ⏎ moves through rows and adds new ones when you run off the end. ' +
      'Commit any field to continue.',
    keys: ['type a title', '⇥ next field', '⏎ next row'],
    advance: 'field-commit',
    needsSheet: true,
  },
  {
    id: 'done',
    target: '.stu-sheet-actions',
    title: 'Done — one clean edit',
    body:
      'Press ⌘⏎ (or click Done). The whole sheet session lands as ONE edit — one undo step, ' +
      'one autosave, one surgical rewrite of the block in your file.',
    keys: ['⌘⏎'],
    advance: 'sheet-done',
    needsSheet: true,
  },
  {
    id: 'part',
    target: '[data-seg="1"]',
    title: 'Click a diagram part',
    body:
      'Diagrams are directly editable. Click any part of the diagram — an actor, an arrow — ' +
      'to select just that part. (⇥ also cycles through parts.)',
    keys: ['click a part', '⇥ cycles'],
    advance: 'part-select',
    needsBlock: true,
  },
  {
    id: 'move',
    target: '[data-seg="1"]',
    title: 'Move it with the arrows',
    body:
      'With a part selected, plain arrow keys move it: list items reorder, grid nodes hop ' +
      'cells, table cells navigate. Try ← or → on your selected part.',
    keys: ['←', '→'],
    advance: 'part-move',
    needsBlock: true,
  },
  {
    id: 'micro',
    target: '[data-seg="1"]',
    title: 'Edit in place, escape out',
    body:
      'Press ⏎ to open the micro-editor for exactly that value — edit it, then Esc to close. ' +
      'Esc always pops out one level: editor → part → block → canvas.',
    keys: ['⏎ edit', 'esc close'],
    advance: 'micro-close',
    needsBlock: true,
  },
  {
    id: 'save',
    target: '[data-tour="save"]',
    title: 'Saving is automatic',
    body:
      'The chip up here tracks the file: Editing… while you type, Saved when the write lands ' +
      '(about a second later). Prefer to review first? Flip Autosave off and ⌘S opens a ' +
      'review of every change before anything touches the disk.',
    keys: ['⌘S'],
    advance: null,
  },
  {
    id: 'finish',
    target: '[data-tour="theme"]',
    title: 'Make it yours',
    body:
      'The theme picker restyles the whole document live. Press ? anytime for every keyboard ' +
      'shortcut, and the README covers the full block catalog. That\'s the tour!',
    keys: ['?'],
    advance: null,
  },
];

/* ─── the state machine ───────────────────────────────────────────────────── */

export interface TourState {
  readonly status: 'idle' | 'running' | 'interrupted' | 'finished';
  /** Current step index (kept through interruption so Resume can return). */
  readonly step: number;
}

export const TOUR_IDLE: TourState = { status: 'idle', step: 0 };

export type TourEvent =
  | { readonly type: 'start' }
  | { readonly type: 'next' }
  | { readonly type: 'back' }
  | { readonly type: 'skip' }
  | { readonly type: 'action'; readonly action: TourAction }
  | { readonly type: 'break' }
  | { readonly type: 'resume'; readonly step: number }
  | { readonly type: 'close' };

/** Advances past `step` — or finishes when it was the last one. */
function advanced(step: number): TourState {
  return step >= TOUR_STEPS.length - 1
    ? { status: 'finished', step: TOUR_STEPS.length - 1 }
    : { status: 'running', step: step + 1 };
}

/**
 * The tour state machine. Notable rules:
 * - `action` only advances while RUNNING and only when it matches the current
 *   step's `advance` (stray actions — the user exploring — are ignored);
 * - `break` (the user wandered off a step's premise) parks the tour in
 *   `interrupted`, keeping the step for Resume;
 * - `skip` works from any active state; `next`/`back` only while running.
 */
export function tourReducer(state: TourState, event: TourEvent): TourState {
  switch (event.type) {
    case 'start':
      return { status: 'running', step: 0 };
    case 'skip':
      return state.status === 'idle' ? state : TOUR_IDLE;
    case 'close':
      return TOUR_IDLE;
    case 'next':
      return state.status === 'running' ? advanced(state.step) : state;
    case 'back':
      return state.status === 'running'
        ? { status: 'running', step: Math.max(0, state.step - 1) }
        : state;
    case 'action': {
      if (state.status !== 'running') return state;
      const step = TOUR_STEPS[state.step];
      return step !== undefined && step.advance === event.action ? advanced(state.step) : state;
    }
    case 'break':
      return state.status === 'running' ? { status: 'interrupted', step: state.step } : state;
    case 'resume':
      return state.status === 'interrupted'
        ? { status: 'running', step: Math.max(0, Math.min(event.step, TOUR_STEPS.length - 1)) }
        : state;
  }
}

/**
 * Where Resume lands, recomputed from the doc's ACTUAL state — the user may
 * have closed the sheet or deleted the block the step assumed:
 * - a sheet step without a sheet falls back to the part steps (block exists)
 *   or all the way to insert;
 * - a block step without the block falls back to insert;
 * - everything else resumes in place.
 */
export function resumeStepFor(args: {
  readonly current: number;
  readonly sheetOpen: boolean;
  readonly hasBlock: boolean;
}): number {
  const step = TOUR_STEPS[args.current];
  if (step === undefined) return 0;
  const insertIndex = TOUR_STEPS.findIndex((s) => s.id === 'insert');
  const partIndex = TOUR_STEPS.findIndex((s) => s.id === 'part');
  if (step.needsSheet === true && !args.sheetOpen) {
    return args.hasBlock ? partIndex : insertIndex;
  }
  if (step.needsBlock === true && !args.hasBlock) return insertIndex;
  return args.current;
}
