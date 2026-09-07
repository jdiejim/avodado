/**
 * The erd overhaul: the grown column / relation grammar round-trips through
 * parse → validate; the DBML and Prisma fence dialects and the SQL DDL
 * importer convert realistic fixtures to exact data that validates clean;
 * bad lines yield the right code and line; an edit writes the canonical
 * ` ```erd ` tag; Mermaid keeps `UK` and comments.
 */

import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';
import { lintDensity } from '../density.js';
import { editableBodyYaml, replaceBlockBody } from '../edit.js';
import { convertDbml } from '../import/dbml.js';
import { convertPrisma } from '../import/prisma.js';
import { convertSqlDdl } from '../import/sqlddl.js';
import { erdFence } from '../import/schemaModel.js';
import { importerForFile } from '../import/registry.js';
import { erdSchema } from '../blocks/schemas.js';
import { BLOCK_TEMPLATES } from '../blocks/catalog.js';
import type { TypedSegment } from '../types.js';

function typed(md: string): TypedSegment {
  const doc = parseDocument(md, 'm');
  for (const seg of doc.segments) if (seg.kind !== 'markdown') return seg;
  throw new Error('expected a typed segment');
}

const clean = (md: string) => validateDocument(parseDocument(md, 'm'), 'm.md');

describe('erd column and relation grammar', () => {
  it('expands every terse column flag', () => {
    const seg = typed(
      '```erd\nentities:\n  - name: users\n    columns:\n' +
        '      - id uuid pk\n' +
        '      - email text unique !null default=now()\n' +
        '      - org_id uuid fk -> orgs.id\n' +
        '      - status enum(open,closed)\n' +
        '      - nick text null idx\n' +
        '      - price numeric(10,2) uk notnull\n' +
        '```\n',
    );
    expect(seg.data).toEqual({
      entities: [
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'uuid', pk: true },
            { name: 'email', type: 'text', unique: true, nullable: false, default: 'now()' },
            { name: 'org_id', type: 'uuid', fk: true, ref: 'orgs.id' },
            { name: 'status', type: 'enum', enum: ['open', 'closed'] },
            { name: 'nick', type: 'text', nullable: true, index: true },
            { name: 'price', type: 'numeric(10,2)', unique: true, nullable: false },
          ],
        },
      ],
    });
  });

  it('reads every crow-foot end, the `..` body, and `->`', () => {
    const seg = typed(
      '```erd\nrelations:\n' +
        '  - "a ||--|| b: one"\n' +
        '  - "a ||--o{ b: many"\n' +
        '  - "a }o--|| b: back"\n' +
        '  - "a }|--|{ b: nm"\n' +
        '  - "a ||--o| b: maybe"\n' +
        '  - "a ||..o{ b: loose"\n' +
        '  - "a -> b: plain"\n' +
        '```\n',
    );
    expect(seg.data).toEqual({
      relations: [
        { from: 'a', to: 'b', label: 'one', card: '1:1' },
        { from: 'a', to: 'b', label: 'many', card: '1:N' },
        { from: 'a', to: 'b', label: 'back', card: 'N:1' },
        { from: 'a', to: 'b', label: 'nm', card: 'N:M' },
        { from: 'a', to: 'b', label: 'maybe', card: '0..1' },
        { from: 'a', to: 'b', label: 'loose', card: '1:N', identifying: false },
        { from: 'a', to: 'b', label: 'plain' },
      ],
    });
  });

  it('the full object form validates clean; the old shape is unchanged', () => {
    const md =
      '```erd\ndir: TB\nentities:\n' +
      '  - { name: users, schema: auth, kind: table, note: People }\n' +
      '  - name: orders\n    columns:\n      - { name: id, type: uuid, pk: true }\n      - { name: user_id, type: uuid, fk: true, ref: users.id, nullable: false, index: true }\n' +
      '    indexes:\n      - { columns: [user_id, status], unique: true, name: by_user }\n' +
      '  - { name: totals, kind: view }\n  - { name: stripe_customers, kind: external }\n' +
      'relations:\n  - { from: orders, to: users, card: "N:1", identifying: false, fromCol: user_id, toCol: id, label: placed by }\n' +
      'groups:\n  - { name: auth, entities: [users] }\n' +
      'enums:\n  - { name: status, values: [open, paid] }\n```\n';
    expect(clean(md)).toEqual([]);
    expect(clean(BLOCK_TEMPLATES.erd)).toEqual([]);
    // The pre-overhaul field shape, with both relation ends declared — a
    // relation naming an entity that does not exist is now `E_SCHEMA`.
    const legacy =
      '```erd\nentities:\n  - name: a\n    columns:\n      - { name: id, type: uuid, pk: true }\n  - name: b\nrelations:\n  - { from: a, to: b, card: "1:N" }\n```\n';
    expect(clean(legacy)).toEqual([]);
  });

  it('rejects an unknown field and a bad card', () => {
    expect(erdSchema.safeParse({ entities: [{ name: 'a', color: 'red' }] }).success).toBe(false);
    expect(erdSchema.safeParse({ relations: [{ from: 'a', to: 'b', card: '2:3' }] }).success).toBe(false);
    expect(erdSchema.safeParse({ entities: [{ name: 'a', columns: [{ name: 'x', enum: 'open' }] }] }).success).toBe(false);
  });

  it('density: 20 entities / 60 columns pass, 21 / 61 warn', () => {
    const ents = (n: number, cols = 0) =>
      Array.from({ length: n }, (_, i) => {
        const c = Array.from({ length: cols }, (_, j) => `      - c${j} int`).join('\n');
        return `  - name: E${i}` + (cols > 0 ? `\n    columns:\n${c}` : '');
      }).join('\n');
    const lint = (body: string) => lintDensity(parseDocument('```erd\nentities:\n' + body + '\n```\n', 'd'), 'd.md');
    expect(lint(ents(20))).toEqual([]);
    expect(lint(ents(21))[0]?.message).toContain('21 entities');
    expect(lint(ents(10, 6))).toEqual([]);
    const cols = lint(ents(10, 7));
    expect(cols).toHaveLength(1);
    expect(cols[0]?.message).toContain('70 columns');
  });
});

