/**
 * SQL DDL → `erd` block data (`avo sync sql schema.sql`). Not a fence
 * dialect: a ```` ```sql ```` fence is usually a plain code sample.
 *
 * Subset: `CREATE TABLE [IF NOT EXISTS] [schema.]name ( … )` with column
 * definitions (`name type [NOT NULL | NULL] [PRIMARY KEY] [UNIQUE] [DEFAULT
 * expr] [REFERENCES t (c) …] [COMMENT '…']`, MySQL `ENUM('a','b')` types,
 * `AUTO_INCREMENT` / `GENERATED … AS IDENTITY` / `CHECK (…)` / `COLLATE` read
 * and dropped) and table constraints (`[CONSTRAINT n] PRIMARY KEY (…)`,
 * `UNIQUE (…)`, `FOREIGN KEY (…) REFERENCES t (…)`, MySQL `KEY` / `INDEX
 * (…)`); `CREATE [UNIQUE] INDEX … ON t (…)`; `ALTER TABLE t ADD [CONSTRAINT]
 * PRIMARY KEY | UNIQUE | FOREIGN KEY …`; `CREATE TYPE t AS ENUM (…)`; `CREATE
 * [MATERIALIZED] VIEW v [(cols)] AS SELECT …` (a `view` entity; columns from
 * the list or a simple select list); `COMMENT ON TABLE | COLUMN … IS '…'`.
 * Postgres (`"x"`), MySQL (`` `x` ``) and SQL Server (`[x]`) quoting; `--`
 * and `/* … *\/` comments; `$$` bodies. The `public` / `dbo` schema prefix
 * is dropped. Any other statement is skipped; a `CREATE TABLE` the subset
 * cannot read fails with its 1-based line.
 */

import {
  addForeignKey,
  emptyModel,
  finalizeModel,
  findEntity,
  toErdData,
  touchColumn,
  touchEntity,
  type DialectResult,
  type SchemaEntity,
  type SchemaModel,
} from './schemaModel.js';

interface Token {
  readonly kind: 'ident' | 'quoted' | 'string' | 'number' | 'punct';
  readonly text: string;
  readonly line: number;
}

const DEFAULT_SCHEMAS = new Set(['public', 'dbo']);

function tokenize(sql: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  let line = 1;
  const n = sql.length;
  while (i < n) {
    const ch = sql[i] ?? '';
    if (ch === '\n') {
      line++;
      i++;
      continue;
    }
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '-' && sql[i + 1] === '-') {
      while (i < n && sql[i] !== '\n') i++;
      continue;
    }
    if (ch === '#' ) {
      // MySQL `#` comment
      while (i < n && sql[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      for (let k = i; k < stop; k++) if (sql[k] === '\n') line++;
      i = stop;
      continue;
    }
    if (ch === '$' && sql[i + 1] === '$') {
      const end = sql.indexOf('$$', i + 2);
      const stop = end === -1 ? n : end + 2;
      const text = sql.slice(i, stop);
      out.push({ kind: 'string', text, line });
      for (const c of text) if (c === '\n') line++;
      i = stop;
      continue;
    }
    if (ch === "'" || ((ch === 'E' || ch === 'e' || ch === 'N') && sql[i + 1] === "'")) {
      let k = ch === "'" ? i + 1 : i + 2;
      let s = '';
      while (k < n) {
        const c = sql[k] ?? '';
        if (c === "'" && sql[k + 1] === "'") {
          s += "'";
          k += 2;
          continue;
        }
        if (c === '\\' && sql[k + 1] === "'") {
          s += "'";
          k += 2;
          continue;
        }
        if (c === "'") break;
        if (c === '\n') line++;
        s += c;
        k++;
      }
      out.push({ kind: 'string', text: s, line });
      i = k + 1;
      continue;
    }
    if (ch === '"' || ch === '`' || ch === '[') {
      const close = ch === '[' ? ']' : ch;
      let k = i + 1;
      let s = '';
      while (k < n && sql[k] !== close) {
        s += sql[k];
        k++;
      }
      out.push({ kind: 'quoted', text: s, line });
      i = k + 1;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(sql[i + 1] ?? ''))) {
      let k = i;
      while (k < n && /[0-9.]/.test(sql[k] ?? '')) k++;
      out.push({ kind: 'number', text: sql.slice(i, k), line });
      i = k;
      continue;
    }
    if (/[A-Za-z_@$]/.test(ch)) {
      let k = i;
      while (k < n && /[A-Za-z0-9_$]/.test(sql[k] ?? '')) k++;
      out.push({ kind: 'ident', text: sql.slice(i, k), line });
      i = k;
      continue;
    }
    if (ch === ':' && sql[i + 1] === ':') {
      out.push({ kind: 'punct', text: '::', line });
      i += 2;
      continue;
    }
    out.push({ kind: 'punct', text: ch, line });
    i++;
  }
  return out;
}

