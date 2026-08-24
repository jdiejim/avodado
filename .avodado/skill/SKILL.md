---
name: avodado-docs
description: >-
  Use whenever you author, edit, validate, or review Avodado documentation —
  Markdown files that mix prose with typed YAML blocks, in 12 families:
  narrative & prose · tables & code · API · architecture · flows & state ·
  data model · charts & overviews · planning & backlogs · business & decisions ·
  design system · algorithms · AI & agents. High-signal types: sequence · erd ·
  c4 · table · callout · timeline · userstory · flow · chart · agentloop ·
  archmap · block · endpoint · kanban · stats · divider — and 74 more, mapped in
  reference/blocks/INDEX.md.
  Trigger on any of: docs/**/*.md in an Avodado repo, the `avo` CLI, any block
  type above, `doc#id` cross-references, presence of `avodado.config.*` or
  `.avodado/skill/SKILL.md` in the workspace, or user mentions "avodado". Covers
  block selection, block grammar, every block's fields, the reference scheme,
  YAML pitfalls, and the validate workflow.
  Detailed references live beside this file — read them on demand:
  reference/blocks/INDEX.md (block → family file map),
  reference/blocks/contract.md (the exact field contract for all 90 blocks),
  reference/blocks/<family>.md (fields + examples per family),
  reference/recipes.md (worked composition recipes),
  reference/style-ste.md (the style authority for all prose),
  reference/system-design.md, reference/decks.md, reference/intake.md,
  reference/organizing.md.
---

# Authoring Avodado documents

> Repo location: commit this folder at `.avodado/skill/` — this file plus its
> `reference/` files. `avo init` copies the folder into new projects and writes
> editor adapters (`CLAUDE.md`, `.cursor/rules/avodado.mdc`) that point here.

Avodado documents are **plain Markdown with typed, fenced YAML blocks**. Prose
is ordinary Markdown. Anything structured — a diagram, a table, a chart — is a
fenced code block whose info-string is the block *type*, with a YAML body.

**The one rule:** the `.md` file is the source of truth. Edit files directly.
A document must read fine as plain text, so never paste raw HTML or inline SVG
— express structure through blocks.

**How to think about blocks:** a block type is a means, not a menu item. What
communicates is the underlying *shape* — an exchange, a flow, a grid, a
containment. Start from the reader's question, find the shapes that can answer
it, then pick the block. A doc built by matching request keywords to block
names is the failure mode this skill exists to prevent.

## The selection procedure — seven steps

An Avodado doc is **designed, not filled in**. Work through these steps in
order. Steps 1–5 happen before any YAML.

### 1 · Think

Write the reader's question(s), one line each. That list drives everything.
To frame it, answer four things:

- **Reader & moment** — who reads this, and when? (new joiner · design
  reviewer · on-call at 3am · exec deciding)
- **Job** — what must the reader *know or decide* afterward?
- **Scope** — one endpoint, one service, the platform? Current state or
  proposal?
- **Form** — a document, a deck (`avo slides`), or both?

If the ask is one line and the answers would change the outline, **ask 2–4
pointed questions back before writing**. Read `reference/intake.md` first — it
lists the CRITICAL items per document kind. Batch all questions in one message.
A good question is one whose answer picks between two *different documents*
("reference for integrators, or explainer for new devs?"). If the user is not
available, proceed on explicit assumptions: list them in a `callout`
(`tone: note`, title *Assumptions*) near the top. Never silently guess scale,
audience, or scope.

Then **outline the `##` headings as a story** — each heading one beat, the
list readable as an argument. Any arc works: orient → tension → resolution →
proof → plan, or whatever the content demands. The test: a reader who sees only the
headings can follow the story. Headings that would fit a different subject
unchanged mean you templated — rewrite them in this document's terms.

### 2 · Survey

For each reader question, read its row in the **question table** below. List
the candidate *shapes* that can answer it — not one block. If no row fits,
scan `reference/blocks/INDEX.md` for the family that draws the shape you need.

### 3 · Reference

Open the nearest exemplar before you write:

- the matching recipe in `reference/recipes.md`;
- a scaffolded example from `avo template --list` / `avo template <name>`;
- the worked example in the block's family file (`reference/blocks/<family>.md`).