const DBML = `// Commerce
Project shop { database_type: 'PostgreSQL' }

Table users as U {
  id uuid [pk, default: \`gen_random_uuid()\`]
  email text [unique, not null, note: 'login']
  role user_role [not null, default: 'member']
  Note: 'People who sign in'
}

Table orders {
  id uuid [pk]
  user_id uuid [not null, ref: > U.id]
  status order_status
  total numeric(10,2) [default: 0]

  indexes {
    (user_id, status) [name: 'orders_user_status']
    status
  }
}

Table order_items {
  order_id uuid [pk]
  product_id uuid [pk]
  qty int [not null]
}

Table products {
  id uuid [pk]
  sku varchar(32) [unique]
}

Enum user_role {
  member
  admin [note: 'full access']
}

Enum order_status {
  open
  paid
}

Ref: order_items.order_id > orders.id
Ref fk_item_product: order_items.product_id > products.id [delete: cascade]
Ref: users.id - profiles.user_id

TableGroup commerce {
  orders
  order_items
  products
}`;

const DBML_DATA = {
  entities: [
    {
      name: 'users',
      note: 'People who sign in',
      columns: [
        { name: 'id', type: 'uuid', pk: true, default: 'gen_random_uuid()' },
        { name: 'email', type: 'text', unique: true, nullable: false, note: 'login' },
        { name: 'role', type: 'user_role', nullable: false, default: 'member' },
      ],
    },
    {
      name: 'orders',
      columns: [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'user_id', type: 'uuid', nullable: false, fk: true, ref: 'users.id' },
        { name: 'status', type: 'order_status', index: true },
        { name: 'total', type: 'numeric(10,2)', default: '0' },
      ],
      indexes: [{ columns: ['user_id', 'status'], name: 'orders_user_status' }],
    },
    {
      name: 'order_items',
      columns: [
        { name: 'order_id', type: 'uuid', pk: true, fk: true, ref: 'orders.id' },
        { name: 'product_id', type: 'uuid', pk: true, fk: true, ref: 'products.id' },
        { name: 'qty', type: 'int', nullable: false },
      ],
    },
    {
      name: 'products',
      columns: [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'sku', type: 'varchar(32)', unique: true },
      ],
    },
    { name: 'profiles', kind: 'external', columns: [{ name: 'user_id', fk: true, ref: 'users.id' }] },
  ],
  relations: [
    { from: 'orders', to: 'users', card: 'N:1', fromCol: 'user_id', toCol: 'id' },
    { from: 'order_items', to: 'orders', card: 'N:1', fromCol: 'order_id', toCol: 'id' },
    { from: 'order_items', to: 'products', card: 'N:1', fromCol: 'product_id', toCol: 'id' },
    { from: 'profiles', to: 'users', card: '1:1', fromCol: 'user_id', toCol: 'id' },
  ],
  groups: [{ name: 'commerce', entities: ['orders', 'order_items', 'products'] }],
  enums: [
    { name: 'user_role', values: ['member', 'admin'] },
    { name: 'order_status', values: ['open', 'paid'] },
  ],
};

