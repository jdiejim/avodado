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
  This file is the decision path. The mechanics live beside it — read them at
  the step that needs them: reference/blocks/INDEX.md (block → family file),
  reference/blocks/contract.md (field contract for all 90 blocks),
  reference/blocks/<family>.md (fields + examples), reference/recipes.md
  (composition), reference/writing.md (grammar, terse items, YAML traps,
  doc#id), reference/mermaid.md (Mermaid input), reference/check.md (avo
  check + error codes), reference/style-ste.md (prose style),
  reference/intake.md, reference/system-design.md, reference/decks.md,
  reference/organizing.md.
---

# Authoring Avodado documents

> Repo location: commit this folder at `.avodado/skill/` — this file plus its
> `reference/` files. `avo init` copies the folder into new projects and writes
> editor adapters (`CLAUDE.md`, `.cursor/rules/avodado.mdc`) that point here.

An Avodado document is **plain Markdown with typed, fenced YAML blocks**.
Prose is ordinary Markdown. Anything structured — a diagram, a table, a chart
— is a fenced block whose info-string is one of the **90 block types**, with
a YAML body.
The `.md` file is the only source of truth. Edit it directly. Never paste raw
HTML or inline SVG.

**A block type is a means, not a menu item.** What communicates is the
underlying *shape* — an exchange, a flow, a grid, a containment. Start from the
reader's question, find the shapes that can answer it, then pick the block.
The words in the request are not the shape: "timeline" in a request does not
mean a `timeline` block, and "steps" does not mean `steps`. A doc built by
matching request keywords to block names is the failure this skill exists to
prevent.

## The procedure — seven steps

An Avodado doc is **designed, not filled in**. Work the steps in order. Steps
1–5 happen before any YAML. Each step names the file to read at that step;
read nothing else until you get there.

### 1 · Think — read `reference/intake.md` for a new doc

Write the reader's question(s), one line each. That list drives everything.
Frame it with four answers:

- **Reader & moment** — who reads this, and when? (new joiner · design
  reviewer · on-call at 3am · exec deciding)
- **Job** — what must the reader *know or decide* afterward?
- **Scope** — one endpoint, one service, the platform? Current state or
  proposal?
- **Form** — a document, a deck (`avo slides`), or both?