Exemplars show composition and field usage. They are examples, not forms.

### 4 · Design

Compose the view: which blocks, in what order, with what prose between.
Rules:

- **2–5 structural blocks per doc.** One lens per beat — structure
  (`c4`/`block`), behavior (`sequence`/`flow`/`state`), data (`erd`),
  trade-offs (`options`/`proscons`), plan (`timeline`/`statustable`). Never
  two blocks drawing the same boxes.
- **Vary the lenses.** Three tables in a row means two want to be something
  else. All diagrams and the doc has no argument; all prose and it has no
  anatomy.
- **Thin data folds into prose.** Fewer than ~3 rows or nodes → a sentence or
  a `callout`, not an almost-empty block.
- **Dense data splits.** A diagram past its density budget reads worse than
  two focused ones — `avo check` warns at the caps.
- **Every number has one home.** When two blocks touch the same facts, one
  block owns the figures; the other keeps only its own lens.
- **One consistent world.** `meta` first (title + subtitle + tag), then a
  short prose intro. The service named `orders-api` in the `c4` keeps that
  exact name in the `sequence`, the `erd`, and the prose.
- **The heading titles the block.** A `##` heading directly above a block IS
  its title — omit the block `title` and write it once, in Markdown. Give a
  block its own `title` only when it must say something the heading does not.

### 5 · Justify

**Mandatory.** Write one line per chosen block: why this block and not the
nearest alternative. Example: "sequence, not flow — the reader's question is
about message order between two services, not about branching." If you cannot
name the rejected alternative, you have not surveyed — return to step 2. Plain
prose is always one of the alternatives — a block near the thin-data line must
beat the sentence that would replace it. The justification also covers what
you left out ("no erd — one table, folded into prose").

### 6 · Write

Write the YAML per the block's family file and
`reference/blocks/contract.md`. Write all prose — Markdown paragraphs AND
block text fields — per the **prose rules** below and
`reference/style-ste.md`. Give an `id:` to any block another block will
reference.

### 7 · Check

Run `avo check`. Fix every diagnostic — a passing check is the definition of
done. Then reread only the headings and block titles: the skim must still tell
the story from step 1. Cut any section that reads as filler.

### Editing an existing doc — keep the story whole

Read the whole doc first and find its story. Then:

- Edit the specific block surgically. Never regenerate the file.
- **Trace the change through every block that shares the fact.** A renamed
  table moves through the `erd`, the `sequence` labels, and the prose
  together. A doc where one block knows the change and its neighbors do not
  is worse than no edit.
- If the change breaks the outline, say so and propose the outline change
  instead of bolting it on.

## Reference files — read on demand

| File | Read it when |
|---|---|
| `reference/blocks/INDEX.md` | To find which family file documents a block — all 90 types → family file, one line each, plus the alias table. |
| `reference/blocks/<family>.md` | Before you write any block you have not used this session — examples + field semantics. |
| `reference/blocks/contract.md` | The strict at-a-glance field contract for all 90 blocks — required vs optional, enums, number rules. |
| `reference/recipes.md` | When composing a document — 8 worked composition recipes (backend, agent, frontend, pipeline, state machine, incident, ADR, API). Examples, not forms. |
| `reference/style-ste.md` | Before you write any prose or instruction text — the style authority. |
| `reference/system-design.md` | Any architecture / design ask — the 8-step design method, which architecture block when, node kinds, the `avo design` slugs. |
| `reference/decks.md` | Any slides / deck ask — slide markers, alignment, pagination, consulting-style decks. |
| `reference/intake.md` | Step 1 of every new document — the ask-back protocol and per-document-type checklists. |
| `reference/organizing.md` | Multi-doc work — when to split, slug naming, index docs, cross-doc refs, `avo build` / Site mode. |

## Pick the block by the reader's question

The renderers draw eight primitive shapes. A block is a means; the shape is
what communicates:

1. **Exchange** — actors trade messages over time (`sequence`, `packet`).
2. **Flow** — steps and branches through a graph (`flow`, `dfd`, `cycle`,
   `sankey`, `gitgraph`, `swimlane`).
