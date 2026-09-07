---
'@avodado/core': patch
'@avodado/render': patch
'@avodado/studio': patch
---

Schema importers keep two tables apart; the one-accent rule says what it means.

**`auth.users` and `public.users` are two tables again.** Every schema importer
— SQL DDL, DBML, Prisma — merged them into one entity: columns from both, the
later `id` type overwriting the earlier, foreign keys re-pointed at the fusion,
and `avo sync sql` printing "2 entities · 1 relations · avo check: clean". The
resolver fell through to a bare-name match even when the reference carried a
schema that did not match. An entity is now identified by its schema *and* its
name, where "no schema" is an identity of its own; a qualified reference
matches only the same qualifier, an unqualified one still resolves when exactly
one table carries the name, and a name two schemas share is reported —
`"users" is ambiguous — 2 tables carry that name (auth.users, billing.users);
qualify it as \`schema.table\`` — instead of guessed. Declaring the same table
twice (a second `CREATE TABLE users`, `Table users {`, or `model User {`) is
now an error with its line, rather than a silent merge; `IF NOT EXISTS` and
`OR REPLACE` are respected.

**Importing a large schema is linear.** Entity and column lookup went through
up to three `Array.find` scans per declaration, which made every importer
quadratic in table count: a 32 000-table schema took 5.9 s of scanning. Lookup
is now a map — 147 ms for the same file, and resolution reads no element of the
entity array at all.

**The one-accent rule in `DESIGN.md` said "at most two elements", which was
wrong.** A focal thing is not always one mark: `spans` accents the critical
path, which is a chain, and `flow` accents each arrival that ends well, which
is a node plus the edge into it. The rule now reads "one focal thing, drawn at
whatever size it is — and never two unrelated things", states that a per-item
`tone` / `status` accent is the author's count and not the renderer's, and is
enforced by a new test that carries one declared row per block type, checks
every catalog example against it, checks that a renderer-chosen accent does not
grow with the data, checks that an author-marked accent is zero without the
marks, and checks structurally that the marks of a path or an arrival belong to
the same thing. No renderer changed; no rendered output changed.

The no-hex test now sweeps every file under `packages/render/src`, not only
`blocks/` and `svg/`, so a colour literal in `deck.ts` or any other renderer
file is caught.
