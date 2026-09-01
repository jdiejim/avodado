/**
 * `stateDiagram` / `stateDiagram-v2` → `state` block data.
 *
 * Supported: `[*] --> A` and `A --> [*]` (the `[*]` pseudo-state becomes a
 * synthetic `_start` / `_end` node with `kind: start` / `kind: terminal` —
 * in the `state` renderer those kinds ARE the dot glyphs, so mapping them
 * onto A would hide A's name), `A --> B : event` (the event is optional;
 * Mermaid gives none → empty string), `state "Long name" as A`, bare
 * `state A`, the description line `A : text` (sets the name), and a
 * top-level `direction`. Composite states `state A { … }` are flattened:
 * their inner states and transitions are kept, the container is dropped;
 * an inner `[*]` gets its own `_start_<Container>` / `_end_<Container>`
 * node. `note` lines and blocks, `--` concurrency separators,
 * `<<fork>>`-style stereotypes, `classDef` / `class` lines and `%%`
 * comments are ignored.
 */

import { bodyLines, fail, startsWithWord, unquote, type MermaidResult } from './lines.js';

const ID = '(\\[\\*\\]|[\\w-]+)';
const TRANSITION_RE = new RegExp(`^${ID}\\s*-->\\s*${ID}\\s*(?::\\s*(.*))?$`);
const STATE_DECL_RE = /^state\s+(?:"([^"]*)"\s+as\s+)?([\w-]+)(?:\s*<<\w+>>)?\s*(\{)?$/;
const DESC_RE = /^([\w-]+)\s*:\s*(.*)$/;

interface StateNode {
  readonly id: string;
  name?: string;
  readonly kind?: 'start' | 'terminal';
}

export function convertState(text: string): MermaidResult {
  const lines = bodyLines(text);
  const states = new Map<string, StateNode>();
  const transitions: Record<string, unknown>[] = [];
  let dir: 'LR' | 'TB' | undefined;
  /** Open composite containers, innermost last. */
  const containers: string[] = [];
  let inNote = false;

  const touch = (id: string): StateNode => {
    const s = states.get(id);
    if (s !== undefined) return s;
    const created: StateNode = { id };
    states.set(id, created);
    return created;
  };
  /** The synthetic pseudo-state for `[*]` at the current nesting. */
  const pseudo = (which: 'start' | 'end'): string => {
    const container = containers[containers.length - 1];
    const id = container === undefined ? `_${which}` : `_${which}_${container}`;
    if (!states.has(id)) {
      states.set(id, { id, name: '', kind: which === 'start' ? 'start' : 'terminal' });
    }
    return id;
  };

  for (const { text: t, line } of lines) {
    if (line === lines[0]?.line && /^stateDiagram(-v2)?$/.test(t)) continue;

    if (inNote) {
      if (t === 'end note') inNote = false;
      continue;
    }
    if (startsWithWord(t, 'note')) {
      // `note right of A : text` is one line; `note right of A` opens a block.
      if (!t.includes(':')) inNote = true;
      continue;
    }
    if (t === '--') continue;
    if (t === '}' && containers.length > 0) {
      containers.pop();
      continue;
    }
    if (startsWithWord(t, 'classDef') || startsWithWord(t, 'class')) continue;
    if (startsWithWord(t, 'direction')) {
      const d = t.slice('direction'.length).trim();
      if (containers.length === 0) dir = d === 'TB' || d === 'TD' ? 'TB' : 'LR';
      continue;
    }

    const sd = STATE_DECL_RE.exec(t);
    if (sd !== null) {
      const s = touch(sd[2] ?? '');
      if (sd[1] !== undefined) s.name = sd[1];
      if (sd[3] !== undefined) containers.push(s.id);
      continue;
    }

    const tr = TRANSITION_RE.exec(t);
    if (tr !== null) {
      const rawFrom = tr[1] ?? '';
      const rawTo = tr[2] ?? '';
      const event = tr[3] !== undefined ? unquote(tr[3]) : '';
      if (rawFrom === '[*]' && rawTo === '[*]') continue;
      const from = rawFrom === '[*]' ? pseudo('start') : touch(rawFrom).id;
      const to = rawTo === '[*]' ? pseudo('end') : touch(rawTo).id;
      transitions.push({ from, to, event });
      continue;
    }

    const desc = DESC_RE.exec(t);
    if (desc !== null) {
      touch(desc[1] ?? '').name = (desc[2] ?? '').trim();
      continue;
    }

    return fail(
      `cannot read stateDiagram line: "${t}" (expected \`A --> B : event\`, \`[*] --> A\`, or \`state "Name" as A\`)`,
      line,
    );
  }

  // The renderer draws `name`, never the id — a bare state is named by its
  // id; a pseudo-state dot carries no name.
  const outStates = [...states.values()].map((s) => ({
    id: s.id,
    ...(s.kind === undefined ? { name: s.name ?? s.id } : {}),
    ...(s.kind !== undefined ? { kind: s.kind } : {}),
  }));

  return {
    ok: true,
    data: {
      ...(dir !== undefined ? { dir } : {}),
      ...(outStates.length > 0 ? { states: outStates } : {}),
      ...(transitions.length > 0 ? { transitions } : {}),
    },
  };
}