3. **Modes** — one object, discrete states, transitions (`state`).
4. **Containment** — boundaries, what lives inside what (`c4`, `cluster`,
   `block`, `layers`, `archmap`, `treemap`, `venn`).
5. **Network** — who connects to whom, no strict nesting (`graph`, `erd`,
   `felogic`, `frontend`, `uml`).
6. **Grid** — two axes: compare, score, locate (`table`, `matrix`,
   `quadrant`, `heatmap`, `scorecard`, `options`, `proscons`, `benchmark`,
   `swot`, `harvey`).
7. **Time** — when things happen(ed), or how a quantity moves (`timeline`,
   `gantt`, `changelog`, `journey`, `chart` line/area, `statustable`).
8. **Structure & emphasis** — hierarchy, proportion, procedure, contract,
   callout: everything else, from `tree` and `steps` to `endpoint`,
   `agentloop`, and `callout`.

Find your reader's question below; the row lists the candidate shapes and the
discriminator that picks between them. One-line descriptions of every block
live in `reference/blocks/INDEX.md` — read the family file before writing.

| Reader question | Candidate shapes → blocks | Choose by |
|---|---|---|
| What calls what? | Exchange: `sequence` · Network: `graph`, `c4` | ordered messages → sequence; topology at rest → graph/c4 |
| What happens when this fails? | Flow: `flow` · Modes: `state` · Exchange: `sequence` (alt path) | branching decisions → flow; lifecycle of one object → state; actor interplay → sequence |
| What lives inside what? | Containment: `c4`, `cluster`, `block`, `layers`, `archmap` · Structure: `tree`, `composition`, `treemap` | runtime boundaries → c4/cluster/block; conceptual tiers → layers; part-of → composition/tree; area budget → treemap |
| What changes over time? | Time: `timeline`, `gantt`, `changelog`, `chart` (line), `slopegraph` · Modes: `state` | events → timeline; scheduled work → gantt; released work → changelog; a measured quantity → chart; two snapshots, every item named → slopegraph; legal transitions → state |
| How do these options compare? | Grid: `options`, `proscons`, `matrix`, `scorecard`, `benchmark`, `quadrant`, `harvey` | criteria × candidates → options; one option's trade-offs → proscons; measured numbers → benchmark; position on two axes → quadrant; qualitative fill → harvey |
| Where does data go? | Flow: `dfd`, `sankey` · Network: `erd` · Exchange: `sequence` | processes and stores → dfd; volumes → sankey; shape at rest → erd |
| Who does what, when? | Flow: `swimlane` · Time: `journey`, `agenda` · Structure: `team`, `kanban` | ownership across steps → swimlane; experience over stages → journey; work in flight → kanban |
| What are the exact steps? | Structure: `steps` · Flow: `flow` | linear procedure → steps; branches or retries → flow |
| What do we build, in what order? | Structure: `storymap` · Time: `timeline`, `gantt` | scope under each journey step, sliced by release → storymap; dated phases → timeline; bars against dates → gantt |
| How big / how fast / how much? | Structure: `stats`, `bignumber`, `chart`, `envelope` · Grid: `benchmark` | one headline → bignumber; a set → stats; napkin math → envelope; measured comparison → benchmark |
| What is this made of? | Structure: `anatomy`, `composition` · Network: `erd` · Containment: `layers` | labeled parts → anatomy; proportions → composition; entities + relations → erd |
| What causes this? | Structure: `fishbone` · Grid: `matrix` | one effect, branching causes → fishbone |
| Why did we decide this? | Grid: `options`, `proscons` · Structure: `scqa`, `takeaways`, `callout` | full ADR shape → see `reference/recipes.md`; the decision itself → callout; narrative case → scqa |
| What does the API accept and return? | Structure: `endpoint`, `code`, `packet` · Grid: `table` | HTTP surface → endpoint; wire format → packet; error codes → table |
| How does the agent behave? | Structure: `agentloop`, `trace`, `prompt`, `context` · Exchange: `sequence` | the loop → agentloop; one real run → trace; the contract → prompt; window contents → context |
| What must always hold? | Structure: `spec`, `slo`, `glossary`, `callout` | invariants → spec; service targets → slo; terms → glossary; a single warning → callout |

