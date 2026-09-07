/**
 * Entity identity in the schema importers (`schemaModel.ts`).
 *
 * A table is identified by its schema *and* its name, so `auth.users` and
 * `public.users` are two tables. The importers must keep them apart, resolve
 * an unqualified reference only when it is unambiguous, and say so when it is
 * not — never merge two tables into a plausible-looking one.
 */

import { describe, expect, it } from 'vitest';

import { convertDbml } from '../import/dbml.js';
import { convertPrisma } from '../import/prisma.js';
import { convertSqlDdl } from '../import/sqlddl.js';
import { emptyModel, matchEntity, touchEntity } from '../import/schemaModel.js';

interface ErdEntity {
  name: string;
  schema?: string;
  kind?: string;
  columns?: { name: string; type?: string }[];
}
interface ErdData {
  entities?: ErdEntity[];
  relations?: { from: string; to: string }[];
  groups?: { name: string; entities: string[] }[];
}

function data(r: ReturnType<typeof convertSqlDdl>): ErdData {
  if (!r.ok) throw new Error(`expected a conversion, got: ${r.message}`);
  return r.data as ErdData;
}

const names = (d: ErdData): string[] => (d.entities ?? []).map((e) => e.name);
const cols = (d: ErdData, name: string): string[] => (d.entities ?? []).find((e) => e.name === name)?.columns?.map((c) => c.name) ?? [];
const typeOf = (d: ErdData, name: string, col: string): string | undefined =>
  (d.entities ?? []).find((e) => e.name === name)?.columns?.find((c) => c.name === col)?.type;

describe('two schemas, one table name', () => {
  it('sql: auth.users and public.users stay two tables, each with its own columns', () => {
    const d = data(
      convertSqlDdl(
        'CREATE TABLE auth.users (id uuid PRIMARY KEY, password_hash text);\n' +
          'CREATE TABLE public.users (id bigint PRIMARY KEY, display_name text);\n' +
          'CREATE TABLE public.orders (id uuid PRIMARY KEY, user_id bigint REFERENCES public.users(id));\n',
      ),
    );
    expect(names(d)).toEqual(['auth.users', 'users', 'orders']);
    expect(cols(d, 'auth.users')).toEqual(['id', 'password_hash']);
    expect(cols(d, 'users')).toEqual(['id', 'display_name']);
    expect(typeOf(d, 'auth.users', 'id')).toBe('uuid');
    expect(typeOf(d, 'users', 'id')).toBe('bigint');
    // The foreign key points at the table the DDL named, not at the other one.
    expect(d.relations).toEqual([{ from: 'orders', to: 'users', card: 'N:1', fromCol: 'user_id', toCol: 'id' }]);
  });

  it('dbml: two schemas keep their columns and their refs apart', () => {
    const d = data(
      convertDbml(
        'Table auth.users {\n  id uuid [pk]\n  password_hash text\n}\n' +
          'Table public.users {\n  id bigint [pk]\n  display_name text\n}\n' +
          'Table orders {\n  id uuid [pk]\n  user_id bigint\n}\n' +
          'Ref: orders.user_id > public.users.id\n',
      ),
    );
    expect(names(d)).toEqual(['auth.users', 'public.users', 'orders']);
    expect(cols(d, 'auth.users')).toEqual(['id', 'password_hash']);
    expect(cols(d, 'public.users')).toEqual(['id', 'display_name']);
    expect(d.relations?.[0]).toMatchObject({ from: 'orders', to: 'public.users' });
  });

  it('a qualified reference to an undeclared table adds that table, it does not adopt another schema’s', () => {
    const d = data(convertSqlDdl('CREATE TABLE auth.users (id uuid PRIMARY KEY);\nCREATE TABLE orders (user_id uuid REFERENCES billing.users(id));\n'));
    expect(names(d)).toEqual(['auth.users', 'orders', 'billing.users']);
    expect((d.entities ?? []).find((e) => e.name === 'billing.users')?.kind).toBe('external');
  });
});

