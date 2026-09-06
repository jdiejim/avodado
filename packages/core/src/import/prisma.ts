/**
 * Prisma schema → `erd` block data (the ```` ```prisma ```` fence dialect and
 * `avo sync prisma`).
 *
 * Subset: `model X { … }` (and `view X { … }`) with scalar fields
 * `name Type[?|[]] @id @unique @default(…) @map(…) @db.…(…) @updatedAt`,
 * relation fields `author User @relation(fields: [authorId], references:
 * [id], name?, onDelete?)` (the `fields` become foreign keys; the relation
 * is `N:1`, or `1:1` when the foreign key is unique), back-relation lists
 * (`posts Post[]`, dropped as columns) and implicit many-to-many (a list on
 * both sides → one `N:M` relation); block attributes `@@id([…])`,
 * `@@unique([…])`, `@@index([…])`, `@@schema("…")`; `enum X { … }`; a `///`
 * doc comment becomes the next model's or field's `note`. `datasource`,
 * `generator` and composite `type` blocks are skipped; `@map` / `@@map`,
 * `@db.*`, `@updatedAt`, `@ignore` and `onDelete` / `onUpdate` are read and
 * dropped. Any other line fails with its 1-based body line.
 */

import {
  addForeignKey,
  emptyModel,
  finalizeModel,
  findEntity,
  qualifiedName,
  toErdData,
  touchColumn,
  touchEntity,
  type DialectResult,
  type SchemaEntity,
} from './schemaModel.js';