/** Splits the token stream on `;` outside parens. */
function statements(tokens: readonly Token[]): Token[][] {
  const out: Token[][] = [];
  let cur: Token[] = [];
  let depth = 0;
  for (const t of tokens) {
    if (t.kind === 'punct' && t.text === '(') depth++;
    if (t.kind === 'punct' && t.text === ')') depth--;
    if (t.kind === 'punct' && t.text === ';' && depth <= 0) {
      if (cur.length > 0) out.push(cur);
      cur = [];
      depth = 0;
      continue;
    }
    cur.push(t);
  }
  if (cur.length > 0) out.push(cur);
  return out;
}

/** A cursor over one statement's tokens. */
class Cur {
  i = 0;
  constructor(readonly toks: readonly Token[]) {}
  peek(off = 0): Token | undefined {
    return this.toks[this.i + off];
  }
  /** True when the next token is the keyword (case-insensitive). */
  isKw(word: string, off = 0): boolean {
    const t = this.peek(off);
    return t !== undefined && t.kind === 'ident' && t.text.toUpperCase() === word;
  }
  isPunct(p: string, off = 0): boolean {
    const t = this.peek(off);
    return t !== undefined && t.kind === 'punct' && t.text === p;
  }
  next(): Token | undefined {
    const t = this.toks[this.i];
    this.i++;
    return t;
  }
  /** Consumes the keyword sequence when present; returns whether it did. */
  eatKw(...words: string[]): boolean {
    for (let k = 0; k < words.length; k++) if (!this.isKw(words[k] ?? '', k)) return false;
    this.i += words.length;
    return true;
  }
  done(): boolean {
    return this.i >= this.toks.length;
  }
  /** Consumes a balanced `( … )` group and returns the inner tokens. */
  parens(): Token[] | undefined {
    if (!this.isPunct('(')) return undefined;
    this.i++;
    const inner: Token[] = [];
    let depth = 1;
    while (!this.done()) {
      const t = this.next();
      if (t === undefined) break;
      if (t.kind === 'punct' && t.text === '(') depth++;
      if (t.kind === 'punct' && t.text === ')') {
        depth--;
        if (depth === 0) return inner;
      }
      inner.push(t);
    }
    return inner;
  }
  /** A possibly qualified name: `a`, `"a"`, `s.t`. */
  name(): string | undefined {
    const parts: string[] = [];
    for (;;) {
      const t = this.peek();
      if (t === undefined || (t.kind !== 'ident' && t.kind !== 'quoted')) break;
      parts.push(t.text);
      this.i++;
      if (!this.isPunct('.')) break;
      this.i++;
    }
    return parts.length > 0 ? parts.join('.') : undefined;
  }
}

/** Splits inner tokens on top-level commas. */
function splitCommas(tokens: readonly Token[]): Token[][] {
  const out: Token[][] = [];
  let cur: Token[] = [];
  let depth = 0;
  for (const t of tokens) {
    if (t.kind === 'punct' && t.text === '(') depth++;
    if (t.kind === 'punct' && t.text === ')') depth--;
    if (t.kind === 'punct' && t.text === ',' && depth === 0) {
      out.push(cur);
      cur = [];
      continue;
    }
    cur.push(t);
  }
  if (cur.length > 0) out.push(cur);
  return out;
}