If the ask is one line and the answers would change the outline, ask 2–4
pointed questions back before writing, in one message. A good question picks
between two *different documents* ("reference for integrators, or explainer
for new devs?"). If the user is not available, proceed on explicit
assumptions and list them in a `callout` (`tone: note`, title *Assumptions*)
near the top. Never silently guess scale, audience, or scope.

Then **outline the `##` headings as a story** — each heading one beat, the
list readable as an argument. A reader who sees only the headings can follow
the story. Headings that would fit a different subject unchanged mean you
templated — rewrite them in this document's terms.

### 2 · Survey — use the question table below

For each reader question, find its row in the table. List the candidate
*shapes* that can answer it — not one block. If no row fits, scan
`reference/blocks/INDEX.md` for the family that draws the shape you need.

### 3 · Reference — open the nearest exemplar

- the matching recipe in `reference/recipes.md`;
- a scaffolded example from `avo template --list` / `avo template <name>`;
- the worked example in the block's family file (`reference/blocks/<family>.md`).

Exemplars show composition and field usage. They are examples, not forms.

### 4 · Design — compose the view

Which blocks, in what order, with what prose between. Rules:

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
- **The heading titles the block.** A `##` heading directly above a block IS
  its title. Omit the block `title` unless it must say something the heading
  does not.
- **`meta` first** (title + subtitle + tag), then a short prose intro.

### 5 · Justify — mandatory, one line per block

Why this block and not the nearest alternative: "sequence, not flow — the
reader's question is about message order between two services, not about
branching." If you cannot name the rejected alternative, you have not
surveyed — return to step 2. Plain prose is always one of the alternatives: a
block near the thin-data line must beat the sentence that would replace it.
Also justify what you left out ("no erd — one table, folded into prose").

### 6 · Write — read `reference/writing.md`, then the family file

Write the YAML per the block's family file — it holds the fields and a worked
example for every block in the family. Open `reference/blocks/contract.md`
only when a field question is not answered there. Write all prose per the
**prose rules** below and `reference/style-ste.md`.
Give an `id:` to any block another block will reference. **Quote any YAML
value that contains `,` `:` `#` `{` `}` or starts with a special character**
— inside `{ a: b, c: d }` inline maps an unquoted comma splits the phrase into
keys, and `{id}` opens a nested map. Prefer block style over inline maps for
anything with prose in it. For `sequence`,
`flow`, `erd`, `state`, and pie charts you may write a ```mermaid fence
instead of YAML when you already know that grammar — `reference/mermaid.md`
lists the exact subset.

### 7 · Check — read `reference/check.md` when it fails

Run `avo check`. Fix every diagnostic. A passing check is the definition of
done. Then reread only the headings and block titles: the skim must still
tell the story from step 1.

### Editing an existing doc — keep the story whole

Read the whole doc first and find its story. Edit the specific block
surgically; never regenerate the file. **Trace the change through every block
that shares the fact** — a renamed table moves through the `erd`, the
`sequence` labels, and the prose together. If the change breaks the outline,
say so and propose the outline change instead of bolting it on.

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

Find your reader's question; the row lists the candidate shapes and the
discriminator that picks between them. One-line descriptions of every block
live in `reference/blocks/INDEX.md`.

| Reader question | Candidate shapes → blocks | Choose by |
|---|---|---|
| What calls what? | Exchange: `sequence` · Network: `graph`, `c4` | ordered messages → sequence; topology at rest → graph/c4 |
| What path does a request take through the infrastructure? | Containment: `block`, `c4`, `cluster` · Exchange: `sequence` | tiers and hops (CDN → LB → app → DB) → block, edges as the path; sequence only when the reader needs the order of the replies |
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

### Structure in the source wants a diagram

When you receive prose, a spec, or a generic table, the *structure the source
describes* picks the diagram — not the words it uses. Prose and tables are the
fallback for things that are genuinely paragraphs and genuinely rows of
values — not the default. The close calls:

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
domain. A `quadrant` is any two-axis 2×2 (risk vs reward, urgency vs
importance). A `journey` is any staged progression (sales funnel, maturity
model). An `anatomy` splits any delimited identifier (URL, semver, cron). A
`cvt` is any before → after. A `matrix` is any X × Y grid with one value per
cell (RACI, browser support). When you repurpose, nothing should betray the
original example.

> **Old names keep working.** Twelve former block types are permanent aliases
> (`infra`/`event`/`ddd`/`network` → `block`, `belogic` → `felogic`,
> `dag` → `flow`, `waterfall`/`funnel` → `chart`, `diff`/`terminal` → `code`,
> `mece` → `tree`, `tracker` → `statustable`). Write the canonical spelling in
> new docs; never rewrite an existing fence only to silence the
> `W_ALIAS_TYPE` warning.

## Composing a document

Composition is worked through examples, not filled from forms. Read
`reference/recipes.md`: 8 worked recipes (backend architecture, AI/agent
architecture, frontend architecture, data pipeline, state machine, incident
writeup, ADR, API reference). **They are examples of composition, not forms
to fill in** — two different systems must not produce structurally identical
docs. Pick a recipe per *section* when a large doc mixes concerns.

`avo template <name>` scaffolds a finished example doc (`avo template --list`
for the 18 names). A template is a worked exemplar — still rework it through
steps 1–5.

**"Design an X" asks** (a notification system, a rate limiter) are where
templating shows worst: every real system's document is shaped by *its*
bottleneck. Work the 8-step method in `reference/system-design.md`.

**Decks:** any document renders as a deck with `avo slides`. Read
`reference/decks.md` before any deck ask.

## Prose rules — hard limits

`reference/style-ste.md` is the style authority. Three zones, three contracts:

- **Markdown prose between blocks**: simple and short. Rules 1–5 apply in full.
- **Block text fields** (`description`, `lede`, `body`, `note`, `subtitle`,
  `summary`): complete information, tight form. Short active sentences, no
  filler openers, but **never delete a fact to get shorter**. Split a long
  sentence into two; keep every component, value, and condition.
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
5. **Write for a smart non-specialist**: simple words, precise claims. Use
   the user's nouns verbatim.

## Reference files — read at the step that needs them

| File | Step | Read it when |
|---|---|---|
| `reference/intake.md` | 1 | Every new document — the ask-back protocol and per-document-type checklists. |
| `reference/blocks/INDEX.md` | 2 | To find which family file documents a block — all 90 types, one line each, plus the alias table. |
| `reference/recipes.md` | 3–4 | When composing a document — 8 worked composition recipes. |
| `reference/system-design.md` | 3–4 | Any architecture / design ask — the 8-step design method, which architecture block when. |
| `reference/decks.md` | 3–4 | Any slides / deck ask. |
| `reference/organizing.md` | 4 | Multi-doc work — when to split, file and slug naming, index docs, cross-doc refs. |
| `reference/writing.md` | 6 | Before you write YAML — block anatomy, terse items, YAML traps, `doc#id`, naming. |
| `reference/blocks/<family>.md` | 6 | Before you write any block you have not used this session — examples + field semantics. |
| `reference/blocks/contract.md` | 6–7 | Only when the family file leaves a field question open, or `E_SCHEMA` names a field — the strict contract for all 90 blocks. |
| `reference/mermaid.md` | 6 | When you write a ```mermaid fence — the accepted subset per grammar. |
| `reference/style-ste.md` | 6 | Before you write any prose or instruction text. |
| `reference/check.md` | 7 | When `avo check` reports anything — every code, its cause, its fix. |