const PRISMA = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL") // secret
}

/// A person who can sign in
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  /// display name
  name      String?
  role      Role     @default(MEMBER)
  posts     Post[]
  profile   Profile?
  createdAt DateTime @default(now()) @map("created_at")

  @@schema("auth")
}

model Profile {
  id     Int    @id @default(autoincrement())
  bio    String @db.Text
  userId String @unique
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Post {
  id         Int        @id @default(autoincrement())
  title      String
  authorId   String
  author     User       @relation(fields: [authorId], references: [id])
  categories Category[]
  parentId   Int?
  parent     Post?      @relation("Thread", fields: [parentId], references: [id])
  replies    Post[]     @relation("Thread")

  @@index([authorId])
  @@unique([authorId, title])
}

model Category {
  id    Int    @id @default(autoincrement())
  name  String
  posts Post[]
}

enum Role {
  MEMBER
  ADMIN
}`;

const PRISMA_DATA = {
  entities: [
    {
      name: 'User',
      schema: 'auth',
      note: 'A person who can sign in',
      columns: [
        { name: 'id', type: 'String', pk: true, default: 'uuid()' },
        { name: 'email', type: 'String', unique: true },
        { name: 'name', type: 'String', nullable: true, note: 'display name' },
        { name: 'role', type: 'Role', default: 'MEMBER' },
        { name: 'createdAt', type: 'DateTime', default: 'now()' },
      ],
    },
    {
      name: 'Profile',
      columns: [
        { name: 'id', type: 'Int', pk: true, default: 'autoincrement()' },
        { name: 'bio', type: 'String' },
        { name: 'userId', type: 'String', unique: true, fk: true, ref: 'User.id' },
      ],
    },
    {
      name: 'Post',
      columns: [
        { name: 'id', type: 'Int', pk: true, default: 'autoincrement()' },
        { name: 'title', type: 'String' },
        { name: 'authorId', type: 'String', fk: true, ref: 'User.id', index: true },
        { name: 'parentId', type: 'Int', nullable: true, fk: true, ref: 'Post.id' },
      ],
      indexes: [{ columns: ['authorId', 'title'], unique: true }],
    },
    {
      name: 'Category',
      columns: [
        { name: 'id', type: 'Int', pk: true, default: 'autoincrement()' },
        { name: 'name', type: 'String' },
      ],
    },
  ],
  relations: [
    { from: 'Profile', to: 'User', card: '1:1', fromCol: 'userId', toCol: 'id' },
    { from: 'Post', to: 'User', card: 'N:1', fromCol: 'authorId', toCol: 'id' },
    { from: 'Post', to: 'Category', card: 'N:M' },
    { from: 'Post', to: 'Post', card: 'N:1', label: 'Thread', fromCol: 'parentId', toCol: 'id' },
  ],
  enums: [{ name: 'Role', values: ['MEMBER', 'ADMIN'] }],
};

const SQL = `-- schema
CREATE TYPE order_status AS ENUM ('open', 'paid');

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
COMMENT ON COLUMN public.users.email IS 'login';

CREATE TABLE orders (
  id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status order_status DEFAULT 'open'::order_status,
  total numeric(10, 2) DEFAULT 0, /* money */
  CONSTRAINT orders_pkey PRIMARY KEY (id)
);
CREATE INDEX orders_user_idx ON orders (user_id);
CREATE UNIQUE INDEX ON orders (user_id, status);

CREATE TABLE \`order_items\` (
  \`order_id\` uuid NOT NULL,
  \`product_id\` uuid NOT NULL,
  \`qty\` int unsigned NOT NULL DEFAULT 1 COMMENT 'units',
  PRIMARY KEY (\`order_id\`, \`product_id\`),
  KEY \`by_product\` (\`product_id\`),
  CONSTRAINT fk_items_order FOREIGN KEY (\`order_id\`) REFERENCES \`orders\` (\`id\`)
) ENGINE=InnoDB COMMENT='line items';

ALTER TABLE ONLY order_items ADD CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products (id);

CREATE VIEW order_totals AS SELECT o.id AS order_id, sum(i.qty) AS units FROM orders o JOIN order_items i ON i.order_id = o.id GROUP BY o.id;
INSERT INTO users (email) VALUES ('a@b.c');`;

const SQL_DATA = {
  entities: [
    {
      name: 'users',
      columns: [
        { name: 'id', type: 'uuid', pk: true, default: 'gen_random_uuid()' },
        { name: 'email', type: 'citext', nullable: false, unique: true, note: 'login' },
        { name: 'created_at', type: 'timestamp with time zone', nullable: false, default: 'now()' },
      ],
    },
    {
      name: 'orders',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, pk: true },
        { name: 'user_id', type: 'uuid', nullable: false, fk: true, ref: 'users.id', index: true },
        { name: 'status', type: 'order_status', default: "'open'::order_status" },
        { name: 'total', type: 'numeric(10,2)', default: '0' },
      ],
      indexes: [{ columns: ['user_id', 'status'], unique: true }],
    },
    {
      name: 'order_items',
      note: 'line items',
      columns: [
        { name: 'order_id', type: 'uuid', nullable: false, pk: true, fk: true, ref: 'orders.id' },
        { name: 'product_id', type: 'uuid', nullable: false, pk: true, fk: true, ref: 'products.id', index: true },
        { name: 'qty', type: 'int unsigned', nullable: false, default: '1', note: 'units' },
      ],
    },
    { name: 'products', kind: 'external' },
    { name: 'order_totals', kind: 'view', columns: [{ name: 'order_id' }, { name: 'units' }] },
  ],
  relations: [
    { from: 'orders', to: 'users', card: 'N:1', fromCol: 'user_id', toCol: 'id' },
    { from: 'order_items', to: 'orders', card: 'N:1', fromCol: 'order_id', toCol: 'id' },
    { from: 'order_items', to: 'products', card: 'N:1', fromCol: 'product_id', toCol: 'id' },
  ],
  enums: [{ name: 'order_status', values: ['open', 'paid'] }],
};

