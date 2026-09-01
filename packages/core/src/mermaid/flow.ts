/**
 * `flowchart` / `graph` → `flow` block data.
 *
 * Supported: the header direction (`TD` / `TB` → `dir: TB`; `LR` / `RL` /
 * `BT` → `dir: LR`; none → `TB`, Mermaid's default), node declarations with
 * shapes (`[ ]` `( )` `([ ])` `(( ))` `{ }` `{{ }}` `[/ /]` `[\ \]` `> ]`
 * `[( )]` `[[ ]]`), edges (`-->`, `---`, `-.->`, `==>`, `--x`, with `|label|`
 * or inline `-- label -->` labels), chains (`A --> B --> C`) and fans
 * (`A & B --> C`). Shapes map to node kinds: `{ }` / `{{ }}` → `decision`;
 * a stadium / circle node with no incoming edge → `start`, with no outgoing
 * edge → `end`. `subgraph … end` framing is dropped (its nodes stay);
 * `style`, `classDef`, `class`, `click`, `linkStyle`, `direction` and
 * `:::class` suffixes are ignored.
 */

import { bodyLines, fail, startsWithWord, unquote, type MermaidResult } from './lines.js';

interface FlowNode {
  readonly id: string;
  label: string;
  shape: 'rect' | 'decision' | 'terminal';
}

interface FlowEdge {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
  readonly kind?: 'error' | 'dashed';
}

/** Header: `flowchart LR`, `graph TD`, `flowchart` (no direction). */
const HEADER_RE = /^(flowchart|graph)(?:\s+(TD|TB|LR|RL|BT))?\s*;?$/;

const SKIP_WORDS = ['style', 'classDef', 'class', 'click', 'linkStyle', 'direction', 'subgraph'];

/** Closing delimiter per shape opener, longest openers first. */
const SHAPES: ReadonlyArray<{ open: string; close: string; shape: FlowNode['shape'] }> = [
  { open: '(((', close: ')))', shape: 'terminal' },
  { open: '((', close: '))', shape: 'terminal' },
  { open: '([', close: '])', shape: 'terminal' },
  { open: '[(', close: ')]', shape: 'rect' },
  { open: '[[', close: ']]', shape: 'rect' },
  { open: '[/', close: ']', shape: 'rect' },
  { open: '[\\', close: ']', shape: 'rect' },
  { open: '{{', close: '}}', shape: 'decision' },
  { open: '[', close: ']', shape: 'rect' },
  { open: '(', close: ')', shape: 'rect' },
  { open: '{', close: '}', shape: 'decision' },
  { open: '>', close: ']', shape: 'rect' },
];

/**
 * Inline-label edge: `-- text -->`, `-- text ---`, `-. text .->`, `== text ==>`.
 * The opener must be followed by whitespace, so a plain `-->` never matches.
 */
const INLINE_EDGE_RE = /^(--|-\.|==)\s+(.+?)\s+((?:-{2,}|\.-+|={2,})([>xo])?)/;
/** Plain edge, optionally bidirectional and with a trailing `|label|`. */
const EDGE_RE = /^<?(?:-\.+-|-{2,}|={2,})([>xo])?(?:\s*\|([^|]*)\|)?/;
/** A node id: word characters, plus `.` / `-` when sandwiched between word characters. */
const ID_RE = /^\w+(?:[.-]\w+)*/;

/** Splits a statement line on `;` outside quotes and shape delimiters. */
function splitStatements(line: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quoted = false;
  let cur = '';
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    if (!quoted) {
      if ('[({'.includes(ch)) depth++;
      else if ('])}'.includes(ch)) depth--;
      else if (ch === ';' && depth <= 0) {
        out.push(cur);
        cur = '';
        continue;
      }
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter((s) => s.length > 0);
}

/** Reads the shape text after an opener; `undefined` when the closer is missing. */
function readShape(s: string, close: string): { text: string; rest: string } | undefined {
  // A quoted label may contain the closer: skip over quoted runs.
  let i = 0;
  let quoted = false;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '"') quoted = !quoted;
    else if (!quoted && s.startsWith(close, i)) {
      return { text: s.slice(0, i), rest: s.slice(i + close.length) };
    }
    i++;
  }
  return undefined;
}

