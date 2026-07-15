/**
 * Input normalization — YAML sugar + scalar coercion.
 *
 * Called by `parseDocument` after YAML parse and alias patching, before the
 * segment is stored — so validate / render / studio / MCP all see the
 * canonical object shape. Input-only: the file keeps the author's terse form;
 * only the in-memory `data` is expanded.
 *
 * Sugar grammars (string items expand to objects; object items pass through;
 * non-matching strings pass through untouched and surface as schema errors —
 * the object form is the escape hatch for exotic ids):
 *
 * YAML wrinkle: written unquoted, `a -> b: label` is not a string — YAML
 * parses it as the single-pair mapping `{ 'a -> b': 'label' }`. The sugar
 * therefore also rescues single-pair mappings whose KEY carries the grammar
 * signature (an arrow, a crow's-foot operator, a `·`/status-bracket), by
 * reconstructing `key: value` and expanding that. Real object forms
 * (`{ from: a, to: b }`) never match a signature and pass through untouched.
 *
 * - sequence.messages / flow.edges / graph.edges / block.edges:
 *   `from -> to: label` — split on the FIRST `:`; arrows: `->` plain,
 *   `-->` response (sequence) / dashed (edges), `-x->` error.
 * - erd.relations: `user ||--o{ order: places` — crow's-foot cardinality
 *   (`||--||` 1:1 · `||--o{` 1:N · `}o--||` N:1 · `}o--o{` N:M); plain `->`
 *   is accepted with no cardinality.
 * - timeline.items: `[done] 2026-07 · label · desc` — optional leading
 *   status bracket, then 1 (label) / 2 (date · label) / 3 (date · label ·
 *   desc) `·`-separated parts.
 *
 * Coercion: at positions whose schema is a bare `z.string()` (never a union
 * with number/boolean — see `stringOnlyAt`), scalar numbers/booleans become
 * their string form, killing the "expected string, received number" trap for
 * values like `tech: 16`. Union positions (table cells, stats.value,
 * endpoint status, dfd num) keep their numbers.
 */

import type { BlockType } from '../types.js';
import { stringOnlyAt } from './schema-walk.js';

/** Arrow head: `from -> to`, longest arrow first so `-->` never parses as `-` + `->`. */
const ARROW_RE = /^(\S+?)\s*(-x->|-->|->)\s*(\S+)$/;

/** ERD head: `from <card> to`, crow's-foot operators or a plain `->`. */
const ERD_RE = /^(\S+?)\s*(\|\|--\|\||\|\|--o\{|\}o--o\{|\}o--\|\||->)\s*(\S+)$/;

/** Crow's-foot operator → cardinality. */
const CARD_MAP: Readonly<Record<string, '1:1' | '1:N' | 'N:1' | 'N:M'>> = {
  '||--||': '1:1',
  '||--o{': '1:N',
  '}o--||': 'N:1',
  '}o--o{': 'N:M',
};

/** Optional leading `[status]` bracket of a timeline item string. */
const STATUS_BRACKET_RE = /^\[([^\]]*)\]\s*/;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Splits `s` on its FIRST `:` into a head and an optional trimmed label. */
function splitLabel(s: string): { readonly head: string; readonly label?: string } {
  const i = s.indexOf(':');
  if (i === -1) return { head: s.trim() };
  const label = s.slice(i + 1).trim();
  return { head: s.slice(0, i).trim(), ...(label.length > 0 ? { label } : {}) };
}

/** `Client -> Server: request` → a sequence message (`-->` response, `-x->` error). */
function messageFromString(s: string): unknown {
  const { head, label } = splitLabel(s);
  const m = ARROW_RE.exec(head);
  if (m === null) return s;
  const [, from, arrow, to] = m as unknown as [string, string, string, string];
  const kind = arrow === '-->' ? 'response' : arrow === '-x->' ? 'error' : undefined;
  return {
    from,
    to,
    ...(label !== undefined ? { label } : {}),
    ...(kind !== undefined ? { kind } : {}),
  };
}

/** `a -> b: label` → an edge (`-->` dashed, `-x->` error). */
function edgeFromString(s: string): unknown {
  const { head, label } = splitLabel(s);
  const m = ARROW_RE.exec(head);
  if (m === null) return s;
  const [, from, arrow, to] = m as unknown as [string, string, string, string];
  const kind = arrow === '-->' ? 'dashed' : arrow === '-x->' ? 'error' : undefined;
  return {
    from,
    to,
    ...(label !== undefined ? { label } : {}),
    ...(kind !== undefined ? { kind } : {}),
  };
}

/** `user ||--o{ order: places` → an ERD relation with crow's-foot cardinality. */
function relationFromString(s: string): unknown {
  const { head, label } = splitLabel(s);
  const m = ERD_RE.exec(head);
  if (m === null) return s;
  const [, from, op, to] = m as unknown as [string, string, string, string];
  const card = CARD_MAP[op];
  return {
    from,
    to,
    ...(label !== undefined ? { label } : {}),
    ...(card !== undefined ? { card } : {}),
  };
}