/** Column names inside `( a, b )` — quoted or bare; expressions keep their text. */
function columnList(inner: readonly Token[] | undefined): string[] {
  if (inner === undefined) return [];
  return splitCommas(inner)
    .map((ts) => {
      const first = ts[0];
      if (first === undefined) return '';
      // `col ASC`, `col DESC`, `col NULLS FIRST` → the column.
      if ((first.kind === 'ident' || first.kind === 'quoted') && ts.every((t, i) => i === 0 || t.kind === 'ident')) return first.text;
      return render(ts);
    })
    .filter((c) => c.length > 0);
}

/** Tokens back to compact SQL text (`numeric(10,2)`, `now()`, `'x'::text`). */
function render(tokens: readonly Token[]): string {
  let s = '';
  let prev: Token | undefined;
  for (const t of tokens) {
    const text = t.kind === 'string' ? `'${t.text}'` : t.kind === 'ident' ? t.text.toLowerCase() : t.text;
    const glue =
      prev === undefined ||
      (t.kind === 'punct' && (t.text === '(' || t.text === ')' || t.text === ',' || t.text === '::' || t.text === '.' || t.text === ']' || t.text === '[')) ||
      (prev.kind === 'punct' && (prev.text === '(' || prev.text === '::' || prev.text === '.' || prev.text === '[' || prev.text === '-' || prev.text === ','));
    s += (glue ? '' : ' ') + text;
    prev = t;
  }
  return s;
}

/** `schema.table` → `{ schema?, name }`, dropping the default schema. */
function tableRef(model: SchemaModel, qualified: string, kind?: SchemaEntity['kind']): SchemaEntity {
  const parts = qualified.split('.');
  const name = parts[parts.length - 1] ?? qualified;
  const schema = parts.length >= 2 ? parts[parts.length - 2] : undefined;
  const ref = schema !== undefined && !DEFAULT_SCHEMAS.has(schema.toLowerCase()) ? `${schema}.${name}` : name;
  return findEntity(model, ref) ?? touchEntity(model, ref, kind);
}

const CONSTRAINT_STOP = new Set([
  'NOT', 'NULL', 'PRIMARY', 'REFERENCES', 'UNIQUE', 'DEFAULT', 'CHECK', 'AUTO_INCREMENT', 'AUTOINCREMENT',
  'GENERATED', 'COLLATE', 'COMMENT', 'CONSTRAINT', 'IDENTITY', 'ON', 'ENCODE', 'VISIBLE', 'INVISIBLE',
  'STORED', 'VIRTUAL', 'AS', 'KEY', 'CHARACTER', 'CHARSET',
]);

const FK_ACTIONS = new Set(['CASCADE', 'RESTRICT', 'NO', 'ACTION', 'SET', 'NULL', 'DEFAULT']);