export function convertFlow(text: string): MermaidResult {
  const lines = bodyLines(text);
  const first = lines[0];
  if (first === undefined) return fail('empty flowchart', 1);
  const h = HEADER_RE.exec(first.text);
  if (h === null) return fail(`cannot read flowchart header: "${first.text}"`, first.line);
  const rawDir = h[2] ?? 'TB';
  const dir: 'TB' | 'LR' = rawDir === 'TD' || rawDir === 'TB' ? 'TB' : 'LR';

  const nodes = new Map<string, FlowNode>();
  const edges: FlowEdge[] = [];

  const declare = (id: string, label: string | undefined, shape: FlowNode['shape'] | undefined): void => {
    const n = nodes.get(id);
    if (n === undefined) {
      nodes.set(id, { id, label: label ?? id, shape: shape ?? 'rect' });
      return;
    }
    if (label !== undefined) n.label = label;
    if (shape !== undefined) n.shape = shape;
  };

  for (const { text: t, line } of lines.slice(1)) {
    for (const stmt of splitStatements(t)) {
      if (stmt === 'end' || SKIP_WORDS.some((w) => startsWithWord(stmt, w))) continue;
      const err = parseStatement(stmt, declare, edges);
      if (err !== undefined) return fail(`${err} (line: "${stmt}")`, line);
    }
  }

  const hasIn = new Set(edges.map((e) => e.to));
  const hasOut = new Set(edges.map((e) => e.from));
  const outNodes = [...nodes.values()].map((n) => {
    const kind =
      n.shape === 'decision'
        ? 'decision'
        : n.shape === 'terminal'
          ? !hasIn.has(n.id)
            ? 'start'
            : !hasOut.has(n.id)
              ? 'end'
              : undefined
          : undefined;
    return { id: n.id, label: n.label, ...(kind !== undefined ? { kind } : {}) };
  });

  return {
    ok: true,
    data: {
      dir,
      ...(outNodes.length > 0 ? { nodes: outNodes } : {}),
      ...(edges.length > 0 ? { edges } : {}),
    },
  };
}

/**
 * Parses one statement — a chain `nodes (edge nodes)*` where `nodes` is one
 * node or an `&` fan. Returns an error message, or `undefined` on success.
 */
function parseStatement(
  stmt: string,
  declare: (id: string, label: string | undefined, shape: FlowNode['shape'] | undefined) => void,
  edges: FlowEdge[],
): string | undefined {
  let rest = stmt;
  let left: string[] | undefined;
  let pending: { label?: string; kind?: 'error' | 'dashed' } | undefined;

  for (;;) {
    // A node group: `A`, `A[text]`, `A & B[text]`.
    const group: string[] = [];
    for (;;) {
      rest = rest.trimStart();
      const m = ID_RE.exec(rest);
      if (m === null) return group.length === 0 ? 'expected a node id' : 'expected a node after `&`';
      const id = m[0];
      rest = rest.slice(id.length);
      let label: string | undefined;
      let shape: FlowNode['shape'] | undefined;
      const sh = SHAPES.find((s) => rest.startsWith(s.open));
      if (sh !== undefined) {
        const body = readShape(rest.slice(sh.open.length), sh.close);
        if (body === undefined) return `unclosed \`${sh.open}\` on node ${id}`;
        // `[/text\]` / `[\text/]` trapezoids close with a slash before `]`.
        label = unquote(body.text.replace(/[/\\]$/, ''));
        shape = sh.shape;
        rest = body.rest;
      }
      const cls = /^:::[\w-]+/.exec(rest);
      if (cls !== null) rest = rest.slice(cls[0].length);
      declare(id, label, shape);
      group.push(id);
      rest = rest.trimStart();
      if (!rest.startsWith('&')) break;
      rest = rest.slice(1);
    }

    if (left !== undefined && pending !== undefined) {
      for (const from of left) {
        for (const to of group) {
          edges.push({
            from,
            to,
            ...(pending.label !== undefined ? { label: pending.label } : {}),
            ...(pending.kind !== undefined ? { kind: pending.kind } : {}),
          });
        }
      }
    }

    rest = rest.trimStart();
    if (rest.length === 0) return undefined;

    // An edge: inline-label form first (its opener must be followed by a space).
    let label: string | undefined;
    let head: string | undefined;
    let dotted = false;
    const inline = INLINE_EDGE_RE.exec(rest);
    if (inline !== null) {
      label = unquote(inline[2] ?? '');
      head = inline[4];
      dotted = inline[1] === '-.';
      rest = rest.slice(inline[0].length);
    } else {
      const e = EDGE_RE.exec(rest);
      if (e === null) return `expected an edge after node ${group[group.length - 1] ?? ''}`;
      head = e[1];
      if (e[2] !== undefined) label = unquote(e[2]);
      dotted = e[0].includes('.');
      rest = rest.slice(e[0].length);
    }
    // `--x` is an error edge; a dotted `-.->` is a dashed (optional) edge.
    const kind = head === 'x' ? ('error' as const) : dotted ? ('dashed' as const) : undefined;
    pending = {
      ...(label !== undefined && label.length > 0 ? { label } : {}),
      ...(kind !== undefined ? { kind } : {}),
    };
    left = group;
  }
}