describe('the same table declared twice', () => {
  it('sql refuses a second CREATE TABLE, and accepts IF NOT EXISTS / OR REPLACE', () => {
    expect(convertSqlDdl('CREATE TABLE users (id uuid);\nCREATE TABLE users (id bigint);\n')).toMatchObject({
      ok: false,
      line: 2,
      message: 'table users is created twice',
    });
    expect(convertSqlDdl('CREATE TABLE users (id uuid);\nCREATE TABLE IF NOT EXISTS users (email text);\n').ok).toBe(true);
    expect(convertSqlDdl('CREATE VIEW v AS SELECT a FROM t;\nCREATE OR REPLACE VIEW v AS SELECT b FROM t;\n').ok).toBe(true);
  });

  it('dbml refuses a second Table block with its line', () => {
    expect(convertDbml('Table users {\n  id uuid [pk]\n}\nTable users {\n  email text\n}\n')).toMatchObject({
      ok: false,
      line: 4,
      message: 'table users is declared twice',
    });
  });

  it('prisma refuses a second model or enum with its line', () => {
    expect(convertPrisma('model User {\n  id Int @id\n}\nmodel User {\n  id Int @id\n}\n')).toMatchObject({
      ok: false,
      line: 4,
      message: 'model User is declared twice',
    });
    expect(convertPrisma('enum Role {\n  A\n}\nenum Role {\n  B\n}\n')).toMatchObject({ ok: false, line: 4 });
  });
});

describe('an unqualified reference', () => {
  it('resolves when exactly one table carries the name', () => {
    const d = data(convertSqlDdl('CREATE TABLE auth.users (id uuid PRIMARY KEY);\nCREATE TABLE orders (user_id uuid REFERENCES users(id));\n'));
    // One table carries the name, so the erd needs no qualifier for it.
    expect(names(d)).toEqual(['users', 'orders']);
    expect((d.entities ?? [])[0]?.schema).toBe('auth');
    expect(d.relations?.[0]).toMatchObject({ from: 'orders', to: 'users' });
  });

  it('is a diagnostic, not a guess, when two schemas carry the name', () => {
    const sql = convertSqlDdl(
      'CREATE TABLE auth.users (id uuid PRIMARY KEY);\n' +
        'CREATE TABLE billing.users (id uuid PRIMARY KEY);\n' +
        'CREATE TABLE orders (user_id uuid REFERENCES users(id));\n',
    );
    expect(sql).toMatchObject({ ok: false, line: 3 });
    if (sql.ok) throw new Error('expected a failure');
    expect(sql.message).toContain('"users" is ambiguous');
    expect(sql.message).toContain('auth.users, billing.users');

    const dbml = convertDbml(
      'Table auth.users {\n  id uuid [pk]\n}\nTable billing.users {\n  id uuid [pk]\n}\n' +
        'Table orders {\n  user_id uuid\n}\n' +
        'Ref: orders.user_id > users.id\n',
    );
    expect(dbml).toMatchObject({ ok: false, line: 10 });
    if (dbml.ok) throw new Error('expected a failure');
    expect(dbml.message).toContain('is ambiguous');
  });

  it('a DBML alias still resolves, and a table named like an alias is its own table', () => {
    const d = data(
      convertDbml('Table users as U {\n  id uuid [pk]\n}\nTable orders {\n  user_id uuid [ref: > U.id]\n}\n'),
    );
    expect(names(d)).toEqual(['users', 'orders']);
    expect(d.relations?.[0]).toMatchObject({ from: 'orders', to: 'users' });
  });
});

describe('lookup is a map, not a scan', () => {
  /**
   * The direct measure of "not quadratic any more", with no clock in it:
   * resolving a reference must not read a single element of `model.entities`.
   * The old `findEntity` ran up to three `Array.prototype.find` scans, so it
   * read O(n) elements per call and O(n²) per import.
   */
  it('resolving a reference reads no element of the entity array', () => {
    const model = emptyModel();
    for (let i = 0; i < 2_000; i++) touchEntity(model, `s${i % 7}.t${i}`);
    matchEntity(model, 't0'); // build the index once

    let elementReads = 0;
    const real = model.entities;
    model.entities = new Proxy(real, {
      get(target, key, receiver): unknown {
        if (typeof key === 'string' && /^\d+$/.test(key)) elementReads++;
        if (key === Symbol.iterator) elementReads += target.length;
        return Reflect.get(target, key, receiver);
      },
    });

    for (let i = 0; i < 500; i++) {
      expect(matchEntity(model, `s${i % 7}.t${i}`).kind).toBe('one'); // qualified hit
      expect(matchEntity(model, `t${i}`).kind).toBe('one'); // unqualified hit
      expect(matchEntity(model, `nope${i}`).kind).toBe('none'); // miss
    }
    model.entities = real;
    expect(elementReads).toBe(0);
  });

  it('a 32 000 table schema imports whole (smoke: the old scan took minutes of CPU here)', { timeout: 10_000 }, () => {
    const sql = Array.from({ length: 32_000 }, (_, i) => `CREATE TABLE t${i} (id uuid PRIMARY KEY, name text);`).join('\n');
    const d = data(convertSqlDdl(sql));
    expect(d.entities).toHaveLength(32_000);
  });
});
