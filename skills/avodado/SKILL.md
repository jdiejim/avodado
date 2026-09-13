---
name: avodado
description: >-
  Write, edit, validate, and review Avodado documentation — Markdown files
  that mix prose with typed, fenced YAML blocks (107 block types: sequence ·
  erd · c4 · flow · state · table · callout · timeline · userstory · chart ·
  endpoint · agentloop · and more). Use when the user asks for a design doc,
  architecture doc, API reference, ADR, runbook, roadmap, diagram, or any doc
  under docs/**/*.md in a repo with avodado.config.* or this skill installed,
  or mentions "avodado" or the `avo` CLI. The CLI is the reference: `npx -y
  avodado block <type>` prints any block's fields and an example. Detailed
  references live beside this file — read them on demand: reference/blocks/
  INDEX.md (every block, one line), reference/writing.md (YAML traps, terse
  forms, doc#id), reference/check.md (diagnostic codes), reference/recipes.md
  (whole-document compositions), reference/style-ste.md (prose rules).
---

# Avodado — docs as Markdown with typed YAML blocks

A doc is plain Markdown. Anything structured — a diagram, a table, a plan — is
a fenced block whose info-string is the block type and whose body is YAML.
The `.md` file is the only source of truth. Never paste HTML or SVG. Never
place pixels: the renderer owns layout, you own content.

````
## Request flow

```sequence
actors:
  - { id: Client, name: Client }
  - { id: API, name: Orders API }
messages:
  - Client -> API: POST /orders
  - API --> Client: 201 Created
```
````

## Fast path

Every command below runs with no install: `npx -y avodado …` (a local `avo`
is used when present).

1. **Pick the blocks from the reader's question**, not from the words in the
   request. Use the table below. Two to five structural blocks per doc, each
   a different lens. Fewer than three rows or nodes is a sentence, not a
   block. Unsure which block exists: `npx -y avodado block` lists all 107.
2. **Look up each block you will write**: `npx -y avodado block <type>`.
   It prints the fields, enums, terse one-line forms, and a validating
   example. That is the whole reference for that block. Read nothing else.
3. **Write the doc.** `meta` first (title, subtitle, tag). A `##` heading
   above a block is its title. Prose carries why and consequence, never a
   description of the block below it. Rules in the two sections after the
   table.
4. **Check**: `npx -y avodado check <file> --json`. Every diagnostic carries
   a stable code and the failing value; `reference/check.md` maps each code
   to its fix. Fix, rerun. Two rounds maximum, then report what remains.
   A non-zero exit is never "done".
5. **Render when asked**: `npx -y avodado html <file> -p` (page) or
   `slides <file> -p` (deck).

Handoff: the file path, the check result (0 errors), and one line per block
naming the rejected alternative ("sequence, not flow — the question is
message order between two services").

Editing an existing doc: read it whole first. Change the one block, and
carry the fact into every block that shares it. Never regenerate the file.

## Pick the block by the reader's question

| Reader question | Blocks | Choose by |
|---|---|---|
| What calls what? | `sequence` · `graph` · `c4` | ordered messages → sequence; topology at rest → graph or c4 |
| What path does a request take through the infrastructure? | `block` · `c4` · `cluster` | tiers and hops → block; system context for a stakeholder → c4; namespaces and replicas → cluster |
| What happens when this fails? | `flow` · `saga` · `state` · `sequence` | branching decisions → flow; multi-service undo → saga; one object's lifecycle → state |
| Where did the time go? | `spans` · `sequence` | measured durations → spans; call order only → sequence |
| What does the event carry, who emits and consumes it? | `eventcontract` · `table` | one event → eventcontract; a catalog → table |
| Who publishes, who subscribes, how does work fan out? | `block` (`preset: event`) · `dfd` · `sequence` | topology of producers, topics, queues, consumers → block; the hop order with the failure branch → sequence; `reference/patterns.md` names the stack per pattern |
| How does this ship, and what stops it? | `rollout` · `steps` · `timeline` | staged traffic with gates → rollout; manual procedure → steps; dated milestones → timeline |
| What lives inside what? | `c4` · `cluster` · `block` · `layers` · `archmap` · `tree` · `composition` · `treemap` | runtime boundaries → c4/cluster/block; conceptual tiers → layers; capability landscape → archmap; part-of → tree/composition; area budget → treemap |
| What changes over time? | `timeline` · `gantt` · `changelog` · `chart` · `slopegraph` · `state` | events → timeline; scheduled work → gantt; released work → changelog; a measured quantity → chart; two snapshots → slopegraph |
| How do these options compare? | `options` · `proscons` · `matrix` · `scorecard` · `benchmark` · `quadrant` · `harvey` | criteria × candidates → options; one option → proscons; numbers → benchmark; two axes → quadrant |
| Where does data go? | `dfd` · `sankey` · `erd` | processes and stores → dfd; volumes → sankey; shape at rest → erd |
| Who does what, when? | `swimlane` · `journey` · `agenda` · `team` · `kanban` | ownership across steps → swimlane; experience over stages → journey; work in flight → kanban |
| What are the exact steps? | `steps` · `flow` | linear → steps; branches or retries → flow |
| What do we build, in what order? | `storymap` · `timeline` · `gantt` | scope per journey step by release → storymap |
| How big, how fast, how much? | `bignumber` · `stats` · `chart` · `envelope` · `benchmark` | one headline → bignumber; a set → stats; napkin math → envelope |
| What is this made of? | `anatomy` · `composition` · `erd` · `layers` | labeled parts of a string → anatomy; proportions → composition |
| What causes this? | `fishbone` · `matrix` | one effect, branching causes → fishbone |
| Why did we decide this? | `options` · `proscons` · `scqa` · `takeaways` · `callout` | the ADR shape → `reference/recipes.md`; the decision alone → callout |
| What does the API accept and return? | `endpoint` · `code` · `packet` · `table` | HTTP surface → endpoint; wire format → packet; error codes → table |
| How does the agent behave? | `agentloop` · `trace` · `prompt` · `context` | the loop → agentloop; one real run → trace; the contract → prompt; window contents → context |
| What did the review find, and are we ready? | `audit` · `checklist` · `risk` | defects found with evidence → audit; a standard applied once → checklist; what might go wrong → risk |
| Are we within budget, and how slow is the tail? | `perfbudget` · `percentiles` · `slo` · `benchmark` | targets with a pass line → perfbudget; p50…p99 per endpoint → percentiles; targets over time → slo |
| Where can this be attacked? | `threatmodel` · `dfd` · `audit` | STRIDE on a data flow with trust boundaries → threatmodel; the flow alone → dfd |
| Who uses the system for what, and which module may depend on which? | `usecase` · `pkg` · `uml` · `timing` | actors and cases → usecase; module dependencies → pkg; classes → uml; states over time with durations → timing; `reference/patterns-design.md` maps the GoF and distributed patterns to blocks |
| What is the model's shape, and what may it be used for? | `neuralnet` · `modelcard` · `chart` | layers → neuralnet; the card → modelcard; loss curves → chart line |
| What ships when, by theme, and where are we in the process? | `roadmap` · `chevrons` · `gantt` · `mindmap` | quarters × themes → roadmap; phases with the current one → chevrons; dated tasks → gantt; unordered ideas around a topic → mindmap |
| What must always hold? | `spec` · `slo` · `glossary` · `callout` | invariants → spec; service targets → slo; terms → glossary |
| What does the user see? | `wireframe` · `frontend` · `felogic` | screens → wireframe; component tree → frontend; module graph with edges → felogic |
| How does the algorithm move through the data? | `array` · `linkedlist` · `bintree` · `hashmap` · `graph` · `code` | pointers, a window, or binary search over cells → array; pointer rewiring → linkedlist; a tree shape → bintree (never `tree`, that is a file hierarchy); hashing → hashmap; visit order → graph with node `state`; the reference implementation → code. A `flow` or `table` is the keyword trap here. |

The type name is a hint, not a cage: a `quadrant` is any two-axis 2×2, a
`journey` any staged progression, a `cvt` any before → after. Relabel every
axis, column, and unit in the user's own nouns.

Twelve old names still work as aliases (`infra` `event` `ddd` `network` →
`block`, `belogic` → `felogic`, `dag` → `flow`, `waterfall` `funnel` →
`chart`, `diff` `terminal` → `code`, `mece` → `tree`, `tracker` →
`statustable`). Write the canonical name in new blocks; never rewrite an
existing fence only to silence the `W_ALIAS_TYPE` warning.

## Writing rules

- Use only the fields `avo block <type>` prints. Schemas are strict: an
  unknown field is an error.
- **Quote any YAML value that contains `,` `:` `#` `{` `}` or starts with a
  special character.** Inside `{ a: b, c: d }` an unquoted comma splits a
  phrase into keys. Numbers that must be strings (`version: "1.0"`, `delta:
  "0"`) get quotes. Prose fields (`desc`, `note`, `summary`, `description`)
  are always quoted. When unsure, write the body as JSON — it is valid YAML.
- Prefer the terse one-line item forms the contract prints (`a -> b: label`,
  `Term — definition`). Switch to the object form only for a field the
  grammar cannot say.
- Give a block an `id:` when another block references it; reference it as
  `doc#id`, or `#id` inside the same doc. A ref to a missing id fails the
  check.
- Use the user's nouns verbatim, and the same name for the same thing in
  every block. Headings say what the reader sees, never the block type.
- **Vary the lens.** One `callout` per doc (the assumptions), never a row of
  them: several points are a `list`, a `spec`, a `faq`, or `takeaways`. A
  third block of the same type is a warning (`W_LENS_REPEAT`). Reach past
  the habitual four (`callout`, `table`, `sequence`, `flow`): ownership
  across steps is a `swimlane`; code the reader will copy or diff is a
  `code` block (`kind: compare` for before / after); terms are a
  `glossary`; questions a reader will ask are a `faq`; a runbook is
  `steps`; side-by-side snippets or nested diagrams are a `gallery`.
- Diagram data (node names, messages, labels, values) is never trimmed to
  fit. Split a dense diagram into two; `avo check` warns at the caps.
- Every arrow says what crosses it, as a verb phrase, never "uses". A `c4`
  edge without a label is a warning; at container level add `tech` too.
  Solid is a call, dashed is async or optional. Flow runs left to right or
  top to bottom, one direction per diagram.
- `sequence`, `flow`, `erd`, `state`, and pie `chart` also accept a
  ```mermaid fence; `erd` accepts ```dbml and ```prisma. Subsets are in
  `reference/mermaid.md`.

## Prose rules

`reference/style-ste.md` is the authority. Between blocks: three sentences
per paragraph by default, five at most. Every sentence carries a fact, a
decision, or a consequence. Banned openers: "In this section", "This diagram
shows", "It's important to note", "At a high level". Block text fields keep
every fact in short active sentences. Diagram data is untouchable.

## Read more only when the task needs it

| File | When |
|---|---|
| `reference/blocks/INDEX.md` | Scanning every block with a one-line description (same as `avo block`). |
| `reference/blocks/<family>.md` | Choosing between neighbours in one family — discriminators and hard rules the schema cannot express. |
| `reference/writing.md` | The full terse-form table, every YAML trap, `doc#id`, naming. |
| `reference/check.md` | A diagnostic code you do not recognise. |
| `reference/recipes.md` | Composing a whole document: architecture, ADR, API reference, incident, pipeline, agent system. |
| `reference/patterns.md` | Anything with events, queues, streams, fan-out, outbox, CQRS, sagas, retries: which blocks draw each pattern and the trap. |
| `reference/patterns-design.md` | A GoF or architectural design pattern (Strategy, Observer, CQRS, Circuit breaker …): the block stack that documents it. |
| `reference/system-design.md` | Any "design an X" ask — the eight-step method. |
| `reference/intake.md` | A new document with an unclear reader or scope — the questions to ask back. |
| `reference/decks.md` | Any slides or deck ask. |
| `reference/organizing.md` | Multi-doc work — file naming, splitting, index docs. |
| `reference/exemplars/*.md` | Ten finished documents to model on. |
