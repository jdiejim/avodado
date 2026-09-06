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
 *   `-->` response (sequence) / dashed (edges), `-x->` error. Sequence only:
 *   `-> +to` / `--> -to` activation signs, and the frame markers
 *   `alt: label` / `opt` / `loop` / `par` / `break` / `critical` / `else:
 *   label` / `end`.
 * - erd.relations: `user ||--o{ order: places` — crow's-foot cardinality
 *   (`||--||` 1:1 · `||--o{` 1:N · `}o--||` N:1 · `}o--o{` N:M · `||--o|`
 *   0..1); a `..` body (`||..o{`) is non-identifying; plain `->` is accepted
 *   with no cardinality.
 * - erd.entities[].columns: `email text unique !null default=now()`,
 *   `user_id uuid fk -> users.id`, `status enum(open,closed)` — see
 *   `erdColumnGrammar`.
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

import { stringify as stringifyYaml } from 'yaml';
import type { BlockType } from '../types.js';
import { fieldNamesAt, stringOnlyAt } from './schema-walk.js';

/** Arrow head: `from -> to`, longest arrow first so `-->` never parses as `-` + `->`. */
const ARROW_RE = /^(\S+?)\s*(-x->|-->|->)\s*(\S+)$/;

/**
 * Sequence arrow head: `from -> to` with an optional activation sign before
 * the target — `A -> +B` opens a bar on B, `B --> -A` closes the bar on the
 * SENDER (Mermaid's convention: the `-` rides on the reply that leaves the
 * bar). The sign never becomes part of `to`.
 */
const SEQ_ARROW_RE = /^(\S+?)\s*(-x->|-->|->)\s*([+-]?)([^\s+-]\S*)$/;

/** Frame markers: the six combined-fragment kinds, plus `else` and `end`. */
const FRAME_HEAD_RE = /^(alt|opt|loop|par|break|critical|else|end)$/;

/**
 * ERD head: `from <op> to` — a crow's-foot operator (every Mermaid end:
 * `||` `|o` `}o` `}|` on the left, `||` `o|` `o{` `|{` on the right, with a
 * `--` identifying or `..` non-identifying body) or a plain `->`.
 */
