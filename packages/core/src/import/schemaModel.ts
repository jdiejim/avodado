/**
 * The intermediate schema model every database-schema importer builds
 * (DBML, Prisma, SQL DDL) and the one function that turns it into `erd`
 * block data. Keeping the model shared means a foreign key, a unique index
 * or an enum comes out identical whichever dialect named it.
 *
 * Pure data: no I/O, no throwing. Importers return a {@link DialectResult}
 * (`ok` + data, or a message with the 1-based body line).
 */

import { Document as YamlDocument, isScalar, isSeq, isCollection, visit, type Node } from 'yaml';
import type { MermaidResult } from '../mermaid/lines.js';

/** Result of converting one schema body. Same shape as a Mermaid conversion. */
export type DialectResult = MermaidResult;

export interface SchemaColumn {
  name: string;
  type?: string;
  pk?: boolean;
  fk?: boolean;
  unique?: boolean;
  nullable?: boolean;
  default?: string;
  index?: boolean;
  enum?: string[];
  ref?: string;
  note?: string;
}

export interface SchemaIndex {
  columns: string[];
  unique?: boolean;
  name?: string;
}

export interface SchemaEntity {
  name: string;
  kind?: 'table' | 'view' | 'enum' | 'external';
  schema?: string;
  note?: string;
  columns: SchemaColumn[];
  indexes: SchemaIndex[];
  /** Dialect alias (DBML `Table users as U`) — resolved by `findEntity`. */
  alias?: string;
  /** Set by `finalizeModel`: the bare name is shared across schemas, so references qualify it. */
  ambiguous?: boolean;
}

export interface SchemaRelation {
  from: string;
  to: string;
  card: '1:1' | '1:N' | 'N:1' | 'N:M' | '0..1' | '0..N';
  identifying?: boolean;
  label?: string;
  fromCol?: string;
  toCol?: string;
}

export interface SchemaModel {
  entities: SchemaEntity[];
  relations: SchemaRelation[];
  enums: { name: string; values: string[] }[];
  groups: { name: string; entities: string[] }[];
}

export function emptyModel(): SchemaModel {
  return { entities: [], relations: [], enums: [], groups: [] };
}

/** Strips one layer of matching quotes / backticks / brackets from an identifier. */
export function unquoteIdent(s: string): string {
  const t = s.trim();
  if (t.length >= 2) {
    const a = t[0];
    const b = t[t.length - 1];
    if ((a === '"' && b === '"') || (a === '`' && b === '`') || (a === '[' && b === ']') || (a === "'" && b === "'")) {
      return t.slice(1, -1);
    }
  }
  return t;
}

/**
 * Splits `schema.table` (any part quoted) into its parts. `a."b c".d` →
 * `['a', 'b c', 'd']`. A quoted part may contain dots.
 */