/** Parses one column definition (`name type constraints…`) into `entity`. */
function parseColumn(model: SchemaModel, entity: SchemaEntity, c: Cur): string | undefined {
  const nameTok = c.next();
  if (nameTok === undefined || (nameTok.kind !== 'ident' && nameTok.kind !== 'quoted')) return 'expected a column name';
  const col = touchColumn(entity, nameTok.text);

  // The type: tokens up to the first constraint keyword (`CHARACTER SET` stops; `CHARACTER VARYING` is a type).
  const typeToks: Token[] = [];
  while (!c.done()) {
    const t = c.peek();
    if (t === undefined) break;
    if (t.kind === 'ident') {
      const up = t.text.toUpperCase();
      if (up === 'CHARACTER' && c.isKw('SET', 1)) break;
      if (CONSTRAINT_STOP.has(up) && up !== 'CHARACTER') break;
    }
    if (t.kind === 'punct' && t.text === '(') {
      const inner = c.parens() ?? [];
      const head = typeToks[typeToks.length - 1]?.text.toUpperCase();
      if (head === 'ENUM' || head === 'SET') {
        col.enum = inner.filter((x) => x.kind === 'string').map((x) => x.text);
        continue;
      }
      typeToks.push({ kind: 'punct', text: '(', line: t.line }, ...inner, { kind: 'punct', text: ')', line: t.line });
      continue;
    }
    typeToks.push(t);
    c.next();
  }
  if (typeToks.length > 0) col.type = render(typeToks);
  if (col.enum !== undefined && col.type !== undefined) col.type = col.type.toLowerCase();

  // Constraints, in any order; unknown words are skipped.
  while (!c.done()) {
    const t = c.next();
    if (t === undefined) break;
    if (t.kind !== 'ident') continue;
    const up = t.text.toUpperCase();
    if (up === 'NOT' && c.eatKw('NULL')) col.nullable = false;
    else if (up === 'NULL') col.nullable = true;
    else if (up === 'PRIMARY') {
      c.eatKw('KEY');
      col.pk = true;
    } else if (up === 'UNIQUE') {
      c.eatKw('KEY');
      col.unique = true;
    } else if (up === 'DEFAULT') {
      const expr: Token[] = [];
      if (c.isPunct('(')) {
        const inner = c.parens() ?? [];
        expr.push({ kind: 'punct', text: '(', line: t.line }, ...inner, { kind: 'punct', text: ')', line: t.line });
      } else {
        if (c.isPunct('-')) expr.push(c.next() as Token);
        const v = c.next();
        if (v !== undefined) expr.push(v);
        if (c.isPunct('(')) {
          const inner = c.parens() ?? [];
          expr.push({ kind: 'punct', text: '(', line: t.line }, ...inner, { kind: 'punct', text: ')', line: t.line });
        }
      }
      while (c.isPunct('::')) {
        expr.push(c.next() as Token);
        const ty = c.next();
        if (ty !== undefined) expr.push(ty);
        if (c.isPunct('(')) {
          const inner = c.parens() ?? [];
          expr.push({ kind: 'punct', text: '(', line: t.line }, ...inner, { kind: 'punct', text: ')', line: t.line });
        }
      }
      col.default = render(expr);
    } else if (up === 'REFERENCES') {
      const target = c.name();
      if (target === undefined) return `REFERENCES on ${entity.name}.${col.name} names no table`;
      const cols = columnList(c.parens());
      const parent = tableRef(model, target, 'external');
      const parentCols = cols.length > 0 ? cols : parent.columns.filter((x) => x.pk === true).map((x) => x.name);
      addForeignKey(model, entity, [col.name], parent, parentCols.length > 0 ? parentCols : ['id']);
      // MATCH … / ON DELETE … / ON UPDATE …
      while (c.isKw('MATCH') || c.isKw('ON')) {
        if (c.eatKw('MATCH')) c.next();
        else {
          c.next(); // ON
          c.next(); // DELETE | UPDATE
          while (!c.done() && c.peek()?.kind === 'ident' && FK_ACTIONS.has((c.peek()?.text ?? '').toUpperCase())) c.next();
        }
      }
    } else if (up === 'CHECK') c.parens();
    else if (up === 'COMMENT') {
      if (c.isPunct('=')) c.next();
      const v = c.next();
      if (v !== undefined && v.kind === 'string') col.note = v.text;
    } else if (up === 'COLLATE') c.next();
    else if (up === 'CHARACTER' || up === 'CHARSET') {
      c.eatKw('SET');
      c.next();
    } else if (up === 'CONSTRAINT') c.next();
    else if (up === 'GENERATED') {
      // GENERATED { ALWAYS | BY DEFAULT } AS { IDENTITY [(…)] | (expr) [STORED|VIRTUAL] }
      while (!c.done() && !c.isKw('AS')) c.next();
      c.eatKw('AS');
      if (c.eatKw('IDENTITY')) c.parens();
      else c.parens();
    } else if (up === 'AS') c.parens();
    else if (up === 'IDENTITY') c.parens();
    else if (up === 'ON') {
      c.next(); // UPDATE
      c.next(); // expr
      c.parens();
    }
    // AUTO_INCREMENT, AUTOINCREMENT, ENCODE x, VISIBLE, STORED, VIRTUAL, KEY: dropped
  }
  if (typeToks.length === 0) return `column ${col.name} has no type`;
  return undefined;
}

