/**
 * DBML → `erd` block data (the ```` ```dbml ```` fence dialect and `avo sync dbml`).
 *
 * Subset: `Table [schema.]name [as Alias] { … }` with columns
 * `name type [pk, primary key, unique, not null, null, increment,
 * default: …, note: '…', ref: > t.c | < t.c | - t.c | <> t.c]`, a `Note:`
 * line (or `Note: '''…'''` block) and an `indexes { (a, b) [unique, name:
 * '…'] }` block; `Ref [name]: a.b > c.d` (`>` many-to-one, `<` one-to-many,
 * `-` one-to-one, `<>` many-to-many; composite `t.(a, b)`) and the `Ref {
 * … }` block form; `Enum [schema.]name { value [note: '…'] }`; `TableGroup
 * name { t1 t2 }`. `Project { … }` and sticky `Note x { … }` blocks are
 * skipped; `//` and `/* … *\/` comments are ignored. Ref settings (`delete:
 * cascade`), `increment`, table header settings and index `type:` are read
 * and dropped. Any other line fails with its 1-based body line.
 */

import {
  addForeignKey,
  ambiguousMessage,
  declareEntity,
  emptyModel,
  entityLabel,
  finalizeModel,
  findEntity,
  matchEntity,
  qualifiedName,
  setEntityAlias,
  splitQualified,
  toErdData,
  touchColumn,
  touchEntity,
  unquoteIdent,
  type DialectResult,
  type SchemaEntity,
  type SchemaModel,
} from './schemaModel.js';

const NAME = `(?:"[^"]+"|[\\w]+)(?:\\.(?:"[^"]+"|[\\w]+))*`;
const TABLE_RE = new RegExp(`^(?:Table|table)\\s+(${NAME})(?:\\s+as\\s+(\\w+))?\\s*(?:\\[[^\\]]*\\])?\\s*\\{\\s*$`);
const ENUM_RE = new RegExp(`^(?:Enum|enum)\\s+(${NAME})\\s*\\{\\s*$`);
const GROUP_RE = new RegExp(`^(?:TableGroup|tablegroup)\\s+(${NAME})\\s*(?:\\[[^\\]]*\\])?\\s*\\{\\s*$`);
const REF_LINE_RE = /^(?:Ref|ref)(?:\s+\w+)?\s*:\s*(.+)$/;
const REF_BLOCK_RE = /^(?:Ref|ref)(?:\s+\w+)?\s*\{\s*$/;
const SKIP_BLOCK_RE = /^(?:Project|project|Note|note|TablePartial)\b.*\{/;
const COLUMN_RE = /^("[^"]+"|[\w]+)\s+("[^"]+"|[\w.]+(?:\([^)]*\))?(?:\[\])?)\s*(?:\[(.*)\])?\s*$/;
const REL_RE = new RegExp(`^(${NAME}(?:\\.\\([^)]*\\))?)\\s*(<>|<|>|-)\\s*(${NAME}(?:\\.\\([^)]*\\))?)\\s*(?:\\[[^\\]]*\\])?\\s*$`);
const INDEX_RE = /^(\([^)]*\)|"[^"]+"|[\w]+)\s*(?:\[(.*)\])?\s*$/;
const NOTE_RE = /^(?:Note|note)\s*:\s*(.*)$/;

interface Line {
  readonly text: string;
  readonly line: number;
}

/** Strips `//` line comments and `/* … *\/` block comments, keeping line numbers. */
function meaningfulLines(text: string): Line[] {
  const out: Line[] = [];
  let inBlock = false;
  text.split('\n').forEach((raw, i) => {
    let s = '';
    let quote: string | undefined;
    for (let k = 0; k < raw.length; k++) {
      const ch = raw[k] ?? '';
      if (inBlock) {
        if (ch === '*' && raw[k + 1] === '/') {
          inBlock = false;
          k++;
        }
        continue;
      }
      if (quote !== undefined) {
        s += ch;
        if (ch === quote) quote = undefined;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
        s += ch;
        continue;
      }
      if (ch === '/' && raw[k + 1] === '/') break;
      if (ch === '/' && raw[k + 1] === '*') {
        inBlock = true;
        k++;
        continue;
      }
      s += ch;
    }
    const t = s.trim();
    if (t.length > 0) out.push({ text: t, line: i + 1 });
  });
  return out;
}

