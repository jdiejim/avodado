/**
 * `sequenceDiagram` → `sequence` block data.
 *
 * Supported: `participant` / `actor` declarations (with or without `as`),
 * the message arrows (`->>` sync, `-->>` response, `-)` async, `--)`
 * response, `-x` / `--x` error, `->` sync, `-->` response) with the `+` / `-`
 * activation suffix on the target (`activate` / `deactivate` on the message),
 * `Note over A,B` / `Note right of A` / `Note left of A` (a `note` message),
 * `title`, and the combined fragments `alt` / `opt` / `loop` / `par` /
 * `critical` / `break` … `end` with their `else` / `and` / `option`
 * branches (frame markers in `messages`). `rect` and `box` … `end` are
 * dropped with their own `end`. `autonumber` and standalone `activate` /
 * `deactivate` lines are dropped. Undeclared actors are added in first-use
 * order, as Mermaid does.
 */

import { bodyLines, fail, startsWithWord, type MermaidResult } from './lines.js';

/** Longest arrows first so `-->>` never matches as `-` + `->>`. */
const MESSAGE_RE = /^(.+?)\s*(-->>|->>|--x|-x|--\)|-\)|-->|->)\s*([+-]?)\s*(.+?)\s*:\s*(.*)$/;
const NOTE_RE = /^[Nn]ote\s+(over|right of|left of)\s+([^:]+?)\s*:\s*(.*)$/;
const PARTICIPANT_RE = /^(participant|actor)\s+(.+?)(?:\s+as\s+(.+))?$/;

const ARROW_KIND: Readonly<Record<string, 'response' | 'async' | 'error' | undefined>> = {
  '->>': undefined,
  '->': undefined,
  '-->>': 'response',
  '-->': 'response',
  '--)': 'response',
  '-)': 'async',
  '-x': 'error',
  '--x': 'error',
};

/** Mermaid fragment keyword → the `frame` kind it opens. */
const FRAME_OPEN: Readonly<Record<string, string>> = {
  alt: 'alt',
  opt: 'opt',
  loop: 'loop',
  par: 'par',
  critical: 'critical',
  break: 'break',
};

/** Keywords that start the next branch of the open fragment. */
const FRAME_ELSE = ['else', 'and', 'option'];

/** Framing that has no block equivalent — dropped together with its `end`. */
const DROPPED_FRAMES = ['rect', 'box'];

const SKIP_WORDS = ['autonumber', 'activate', 'deactivate', 'link', 'links', 'properties', 'details'];

/** The rest of the line after its leading keyword, trimmed. */
function afterWord(text: string, word: string): string {
  return text.slice(word.length).trim();
}

export function convertSequence(text: string): MermaidResult {
  const lines = bodyLines(text);
  const actors = new Map<string, { id: string; name: string }>();
  const messages: Record<string, unknown>[] = [];
  let title: string | undefined;
  // Open framing, innermost last: a real frame (emitted) or a dropped one
  // (`rect` / `box`), so each `end` consumes the right opener.
  const stack: Array<'frame' | 'dropped'> = [];

  const touch = (id: string): void => {
    if (!actors.has(id)) actors.set(id, { id, name: id });
  };

  for (const { text: t, line } of lines) {
    if (line === lines[0]?.line && startsWithWord(t, 'sequenceDiagram')) continue;
    if (SKIP_WORDS.some((w) => startsWithWord(t, w))) continue;
    if (startsWithWord(t, 'title')) {
      title = t.slice('title'.length).replace(/^\s*:?\s*/, '').trim();
      continue;
    }

    const opener = Object.keys(FRAME_OPEN).find((w) => startsWithWord(t, w));
    if (opener !== undefined) {
      const label = afterWord(t, opener);
      messages.push({ frame: FRAME_OPEN[opener], ...(label.length > 0 ? { label } : {}) });
      stack.push('frame');
      continue;
    }
    if (DROPPED_FRAMES.some((w) => startsWithWord(t, w))) {
      stack.push('dropped');
      continue;
    }
    const elseWord = FRAME_ELSE.find((w) => startsWithWord(t, w));
    if (elseWord !== undefined) {
      if (stack[stack.length - 1] === 'frame') messages.push({ else: afterWord(t, elseWord) });
      continue;
    }
    if (startsWithWord(t, 'end')) {
      if (stack.pop() === 'frame') messages.push({ end: true });
      continue;
    }

    const p = PARTICIPANT_RE.exec(t);
    if (p !== null) {
      const id = (p[2] ?? '').trim();
      const name = (p[3] ?? id).trim();
      // `Map.set` keeps the first-appearance order for an already-used id.
      actors.set(id, { id, name });
      continue;
    }

    const n = NOTE_RE.exec(t);
    if (n !== null) {
      const targets = (n[2] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const from = targets[0];
      if (from === undefined) return fail('note needs an actor', line);
      const to = targets[1] ?? from;
      touch(from);
      if (to !== from) touch(to);
      messages.push({ from, to, label: (n[3] ?? '').trim(), kind: 'note' });
      continue;
    }

    const m = MESSAGE_RE.exec(t);
    if (m !== null) {
      const from = (m[1] ?? '').trim();
      const arrow = m[2] ?? '';
      const sign = m[3] ?? '';
      const to = (m[4] ?? '').trim();
      const label = (m[5] ?? '').trim();
      touch(from);
      touch(to);
      const kind = ARROW_KIND[arrow];
      messages.push({
        from,
        to,
        ...(label.length > 0 ? { label } : {}),
        ...(kind !== undefined ? { kind } : {}),
        ...(sign === '+' ? { activate: true } : {}),
        ...(sign === '-' ? { deactivate: true } : {}),
      });
      continue;
    }

    return fail(
      `cannot read sequenceDiagram line: "${t}" (expected a participant, a message like \`A->>B: text\`, a Note, or a fragment like \`alt text\` … \`end\`)`,
      line,
    );
  }

  return {
    ok: true,
    data: {
      ...(title !== undefined && title.length > 0 ? { title } : {}),
      ...(actors.size > 0 ? { actors: [...actors.values()] } : {}),
      ...(messages.length > 0 ? { messages } : {}),
    },
  };
}
