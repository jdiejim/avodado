---
'@avodado/core': minor
---

Schema hardening: numbers, grid coordinates, the ERD column shorthand, and in-block references.

**Non-finite numbers are rejected.** Zod's `z.number()` accepts `Infinity`, and YAML `.inf` parses to exactly that, so `packet: {width: .inf}` validated clean and then made a renderer append to a string until the process ran out of memory. Every numeric field now goes through one shared builder that requires a finite value; no block field wants `Infinity`. A test fails the build if a bare `z.number()` returns to the schema file.

**Fields that multiply output size carry a ceiling.** `packet.width` (≤ 128), `packet.fields[].bits` (≤ 4096) and a `wireframe` element's `rows` (≤ 40) each became a renderer loop bound — `width: 1000000` produced a 108 MB page with no diagnostic. A value that is merely unwise rather than impossible warns instead: `W_DENSE_BLOCK` above 64 bits per row, and above 12 rows in one wireframe element.

**Grid coordinates are 1-based whole numbers.** `col: 0` used to paint a node at a negative x, entirely outside the `viewBox`, with nothing on the page to say a node was lost. `col` / `row` are now integers from 1 and `cols` / `rows` / `w` spans at least one cell, across `c4`, `block`, `dfd`, `graph`, `felogic`, `swimlane`, `state`, `flow`, `uml`, `frontend`, `sankey` and the shared group panel. `lane` and `layer` stay 0-based: they index a declared list. Studio's "+ Add group" chip seeded `col: 0`; it now seeds the schema's floor.

**The ERD column shorthand keeps a multi-word default.** `created_at timestamptz default=CURRENT TIMESTAMP` parsed as `default: CURRENT`, `type: "timestamptz TIMESTAMP"`. The shorthand now tokenizes quote-aware and paren-aware, only treats a leading `name:` as the single-pair separator, and reads `default=` to the closing quote or to the next flag. `default=12:00`, `default=0::numeric`, `default="hello world"`, `enum(a:b,c)` and `numeric(10, 2)` all survive.

**An in-block reference to a thing that does not exist is reported.** An `erd` relation naming an entity that is not declared, a `block` edge naming a missing node, a duplicate entity name and a duplicate node or group id were all discarded in silence while the diagram rendered as if the line were never written. They are now `E_SCHEMA`, matching what `spans` and `saga` already do for theirs.

Diagnostics also read better: a non-finite value reports its cause once instead of three times, and a fractional coordinate says "expected a whole number" with the fix.