> **Old names keep working.** Twelve former block types are permanent aliases
> (`infra`/`event`/`ddd`/`network` → `block`, `belogic` → `felogic`,
> `dag` → `flow`, `waterfall`/`funnel` → `chart`, `diff`/`terminal` → `code`,
> `mece` → `tree`, `tracker` → `statustable`). An alias fence parses,
> validates, and renders exactly as before; `avo check` notes the mapping as a
> `W_ALIAS_TYPE` warning. Write the canonical spelling in new docs; never
> rewrite an existing fence only to silence the warning. The full table is in
> `reference/blocks/INDEX.md` and `contract.md`.

### Adapt the content — structure in the source wants a diagram

When you receive prose, a spec, or a generic table, the *structure the source
describes* picks the diagram — not the words it uses. If the source describes
an architecture, a layering, a pipeline, or a set of gates, render the
matching diagram. Prose and tables are the fallback for things that are
genuinely paragraphs and genuinely rows of values — not the default. The
close calls:

| The source describes… | Use | Not |
|---|---|---|
| N checks or gates **in order**, any one can reject | `flow` (decision nodes + `kind: error` exits) | a `sequence` — gates are not temporal |
| A happens, then B, then a reply comes back | `sequence` | a `flow` |
| who does what across teams, step by step | `swimlane` | a `flow` |
| controller / service / repository / adapter layers in code | `felogic` (`variant: be`) | a `sequence` |
| components / hooks / providers / store | `frontend` (tree) or `felogic` (module graph) | a `table` |
| a capability landscape as a tile mosaic | `archmap` | a `block` — no arrows in a landscape |
| compare 2–4 named things side by side | `gallery` (`cols: N`, nested blocks) | stacking them, or a `table` |
| a session transcript, turn by turn with tool calls | `trace` | a `sequence` — a trace carries content, not arrows |
| access = check ∩ check ∩ check, unordered | `composition` | a `flow` |
| a traversal / BST / heap shape | `bintree` | a `tree` — that is a file hierarchy |
| binary search, two pointers, a window | `array` | a `table` |
| pointer manipulation | `linkedlist`; hashing → `hashmap`; visit order → `graph` with node `state` | a `flow` |
| tasks with a domain-specific status label per row | `statustable` (define the `statuses` vocabulary) | a plain `table` |
| what the user sees on screen | `wireframe` | prose |

### Repurpose a block — the type name is a hint, not a cage

Each block has a **shape** and a **conventional example** (its shipped
labels). Pick by the shape of the idea, not by the example, and **relabel
everything** — titles, axes, columns, units — so the block speaks the user's
domain.

A `quadrant` is any two-axis 2×2 (risk vs reward, urgency vs
importance), not "effort vs impact". A `journey` is any staged progression
(sales funnel, maturity model). An `anatomy` splits any delimited identifier
(URL, semver, cron). A `cvt` is any before → after. A `matrix` is any X × Y
grid with one value per cell (RACI, browser support).

When you repurpose, nothing should betray the original example.

## Composing a document

Composition — which blocks, in what order, with what prose between — is
worked through examples, not filled from forms. Read `reference/recipes.md`:
8 worked recipes (backend architecture, AI/agent architecture, frontend
architecture, data pipeline, state machine, incident writeup, ADR, API
reference). Each recipe gives the reader questions it answers, the block
stack, what the prose between blocks carries, and the rejected alternatives. **They are
examples of composition, not forms to fill in** — two different systems must
not produce structurally identical docs. Pick a recipe per *section* when a
large doc mixes concerns.

`avo template <name>` scaffolds a finished example doc (`avo template --list`
for the 18 names). A template is a worked exemplar — still rework it through
steps 1–5.

**"Design an X" asks** (a notification system, a rate limiter) are where
templating shows worst: every real system's document is shaped by *its*
bottleneck. Work the 8-step method in `reference/system-design.md` —
requirements → envelope math → contract → high level → bottleneck deep-dive →
trade-offs → failure & operations → plan.