const ERD_RE = /^(\S+?)\s*((?:\|\||\|o|\}o|\}\|)(?:--|\.\.)(?:\|\||o\||o\{|\|\{)|->)\s*(\S+)$/;

/**
 * Crow's-foot operator → `{ card, identifying }`. The left end says whether
 * `from` is one or many; the right end says the same for `to`, and an `o`
 * on the right (`o|`, `o{`) makes `to` optional (`0..1` / `0..N`) when `from`
 * is one. A `..` body is a non-identifying relation (dashed).
 */
function cardOf(op: string): { card?: string; identifying?: false } {
  if (op === '->') return {};
  const body = op.includes('..') ? '..' : '--';
  const [left, right] = op.split(body) as [string, string];
  const fromMany = left.startsWith('}');
  const toMany = right.endsWith('{');
  const toOptional = right.startsWith('o');
  // `||--o{` stays `1:N` (the documented spelling of one-to-many); only a
  // one-to-one with an optional `to` (`||--o|`) reads as `0..1`.
  const card = fromMany ? (toMany ? 'N:M' : 'N:1') : toMany ? '1:N' : toOptional ? '0..1' : '1:1';
  return { card, ...(body === '..' ? { identifying: false as const } : {}) };
}

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

/**
 * A sequence `messages` item from its terse string:
 *
 * - `Client -> Server: request` → a message (`-->` response, `-x->` error;
 *   `-> +B` sets `activate`, `--> -A` sets `deactivate`);
 * - `alt: token valid` / `opt` / `loop: every 5s` / `par` / `break` /
 *   `critical` → a frame open (`{ frame, label? }`);
 * - `else: expired` → a frame else; a bare `end` → a frame end.
 */
function messageFromString(s: string): unknown {
  const { head, label } = splitLabel(s);
  if (FRAME_HEAD_RE.test(head)) {
    if (head === 'end') return { end: true };
    if (head === 'else') return label !== undefined ? { else: label } : s; // label required
    return { frame: head, ...(label !== undefined ? { label } : {}) };
  }
  const m = SEQ_ARROW_RE.exec(head);
  if (m === null) return s;
  const [, from, arrow, sign, to] = m as unknown as [string, string, string, string, string];
  const kind = arrow === '-->' ? 'response' : arrow === '-x->' ? 'error' : undefined;
  return {
    from,
    to,
    ...(label !== undefined ? { label } : {}),
    ...(kind !== undefined ? { kind } : {}),
    ...(sign === '+' ? { activate: true } : {}),
    ...(sign === '-' ? { deactivate: true } : {}),
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
  return {
    from,
    to,
    ...(label !== undefined ? { label } : {}),
    ...cardOf(op),
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
const messageGrammar: Grammar = {
  expand: messageFromString,
  // `- alt: token valid` / `- else: expired` / `- end: true` are single-pair
  // maps too — their key is the frame keyword.
  signature: (key) => SEQ_ARROW_RE.test(key) || FRAME_HEAD_RE.test(key),
};
const edgeGrammar: Grammar = arrowGrammar(edgeFromString);
const relationGrammar: Grammar = {
  expand: relationFromString,
  signature: (key) => ERD_RE.test(key),
};
const timelineGrammar: Grammar = {
  expand: timelineItemFromString,
  signature: (key) => STATUS_BRACKET_RE.test(key) || key.includes('·'),
};

/** Span head: `service/id` — the first `/` splits the lane from the id. */
const SPAN_HEAD_RE = /^([^/\s:]+)\/(\S+)$/;

/** A finite number written as a plain token (`0`, `12.5`). */
function numberToken(s: string | undefined): number | undefined {
  if (s === undefined || s.length === 0) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * `service/id: name · start · duration [· parent]` → a span. The head names
 * the lane and the id; the body is the span name, its offset, its length, and
 * an optional parent id. Anything the grammar can't read stays a string and
 * surfaces as a schema error.
 */
function spanFromString(s: string): unknown {
  const { head, label } = splitLabel(s);
  const m = SPAN_HEAD_RE.exec(head);
  if (m === null || label === undefined) return s;
  const parts = label
    .split('·')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length < 3 || parts.length > 4) return s;
  const start = numberToken(parts[1]);
  const duration = numberToken(parts[2]);
  if (start === undefined || duration === undefined) return s;
  const parent = parts[3];
  return {
    id: m[2],
    service: m[1],
    name: parts[0],
    start,
    duration,
    ...(parent !== undefined ? { parent } : {}),
  };
}
const spanGrammar: Grammar = {
  expand: spanFromString,
  signature: (key) => SPAN_HEAD_RE.test(key),
};

/** A traffic share token: `10%`, `2.5%`. */
const TRAFFIC_RE = /^(\d+(?:\.\d+)?)\s*%$/;

/**
 * `[status] traffic% · name · duration — gate` → a rollout stage. The bracket,
 * the traffic share, the duration, and the gate are all optional; the name is
 * the first part that is not a percentage.
 */
function rolloutStageFromString(s: string): unknown {
  let rest = s.trim();
  let status: string | undefined;
  const b = STATUS_BRACKET_RE.exec(rest);
  if (b !== null) {
    status = (b[1] ?? '').trim();
    rest = rest.slice(b[0].length);
  }
  let gate: string | undefined;
  const dash = rest.indexOf(' — ');
  if (dash !== -1) {
    gate = rest.slice(dash + 3).trim();
    rest = rest.slice(0, dash);
  }
  const parts = rest
    .split('·')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  let traffic: number | undefined;
  const t = parts.length > 0 ? TRAFFIC_RE.exec(parts[0] ?? '') : null;
  if (t !== null) {
    traffic = Number(t[1]);
    parts.shift();
  }
  const name = parts.shift();
  if (name === undefined) return s; // nothing usable — schema error explains
  const duration = parts.length > 0 ? parts.join(' · ') : undefined;
  return {
    name,
    ...(traffic !== undefined ? { traffic } : {}),
    ...(duration !== undefined ? { duration } : {}),
    ...(gate !== undefined && gate.length > 0 ? { gate } : {}),
    ...(status !== undefined && status.length > 0 ? { status } : {}),
  };
}
const rolloutGrammar: Grammar = {
  expand: rolloutStageFromString,
  signature: (key) => STATUS_BRACKET_RE.test(key) || key.includes('·'),
};

/**
 * Text-pair grammar for list-shaped blocks: an item may be a plain string,
 * split on the FIRST ` — ` (em dash) into lead + rest:
 *
 *   - Ship small — five focused releases beat one big one.   (takeaways)
 *   - SLO — the target the team commits to.                  (glossary)
 *   - Why is it fast? — The cache is warm.                   (faq)
 *
 * With no ` — `, the whole string becomes the lead field (when the rest field
 * is optional) or stays a string and surfaces as a schema error (when both
 * halves are required — glossary/faq). `alsoColon` additionally accepts
 * `Term: definition` (the natural glossary spelling).
 *
 * The single-pair-map signature is "the key is NOT a known item field": YAML
 * turns an unquoted `- SLO: the target` into `{ SLO: 'the target' }`, which is
 * reconstructed to `SLO: the target` and expanded — while a real field form
 * like `{ term: SLO }` never matches.
 */
function textPairGrammar(
  leadField: string,
  restField: string,
  restRequired: boolean,
  knownKeys: readonly string[],
  alsoColon = false,
): Grammar {
  const expand = (s: string): unknown => {
    const t = s.trim();
    if (t.length === 0) return s;
    let i = t.indexOf(' — ');
    let sep = 3;
    if (i === -1 && alsoColon) {
      i = t.indexOf(': ');
      sep = 2;
    }
    if (i === -1) return restRequired ? s : { [leadField]: t };
    const lead = t.slice(0, i).trim();
    const rest = t.slice(i + sep).trim();
    if (lead.length === 0) return s;
    return { [leadField]: lead, ...(rest.length > 0 ? { [restField]: rest } : {}) };
  };
  return { expand, signature: (key) => !knownKeys.includes(key) };
}

const glossaryGrammar = textPairGrammar('term', 'def', true, ['term', 'def', 'avoid', 'id'], true);
const faqGrammar = textPairGrammar('q', 'a', true, ['q', 'a', 'open', 'id']);
const takeawaysGrammar = textPairGrammar('text', 'detail', false, ['text', 'detail', 'id']);
const listGrammar = textPairGrammar('lead', 'text', false, [
  'lead',
  'text',
  'icon',
  'accent',
  'done',
  'id',
]);
const stepsGrammar = textPairGrammar('title', 'body', false, [
  'title',
  'body',
  'code',
  'lang',
  'note',
  'id',
]);

/** Kanban card: `'Title'` or `'Title · tag'` → `{ title, tag? }`. */
const kanbanCardGrammar: Grammar = {
  expand: (s: string): unknown => {
    const parts = s
      .split('·')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (parts.length === 0) return s;
    if (parts.length === 1) return { title: parts[0] };
    return { title: parts[0], tag: parts.slice(1).join(' · ') };
  },
  signature: (key) => !['title', 'tag', 'id'].includes(key),
};

/** Splits on `·`, trimming and dropping empties. */
function dotParts(s: string): string[] {
  return s
    .split('·')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/** A signature that rescues any single-pair map whose key is NOT a real field. */
const notAField =
  (kind: BlockType, path: ReadonlyArray<string | number>) =>
  (key: string): boolean =>
    key !== 'id' && !fieldNamesAt(kind, [...path, 0, key]).includes(key);

/**
 * Node sugar for grid diagrams: `'rx: Receive'` → `{ id: 'rx', label: 'Receive' }`
 * (or `name:` for the kinds that spell it that way); a bare `'Receive'` uses the
 * text as BOTH id and label, so a quick sketch is just names + arrows:
 *
 *   nodes: [Receive, Check, Ship]
 *   edges: [Receive -> Check, Check -> Ship]
 */
function nodeGrammar(kind: BlockType, nodesField: string, labelField: 'label' | 'name'): Grammar {
  const expand = (s: string): unknown => {
    const t = s.trim();
    if (t.length === 0) return s;
    const i = t.indexOf(': ');
    if (i === -1) return { id: t, [labelField]: t };
    const id = t.slice(0, i).trim();
    const label = t.slice(i + 2).trim();
    if (id.length === 0 || label.length === 0 || /\s/.test(id)) return s;
    return { id, [labelField]: label };
  };
  const isField = notAField(kind, [nodesField]);
  return { expand, signature: (key) => !/\s/.test(key) && isField(key) };
}

/** `'a -> b: label'` with NO kind field on the target — plain from/to/label. */
const linkGrammar: Grammar = {
  expand: (s: string): unknown => {
    const out = edgeFromString(s);
    if (typeof out === 'string' || !isPlainObject(out)) return out;
    const { kind: _drop, ...rest } = out as { kind?: unknown };
    return rest;
  },
  signature: (key) => ARROW_RE.test(key),
};

/** `'idle -> active: submit'` → a state transition (the label is the EVENT). */
const transitionGrammar: Grammar = {
  expand: (s: string): unknown => {
    const out = edgeFromString(s);
    if (typeof out === 'string' || !isPlainObject(out)) return out;
    const o = out as { from: string; to: string; label?: string };
    // `event` is required by the schema — seed empty when unlabelled.
    return { from: o.from, to: o.to, event: o.label ?? '' };
  },
  signature: (key) => ARROW_RE.test(key),
};

/** The erd column fields — a single-pair map whose key is one of these is a real object form. */
const ERD_COLUMN_FIELDS = ['name', 'type', 'pk', 'fk', 'unique', 'nullable', 'default', 'index', 'enum', 'ref', 'note'];

/**
 * ERD column: `'name type flags…'` — the name, then any of, in any order:
 *
 *   pk · fk · unique (uk) · !null (notnull) · null (?) · index (idx)
 *   default=<value> · -> table.column (an FK with its target)
 *   enum(a,b,c) (an inline value list; the type becomes `enum`)
 *
 * Every other token joins the type (`double precision`, `numeric(10,2)`).
 * `'email text unique !null default=now()'` and `'user_id uuid fk -> users.id'`
 * are the documented shapes.
 */
const erdColumnGrammar: Grammar = {
  expand: (s: string): unknown => {
    // The single-pair rescue reconstructs `'id: uuid pk'` — treat ':' as space.
    const tokens = s.replace(':', ' ').split(/\s+/).filter((t) => t.length > 0);
    const name = tokens.shift();
    if (name === undefined) return s;
    const out: Record<string, unknown> = { name };
    const typeParts: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i] ?? '';
      const lower = t.toLowerCase();
      if (lower === 'pk') out['pk'] = true;
      else if (lower === 'fk') out['fk'] = true;
      else if (lower === 'unique' || lower === 'uk') out['unique'] = true;
      else if (lower === '!null' || lower === 'notnull' || lower === 'not-null') out['nullable'] = false;
      else if (lower === 'null' || lower === '?') out['nullable'] = true;
      else if (lower === 'index' || lower === 'idx') out['index'] = true;
      else if (lower.startsWith('default=')) out['default'] = t.slice('default='.length);
      else if (t === '->') {
        const target = tokens[i + 1];
        if (target !== undefined) {
          out['fk'] = true;
          out['ref'] = target;
          i += 1;
        }
      } else if (/^enum\(.*\)$/i.test(t)) {
        out['enum'] = t
          .slice(5, -1)
          .split(',')
          .map((v) => v.trim())
          .filter((v) => v.length > 0);
        typeParts.push('enum');
      } else typeParts.push(t);
    }
    if (typeParts.length > 0) out['type'] = typeParts.join(' ');
    return out;
  },
  signature: (key) => !/\s/.test(key) && !ERD_COLUMN_FIELDS.includes(key),
};

/** Stat: `'label · value · delta'` — trend inferred from the delta's sign. */
const statGrammar: Grammar = {
  expand: (s: string): unknown => {
    const parts = dotParts(s);
    if (parts.length < 2) return s; // value + label both required
    const out: Record<string, unknown> = { label: parts[0], value: parts[1] };
    const delta = parts[2];
    if (delta !== undefined) {
      out['delta'] = delta;
      if (delta.startsWith('+')) out['trend'] = 'up';
      else if (delta.startsWith('-')) out['trend'] = 'down';
    }
    return out;
  },
  signature: (key) => key.includes('·'),
};

/** Team member: `'Name · role · focus'`. */
const teamGrammar: Grammar = {
  expand: (s: string): unknown => {
    const parts = dotParts(s);
    const name = parts[0];
    if (name === undefined) return s;
    return {
      name,
      ...(parts[1] !== undefined ? { role: parts[1] } : {}),
      ...(parts[2] !== undefined ? { focus: parts.slice(2).join(' · ') } : {}),
    };
  },
  signature: (key) => key.includes('·'),
};

const TIME_RE = /^~?\d{1,2}:\d{2}$/;
const DURATION_RE = /^~?\d+\s*(m|min|mins|h|hr|hrs)$/i;

/** Agenda item: `'09:00 · 20m · Title — desc'` — time/duration detected by shape. */
const agendaGrammar: Grammar = {
  expand: (s: string): unknown => {
    const parts = dotParts(s);
    if (parts.length === 0) return s;
    const out: Record<string, unknown> = {};
    if (parts.length > 1 && TIME_RE.test(parts[0] ?? '')) out['time'] = parts.shift();
    if (parts.length > 1 && DURATION_RE.test(parts[0] ?? '')) out['duration'] = parts.shift();
    const title = parts.join(' · ');
    const d = title.indexOf(' — ');
    if (d === -1) out['title'] = title;
    else {
      out['title'] = title.slice(0, d).trim();
      out['desc'] = title.slice(d + 3).trim();
    }
    return out;
  },
  signature: (key) => key.includes('·') || TIME_RE.test(key),
};

/** OKR key result: `'[status] Text · 60'` — bracket status, trailing `· progress`. */
const krGrammar: Grammar = {
  expand: (s: string): unknown => {
    let rest = s.trim();
    let status: string | undefined;
    const b = STATUS_BRACKET_RE.exec(rest);
    if (b !== null) {
      status = (b[1] ?? '').trim();
      rest = rest.slice(b[0].length);
    }
    const parts = dotParts(rest);
    const last = parts[parts.length - 1];
    const raw = last !== undefined && /^\d+(\.\d+)?%?$/.test(last) ? Number(last.replace('%', '')) : undefined;
    if (raw === undefined) return s; // progress is required — schema explains
    // The schema's `progress` is a 0-1 fraction; the terse form reads as a
    // percentage (`· 60` or `· 60%`), so anything above 1 divides by 100.
    const progress = raw > 1 ? raw / 100 : raw;
    return {
      kr: parts.slice(0, -1).join(' · '),
      progress,
      ...(status !== undefined && status.length > 0 ? { status } : {}),
    };
  },
  signature: (key) => STATUS_BRACKET_RE.test(key) || key.includes('·'),
};

/**
 * Event payload / header field: `name type [required] — desc`. The name is
 * the first token, `required` is an optional last token before the dash,
 * and everything between is the type (so `Item[]` and `string (ISO 8601)`
 * both work). The description follows ` — `.
 */
const EVENT_FIELD_KEYS = ['name', 'type', 'required', 'desc', 'example'];
const eventFieldGrammar: Grammar = {
  expand: (s: string): unknown => {
    let head = s.trim();
    let desc: string | undefined;
    const dash = head.indexOf(' — ');
    if (dash !== -1) {
      desc = head.slice(dash + 3).trim();
      head = head.slice(0, dash);
    }
    // The single-pair rescue reconstructs `'order_id: uuid required'` — treat
    // the first ':' of the head as a space (the desc keeps its colons).
    const tokens = head.replace(':', ' ').split(/\s+/).filter((t) => t.length > 0);
    const name = tokens.shift();
    if (name === undefined) return s;
    let required = false;
    if (tokens.length > 1 && /^required$/i.test(tokens[tokens.length - 1] ?? '')) {
      tokens.pop();
      required = true;
    }
    const type = tokens.join(' ');
    if (type.length === 0) return s; // type is required — schema error explains
    return {
      name,
      type,
      ...(required ? { required: true } : {}),
      ...(desc !== undefined && desc.length > 0 ? { desc } : {}),
    };
  },
  signature: (key) => !/\s/.test(key) && !EVENT_FIELD_KEYS.includes(key),
};

/** Event error: `Name — when the consumer sees it`. */
const eventErrorGrammar = textPairGrammar('name', 'when', false, ['name', 'when', 'id']);

/**
 * Saga step: `id: Name · service · compensate` — three parts after the id
 * give name, service, and the compensating action; four give name, service,
 * action, compensate; two give name and service only.
 */
const SAGA_STEP_KEYS = ['id', 'name', 'service', 'action', 'compensate', 'status'];
const sagaStepGrammar: Grammar = {
  expand: (s: string): unknown => {
    const t = s.trim();
    const i = t.indexOf(': ');
    if (i === -1) return s;
    const id = t.slice(0, i).trim();
    if (id.length === 0 || /\s/.test(id)) return s;
    const parts = dotParts(t.slice(i + 2));
    const name = parts[0];
    const service = parts[1];
    if (name === undefined || service === undefined) return s; // both required — schema explains
    const out: Record<string, unknown> = { id, name, service };
    if (parts.length === 3) out['compensate'] = parts[2];
    else if (parts.length >= 4) {
      out['action'] = parts[2];
      out['compensate'] = parts.slice(3).join(' · ');
    }
    return out;
  },
  signature: (key) => !/\s/.test(key) && !SAGA_STEP_KEYS.includes(key),
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
      // `A -> B: 200` — YAML types a bare numeric/boolean label; it is still
      // the label. Only nested structures mean "this is a real object form".
      const label =
        typeof v === 'string'
          ? v
          : v === null
            ? ''
            : typeof v === 'number' || typeof v === 'boolean'
              ? String(v)
              : undefined;
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
  erd: (d) => {
    // Relations get the crow's-foot grammar; each entity's columns get the
    // `'id uuid pk'` token grammar (nested, like kanban cards).
    let out = mapArrayField(d, 'relations', relationGrammar);
    const ents = out['entities'];
    if (Array.isArray(ents)) {
      let changed = false;
      const next = ents.map((e) => {
        if (!isPlainObject(e)) return e;
        const c = mapArrayField(e, 'columns', erdColumnGrammar);
        if (c !== e) changed = true;
        return c;
      });
      if (changed) out = { ...out, entities: next };
    }
    return out;
  },
  flow: (d) =>
    mapArrayField(mapArrayField(d, 'edges', edgeGrammar), 'nodes', nodeGrammar('flow', 'nodes', 'label')),
  graph: (d) =>
    mapArrayField(mapArrayField(d, 'edges', edgeGrammar), 'nodes', nodeGrammar('graph', 'nodes', 'label')),
  block: (d) =>
    mapArrayField(mapArrayField(d, 'edges', edgeGrammar), 'nodes', nodeGrammar('block', 'nodes', 'name')),
  state: (d) =>
    mapArrayField(
      mapArrayField(d, 'transitions', transitionGrammar),
      'states',
      nodeGrammar('state', 'states', 'name'),
    ),
  dfd: (d) =>
    mapArrayField(mapArrayField(d, 'edges', linkGrammar), 'nodes', nodeGrammar('dfd', 'nodes', 'name')),
  swimlane: (d) =>
    mapArrayField(mapArrayField(d, 'links', linkGrammar), 'lanes', {
      // A lane is just its label: `lanes: [Dev, QA, Ops]`.
      expand: (s) => ({ label: s.trim() }),
      signature: () => false, // single-pair lanes have no terse form
    }),
  c4: (d) => mapArrayField(d, 'edges', edgeGrammar),
  cluster: (d) => mapArrayField(d, 'links', edgeGrammar),
  stats: (d) => mapArrayField(d, 'stats', statGrammar),
  team: (d) => mapArrayField(d, 'members', teamGrammar),
  agenda: (d) => mapArrayField(d, 'items', agendaGrammar),
  okr: (d) => {
    const items = d['items'];
    if (!Array.isArray(items)) return d;
    let changed = false;
    const next = items.map((it) => {
      if (!isPlainObject(it)) return it;
      const out = mapArrayField(it, 'krs', krGrammar);
      if (out !== it) changed = true;
      return out;
    });
    return changed ? { ...d, items: next } : d;
  },
  timeline: (d) => mapArrayField(d, 'items', timelineGrammar),
  eventcontract: (d) =>
    mapArrayField(
      mapArrayField(mapArrayField(d, 'schema', eventFieldGrammar), 'headers', eventFieldGrammar),
      'errors',
      eventErrorGrammar,
    ),
  saga: (d) => mapArrayField(d, 'steps', sagaStepGrammar),
  spans: (d) => mapArrayField(d, 'spans', spanGrammar),
  rollout: (d) => mapArrayField(d, 'stages', rolloutGrammar),
  glossary: (d) => mapArrayField(d, 'terms', glossaryGrammar),
  faq: (d) => mapArrayField(d, 'items', faqGrammar),
  takeaways: (d) => mapArrayField(d, 'items', takeawaysGrammar),
  list: (d) => mapArrayField(d, 'items', listGrammar),
  steps: (d) => mapArrayField(d, 'items', stepsGrammar),
  kanban: (d) => {
    // Cards nest one level down: expand each column's `cards` in place.
    const cols = d['columns'];
    if (!Array.isArray(cols)) return d;
    let changed = false;
    const next = cols.map((col) => {
      if (!isPlainObject(col)) return col;
      const out = mapArrayField(col, 'cards', kanbanCardGrammar);
      if (out !== col) changed = true;
      return out;
    });
    return changed ? { ...d, columns: next } : d;
  },
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

/* ── Bare-text bodies ───────────────────────────────────────────────────────
 * Text-first blocks accept their body as PLAIN TEXT — no YAML at all:
 *
 *   ```callout
 *   Heads up: the API rate limit is 100 req/min.
 *   ```
 *
 * The whole body becomes the block's text field (callout `body`, pullquote
 * `text`), so colons, quotes and dashes never need YAML escaping. The escape
 * hatch back to fields is leading with one: a body whose FIRST non-blank line
 * is `<known-field>:` (or `id:`) parses as YAML exactly as before.
 */
const TEXT_BODY: Partial<Record<BlockType, string>> = {
  callout: 'body',
  pullquote: 'text',
};

/** True when the body's first non-blank line is a known `field:` for `kind`. */
function leadsWithField(kind: BlockType, text: string): boolean {
  const first = text.split('\n').find((l) => l.trim() !== '') ?? '';
  const m = /^([A-Za-z][A-Za-z0-9_-]*):(\s|$)/.exec(first.trim());
  if (m === null) return false;
  const key = m[1] ?? '';
  return key === 'id' || fieldNamesAt(kind, []).includes(key);
}

/**
 * The parsed data for a bare-text body, or `undefined` when the body should go
 * through the normal YAML parse (not a text-first kind, empty, or field-led).
 */
export function textBodyData(kind: BlockType, raw: string): Record<string, unknown> | undefined {
  const field = TEXT_BODY[kind];
  if (field === undefined) return undefined;
  const text = raw.trim();
  if (text === '' || leadsWithField(kind, text)) return undefined;
  return { [field]: text };
}

/**
 * The explicit-YAML equivalent of a bare-text body, or `undefined` when `raw`
 * is not one. Editors (the studio's YAML path ops) canonicalize through this
 * before structured edits, so a bare-text block upgrades to fields instead of
 * failing the edit.
 */
export function textBodyYaml(kind: BlockType, raw: string): string | undefined {
  const data = textBodyData(kind, raw);
  if (data === undefined) return undefined;
  return stringifyYaml(data);
}
