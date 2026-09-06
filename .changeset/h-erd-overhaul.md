---
'@avodado/core': minor
'@avodado/render': minor
'avodado': patch
'@avodado/mcp': patch
'@avodado/studio': patch
---

feat(erd): the ERD overhaul — a full relational model in, a layered auto-layout out; DBML / Prisma fences and `avo sync sql | dbml | prisma`

- **Schema (additive; every existing `erd` doc is unchanged).** Columns gain `unique`, `nullable`, `default`, `index`, `enum: [..]`, `ref: table.column`, `note`; entities gain `kind` (`table` · `view` · `enum` · `external`), `schema`, `note`, `indexes: [{ columns, unique?, name? }]`; relations gain `identifying`, `fromCol`, `toCol` and the cards `0..1` / `0..N`; the block gains `groups` (schema panels), `enums` (value cards) and `dir: LR | TB`. The terse column string grows: `email text unique !null default=now()`, `user_id uuid fk -> users.id`, `status enum(open,closed)`; the terse relation reads every Mermaid crow's-foot end and a `..` body for non-identifying (`users ||..o{ sessions: opens`, `orders ||--o| payments`).
- **Renderer.** Layered auto-layout ranked by relation adjacency: the aggregate root centred, its neighbours fanned out by depth on both sides, a join table between its parents; `groups` / shared `schema` as non-overlapping `paper-2` panels with an eyebrow tab; `enums` as cards in a side column; orthogonal field-level routes with one gutter slot per relation, `1` / `N` / `0..1` letters at each end, identifying solid, non-identifying dashed, labels on a paper mask. Rows carry `#` `→` `U` `?` `⌘` markers, the FK target and default after the type, enum values as a sub-row; kind chips `VIEW` / `ENUM` / `EXT` (dashed). Nothing is truncated any more — cards grow. The legend lists exactly the markers used. Density budget: 20 entities / 60 columns.
- **Input dialects.** A ```` ```dbml ```` fence and a ```` ```prisma ```` fence parse into an `erd` (`sourceType: 'dbml' | 'prisma'`), with `E_PARSE_DBML` / `E_PARSE_PRISMA` on a bad line; an edit rewrites the fence to ` ```erd `. The Mermaid `erDiagram` converter keeps `UK` (→ `unique`), column comments (→ `note`) and `..` (→ `identifying: false`). New `dialects.ts` is the one place that knows the dialect tags (`isDialectSource`, `convertDialect`, `dialectBodyYaml`).
- **`avo sync sql | dbml | prisma <file> [--out doc.md] [--title] [--id]`** converts a schema file to an `erd` fence (stdout) or a minimal doc validated by `avo check`. SQL DDL reads `CREATE TABLE` (inline and table constraints, Postgres / MySQL / SQL Server quoting), `CREATE INDEX`, `ALTER TABLE ADD`, `CREATE TYPE … AS ENUM`, `CREATE VIEW`, `COMMENT ON`. The importer registry claims `.sql` / `.ddl` / `.dbml` / `.prisma`; Studio's drop-to-import inserts them as an `erd`.
- Skill: `blocks/data-model.md` documents the full grammar; `reference/mermaid.md` becomes "Input dialects" (Mermaid, DBML, Prisma). New example `docs/examples/data-model.md`.