/** Splits a settings body on commas outside quotes / parens / backticks. */
function splitSettings(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  let depth = 0;
  let quote: string | undefined;
  for (const ch of s) {
    if (quote !== undefined) {
      cur += ch;
      if (ch === quote) quote = undefined;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim().length > 0) out.push(cur.trim());
  return out;
}

/** `'active'` → `active`, `` `now()` `` → `now()`, `"x"` → `x`; numbers and booleans as written. */
function literal(v: string): string {
  const t = v.trim();
  if (t.length >= 2 && ((t.startsWith('`') && t.endsWith('`')) || (t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"')))) {
    return t.slice(1, -1);
  }
  return t;
}

/** `t.(a, b)` → `{ table: 't', cols: ['a', 'b'] }`; `s.t.c` → `{ table: 's.t', cols: ['c'] }`. */
function endpoint(s: string): { table: string; cols: string[] } | undefined {
  const comp = /^(.*)\.\(([^)]*)\)$/.exec(s.trim());
  if (comp !== null) {
    return {
      table: comp[1] ?? '',
      cols: (comp[2] ?? '')
        .split(',')
        .map((c) => unquoteIdent(c))
        .filter((c) => c.length > 0),
    };
  }
  const parts = splitQualified(s);
  if (parts.length < 2) return undefined;
  const col = parts[parts.length - 1] ?? '';
  return { table: parts.slice(0, -1).join('.'), cols: [col] };
}

interface PendingRef {
  readonly left: { table: string; cols: string[] };
  readonly op: string;
  readonly right: { table: string; cols: string[] };
  readonly line: number;
}

/** Resolves one endpoint of a `Ref`; an ambiguous bare name is the failure. */
function refSide(model: SchemaModel, ref: string): SchemaEntity | string {
  const m = matchEntity(model, ref);
  if (m.kind === 'one') return m.entity;
  if (m.kind === 'ambiguous') return ambiguousMessage(ref, m.candidates);
  return touchEntity(model, ref, 'external');
}

/** Resolves a `Ref` into the model once every table is known. */
function applyRef(model: SchemaModel, p: PendingRef): DialectResult | undefined {
  const left = refSide(model, p.left.table);
  if (typeof left === 'string') return { ok: false, message: left, line: p.line };
  const right = refSide(model, p.right.table);
  if (typeof right === 'string') return { ok: false, message: right, line: p.line };
  if (p.op === '>') {
    addForeignKey(model, left, p.left.cols, right, p.right.cols);
  } else if (p.op === '<') {
    addForeignKey(model, right, p.right.cols, left, p.left.cols);
  } else if (p.op === '-') {
    // One-to-one: the FK sits on the side whose column is not the key.
    const leftIsPk = p.left.cols.every((c) => left.columns.find((x) => x.name === c)?.pk === true);
    if (leftIsPk && !p.right.cols.every((c) => right.columns.find((x) => x.name === c)?.pk === true)) {
      addForeignKey(model, right, p.right.cols, left, p.left.cols);
    } else {
      addForeignKey(model, left, p.left.cols, right, p.right.cols);
    }
    const rel = model.relations[model.relations.length - 1];
    if (rel !== undefined) rel.card = '1:1';
  } else {
    model.relations.push({ from: qualifiedName(left), to: qualifiedName(right), card: 'N:M' });
  }
  return undefined;
}

export function convertDbml(text: string): DialectResult {
  const lines = meaningfulLines(text);
  const model = emptyModel();
  const pending: PendingRef[] = [];
  let mode: 'top' | 'table' | 'indexes' | 'enum' | 'group' | 'ref' | 'skip' | 'noteblock' = 'top';
  let depth = 0; // brace depth inside a skipped block
  let table: SchemaEntity | undefined;
  let enumName = '';
  let enumValues: string[] = [];
  let group: { name: string; entities: string[] } | undefined;
  let noteBuf: string[] = [];

  const fail = (message: string, line: number): DialectResult => ({ ok: false, message, line });

  const parseRel = (expr: string, line: number): DialectResult | undefined => {
    const m = REL_RE.exec(expr);
    if (m === null) return fail(`cannot read Ref "${expr}" (expected \`a.b > c.d\`)`, line);
    const left = endpoint(m[1] ?? '');
    const right = endpoint(m[3] ?? '');
    if (left === undefined || right === undefined) return fail(`Ref "${expr}" needs \`table.column\` on both sides`, line);
    pending.push({ left, op: m[2] ?? '>', right, line });
    return undefined;
  };

  for (const { text: t, line } of lines) {
    if (mode === 'skip') {
      depth += (t.match(/\{/g) ?? []).length - (t.match(/\}/g) ?? []).length;
      if (depth <= 0) mode = 'top';
      continue;
    }
    if (mode === 'noteblock') {
      if (t.includes("'''")) {
        noteBuf.push(t.slice(0, t.indexOf("'''")).trim());
        if (table !== undefined) table.note = noteBuf.filter((l) => l.length > 0).join(' ');
        noteBuf = [];
        mode = 'table';
      } else noteBuf.push(t);
      continue;
    }
    if (mode === 'table' && table !== undefined) {
      if (t === '}') {
        mode = 'top';
        table = undefined;
        continue;
      }
      if (/^(?:indexes|Indexes)\s*\{\s*$/.test(t)) {
        mode = 'indexes';
        continue;
      }
      const note = NOTE_RE.exec(t);
      if (note !== null) {
        const v = note[1] ?? '';
        if (v.startsWith("'''")) {
          const rest = v.slice(3);
          if (rest.includes("'''")) table.note = rest.slice(0, rest.indexOf("'''")).trim();
          else {
            noteBuf = [rest.trim()];
            mode = 'noteblock';
          }
        } else if (/^(?:Note|note)\s*\{/.test(t)) {
          // `Note { '''…''' }` — handled by the same buffer.
          noteBuf = [];
          mode = 'noteblock';
        } else table.note = literal(v);
        continue;
      }
      if (/^(?:Note|note)\s*\{\s*$/.test(t)) {
        noteBuf = [];
        mode = 'noteblock';
        continue;
      }
      const c = COLUMN_RE.exec(t);
      if (c === null) return fail(`cannot read column in ${table.name}: "${t}" (expected \`name type [settings]\`)`, line);
      const col = touchColumn(table, unquoteIdent(c[1] ?? ''));
      col.type = unquoteIdent(c[2] ?? '');
      for (const setting of splitSettings(c[3] ?? '')) {
        const lower = setting.toLowerCase();
        const kv = /^([\w ]+?)\s*:\s*(.*)$/.exec(setting);
        if (lower === 'pk' || lower === 'primary key') col.pk = true;
        else if (lower === 'unique') col.unique = true;
        else if (lower === 'not null') col.nullable = false;
        else if (lower === 'null') col.nullable = true;
        else if (lower === 'increment') continue;
        else if (kv !== null) {
          const key = (kv[1] ?? '').trim().toLowerCase();
          const value = kv[2] ?? '';
          if (key === 'default') col.default = literal(value);
          else if (key === 'note') col.note = literal(value);
          else if (key === 'ref') {
            const m = /^(<>|<|>|-)\s*(.+)$/.exec(value.trim());
            if (m === null) return fail(`cannot read inline ref "${value}" in ${table.name}.${col.name}`, line);
            const other = endpoint(m[2] ?? '');
            if (other === undefined) return fail(`inline ref "${value}" needs \`table.column\``, line);
            const self = table.schema !== undefined ? `${table.schema}.${table.name}` : table.name;
            pending.push({ left: { table: self, cols: [col.name] }, op: m[1] ?? '>', right: other, line });
          }
          // any other `key: value` setting is dropped
        } else return fail(`unknown column setting "${setting}" in ${table.name}.${col.name}`, line);
      }
      continue;
    }
    if (mode === 'indexes' && table !== undefined) {
      if (t === '}') {
        mode = 'table';
        continue;
      }
      const ix = INDEX_RE.exec(t);
      if (ix === null) return fail(`cannot read index in ${table.name}: "${t}"`, line);
      const spec = ix[1] ?? '';
      const cols = spec.startsWith('(')
        ? spec
            .slice(1, -1)
            .split(',')
            .map((c) => unquoteIdent(c))
            .filter((c) => c.length > 0)
        : [unquoteIdent(spec)];
      let unique = false;
      let pk = false;
      let name: string | undefined;
      for (const setting of splitSettings(ix[2] ?? '')) {
        const lower = setting.toLowerCase();
        const kv = /^([\w]+)\s*:\s*(.*)$/.exec(setting);
        if (lower === 'unique') unique = true;
        else if (lower === 'pk') pk = true;
        else if (kv !== null && (kv[1] ?? '').toLowerCase() === 'name') name = literal(kv[2] ?? '');
      }
      if (pk) for (const c of cols) touchColumn(table, c).pk = true;
      else if (cols.length === 1 && cols[0] !== undefined) {
        const c = touchColumn(table, cols[0]);
        if (unique) c.unique = true;
        else c.index = true;
      } else table.indexes.push({ columns: cols, ...(unique ? { unique: true } : {}), ...(name !== undefined ? { name } : {}) });
      continue;
    }
    if (mode === 'enum') {
      if (t === '}') {
        model.enums.push({ name: enumName, values: enumValues });
        mode = 'top';
        continue;
      }
      const v = /^("[^"]+"|[\w-]+)\s*(?:\[.*\])?\s*$/.exec(t);
      if (v === null) return fail(`cannot read enum value in ${enumName}: "${t}"`, line);
      enumValues.push(unquoteIdent(v[1] ?? ''));
      continue;
    }
    if (mode === 'group' && group !== undefined) {
      if (t === '}') {
        model.groups.push(group);
        mode = 'top';
        group = undefined;
        continue;
      }
      if (NOTE_RE.test(t)) continue;
      const parts = splitQualified(t);
      group.entities.push(parts.join('.'));
      continue;
    }
    if (mode === 'ref') {
      if (t === '}') {
        mode = 'top';
        continue;
      }
      const err = parseRel(t, line);
      if (err !== undefined) return err;
      continue;
    }

    // top level
    const tm = TABLE_RE.exec(t);
    if (tm !== null) {
      const decl = declareEntity(model, tm[1] ?? '');
      if (decl.duplicate) return fail(`table ${entityLabel(decl.entity)} is declared twice`, line);
      table = decl.entity;
      if (table.kind === 'external') delete table.kind;
      if (tm[2] !== undefined) setEntityAlias(model, table, tm[2]);
      mode = 'table';
      continue;
    }
    const em = ENUM_RE.exec(t);
    if (em !== null) {
      const parts = splitQualified(em[1] ?? '');
      enumName = parts[parts.length - 1] ?? '';
      enumValues = [];
      mode = 'enum';
      continue;
    }
    const gm = GROUP_RE.exec(t);
    if (gm !== null) {
      group = { name: unquoteIdent(gm[1] ?? ''), entities: [] };
      mode = 'group';
      continue;
    }
    const rl = REF_LINE_RE.exec(t);
    if (rl !== null) {
      const err = parseRel(rl[1] ?? '', line);
      if (err !== undefined) return err;
      continue;
    }
    if (REF_BLOCK_RE.test(t)) {
      mode = 'ref';
      continue;
    }
    if (SKIP_BLOCK_RE.test(t)) {
      // `Project x { … }` may close on the same line.
      depth = (t.match(/\{/g) ?? []).length - (t.match(/\}/g) ?? []).length;
      if (depth > 0) mode = 'skip';
      continue;
    }
    return fail(`cannot read DBML line: "${t}" (expected \`Table x {\`, \`Ref: a.b > c.d\`, \`Enum x {\` or \`TableGroup x {\`)`, line);
  }

  if (mode !== 'top') {
    const last = lines[lines.length - 1]?.line ?? 1;
    if (mode === 'table' || mode === 'indexes') return fail(`table ${table?.name ?? ''} is missing its closing \`}\``, last);
    return fail('a block is missing its closing `}`', last);
  }

  // Every table is known now: fix the reference names before relations are built.
  finalizeModel(model);
  for (const p of pending) {
    const err = applyRef(model, p);
    if (err !== undefined) return err;
  }
  // A group may name a table by alias or `schema.table` — normalise to entity names.
  for (const g of model.groups) {
    g.entities = g.entities.map((n) => {
      const e = findEntity(model, n);
      return e !== undefined ? qualifiedName(e) : n;
    });
  }
  return { ok: true, data: toErdData(model) };
}