describe('dbml → erd', () => {
  it('converts the fixture to exact data', () => {
    expect(convertDbml(DBML)).toEqual({ ok: true, data: DBML_DATA });
  });
  it('a ```dbml fence is a typed erd with sourceType dbml that validates clean', () => {
    const md = '```dbml\n' + DBML + '\n```\n';
    const seg = typed(md);
    expect(seg.kind).toBe('erd');
    expect(seg.sourceType).toBe('dbml');
    expect(seg.data).toEqual(DBML_DATA);
    expect(clean(md)).toEqual([]);
  });
  it('a bad line is E_PARSE_DBML at that document line', () => {
    const md = '# T\n\n```dbml\nTable a {\n  id uuid [pk]\n  what is this\n}\n```\n';
    const diags = clean(md);
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({ code: 'E_PARSE_DBML', level: 'error', line: 6 });
    expect(diags[0]?.message).toContain('cannot read column in a');
    expect(convertDbml('Table a {\n  id uuid\n')).toMatchObject({ ok: false, line: 2 });
    expect(convertDbml('Ref: a > b')).toMatchObject({ ok: false, line: 1 });
  });
});

describe('prisma → erd', () => {
  it('converts the fixture to exact data', () => {
    expect(convertPrisma(PRISMA)).toEqual({ ok: true, data: PRISMA_DATA });
  });
  it('a ```prisma fence is a typed erd with sourceType prisma that validates clean', () => {
    const md = '```prisma\n' + PRISMA + '\n```\n';
    const seg = typed(md);
    expect(seg.kind).toBe('erd');
    expect(seg.sourceType).toBe('prisma');
    expect(seg.data).toEqual(PRISMA_DATA);
    expect(clean(md)).toEqual([]);
  });
  it('a bad line is E_PARSE_PRISMA at that document line', () => {
    const md = '```prisma\nmodel A {\n  id Int @id\n  ???\n}\n```\n';
    const diags = clean(md);
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({ code: 'E_PARSE_PRISMA', level: 'error', line: 4 });
    expect(convertPrisma('nonsense here')).toMatchObject({ ok: false, line: 1 });
  });
});