/** A table-level constraint item; returns false when the item is not one (a column follows). */
function parseTableConstraint(model: SchemaModel, entity: SchemaEntity, c: Cur): boolean {
  if (c.eatKw('CONSTRAINT')) c.name();
  if (c.eatKw('PRIMARY', 'KEY')) {
    if (!c.isPunct('(')) c.name();
    for (const col of columnList(c.parens())) touchColumn(entity, col).pk = true;
    return true;
  }
  if (c.isKw('UNIQUE')) {
    c.next();
    if (c.isKw('KEY') || c.isKw('INDEX')) c.next();
    if (!c.isPunct('(')) c.name();
    const cols = columnList(c.parens());
    if (cols.length === 1 && cols[0] !== undefined) touchColumn(entity, cols[0]).unique = true;
    else entity.indexes.push({ columns: cols, unique: true });
    return true;
  }
  if (c.eatKw('FOREIGN', 'KEY')) {
    if (!c.isPunct('(')) c.name();
    const cols = columnList(c.parens());
    if (!c.eatKw('REFERENCES')) return true;
    const target = c.name();
    if (target === undefined) return true;
    const parent = tableRef(model, target, 'external');
    const pcols = columnList(c.parens());
    addForeignKey(model, entity, cols, parent, pcols.length > 0 ? pcols : parent.columns.filter((x) => x.pk === true).map((x) => x.name));
    return true;
  }
  if (c.isKw('KEY') || c.isKw('INDEX')) {
    c.next();
    if (!c.isPunct('(')) c.name();
    const cols = columnList(c.parens());
    if (cols.length === 1 && cols[0] !== undefined) touchColumn(entity, cols[0]).index = true;
    else entity.indexes.push({ columns: cols });
    return true;
  }
  if (c.isKw('CHECK') || c.isKw('EXCLUDE') || c.isKw('FULLTEXT') || c.isKw('SPATIAL') || c.isKw('LIKE') || c.isKw('PERIOD')) {
    return true; // dropped
  }
  return false;
}

