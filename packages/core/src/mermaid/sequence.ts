/**
 * `sequenceDiagram` → `sequence` block data.
 *
 * Supported: `participant` / `actor` declarations (with or without `as`),
 * the message arrows (`->>` sync, `-->>` response, `-)` async, `--)`
 * response, `-x` / `--x` error, `->` sync, `-->` response), `Note over A,B`
 * / `Note right of A` / `Note left of A` (a `note` message), and `title`.
 * Framing (`alt` / `else` / `opt` / `loop` / `par` / `and` / `critical` /
 * `option` / `break` / `rect` / `box` / `end`), `autonumber`, `activate` /
 * `deactivate` and `+` / `-` activation suffixes are dropped. Undeclared
 * actors are added in first-use order, as Mermaid does.
 */

import { bodyLines, fail, startsWithWord, type MermaidResult } from './lines.js';

/** Longest arrows first so `-->>` never matches as `-` + `->>`. */
const MESSAGE_RE = /^(.+?)\s*(-->>|->>|--x|-x|--\)|-\)|-->|->)\s*[+-]?\s*(.+?)\s*:\s*(.*)$/;
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

const SKIP_WORDS = [
  'autonumber',
  'activate',
  'deactivate',
  'alt',
  'else',
  'opt',
  'loop',
  'par',
  'and',
  'critical',
  'option',
  'break',
  'rect',
  'box',
  'end',
  'link',
  'links',
  'properties',
  'details',
];

export function convertSequence(text: string): MermaidResult {
  const lines = bodyLines(text);
  const actors = new Map<string, { id: string; name: string }>();
  const messages: Record<string, unknown>[] = [];
  let title: string | undefined;

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
      const to = (m[3] ?? '').trim();
      const label = (m[4] ?? '').trim();
      touch(from);
      touch(to);
      const kind = ARROW_KIND[arrow];
      messages.push({
        from,
        to,
        ...(label.length > 0 ? { label } : {}),
        ...(kind !== undefined ? { kind } : {}),
      });
      continue;
    }

    return fail(
      `cannot read sequenceDiagram line: "${t}" (expected a participant, a message like \`A->>B: text\`, or a Note)`,
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