/** `[done] 2026-07 · label · desc` → a timeline item. */
function timelineItemFromString(s: string): unknown {
  let rest = s.trim();
  let status: string | undefined;
  const b = STATUS_BRACKET_RE.exec(rest);
  if (b !== null) {
    status = (b[1] ?? '').trim();
    rest = rest.slice(b[0].length);
  }
  const parts = rest
    .split('·')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) return s; // nothing usable — schema error explains
  const withStatus = status !== undefined && status.length > 0 ? { status } : {};
  if (parts.length === 1) return { label: parts[0], ...withStatus };
  if (parts.length === 2) return { date: parts[0], label: parts[1], ...withStatus };
  return {
    date: parts[0],
    label: parts[1],
    desc: parts.slice(2).join(' · '),
    ...withStatus,
  };
}

/** One sugar grammar: the string expander + its "this key is terse" signature. */
interface Grammar {
  /** Expands a terse string; returns the input unchanged when it doesn't match. */
  readonly expand: (s: string) => unknown;
  /** True when a single-pair mapping KEY carries this grammar's operators. */
  readonly signature: (key: string) => boolean;
}

const arrowGrammar = (expand: (s: string) => unknown): Grammar => ({
  expand,
  signature: (key) => ARROW_RE.test(key),
});
const messageGrammar: Grammar = arrowGrammar(messageFromString);
const edgeGrammar: Grammar = arrowGrammar(edgeFromString);
const relationGrammar: Grammar = {
  expand: relationFromString,
  signature: (key) => ERD_RE.test(key),
};
const timelineGrammar: Grammar = {
  expand: timelineItemFromString,
  signature: (key) => STATUS_BRACKET_RE.test(key) || key.includes('·'),
};

/**
 * Expands the terse items of `data[key]` via `grammar`, leaving everything
 * else untouched. Handles both spellings of a terse item:
 *
 * - a plain string (the quoted form) — expanded directly;
 * - a single-pair mapping (the unquoted `head: label` form YAML produces)
 *   whose key matches the grammar signature — reconstructed and expanded.
 *
 * Anything else (real object forms, non-arrays) passes through untouched.
 */
function mapArrayField(
  data: Record<string, unknown>,
  key: string,
  grammar: Grammar,
): Record<string, unknown> {
  const arr = data[key];
  if (!Array.isArray(arr)) return data;
  let changed = false;
  const next = arr.map((item) => {
    if (typeof item === 'string') {
      const out = grammar.expand(item);
      if (out !== item) changed = true;
      return out;
    }
    if (isPlainObject(item)) {
      const entries = Object.entries(item);
      if (entries.length !== 1) return item;
      const [k, v] = entries[0] as [string, unknown];
      const label = typeof v === 'string' ? v : v === null ? '' : undefined;
      if (label === undefined || !grammar.signature(k)) return item;
      const out = grammar.expand(label.length > 0 ? `${k}: ${label}` : k);
      if (typeof out === 'string') return item; // no match — keep the original
      changed = true;
      return out;
    }
    return item;
  });
  return changed ? { ...data, [key]: next } : data;
}

/** Per-type sugar expanders (aliases are covered: they map to these kinds). */
const SUGAR: Partial<
  Record<BlockType, (data: Record<string, unknown>) => Record<string, unknown>>
> = {
  sequence: (d) => mapArrayField(d, 'messages', messageGrammar),
  erd: (d) => mapArrayField(d, 'relations', relationGrammar),
  flow: (d) => mapArrayField(d, 'edges', edgeGrammar),
  graph: (d) => mapArrayField(d, 'edges', edgeGrammar),
  block: (d) => mapArrayField(d, 'edges', edgeGrammar),
  timeline: (d) => mapArrayField(d, 'items', timelineGrammar),
};

/** Recursively coerces number/boolean scalars to strings at string-only positions. */
function coerce(kind: BlockType, value: unknown, path: ReadonlyArray<string | number>): unknown {
  if (Array.isArray(value)) {
    return value.map((v, i) => coerce(kind, v, [...path, i]));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, coerce(kind, v, [...path, k])]),
    );
  }
  if ((typeof value === 'number' || typeof value === 'boolean') && stringOnlyAt(kind, path)) {
    return String(value);
  }
  return value;
}

/**
 * Normalizes a block's parsed data to canonical shape: sugar expansion first,
 * then scalar coercion. Non-object data (empty body, scalar/array bodies)
 * passes through untouched.
 *
 * @param kind - The block's CANONICAL type (aliases already resolved).
 * @param data - The parsed (and alias-patched) YAML body.
 */
export function normalizeBlockData(kind: BlockType, data: unknown): unknown {
  if (!isPlainObject(data)) return data;
  const sugar = SUGAR[kind];
  const sugared = sugar !== undefined ? sugar(data) : data;
  return coerce(kind, sugared, []);
}