export function splitQualified(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote: string | undefined;
  for (const ch of s) {
    if (quote !== undefined) {
      if (ch === quote) quote = undefined;
      else cur += ch;
      continue;
    }
    if (ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '[') {
      quote = ']';
      continue;
    }
    if (ch === '.') {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((p) => p.trim()).filter((p) => p.length > 0);
}

/*
 * ── Entity identity and lookup ──────────────────────────────────────────
 *
 * An entity is identified by its schema **and** its name. "No schema" is an
 * identity of its own, never a wildcard: `auth.users` and `users` are two
 * different tables. (The SQL importer maps the default schema — `public` /
 * `dbo` — to "no schema" before it gets here, so `public.users` and `users`
 * are one table there.)
 *
 * A reference resolves in this order:
 *   1. a dialect alias (DBML `Table users as U`);
 *   2. the same identity — same schema, same name;
 *   3. for an *unqualified* reference only: the bare name, when exactly one
 *      entity carries it. Two or more entities share it → `ambiguous`, and
 *      the importer reports it instead of guessing.
 *
 * A qualified reference stops after step 2: `auth.users` never resolves to an
 * entity in another schema. When nothing matches, the caller creates the
 * entity (`touchEntity`, usually as `external`) — two tables in the drawing
 * is the truth; merging them is not.
 *
 * A declaration (`declareEntity`) matches on identity alone — never on an
 * alias, never on the bare name — and reports a second declaration of the
 * same identity as a duplicate.
 *
 * Every step is a Map lookup, so an import is linear in the number of tables
 * and columns.
 */

/** `schema` + `name` as one key; the separator cannot occur in an identifier. */
function identityKey(schema: string | undefined, name: string): string {
  return `${schema ?? ''}\u0000${name}`;
}

interface ModelIndex {
  /** Entity count the maps were built from; a direct push rebuilds them. */
  size: number;
  byKey: Map<string, SchemaEntity>;
  byName: Map<string, SchemaEntity[]>;
  byAlias: Map<string, SchemaEntity>;
  /** Entities a `Table` / `model` / `CREATE TABLE` statement declared. */
  readonly declared: WeakSet<SchemaEntity>;
}

const MODEL_INDEX = new WeakMap<SchemaModel, ModelIndex>();

function indexOf(model: SchemaModel): ModelIndex {
  const found = MODEL_INDEX.get(model);
  if (found !== undefined && found.size === model.entities.length) return found;
  const ix: ModelIndex = found ?? { size: 0, byKey: new Map(), byName: new Map(), byAlias: new Map(), declared: new WeakSet() };
  ix.byKey = new Map();
  ix.byName = new Map();
  ix.byAlias = new Map();
  for (const e of model.entities) {
    const key = identityKey(e.schema, e.name);
    if (!ix.byKey.has(key)) ix.byKey.set(key, e);
    const same = ix.byName.get(e.name);
    if (same === undefined) ix.byName.set(e.name, [e]);
    else same.push(e);
    if (e.alias !== undefined && !ix.byAlias.has(e.alias)) ix.byAlias.set(e.alias, e);
  }
  ix.size = model.entities.length;
  MODEL_INDEX.set(model, ix);
  return ix;
}

interface ParsedRef {
  readonly name: string;
  readonly schema: string | undefined;
}

/** `auth.users` → `{ schema: 'auth', name: 'users' }`; `users` → no schema. */
function parseRef(ref: string): ParsedRef {
  const parts = splitQualified(ref);
  return {
    name: parts[parts.length - 1] ?? ref,
    schema: parts.length >= 2 ? parts[parts.length - 2] : undefined,
  };
}

/** How a reference resolved: one entity, nothing, or several equal candidates. */
export type EntityMatch =
  | { readonly kind: 'one'; readonly entity: SchemaEntity }
  | { readonly kind: 'none' }
  | { readonly kind: 'ambiguous'; readonly candidates: readonly SchemaEntity[] };

/** Resolves `ref` by the rule above. */
export function matchEntity(model: SchemaModel, ref: string): EntityMatch {
  const ix = indexOf(model);
  const alias = ix.byAlias.get(ref);
  if (alias !== undefined) return { kind: 'one', entity: alias };
  const { name, schema } = parseRef(ref);
  const exact = ix.byKey.get(identityKey(schema, name));
  if (exact !== undefined) return { kind: 'one', entity: exact };
  if (schema !== undefined) return { kind: 'none' };
  const same = ix.byName.get(name) ?? [];
  const only = same[0];
  if (same.length === 1 && only !== undefined) return { kind: 'one', entity: only };
  if (same.length > 1) return { kind: 'ambiguous', candidates: same };
  return { kind: 'none' };
}

/** `auth.users` for an entity in a schema, `users` for one without. */
export function entityLabel(e: SchemaEntity): string {
  return e.schema !== undefined ? `${e.schema}.${e.name}` : e.name;
}

/** The message an importer reports for an ambiguous reference. */
export function ambiguousMessage(ref: string, candidates: readonly SchemaEntity[]): string {
  const names = candidates.map(entityLabel).join(', ');
  return `"${ref}" is ambiguous — ${candidates.length} tables carry that name (${names}); qualify it as \`schema.table\``;
}

/** Finds the one entity `ref` names; `undefined` when nothing or several match. */
export function findEntity(model: SchemaModel, ref: string): SchemaEntity | undefined {
  const m = matchEntity(model, ref);
  return m.kind === 'one' ? m.entity : undefined;
}

function createEntity(model: SchemaModel, ref: string, kind?: SchemaEntity['kind']): SchemaEntity {
  const { name, schema } = parseRef(ref);
  const e: SchemaEntity = {
    name,
    ...(schema !== undefined ? { schema } : {}),
    ...(kind !== undefined ? { kind } : {}),
    columns: [],
    indexes: [],
  };
  const ix = indexOf(model);
  model.entities.push(e);
  ix.size = model.entities.length;
  const key = identityKey(schema, name);
  if (!ix.byKey.has(key)) ix.byKey.set(key, e);
  const same = ix.byName.get(name);
  if (same === undefined) ix.byName.set(name, [e]);
  else same.push(e);
  return e;
}

/**
 * Adds (or returns) the entity a *reference* names. Callers handle an
 * ambiguous reference themselves (`matchEntity`) — reaching this with one
 * creates a new entity rather than guessing which was meant.
 */
export function touchEntity(model: SchemaModel, ref: string, kind?: SchemaEntity['kind']): SchemaEntity {
  const m = matchEntity(model, ref);
  return m.kind === 'one' ? m.entity : createEntity(model, ref, kind);
}

/** The outcome of a table / model declaration. */
export interface DeclareResult {
  readonly entity: SchemaEntity;
  /** True when the same identity was already declared — the dialect's error. */
  readonly duplicate: boolean;
}

/**
 * Declares the entity `ref` names. Matches on identity only, so
 * `CREATE TABLE auth.users` and `CREATE TABLE public.users` declare two
 * tables; a forward reference that already created the entity is adopted.
 */
export function declareEntity(model: SchemaModel, ref: string, kind?: SchemaEntity['kind']): DeclareResult {
  const ix = indexOf(model);
  const { name, schema } = parseRef(ref);
  const existing = ix.byKey.get(identityKey(schema, name));
  const entity = existing ?? createEntity(model, ref, kind);
  const duplicate = ix.declared.has(entity);
  ix.declared.add(entity);
  return { entity, duplicate };
}

/** Records a dialect alias (`Table users as U`) and indexes it. */
export function setEntityAlias(model: SchemaModel, e: SchemaEntity, alias: string): void {
  e.alias = alias;
  indexOf(model).byAlias.set(alias, e);
}

/** Moves an entity into a schema after the fact (Prisma's `@@schema`). */
export function setEntitySchema(model: SchemaModel, e: SchemaEntity, schema: string): void {
  const ix = indexOf(model);
  const old = identityKey(e.schema, e.name);
  if (ix.byKey.get(old) === e) ix.byKey.delete(old);
  e.schema = schema;
  const key = identityKey(schema, e.name);
  if (!ix.byKey.has(key)) ix.byKey.set(key, e);
}

/** Column lookup index; rebuilt when a caller pushes a column directly. */
const COLUMN_INDEX = new WeakMap<SchemaEntity, { size: number; byName: Map<string, SchemaColumn> }>();

function columnIndex(e: SchemaEntity): { size: number; byName: Map<string, SchemaColumn> } {
  const found = COLUMN_INDEX.get(e);
  if (found !== undefined && found.size === e.columns.length) return found;
  const byName = new Map<string, SchemaColumn>();
  for (const c of e.columns) if (!byName.has(c.name)) byName.set(c.name, c);
  const fresh = { size: e.columns.length, byName };
  COLUMN_INDEX.set(e, fresh);
  return fresh;
}

function findColumn(e: SchemaEntity, name: string): SchemaColumn | undefined {
  return columnIndex(e).byName.get(name);
}

/** Adds (or returns) a column; importers fill the type when the line says one. */
export function touchColumn(e: SchemaEntity, name: string): SchemaColumn {
  const ix = columnIndex(e);
  const found = ix.byName.get(name);
  if (found !== undefined) return found;
  const c: SchemaColumn = { name };
  e.columns.push(c);
  ix.byName.set(name, c);
  ix.size = e.columns.length;
  return c;
}

/** True when `cols` (in any order) are exactly the entity's primary key or a unique index / column. */
function isUniqueSet(e: SchemaEntity, cols: readonly string[]): boolean {
  const set = [...cols].sort().join('\u0000');
  const pk = e.columns
    .filter((c) => c.pk === true)
    .map((c) => c.name)
    .sort()
    .join('\u0000');
  if (pk.length > 0 && pk === set) return true;
  if (cols.length === 1 && findColumn(e, cols[0] ?? '')?.unique === true) return true;
  return e.indexes.some((ix) => ix.unique === true && [...ix.columns].sort().join('\u0000') === set);
}

/**
 * Records a foreign key: marks the referencing columns `fk` with their
 * `ref` target, and adds the relation child → parent. The cardinality is
 * `1:1` when the referencing columns are themselves unique (a primary key
 * or a unique index), otherwise `N:1`.
 */
export function addForeignKey(
  model: SchemaModel,
  from: SchemaEntity,
  fromCols: readonly string[],
  to: SchemaEntity,
  toCols: readonly string[],
  extra: { label?: string; identifying?: boolean } = {},
): void {
  const target = qualifiedName(to);
  fromCols.forEach((name, i) => {
    const c = touchColumn(from, name);
    c.fk = true;
    const tc = toCols[i] ?? toCols[0];
    if (tc !== undefined) c.ref = `${target}.${tc}`;
  });
  const fromCol = fromCols[0];
  const toCol = toCols[0];
  model.relations.push({
    from: qualifiedName(from),
    to: target,
    card: isUniqueSet(from, fromCols) ? '1:1' : 'N:1',
    ...(extra.identifying !== undefined ? { identifying: extra.identifying } : {}),
    ...(extra.label !== undefined ? { label: extra.label } : {}),
    ...(fromCol !== undefined ? { fromCol } : {}),
    ...(toCol !== undefined ? { toCol } : {}),
  });
}

/**
 * The name an entity is referenced by in the erd data. Bare when unique;
 * `schema.name` when two schemas both define the same table name.
 */
export function qualifiedName(e: SchemaEntity): string {
  return e.schema !== undefined && e.ambiguous === true ? `${e.schema}.${e.name}` : e.name;
}

/** Flags entities whose bare name is shared across schemas (so `qualifiedName` qualifies them). */
export function finalizeModel(model: SchemaModel): void {
  const counts = new Map<string, number>();
  for (const e of model.entities) counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
  for (const e of model.entities) e.ambiguous = (counts.get(e.name) ?? 0) > 1 && e.schema !== undefined;
}

function compact<T extends object>(o: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}

/** The `erd` block data for a model — exactly the shape `erdSchema` accepts. */
export function toErdData(model: SchemaModel): Record<string, unknown> {
  finalizeModel(model);
  const entities = model.entities.map((e) =>
    compact({
      name: qualifiedName(e),
      kind: e.kind,
      schema: e.schema,
      note: e.note,
      columns:
        e.columns.length > 0
          ? e.columns.map((c) =>
              compact({
                name: c.name,
                type: c.type,
                pk: c.pk,
                fk: c.fk,
                unique: c.unique,
                nullable: c.nullable,
                default: c.default,
                index: c.index,
                enum: c.enum,
                ref: c.ref,
                note: c.note,
              }),
            )
          : undefined,
      indexes:
        e.indexes.length > 0
          ? e.indexes.map((ix) => compact({ columns: ix.columns, unique: ix.unique, name: ix.name }))
          : undefined,
    }),
  );
  const relations = model.relations.map((r) => compact(r));
  return {
    ...(entities.length > 0 ? { entities } : {}),
    ...(relations.length > 0 ? { relations } : {}),
    ...(model.groups.length > 0 ? { groups: model.groups.map((g) => ({ name: g.name, entities: g.entities })) } : {}),
    ...(model.enums.length > 0 ? { enums: model.enums.map((n) => ({ name: n.name, values: n.values })) } : {}),
  };
}

/** Keys whose sequence items are written inline: `- { name: id, type: uuid, pk: true }`. */
const FLOW_ITEM_KEYS = new Set(['columns', 'relations', 'indexes', 'enums', 'groups']);

function flowDeep(node: Node): void {
  visit(node, {
    Map(_key, map) {
      map.flow = true;
    },
    Seq(_key, seq) {
      seq.flow = true;
    },
  });
}

/**
 * Serialises erd data in the house style: entities in block form, each
 * column / relation / index / enum / group as one inline record per line.
 * No trailing newline.
 */
export function serializeErdBody(data: Record<string, unknown>): string {
  const doc = new YamlDocument(data);
  visit(doc.contents, {
    Pair(_key, pair) {
      const key = isScalar(pair.key) ? pair.key.value : pair.key;
      if (typeof key !== 'string' || !FLOW_ITEM_KEYS.has(key)) return;
      const value = pair.value;
      if (!isSeq(value)) return;
      for (const item of value.items) if (isCollection(item)) flowDeep(item);
    },
  });
  return doc.toString({ lineWidth: 0, flowCollectionPadding: true }).replace(/\n$/, '');
}

/** A ready-to-paste ` ```erd ` fence for the data (trailing newline included). */
export function erdFence(data: Record<string, unknown>, id?: string): string {
  const body = serializeErdBody(id !== undefined ? { id, ...data } : data);
  return '```erd\n' + body + '\n```\n';
}