describe('sql ddl → erd', () => {
  it('converts Postgres + MySQL DDL to exact data', () => {
    expect(convertSqlDdl(SQL)).toEqual({ ok: true, data: SQL_DATA });
  });
  it('the data validates clean as an erd fence', () => {
    const r = convertSqlDdl(SQL);
    if (!r.ok) throw new Error(r.message);
    const fence = erdFence(r.data, 'schema');
    expect(fence.startsWith('```erd\nid: schema\n')).toBe(true);
    expect(clean(fence)).toEqual([]);
    expect(typed(fence).data).toEqual({ id: 'schema', ...SQL_DATA });
  });
  it('a CREATE TABLE the subset cannot read fails with its line', () => {
    expect(convertSqlDdl('CREATE TABLE a;')).toMatchObject({ ok: false, line: 1 });
    expect(convertSqlDdl('SET x = 1;\nCREATE TABLE a (\n  id\n);')).toMatchObject({ ok: false, line: 3 });
  });
  it('the importer registry claims .dbml .prisma .sql', () => {
    expect(importerForFile('schema.dbml')?.id).toBe('dbml');
    expect(importerForFile('schema.prisma')?.id).toBe('prisma');
    expect(importerForFile('schema.SQL')?.id).toBe('sql');
  });
});

describe('edit round-trip', () => {
  it('replaceBlockBody on a dbml segment writes the canonical erd tag + YAML', () => {
    const src = '# Doc\n\n```dbml\n' + DBML + '\n```\n\nAfter.\n';
    const doc = parseDocument(src, 'm');
    const seg = doc.segments[1];
    if (seg === undefined || seg.kind === 'markdown') throw new Error('expected block');
    const yaml = editableBodyYaml(seg);
    expect(yaml.startsWith('entities:')).toBe(true);
    const next = replaceBlockBody(src, doc, 1, yaml);
    expect(next).not.toContain('```dbml');
    expect(next).toContain('```erd\n');
    const reparsed = parseDocument(next, 'm').segments[1];
    if (reparsed === undefined || reparsed.kind === 'markdown') throw new Error('expected block');
    expect(reparsed.sourceType).toBeUndefined();
    expect(reparsed.data).toEqual(seg.data);
    expect(validateDocument(parseDocument(next, 'm'), 'm.md')).toEqual([]);
  });
});

describe('mermaid erDiagram keeps UK, comments and the `..` body', () => {
  it('maps UK → unique, "comment" → note, `..` → identifying: false', () => {
    const seg = typed('```mermaid\nerDiagram\n  A ||..o{ B : has\n  A {\n    string email UK "login"\n  }\n```\n');
    expect(seg.data).toEqual({
      entities: [{ name: 'A', columns: [{ name: 'email', type: 'string', unique: true, note: 'login' }] }, { name: 'B' }],
      relations: [{ from: 'A', to: 'B', label: 'has', card: '1:N', identifying: false }],
    });
  });
});