**Decks:** any document renders as a deck with `avo slides`. Each `#`/`##`
heading starts a slide and is its title; the `meta` block is the cover.
Heading markers `{top}` `{center}` `{bottom}` `{split}` control layout. Read
`reference/decks.md` before any deck ask.

## Prose rules — hard limits

`reference/style-ste.md` is the style authority. Full STE discipline applies
to this skill's own instructions, `steps` blocks, and diagnostics; STE-lite
applies to prose, `callout`, and `pullquote` content.

**Scope first — three zones, three contracts:**

- **Markdown prose between blocks**: simple and short. Rules 1–5 below apply
  in full.
- **Block text fields** (`description`, `lede`, `body`, `note`, `subtitle`,
  `summary`): complete information, tight form. Apply the FORM rules (short
  active sentences, no filler openers) but **never delete a fact to get
  shorter**. Split a long sentence into two; keep every component, value,
  and condition. Completeness wins over brevity inside a block.
- **Diagram data** (node names, messages, edge labels, states, values):
  untouchable. Never simplify, trim, or summarize it — the diagram is the
  data, and it must be complete.

The hard rules for Markdown prose:

1. **Prose carries what the block cannot**: why, trade-off, consequence.
   Never describe the block below it — the reader can see it.
2. **3 sentences default, 5 hard maximum** per paragraph.
3. **Every sentence carries a fact, a decision, or a consequence.** Delete
   the rest.
4. **Banned openers**: "In this section", "It's important to note", "This
   diagram shows", "Let's dive into", "At a high level", "The blocks below".
5. **Write for a smart non-specialist**: simple words, precise claims. Short
   and elegant beats thorough — but in fields, complete beats short.

Before/after — a field keeps its facts, in tighter form:

```
✗ Leveraging the gateway abstraction, the flow seamlessly routes charges
  through our robust payment layer and various downstream systems.
✓ The controller calls OrderService, which loads through OrderRepository and
  charges through the PaymentGateway interface (Stripe and Adyen adapters).
  Writes go to Postgres, the event bus, and the external gateways. One
  interface per provider, so a Stripe outage is a config change.
```

Before/after — Markdown prose drops the legend, keeps the consequence:

```
✗ Time runs downward. Solid arrows are synchronous requests; dashed are
  responses. The order row exists as PENDING only inside the transaction…
✓ An order is never visible as PENDING outside the transaction: it commits
  as CONFIRMED or rolls back to CANCELLED. Clients can treat every read as
  final.
```

Titles and voice:

- **Use the user's nouns, verbatim.** They say "tenants" — do not write
  "customers". Carry their exact terms into labels, headings, node names.
- **Headings state what the reader sees** ("Request flow", "Rollout plan"),
  never the block type ("Sequence").
- **`meta` cover**: `title` = what the document is, in the user's domain
  language; `subtitle` = the question it answers; `tag` = a short pill
  (`RFC`, `Runbook`). If the user named the doc, use that name as-is.
- **Match their register.** Do not inflate "quick notes on auth" into "Authn
  & Authz Architecture Specification". "DRAFT" left in a finished doc is a
  bug.

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

- The info-string is exactly one of the **90 block types** mapped in
  `reference/blocks/INDEX.md` and specified field-by-field in
  `reference/blocks/` — never invent new ones. (The 12 old merged names
  remain valid as permanent aliases.)
- The body is **YAML** (JSON also parses; YAML is preferred).
- Use only the fields documented for that block. Keep prose outside blocks.
- A block MAY carry a top-level `id:` (a slug) so other blocks can reference
  it.
- Most diagram blocks accept optional `title`, `description`, and `lede`;
  these surface in the section header and diagram frame.

### Terse arrows & items — the default for chatty lists

Most list fields accept a **terse one-line string** per item. Write this form
by default; it expands to the object form at parse time, so validation and
rendering are identical.

**Arrows & diagrams**

| Field | Terse item | Grammar |
|---|---|---|
| `sequence.messages` | `Client -> API: POST /orders` | `from -> to: label` — `->` sync · `-->` response · `-x->` error |
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

## Workflow — always validate

After you create or edit any doc, run the CLI and fix everything it reports:

```
avo check                       # validate all docs: schema + dangling refs + dup ids
avo check docs/orders-api.md    # validate one file
avo check --json                # machine-readable, for CI
avo preview docs/orders-api.md  # render and open it
avo studio                      # visual Edit, live Site preview, Present
avo build                       # static site (index + nav + cross-doc links) → dist/
avo pdf docs/x.md               # one doc → PDF
avo block <type>                # scaffold a single block
avo template <name>             # scaffold a whole doc (--list for names)
avo demo [family]               # render the built-in block showcase
avo sync openapi spec.yaml --out docs/api.md   # doc from an OpenAPI spec
```

`avo check` exits non-zero on any error and names the file, line, and
offending value. **A change is not done until `avo check` passes.**

### When `avo check` fails — error code recipes

Every diagnostic carries a stable code. Apply the matching fix:

| Code | Meaning | First check |
|---|---|---|
| `E_PARSE_YAML` | YAML body failed to parse. | Re-read *YAML pitfalls*. Unquoted `,`/`:`/`#` in a `desc` is the usual cause. |
| `E_SCHEMA` | A field is missing, wrong-typed, or unknown; the message contains the path. | Compare against `reference/blocks/contract.md` and the family file. Do not add undocumented fields — the schema is strict. |
| `E_DANGLING_REF` | A `ref` points at an id that exists nowhere. | Fix the ref string, or add the missing `id:` to the target block. |
| `E_DUP_ID` | The same `id:` in two blocks; the message names both. | Ids are repo-global. Rename one. |
| `E_BAD_REF_FORMAT` | A `ref:` is not `doc#id` or `#id` shape. | Match the format; the id slug is `[\w-]+`. |
| `E_UNKNOWN_BLOCK` | A segment claims an unknown block type (rare — unknown fences normally fall through to plain code). | Use exactly one of the 90 documented types (`reference/blocks/INDEX.md`). |
| `W_EMPTY_BLOCK` | A typed block had an empty body. | Add fields or remove the block. |
| `W_SUSPECT_BLOCK` | A fence tag is within typo distance of a real type (e.g. ` ```sequnce `); it rendered as plain text. | Rename the fence to the suggested type. |
| `W_ALIAS_TYPE` | The fence uses one of the 12 old merged names. It parsed and rendered fine. | Nothing — both spellings work forever. Use the canonical name in new blocks; do not churn existing fences. |

Common `E_SCHEMA` shapes: `Expected string, received number` → quote the
value (`tech: "16"`). `Invalid enum value` → use the documented enum only.
`Unrecognized key(s)` → you added an undocumented field, or an unquoted comma
in a flow-style mapping split a phrase into keys. `meta` fails → it must be
the first block in the file.

## Do / Don't

**Do**

- Edit the specific block you need — a few lines — rather than regenerating a
  document.
- Keep narrative in Markdown prose and structure in blocks.
- Write the one-line justification per block (step 5) before you write YAML.
- Quote YAML values that contain commas, colons, or `1:N` strings.
- Give a block an `id:` whenever something else might reference it.
- Run `avo check` and resolve all diagnostics before finishing.
- When unsure between architecture blocks: `block` for boxes-and-arrows,
  `c4` for actor / system context — both are safe defaults.

**Don't**

- Paste raw HTML, `<svg>`, or `<style>` into a doc. Use blocks.
- Invent block types or fields. The schemas are strict; unknown fields error.
- Reference a `doc#id` that does not exist.
- Stuff a whole spec into one giant block. Decompose into 3–5 focused blocks.
- Write a `description` longer than 2 sentences. Long narrative goes in
  prose.
- Reuse the same `id:` in two blocks. Ids are repo-global unique.
- Add a `prose` block AND raw `##` headings for the same idea. Pick one.
- Use `frontend` for backend modules, or `felogic` when you mean `frontend`:
  `frontend` is a top-down tree; `felogic` (or `variant: be`) is a module
  graph with edges.
- Ship the same document shape twice for different subjects. Recipes and
  templates are worked examples; steps 1–5 decide the real outline.
- Match a request keyword to a block name and stop thinking. Survey shapes,
  then justify the pick against its nearest alternative.
