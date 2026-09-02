# Writing blocks — step 6 of the procedure

Read this file before you write YAML. It holds the block grammar, the terse
item forms, the YAML traps, the reference scheme, and the naming rules. The
field contract for every block is in `blocks/contract.md`; the examples are
in `blocks/<family>.md`.

## How a block looks

````
## Request flow

```sequence
id: seq-place-order
endpoint: { method: POST, path: /orders }
actors:
  - { id: Client, name: Client }
  - { id: API, name: Orders API }
messages:
  - Client -> API: POST /orders
  - API --> Client: 201 Created
```
````

Rules:

- The info-string is exactly one of the block types mapped in
  `blocks/INDEX.md` and specified field-by-field in `blocks/contract.md`.
  Never invent a type. The 12 old merged names remain valid as permanent
  aliases.
- The body is **YAML** (JSON also parses; YAML is preferred). A `mermaid`
  fence is also accepted for five diagram grammars — see `mermaid.md`.
- Use only the fields documented for that block. The schemas are strict: an
  unknown field is an error. Keep prose outside blocks.
- A block MAY carry a top-level `id:` (a slug) so other blocks can reference
  it.
- Most diagram blocks accept optional `title`, `description`, and `lede`.
  A `##` heading directly above a block IS its title — omit the block `title`
  unless it must say something the heading does not.
- A `description` is at most 2 sentences. Longer narrative goes in prose.
- Never paste raw HTML, `<svg>`, or `<style>` into a doc.

## Terse arrows & items — the default for chatty lists

Most list fields accept a **terse one-line string** per item. Write this form
by default; it expands to the object form at parse time, so validation and
rendering are identical.

**Arrows & diagrams**

| Field | Terse item | Grammar |
|---|---|---|
| `sequence.messages` | `Client -> API: POST /orders` | `from -> to: label` — `->` sync · `-->` response · `-x->` error · `-> +to` opens an activation bar on `to` · `--> -to` closes the sender's bar |
| `sequence.messages` frames | `alt: token valid` · `else: expired` · `end` | `alt` `opt` `loop` `par` `break` `critical` open a frame (`: guard` optional) · `else: guard` starts the next branch · a bare `end` closes the frame |
| `flow`/`graph`/`block` `edges` · `c4.edges` · `cluster.links` | `build -> deploy: on green` | `->` solid · `-->` dashed · `-x->` error |
| `dfd.edges` · `swimlane.links` | `a -> b: writes` | `from -> to: label` |
| `state.transitions` | `idle -> active: submit` | the label is the **event** |
| `flow`/`graph`/`block`/`dfd`/`state` **nodes** | `rx: Receive` — or just `Receive` | `id: Label`; a bare name is both id and label |
| `erd` entity `columns` | `id uuid pk` · `org_id: uuid fk` | `name [type…] [pk] [fk]` |
| `erd.relations` | `users \|\|--o{ orders: places` | crow's-foot — `\|\|--\|\|` 1:1 · `\|\|--o{` 1:N · `}o--o{` N:M · plain `->` = no cardinality |

**Text & cards** (split on ` — ` em dash · `·` middle dot)

| Field | Terse item | Grammar |
|---|---|---|
| `glossary.terms` | `SLO — the target` | `term — def` |
| `faq.items` | `Why fast? — The cache is warm.` | `q — a` |
| `takeaways` / `list` / `steps` items | `Ship small — five beats one.` | `lead — detail?` |
| `kanban` cards | `Core parser` · `Validation · priority` | `title · tag?` |
| `stats.stats` | `p95 · 120ms · -30%` | `label · value · delta?` — trend inferred from the sign |
| `team.members` | `Ana · Backend · payments` | `name · role? · focus?` |
| `agenda.items` | `09:00 · 20m · Standup — round robin` | `[time ·] [duration ·] title [— desc]` |
| `okr` key results | `[on-track] Signups · 60%` | optional `[status]`, then `kr · progress` |
| `timeline.items` | `[done] 2026-07 · Ship beta · Behind a flag` | optional `[status]`, then `date · label · desc` |

The label is everything after the **first** `:` (arrows) or the first ` — `
(text pairs). Mix terse strings and objects freely in one list; switch to the
object form when an item needs fields the grammar cannot say.

## YAML pitfalls — quote when in doubt

Most "schema errors" are YAML mis-parses. **Quote the value** whenever it
contains:

| Character | What goes wrong unquoted | Fix |
|---|---|---|
| `,` (comma) | Inside `{ a, b }` flow style it is a separator; a sentence becomes 3 keys. | `desc: "40 blocks, themes, agent skill"` |
| `:` (colon) | Read as `key: value`; `1:N` becomes a number sequence. | `card: "1:N"` |
| `#` (hash) | Starts a comment. | `label: "POST /orders #idempotent"` |
| Leading `*` `&` `!` `\|` `>` `%` `@` `` ` `` | YAML anchor / tag / fold characters. | Quote the whole value. |
| Leading `-` + space | Looks like a list item. | Quote. |
| Numeric-looking (`0`, `02`, `1e3`) | Parsed as a number; fails `string` schemas. | `delta: "0"`, `version: "1.0"` |
| `yes` / `no` / `true` / `false` / `null` | YAML 1.1 booleans. | Quote. |
| Empty | Parsed as null. | `name: ""` |

Inline `{ k: v }` maps are fine for short records (under ~5 fields). For
anything longer, use block style — easier diffs, fewer comma traps. When a
`desc` / `note` / `summary` / `description` contains prose, **always quote
it** — those fields are the top source of validation errors.

## Cross-references (`doc#id`)

Blocks become a connected model through references:

- Give a block a unique `id:` (unique across the **whole repo**).
- Reference it as `doc#id`, where `doc` is the target file's path under the
  docs root without `.md` (e.g. `orders-api`, `architecture/overview`).
- A bare `#id` means the current document. **Always prefer `#id` inside the
  same doc** — it survives renames. Do not repeat the current doc's slug.
- A reference to an id that does not exist is a **dangling reference** and
  fails validation. Only add a `ref` to an id that exists (or that you create
  in the same change).

The only reference-bearing field in v1 is `userstory.links[].ref`.

## Names, titles, voice

- **Use the user's nouns, verbatim.** They say "tenants" — do not write
  "customers". Carry their exact terms into labels, headings, node names.
- **One consistent world.** The service named `orders-api` in the `c4` keeps
  that exact name in the `sequence`, the `erd`, and the prose.
- **Headings state what the reader sees** ("Request flow", "Rollout plan"),
  never the block type ("Sequence").
- **`meta` cover**: `title` = what the document is, in the user's domain
  language; `subtitle` = the question it answers; `tag` = a short pill
  (`RFC`, `Runbook`). If the user named the doc, use that name as-is.
- **Match their register.** Do not inflate "quick notes on auth" into "Authn
  & Authz Architecture Specification". "DRAFT" left in a finished doc is a
  bug.
- `frontend` is a top-down tree; `felogic` (or `variant: be`) is a module
  graph with edges. Do not swap them.
- Do not add a `prose` block AND raw `##` headings for the same idea. Pick
  one.