const BLOCK_RE = /^(model|view|enum|type|datasource|generator)\s+(\w+)\s*\{\s*$/;
const FIELD_RE = /^(\w+)\s+(\w+(?:\("[^"]*"\))?)(\?|\[\])?\s*(.*)$/;
const ENUM_VALUE_RE = /^(\w+)\s*(?:@.*)?$/;

interface Line {
  readonly text: string;
  readonly line: number;
  /** A `///` doc comment line (its text, without the slashes). */
  readonly doc?: string;
}

/** Non-blank lines with `//` comments stripped (outside strings); `///` lines kept as docs. */
function meaningfulLines(text: string): Line[] {
  const out: Line[] = [];
  text.split('\n').forEach((raw, i) => {
    const t0 = raw.trim();
    if (t0.startsWith('///')) {
      out.push({ text: '', line: i + 1, doc: t0.slice(3).trim() });
      return;
    }
    let s = '';
    let inStr = false;
    for (let k = 0; k < raw.length; k++) {
      const ch = raw[k] ?? '';
      if (inStr) {
        s += ch;
        if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') {
        inStr = true;
        s += ch;
        continue;
      }
      if (ch === '/' && raw[k + 1] === '/') break;
      s += ch;
    }
    const t = s.trim();
    if (t.length > 0) out.push({ text: t, line: i + 1 });
  });
  return out;
}

/** Splits `@a @b(x, y) @c` into its attributes (an `@` outside parens / strings starts one). */
function splitAttrs(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  let depth = 0;
  let inStr = false;
  for (const ch of s) {
    if (inStr) {
      cur += ch;
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === '@' && depth === 0 && cur.trim().length > 0) {
      out.push(cur.trim());
      cur = '';
    }
    cur += ch;
  }
  if (cur.trim().length > 0) out.push(cur.trim());
  return out;
}

/** Splits an argument list on commas outside brackets / parens / strings. */
function splitArgs(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  let depth = 0;
  let inStr = false;
  for (const ch of s) {
    if (inStr) {
      cur += ch;
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
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

/** `[a, b]` → `['a', 'b']`. */
function list(s: string): string[] {
  const t = s.trim();
  const inner = t.startsWith('[') && t.endsWith(']') ? t.slice(1, -1) : t;
  return inner
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

/** `"x"` → `x`. */
function unstr(s: string): string {
  const t = s.trim();
  return t.length >= 2 && t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
}

interface RelationArgs {
  name?: string;
  fields?: string[];
  references?: string[];
}

function relationArgs(inner: string): RelationArgs {
  const out: RelationArgs = {};
  for (const arg of splitArgs(inner)) {
    const kv = /^(\w+)\s*:\s*([\s\S]*)$/.exec(arg);
    if (kv === null) {
      if (arg.startsWith('"')) out.name = unstr(arg);
      continue;
    }
    const key = kv[1] ?? '';
    const value = kv[2] ?? '';
    if (key === 'fields') out.fields = list(value);
    else if (key === 'references') out.references = list(value);
    else if (key === 'name') out.name = unstr(value);
  }
  return out;
}

interface RelationField {
  readonly model: SchemaEntity;
  readonly field: string;
  readonly target: string;
  readonly isList: boolean;
  readonly optional: boolean;
  readonly args: RelationArgs;
  readonly line: number;
}

export function convertPrisma(text: string): DialectResult {
  const lines = meaningfulLines(text);
  const fail = (message: string, line: number): DialectResult => ({ ok: false, message, line });

  // Pass 1: the names a field type may refer to.
  const modelNames = new Set<string>();
  const enumNames = new Set<string>();
  for (const l of lines) {
    const b = BLOCK_RE.exec(l.text);
    if (b === null) continue;
    if (b[1] === 'model' || b[1] === 'view') modelNames.add(b[2] ?? '');
    if (b[1] === 'enum') enumNames.add(b[2] ?? '');
  }

  const model = emptyModel();
  const relFields: RelationField[] = [];
  let mode: 'top' | 'model' | 'enum' | 'skip' = 'top';
  let entity: SchemaEntity | undefined;
  let enumName = '';
  let enumValues: string[] = [];
  let doc: string[] = [];

  for (const l of lines) {
    if (l.doc !== undefined) {
      doc.push(l.doc);
      continue;
    }
    const t = l.text;
    if (mode === 'skip') {
      if (t === '}') mode = 'top';
      continue;
    }
    if (mode === 'enum') {
      if (t === '}') {
        model.enums.push({ name: enumName, values: enumValues });
        mode = 'top';
        doc = [];
        continue;
      }
      if (t.startsWith('@@')) continue;
      const v = ENUM_VALUE_RE.exec(t);
      if (v === null) return fail(`cannot read enum value in ${enumName}: "${t}"`, l.line);
      enumValues.push(v[1] ?? '');
      doc = [];
      continue;
    }
    if (mode === 'model' && entity !== undefined) {
      if (t === '}') {
        mode = 'top';
        entity = undefined;
        doc = [];
        continue;
      }
      if (t.startsWith('@@')) {
        const m = /^@@(\w+)\s*(?:\(([\s\S]*)\))?$/.exec(t);
        if (m === null) return fail(`cannot read block attribute in ${entity.name}: "${t}"`, l.line);
        const attr = m[1] ?? '';
        const args = splitArgs(m[2] ?? '');
        const first = args[0] ?? '';
        if (attr === 'id') for (const c of list(first)) touchColumn(entity, c).pk = true;
        else if (attr === 'unique' || attr === 'index') {
          const cols = list(first);
          const named = args.find((a) => a.startsWith('name:') || a.startsWith('map:'));
          const name = named !== undefined ? unstr(named.slice(named.indexOf(':') + 1)) : undefined;
          if (cols.length === 1 && cols[0] !== undefined && name === undefined) {
            const c = touchColumn(entity, cols[0]);
            if (attr === 'unique') c.unique = true;
            else c.index = true;
          } else {
            entity.indexes.push({
              columns: cols,
              ...(attr === 'unique' ? { unique: true } : {}),
              ...(name !== undefined ? { name } : {}),
            });
          }
        } else if (attr === 'schema') entity.schema = unstr(first);
        // @@map, @@ignore, @@fulltext: dropped
        doc = [];
        continue;
      }
      const f = FIELD_RE.exec(t);
      if (f === null) return fail(`cannot read field in ${entity.name}: "${t}" (expected \`name Type @attrs\`)`, l.line);
      const name = f[1] ?? '';
      const rawType = f[2] ?? '';
      const mod = f[3];
      const attrs = splitAttrs(f[4] ?? '');
      const note = doc.length > 0 ? doc.join(' ') : undefined;
      doc = [];
      if (modelNames.has(rawType)) {
        const rel = attrs.find((a) => a.startsWith('@relation'));
        const inner = rel !== undefined ? /^@relation\s*\(([\s\S]*)\)$/.exec(rel)?.[1] ?? '' : '';
        relFields.push({
          model: entity,
          field: name,
          target: rawType,
          isList: mod === '[]',
          optional: mod === '?',
          args: relationArgs(inner),
          line: l.line,
        });
        continue;
      }
      const col = touchColumn(entity, name);
      const unsupported = /^Unsupported\("([^"]*)"\)$/.exec(rawType);
      col.type = (unsupported !== null ? unsupported[1] ?? rawType : rawType) + (mod === '[]' ? '[]' : '');
      if (mod === '?') col.nullable = true;
      if (note !== undefined) col.note = note;
      for (const a of attrs) {
        const am = /^@([\w.]+)\s*(?:\(([\s\S]*)\))?$/.exec(a);
        if (am === null) return fail(`cannot read attribute "${a}" on ${entity.name}.${name}`, l.line);
        const key = am[1] ?? '';
        const arg = am[2] ?? '';
        if (key === 'id') col.pk = true;
        else if (key === 'unique') col.unique = true;
        else if (key === 'default') {
          const dbg = /^dbgenerated\(\s*"([^"]*)"\s*\)$/.exec(arg.trim());
          col.default = dbg !== null ? dbg[1] ?? arg : unstr(arg);
        }
        // @map, @db.*, @updatedAt, @ignore, @relation on a scalar: dropped
      }
      continue;
    }

    // top level
    const b = BLOCK_RE.exec(t);
    if (b !== null) {
      const kind = b[1];
      const name = b[2] ?? '';
      if (kind === 'model' || kind === 'view') {
        entity = touchEntity(model, name, kind === 'view' ? 'view' : undefined);
        if (doc.length > 0) entity.note = doc.join(' ');
        doc = [];
        mode = 'model';
      } else if (kind === 'enum') {
        enumName = name;
        enumValues = [];
        doc = [];
        mode = 'enum';
      } else {
        doc = [];
        mode = 'skip';
      }
      continue;
    }
    return fail(`cannot read Prisma line: "${t}" (expected \`model X {\`, \`enum X {\`, \`datasource\` or \`generator\`)`, l.line);
  }
  if (mode !== 'top') return fail('a block is missing its closing `}`', lines[lines.length - 1]?.line ?? 1);

  finalizeModel(model);
  // Explicit relations: the side that names `fields` holds the foreign key.
  const seenNm = new Set<string>();
  for (const rf of relFields) {
    const target = findEntity(model, rf.target) ?? touchEntity(model, rf.target, 'external');
    if (rf.args.fields !== undefined && rf.args.fields.length > 0) {
      const refs = rf.args.references ?? target.columns.filter((c) => c.pk === true).map((c) => c.name);
      addForeignKey(model, rf.model, rf.args.fields, target, refs, {
        ...(rf.args.name !== undefined ? { label: rf.args.name } : {}),
      });
      if (rf.optional) {
        // An optional relation field means the FK column is nullable.
        for (const fc of rf.args.fields) {
          const c = rf.model.columns.find((x) => x.name === fc);
          if (c !== undefined && c.nullable === undefined) c.nullable = true;
        }
      }
      continue;
    }
    if (!rf.isList) continue; // the back side of a one-to-one / many-to-one
    // A list with no `fields`: implicit many-to-many when the other side is a list too.
    const other = relFields.find(
      (o) =>
        o !== rf &&
        o.model === target &&
        o.target === rf.model.name &&
        o.isList &&
        (o.args.fields === undefined || o.args.fields.length === 0) &&
        o.args.name === rf.args.name,
    );
    if (other === undefined) continue;
    const key = [qualifiedName(rf.model), qualifiedName(target), rf.args.name ?? ''].sort().join('|');
    if (seenNm.has(key)) continue;
    seenNm.add(key);
    model.relations.push({
      from: qualifiedName(rf.model),
      to: qualifiedName(target),
      card: 'N:M',
      ...(rf.args.name !== undefined ? { label: rf.args.name } : {}),
    });
  }
  return { ok: true, data: toErdData(model) };
}