export function convertSqlDdl(text: string): DialectResult {
  const model = emptyModel();
  const fail = (message: string, line: number): DialectResult => ({ ok: false, message, line });
  const stmts = statements(tokenize(text));

  for (const toks of stmts) {
    const c = new Cur(toks);
    const line = toks[0]?.line ?? 1;
    if (c.eatKw('CREATE')) {
      let unique = false;
      let view = false;
      for (;;) {
        if (c.eatKw('OR', 'REPLACE') || c.eatKw('TEMP') || c.eatKw('TEMPORARY') || c.eatKw('UNLOGGED') || c.eatKw('GLOBAL') || c.eatKw('LOCAL')) continue;
        if (c.eatKw('MATERIALIZED')) {
          view = true;
          continue;
        }
        if (c.eatKw('UNIQUE')) {
          unique = true;
          continue;
        }
        break;
      }
      if (c.eatKw('TABLE')) {
        c.eatKw('IF', 'NOT', 'EXISTS');
        const name = c.name();
        if (name === undefined) return fail('CREATE TABLE without a table name', line);
        const entity = tableRef(model, name);
        if (entity.kind === 'external') delete entity.kind;
        const body = c.parens();
        if (body === undefined) return fail(`CREATE TABLE ${name}: expected \`(\` after the table name`, line);
        for (const item of splitCommas(body)) {
          if (item.length === 0) continue;
          const ic = new Cur(item);
          if (parseTableConstraint(model, entity, ic)) continue;
          const err = parseColumn(model, entity, new Cur(item));
          if (err !== undefined) return fail(`CREATE TABLE ${name}: ${err}`, item[0]?.line ?? line);
        }
        // Table options: `COMMENT [=] '…'` (MySQL) becomes the note.
        while (!c.done()) {
          if (c.eatKw('COMMENT')) {
            if (c.isPunct('=')) c.next();
            const v = c.next();
            if (v !== undefined && v.kind === 'string') entity.note = v.text;
          } else c.next();
        }
        continue;
      }
      if (c.eatKw('INDEX')) {
        c.eatKw('CONCURRENTLY');
        c.eatKw('IF', 'NOT', 'EXISTS');
        let ixName: string | undefined;
        if (!c.isKw('ON')) ixName = c.name();
        if (!c.eatKw('ON')) continue;
        c.eatKw('ONLY');
        const table = c.name();
        if (table === undefined) continue;
        if (c.eatKw('USING')) c.next();
        const cols = columnList(c.parens());
        const entity = tableRef(model, table);
        if (cols.length === 1 && cols[0] !== undefined && findEntity(model, table) !== undefined && !/[()]/.test(cols[0])) {
          const col = touchColumn(entity, cols[0]);
          if (unique) col.unique = true;
          else col.index = true;
        } else if (cols.length > 0) {
          entity.indexes.push({ columns: cols, ...(unique ? { unique: true } : {}), ...(ixName !== undefined ? { name: ixName } : {}) });
        }
        continue;
      }
      if (c.eatKw('VIEW') || view) {
        if (!view) view = true;
        c.eatKw('IF', 'NOT', 'EXISTS');
        const name = c.name();
        if (name === undefined) continue;
        const entity = tableRef(model, name, 'view');
        entity.kind = 'view';
        const explicit = c.isPunct('(') ? columnList(c.parens()) : [];
        for (const col of explicit) touchColumn(entity, col);
        if (explicit.length === 0 && c.eatKw('AS') && c.eatKw('SELECT')) {
          c.eatKw('DISTINCT');
          const sel: Token[] = [];
          let depth = 0;
          while (!c.done()) {
            const t = c.peek();
            if (t === undefined) break;
            if (t.kind === 'punct' && t.text === '(') depth++;
            if (t.kind === 'punct' && t.text === ')') depth--;
            if (depth === 0 && t.kind === 'ident' && t.text.toUpperCase() === 'FROM') break;
            sel.push(t);
            c.next();
          }
          for (const item of splitCommas(sel)) {
            const last = item[item.length - 1];
            if (last === undefined || (last.kind === 'punct' && last.text === '*')) continue;
            if (last.kind === 'ident' || last.kind === 'quoted') touchColumn(entity, last.text);
          }
        }
        continue;
      }
      if (c.eatKw('TYPE')) {
        const name = c.name();
        if (name === undefined || !c.eatKw('AS', 'ENUM')) continue;
        const values = (c.parens() ?? []).filter((t) => t.kind === 'string').map((t) => t.text);
        const parts = name.split('.');
        model.enums.push({ name: parts[parts.length - 1] ?? name, values });
        continue;
      }
      continue; // CREATE SCHEMA / EXTENSION / FUNCTION / TRIGGER / SEQUENCE …
    }
    if (c.eatKw('ALTER', 'TABLE')) {
      c.eatKw('ONLY');
      c.eatKw('IF', 'EXISTS');
      const name = c.name();
      if (name === undefined) continue;
      const entity = tableRef(model, name);
      const rest = toks.slice(c.i);
      for (const clause of splitCommas(rest)) {
        const cc = new Cur(clause);
        if (!cc.eatKw('ADD')) continue;
        if (parseTableConstraint(model, entity, cc)) continue;
        cc.eatKw('COLUMN');
        cc.eatKw('IF', 'NOT', 'EXISTS');
        parseColumn(model, entity, cc);
      }
      continue;
    }
    if (c.eatKw('COMMENT', 'ON')) {
      const what = c.next()?.text.toUpperCase();
      const name = c.name();
      if (name === undefined || !c.eatKw('IS')) continue;
      const v = c.next();
      if (v === undefined || v.kind !== 'string') continue;
      if (what === 'TABLE') tableRef(model, name).note = v.text;
      else if (what === 'COLUMN') {
        const parts = name.split('.');
        const col = parts.pop() ?? '';
        const e = tableRef(model, parts.join('.'));
        touchColumn(e, col).note = v.text;
      }
      continue;
    }
    // Anything else (INSERT, SET, GRANT, CREATE FUNCTION …) is not schema.
  }

  finalizeModel(model);
  return { ok: true, data: toErdData(model) };
}
