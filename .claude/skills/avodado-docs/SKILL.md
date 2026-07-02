---
name: avodado-docs
version: 0.30.2
description: >-
  Use whenever you author, edit, validate, or review Avodado documentation —
  Markdown files that mix prose with typed YAML blocks, in 12 families:
  narrative & prose · tables & code · API · architecture · flows & state ·
  data model · charts & overviews · planning & backlogs · business & decisions ·
  design system · algorithms · AI & agents. High-signal types: sequence · erd ·
  c4 · table · callout · timeline · userstory · flow · chart · agentloop ·
  archmap · block · endpoint · kanban · stats · divider — and 71 more, mapped in
  reference/blocks/INDEX.md.
  Trigger on any of: docs/**/*.md in an Avodado repo, the `avo` CLI, any block
  type above, `doc#id` cross-references, presence of `avodado.config.*` or
  `.avodado/skill/SKILL.md` in the workspace, or user mentions "avodado". Covers
  block grammar, every block's fields, the reference scheme, YAML pitfalls, and
  the validate workflow.
  Detailed references live beside this file — read them on demand:
  reference/blocks/INDEX.md (block → family file map),
  reference/blocks/contract.md (the exact field contract for all 87 blocks),
  reference/blocks/<family>.md (fields + examples per family),
  reference/system-design.md, reference/decks.md, reference/intake.md,
  reference/organizing.md.
---

# Authoring Avodado documents

> Repo location: commit this folder at `.avodado/skill/` — this file plus its
> `reference/` files. `avo init` copies the whole folder into new projects and
> writes editor adapters (`CLAUDE.md`, `.cursor/rules/avodado.mdc`) that point
> here so Claude Code, Cursor, and other agents pick it up automatically.

Avodado documents are **plain Markdown with typed, fenced YAML blocks**. Prose
is ordinary Markdown; anything structured (a diagram, a table, a user story,
a chart) is a fenced code block whose info-string is the block *type*, with a
YAML body.

**The one rule:** the `.md` file is the source of truth. You edit files
directly. A document must read fine as plain text with no tooling, so never
paste raw HTML or inline SVG — express structure through blocks instead.

## The authoring method — think, then write

An Avodado doc is **designed, not filled in**. The failure mode to avoid: grab a
template, pour the user's nouns into it, ship the same document shape every time.
Work through five moves — the first two happen *before any YAML*.

### 1 · Understand the ask — and ask back

Decide what the document must do for its reader. If you can't answer these four,
the outline will be wrong no matter how good the blocks are:

- **Reader & moment** — who reads this, and when? (new joiner onboarding ·
  reviewer approving a design · on-call at 3am · exec skimming for a decision)
- **Job** — what should the reader *know or decide* after reading?
- **Scope** — one endpoint? one service? the whole platform? current state or
  a proposal?
- **Form** — a document, a deck (`avo slides`), or both?

**When the ask is one line and the answers would change the outline, ask 2-4
pointed questions back before writing.** Batch them once — don't drip. A good
question is one whose answer picks between two *different documents*:

| The ask | Worth asking back |
|---|---|
| "Document our auth" | Reference for integrators, or explainer for new devs? Current behavior or target design? Which flows matter most? |
| "Design a notification system" | Scale (users, notifications/day)? Channels — push, email, in-app? Real-time or digest latency? What exists today? |
| "Write an ADR for the queue choice" | Which options were actually on the table? What constraint decided it? Proposed or already accepted? |
| "Make a deck about the migration" | Audience — engineers or leadership? How long a slot? Seeking a decision, or reporting status? |

**Before asking, open `reference/intake.md`** and pull the checklist for the
document type — it marks what's CRITICAL per document kind. Ask for every
missing critical item in ONE batched message.

If the user isn't available (or the gaps are minor), **proceed on explicit
assumptions**: list them in a `callout` (`tone: note`, title *Assumptions*) near
the top so they're visible and correctable. Never silently guess scale, audience,
or scope.

### 2 · Outline the story before any YAML

Write the `##` headings first, as a narrative — each heading one beat, the whole
list readable as an argument. Most technical stories move *orient → tension →
resolution → proof → plan*, but the beats come from the content:

- A **design doc** argues: the problem → the forces → the options → the choice →
  how it works → what could go wrong → how it rolls out.
- A **runbook** triages: how you know you're in this incident → decide which case
  → act → verify → escalate.
- An **onboarding overview** zooms: the system in one picture → the request path
  you'll touch most → where the data lives → who owns what.

The test: someone reading **only the headings** should follow the story. If your
headings could be pasted onto a different subject unchanged, you templated —
rewrite them in this document's terms.

### 3 · Cast blocks from the catalog

Now, per heading, pick the **one block that carries that beat best** — shop the
*Block glossary* below (`avo catalog` prints all 87 with descriptions). Casting
rules:

- **One lens per beat.** Structure (`c4`/`block`/`infra`), behavior
  (`sequence`/`flow`/`state`), data (`erd`), trade-offs (`options`/`proscons`),
  plan (`timeline`/`tracker`). A beat needs one of these — not two blocks drawing
  the same boxes.
- **Vary the lenses across the doc.** Three tables in a row means two of them
  want to be something else (a `matrix`? a `list`? a diagram?). All diagrams and
  the doc has no argument; all prose and it has no anatomy. 2-5 structural blocks
  is the sweet spot.
- **Let the content pick the diagram** — see *Adapt the content* below. Never
  default to `table` for anything that has boxes-and-arrows in it.
- **Thin data folds into prose.** Fewer than ~3 rows/nodes → a sentence or a
  `callout`, not an almost-empty block.

### 4 · Write with one consistent cast

The blocks of a doc describe **one world** — keep the world consistent:

- **`meta` first, always** — title + subtitle + tag — then a 2-4 sentence prose
  intro.
- **Same names everywhere.** The service called `orders-api` in the `c4` is
  `orders-api` in the `sequence`, the `erd` notes, and the prose — not "Orders
  service" in one and "OrderSvc" in another.
- **Ids + refs instead of repetition.** Give the canonical block an `id:` and
  point at it (`userstory.links[].ref: "#id"`) rather than redrawing it.
- **Titles agree.** The `##` heading, the block's `title`/`lede`, and the `meta`
  cover should sound like one author (see *Titles, headings & voice*).
- **Quote YAML strings containing `,` `:` `#` etc.** — see *YAML pitfalls*.

### 5 · Validate, then skim

Run `avo check` and fix every diagnostic — **a passing check is the definition of
done**. Then reread only the headings + block titles top-to-bottom: does the skim
still tell the story you outlined in move 2? If a section reads as filler, cut it.

### Editing an existing doc — keep the story whole

When asked to change a doc, **read the whole doc first** and find its story. Then:

- Edit the specific block surgically — never regenerate the file.
- **Trace the change through every block that shares the fact.** Adding a service?
  It may belong in the `c4`, the key `sequence`, and the `tracker`. Renaming a
  table? The `erd`, the `sequence` labels, and the prose mentions move together.
  A doc where one block knows about the change and its neighbors don't is worse
  than no edit.
- If the change breaks the outline (the new content's beat doesn't fit the arc),
  say so and propose the outline change instead of bolting it on.

## Reference files — read on demand

Detailed references live beside this file — read them on demand; they hold the
full contracts this hub only summarises:

| File | Read it when |
|---|---|
| `reference/blocks/INDEX.md` | To find which family file documents a block — the map of all 87 types → family file, one line each. |
| `reference/blocks/<family>.md` | Before writing any block you haven't used in this session — read the family file you need (examples + field semantics), or `contract.md` for exact fields. |
| `reference/blocks/contract.md` | The strict at-a-glance field contract for all 87 blocks — required vs optional fields, enums, number rules. |
| `reference/system-design.md` | Any architecture / design ask — the 8-step design method, which architecture block when, node kinds & shapes, C4 extras, the 106 `avo design` slugs. |
| `reference/decks.md` | Any slides / deck ask — slide markers, alignment, pagination, consulting-style decks. |
| `reference/intake.md` | Move 1 of every new document — the ask-back protocol, per-document-type checklists, and the review checklist for existing docs. |
| `reference/organizing.md` | Multi-doc work — when to split docs, slug naming, the index/overview doc pattern, cross-doc refs, and how `avo build`/`avo serve` consume the set. |

## Choose your block — decision tables

Most authoring failures come from picking the wrong block. Use these tables.

### Block glossary — one line on what each is *for*

The whole vocabulary at a glance. Read this first; it's the map from *a concept in
your head* to *a block*. Then *Adapt the content* maps source-material cues to
diagrams, and *Architecture and topology* in `reference/system-design.md`
disambiguates the seven architecture blocks — the closest calls.

| Block | What it represents |
|---|---|
| `meta` | Document header — title, subtitle, tag pill. Always the first block. |
| `callout` | A single aside: note / tip / warn / danger. |
| `prose` | Structured prose (headings, paragraphs, lists, quotes) carried as data. |
| `glossary` | Term → definition rows. |
| `proscons` | Two columns weighed against each other: pros vs cons. |
| `cvt` | Current → target (before / after) as two side-by-side panels. |
| `agenda` | Meeting agenda — time, duration, owner, topic per row. |
| `table` | Genuinely tabular data (rows × columns of values); cells can carry tone. |
| `stats` | KPI cards — a value with a delta and an up/down/flat trend. |
| `slo` | Service-level objectives — SLI, target vs current, and an error-budget burn bar. |
| `code` | One or more syntax-highlighted snippets under a titled header bar. |
| `terminal` | A shell session on the dark surface — `$ ` commands, `# ` comments, output lines. |
| `tracker` | A task list with status / priority / owner / due. |
| `risk` | A risk register — severity derived from likelihood × impact, with mitigation, owner, status. |
| `kanban` | Flexible named columns (e.g. Now / Next / Later) of cards. |
| `timeline` | Phases in order with status dots (done / current / next / future). |
| `changelog` | Release history on a vertical rail — version pills, dates, and typed change chips. |
| `gantt` | A schedule — tasks as bars across date columns. |
| `okr` | Objectives + key results — one card per objective, a status-coloured progress bar per KR. |
| `userstory` | An agile story: role / want / soThat + acceptance criteria + links. |
| `sequence` | Messages between actors **over time** (lifelines, returns); optional step list + endpoint pill. |
| `state` | A state machine — states + event transitions (+ a transition table). |
| `flow` | A decision flowchart — start / process / decision / end nodes, with `error` exits. |
| `dag` | A pipeline / DAG — same shapes as `flow`, framed for CI/CD. |
| `dfd` | Data-flow — processes, external entities, and datastores. |
| `swimlane` | A cross-functional process with one horizontal lane per role. |
| `journey` | A user journey across stages, with an optional emotion curve. |
| `funnel` | A conversion funnel — stacked bands proportional to value, with stage-to-stage conversion chips. |
| `persona` | User persona cards — avatar, role, quote, goals, frustrations, tools. |
| `erd` | Entity-relationship diagram — tables, columns, PK/FK, crow's-foot cardinality. |
| `uml` | A class diagram — attributes, methods, UML relationships. |
| `c4` | C4 model (context / container / component) — people, systems, containers, stores. |
| `block` | Generic boxes-and-arrows architecture — grid **or** horizontal `layers`, dashed `groups` zones. |
| `infra` | Cloud topology (same engine as `block`) — CDN / gateway / compute / DB, nested account & network zones. |
| `event` | Pub/sub topology (same engine) — producers → topics → consumers. |
| `ddd` | DDD bounded-context map (same engine). |
| `network` | Security zones with trust boundaries (same engine); supports `forbidden` (red) edges. |
| `cluster` | Kubernetes-style namespaces holding services, with replica counts. |
| `archmap` | A target-architecture capability map — a mosaic of tinted domain areas packed with small status-coded capability tiles (current · target · new · gap · deprecated). |
| `frontend` | A top-down component tree — root / layout / page / component / provider / hook / store. |
| `felogic` | Frontend module/logic graph — components, hooks, interfaces, strategies; group zones + egress edges. |
| `belogic` | Backend module/logic graph (same engine) — controller / service / repository / adapter / gateway + egress. |
| `graph` | A generic node-link graph with colour-cycled groups. |
| `mece` | A MECE issue tree — one problem broken into mutually-exclusive branches. |
| `tree` | An indented file/folder hierarchy (HTML, not SVG). |
| `pyramid` | A layered pyramid (strategy / hierarchy), widening top → bottom. |
| `quadrant` | A 2×2 matrix (e.g. effort vs impact) with plotted items. |
| `swot` | A classic SWOT 2×2 — strengths / weaknesses / opportunities / threats as tinted quadrant cards. |
| `wireframe` | Low-fi UI mockups inside device frames — desktop / browser / phone screens. |
| `endpoint` | A Swagger-style API endpoint card — method, path, params, request body, responses, examples. |
| `pullquote` | A standout pull-quote with optional attribution. |
| `layers` | A layered explanation — N numbered layers, each a kicker / title / source / question + body. |
| `matrix` | A role × resource capability grid; cells tint by permission level. |
| `anatomy` | The labelled parts of a structured string (e.g. `app:feature:action`). |
| `composition` | Effective access as intersected gates — `gate₁ ∩ gate₂ ∩ … = result`. |
| `drivers` | A grid of factor/driver cards — icon + title + body + tag, the forces that shaped a design. |
| `team` | Compact people cards — initials avatar, name, role, focus area. |
| `options` | Approaches explored — cards with pros / cons / verdict; the chosen one is highlighted. |
| `scorecard` | A weighted decision matrix — criteria rows × option columns, weighted totals, winner highlighted. |
| `spec` | A labelled spec sheet — `label → value` rows (a value can be an inline step-flow). |
| `envelope` | Back-of-envelope capacity math — assumptions, derivation rows, a highlighted bottom line. |
| `list` | A fancy bullet list — bold lead + supporting line per row, in one of four marker styles (accent bar / check / icon / number). |
| `stories` | A collapsible backlog of user stories — many stories as `<details>` accordions in one section. |
| `pattern` | A design-pattern reference card — intent · forces · participants · consequences. |
| `gallery` | A responsive grid of cards — code snippets or notes (a bug gallery, a comparison grid). |
| `chart` | A data chart — bar / line / area / donut / radar in pure SVG, series coloured by accent. |
| `waterfall` | A budget cascade — bars start where the previous total ended; optional dashed budget cap. |
| `heatmap` | A numeric grid with an intensity ramp — rows × columns of tiles tinted by value. |
| `array` | Array cells for algorithm walkthroughs — tones, pointer labels below cells, a dashed index-window highlight. |
| `linkedlist` | A pointer-chain diagram (singly or doubly) — boxed nodes with next/prev arrows, markers like `head`/`curr`, a ∅ terminator. |
| `bintree` | A binary tree — nodes placed by `parent` + `side`, tinted to show search paths, traversals, heap shapes. |
| `hashmap` | Hash buckets with chained entries — collision chains read left → right as key/value pills. |
| `figure` | An image with a caption in a bordered card (optional pixel width cap). |
| `diff` | A unified diff on the dark editor surface — `+` added, `-` removed, `@@` hunks. |
| `steps` | A numbered how-to / runbook stepper — title + body + optional command + note per step. |
| `faq` | Q&A accordions — native `<details>`, question in the summary, answer expands. |
| `palette` | Color-token swatches — name, hex value, and usage per color, on a card grid. |
| `typescale` | A live type specimen — each row renders the sample text at its real size / weight / font. |
| `dodont` | Do / don't guideline cards — what to do (green ✓) vs what to avoid (red ✕), with optional mono examples. |
| `inventory` | A component / feature status board — name + color-coded status chip (stable · beta · experimental · deprecated · planned) per row. |
| `agentloop` | The canonical LLM agent loop — environment → agent (model chip) → tools column, memory cylinder, numbered loop arrows, stop condition. |
| `trace` | An agent / session execution transcript — user / assistant / tool / system turns, with `thinking` and tool `args` → `result`. |
| `prompt` | Prompt anatomy — stacked role segments (system / user / assistant / tool) with `{{variable}}` chips and a variable legend. |
| `context` | A context-window token budget — one stacked bar sized against the window, with free space and over-budget overflow. |
| `divider` | A full-width section break — kicker ("PART 2"), display title, optional subtitle on an accent-washed band; a clean interstitial slide in decks. |
| `bignumber` | One hero metric at presentation scale — a display-size value with an optional delta + trend arrow (the arrow stays neutral gray — "down" is often good), a one-line claim, and a context line. |
| `takeaways` | The 2-6 things to remember — numbered rows at presentation scale, each a bold one-liner with an optional detail; a deck's closing slide. |

### Adapt the content — signals that should trigger a diagram

When you're handed prose, a spec, or a generic table, these cues in the *source*
tell you which diagram it really wants. This is the step people skip — and then
everything degrades into tables and sequences.

| If the source describes… | Adapt it to | Not |
|---|---|---|
| "layers / tiers / sits on top of / front-to-back / N-tier" | `block` (with `layers`) or `infra` | a table |
| "the platform: these services + a shared backbone, who calls what" | `block` / `infra` / `cluster` | a table |
| "a person uses the system, which depends on external systems" | `c4` (level: context) | prose |
| "N checks/gates **in order**, any one can reject the request" | `flow` (decision nodes + `kind: error` exits) | a `sequence` — gates aren't temporal |
| "A happens, then B, then C, then a reply comes back" (over time) | `sequence` | a `flow` |
| "who does what across teams, step by step" | `swimlane` | a `flow` |
| "components / providers / hooks / context / store" | `frontend` (tree) or `felogic` (with patterns + egress) | a table |
| "controller / service / repository / adapter / gateway / middleware / Depends()" | `belogic` | a `sequence` |
| "producers emit events → topics → consumers" | `event` | a `flow` |
| "namespaces / pods / replicas / deployments" | `cluster` | a `block` |
| "target architecture / capability map / platform landscape as a tile mosaic" | `archmap` | a `block` — no arrows here, it's a landscape |
| "trust boundary / DMZ / zones / must-not-call" | `network` (with `forbidden` edges) | a `block` |
| "tables, schema, primary/foreign keys, relationships" | `erd` | a `table` |
| "several approaches/options weighed, each with a verdict" | `options` (chosen one highlighted) | a `table` |
| "**compare** 2-4 named things **side by side** (patterns, architectures, services) — e.g. 'adapter vs command'" | `gallery` (`cols: N`, each cell a nested `pattern`/diagram block) | stacking them or a `table` |
| "pros vs cons / trade-offs for **one** option" | `proscons` | a `table` |
| "current state vs target state" / "before vs after" | `cvt` | a 2-column `table` |
| "the N forces / requirements / drivers behind a design" | `drivers` (icon cards) | prose bullets |
| "who can do what — roles × apps/resources, a value per cell" | `matrix` | a plain `table` |
| "a delimited identifier with named parts (`app:feature:action`, a URN)" | `anatomy` | `code` |
| "access = check ∩ check ∩ check, all must hold (not ordered)" | `composition` | a `flow` |
| "explain it in N numbered tiers, each answering one question" | `layers` | a `table` |
| "a compact fact sheet for one approach (label → value rows)" | `spec` | prose |
| "a Swagger-style HTTP endpoint (method, path, params, responses)" | `endpoint` | a `table` |
| "why is X happening — break the causes down" | `mece` | a bulleted list |
| "walk through binary search / two pointers / a sliding window" | `array` (tones + pointer labels + `window`) | a `table` |
| "show a traversal / BST insert / heap shape" | `bintree` | a `tree` — that's a file hierarchy |
| "pointer manipulation, reversing a list" | `linkedlist` | a `flow` |
| "hashing, collisions, buckets" | `hashmap` | a `table` |
| "BFS/DFS/Dijkstra visit order" | `graph` with node `state` (+ edge `weight`) | a `flow` |
| "an LLM agent with tools / the agent loop" | `agentloop` | a `block` or a `flow` |
| "what happened turn by turn / a session transcript / tool calls" | `trace` | a `sequence` — a trace carries content, not just arrows |
| "the system prompt / prompt template / variables" | `prompt` | a `code` block |
| "what's in the context window / token budget" | `context` | a `table` or a `funnel` |
| "phases / rollout in order" | `timeline` (status) or `gantt` (real dates) | a `table` |
| "what the user sees / the screen / the app / the bell + feed" | `wireframe` (desktop / browser / phone) | prose |
| "a section break in a deck / part N of the story" | `divider` | a bare heading slide |
| "one hero metric that carries the slide" | `bignumber` | a one-item `stats` row |
| "the 2-4 things to remember / closing summary" | `takeaways` | a bulleted list or `callout` |

> **The rule:** if the source *describes* a structure — an architecture, a layering,
> a pipeline, a component tree, a set of gates — render it as the matching **diagram**.
> Prose and tables are the fallback for things that are genuinely paragraphs and
> genuinely rows-of-values, not the default for everything.

### Repurpose a block — the type name is a hint, not a cage

Each block has a **shape** (the visual structure it draws) and a **conventional
example** (the label it ships with — "effort vs impact", "app:feature:action",
RBAC roles). **Pick by the shape of the idea, not by the example.** If the user's
content matches a block's shape, use that block and **relabel everything** so it
reads in their domain — titles, axis labels, column headers, separators, units.
A `quadrant` is not "only for effort/impact"; it's *any* two-axis 2×2.

| The shape of the idea | Block | Examples beyond the default |
|---|---|---|
| Two independent axes, items plotted in 4 zones | `quadrant` | risk vs reward · urgency vs importance · cost vs value · reach vs effort |
| Few-at-top tiers / ranked hierarchy | `pyramid` | Maslow · test pyramid · org levels · strategy→tactics · data hierarchy |
| Ordered stages, optional sentiment per stage | `journey` | sales funnel · onboarding · maturity model · hiring pipeline |
| Labelled milestones along a line | `timeline` | company history · release cadence · curriculum · incident timeline |
| Grid of X across Y, one value per cell | `matrix` | feature comparison · RACI · browser support · compatibility · plan tiers |
| One delimited identifier split into named parts | `anatomy` | URL · file path · semver · SKU · ARN · cron expression · git ref |
| `result = A ∩ B ∩ C` — several conditions combined | `composition` | eligibility rules · feature-flag gating · discount qualification |
| Numbered conceptual layers, each answering one question | `layers` | OSI model · abstraction levels · request lifecycle · L1/L2/L3 |
| Break one thing into exhaustive, non-overlapping parts | `mece` | cost breakdown · taxonomy · root-cause · scope decomposition |
| Boxes and arrows between abstract concepts | `block` / `graph` | mind map · dependency graph · concept map · state of a system |
| Before → after of anything | `cvt` | migration · redesign · process change · mindset shift |
| Two sides weighed against each other | `proscons` | build vs buy · any debate or trade-off |
| Big numbers that summarise something | `stats` | survey results · benchmarks · adoption · SLOs |

> When you repurpose, **nothing should betray the original example.** Override the
> `title`, every axis/column/corner label, and any default unit so the block speaks
> the user's domain. A reader should never be able to tell the block "was meant for"
> something else.

## Mixing blocks — document recipes

A good Avodado doc is **2-5 blocks, each a different lens** on the subject —
*orient → big picture → detail → plan*. Don't show the same thing in two block
types, and don't reach for all 87. Start from the doc's job and pick a stack:

| Doc job | Core blocks (always) | Add when relevant | Skip / fold into prose when… |
|---|---|---|---|
| **API / endpoint spec** | `meta` + `sequence` (request flow) | `erd` (data touched) · `table` (status codes) · `code` (payloads) · `userstory` (the story it serves) | the call is a single hop — describe it in prose |
| **Architecture overview** | `meta` + `c4` (context) **or** `block`/`infra` (the landscape) | `belogic`/`felogic` (one module's internals) · `flow` (a key decision path) · `tracker` (open decisions) | there are <3 components — a `callout` is enough |
| **Design doc / RFC** | `meta` + `proscons` **or** `cvt` (the choice) | `mece` (problem breakdown) · `c4`/`block` (proposed arch) · `sequence`/`flow` (behavior) · `tracker` | only one option exists — just prose |
| **Roadmap / plan** | `meta` + `timeline` (phases) **or** `gantt` (real dates) | `kanban` (now/next/later) · `tracker` (tasks) · `stats` (targets) | — |
| **Runbook / procedure** | `meta` + `flow` **or** `swimlane` | `sequence` (one interaction) · `code` (commands) · `table` (symptom → action) · `callout: warn` | the steps are linear with no branches — an `ol` in `prose` |
| **Data model** | `meta` + `erd` | `table` (field semantics) · `state` (record lifecycle) | it's a single table — use `table` alone |
| **Frontend feature** | `meta` + `frontend` (tree) | `felogic` (logic + patterns) · `wireframe` (what the user sees) · `sequence` (data fetch) · `userstory` | — |
| **Status / metrics** | `meta` + `stats` | `quadrant` · `timeline` | — |
| **Meeting** | `meta` + `agenda` | `tracker` · `kanban` · `callout` | — |

The combining rules are moves 3-4 of the method above: one lens per beat, connect
with refs instead of redrawing, fold thin data into prose, and order the doc as
the reader needs it — orient → big picture → detail → plan.

## Document playbooks — from a one-line ask to a block stack

When the user names a *kind* of document ("write an ADR", "a situation/resolution
write-up", "a roadmap", "a cloud architecture"), the matching playbook below is a
**first draft of move 2's outline — not a cage**. Keep the blocks that carry real
content, drop the ones you have nothing for, add lenses the playbook never
mentions when the content demands them, and always open with `meta` + a short
prose intro. If two documents you produce for different subjects come out with
the same section list, you skipped moves 1-2 and templated.

| The user asks for… | Trigger words | Block stack (in order) |
|---|---|---|
| **ADR** (decision record) | "ADR", "decision record", "why did we choose" | `meta` (tag `ADR-NNN`) → prose *Context* → `options` (or `proscons` if one option) → `callout` *Decision* → `proscons`/`table` *Consequences* → `tracker` *Follow-ups* |
| **Situation → Resolution** | "situation/complication/resolution", "problem → approach → answer", "write-up of how we solved" | `meta` → prose *Situation* → `drivers` *Forces* → `callout: warn` *Complication* → `options` *Approaches* → `spec` *Chosen approach* → `composition`/`sequence` *How it works* |
| **Roadmap / plan** | "roadmap", "delivery plan", "timeline", "what ships when" | `meta` → `stats` *Targets* → `timeline` (phases) **or** `gantt` (real dates) → `kanban` *Now/Next/Later* → `tracker` *Workstreams* |
| **Cloud architecture** | "cloud arch", "AWS/GCP/Azure design", "infra", "deployment topology" | `meta` → `drivers` *Requirements/NFRs* → `c4` (context) → `infra` *Topology* → `sequence` *Key request* → `table` *Stack choices* → `callout` *Trade-offs* |
| **Access model / RBAC** | "RBAC", "permissions", "access model", "roles & scopes" | `meta` → `drivers` *Requirements* → `layers` **or** `composition` *The model* → `options` *Approaches* → `spec` *Chosen* → `anatomy` *Permission string* → `matrix` *Role × capability* → `sequence` *Authz flow* → `userstory` *Backlog* |
| **API / endpoint spec** | "API spec", "endpoint docs", "REST/HTTP reference" | `meta` → `endpoint` (one per route) → `sequence` *Request flow* → `erd` *Data touched* → `table` *Status codes* |
| **Design-system doc** | "design system", "UI guidelines", "component library docs", "design tokens" | `meta` → `palette` *Tokens/colors* → `typescale` *Type* → `dodont` *Usage guidelines* → `inventory` *Component status* → `wireframe` *Key screens* |
| **Agent system doc** | "document our agent", "agent architecture", "LLM pipeline", "agentic system" | `meta` → `drivers` *Requirements* → `agentloop` *The loop* → `prompt` *Prompt anatomy* → `context` *Context budget* → `sequence` *One turn end-to-end* → `trace` *A real episode* → `table` *Eval results* |
| **Design doc / RFC** | "design doc", "RFC", "technical proposal" | `meta` → prose *Problem* → `mece` *Problem breakdown* → `options` *Alternatives* → `c4`/`block` *Proposed design* → `sequence`/`flow` *Behavior* → `tracker` *Open questions* |
| **Runbook / procedure** | "runbook", "on-call", "incident procedure", "how to operate" | `meta` → `callout` *When to use* → `flow` **or** `swimlane` *Procedure* → `code` *Commands* → `table` *Symptom → action* |
| **System overview** | "architecture overview", "how the system works", "onboarding doc" | `meta` → `c4` (context) → `block`/`infra` *Landscape* → `felogic`/`belogic` *One module* → `sequence` *A key flow* |
| **System design** | "design a notification system", "event-driven architecture", "how would you build X at scale", "high-level design" | **No fixed stack — derive it.** See *Designing a system* below: the outline falls out of the requirements, the envelope math, and the bottleneck. |
| **Presentation / deck** | "slides", "deck", "present this", "pitch" | `meta` (cover) → **one slide per `#`/`##` heading**, each heading + one strong block (`drivers`/`stats`/`pyramid`/`quadrant`/`timeline`/a diagram). See *Slide decks* below. |

> These compose: a big design doc might embed the **cloud architecture** stack in
> one section and the **access model** stack in another. Pick the playbook per
> *section*, not just per document. If the ask doesn't match any playbook, fall
> back to *Mixing blocks* above — job → core blocks.

> Most playbooks ship as a ready skeleton: `avo template <name>` scaffolds a
> valid starting doc — `adr`, `design-doc` (design doc / RFC), `runbook`,
> `roadmap`, `api-spec`, `system-design`, `agent-system`, `design-system`,
> `postmortem`, `data-model`, `deck` (the consulting formula). It's a first
> draft of move 2's outline — still rework it through moves 1-2.

## Designing a system — reason it, don't template it

"Design an X" asks (a notification system, a rate limiter, "how would you build
Y at scale") are where templating shows worst — every real system's document is
shaped by *its* bottleneck. Work the 8-step method in
`reference/system-design.md`: requirements → envelope math → contract → high
level → bottleneck deep-dive → trade-offs → failure & operations → plan. Read
that file for any architecture or design ask — it also disambiguates the seven
architecture blocks and lists the 106 `avo design` pattern slugs.

## Slide decks (`avo slides`) — the short version

Any document renders as a deck with `avo slides`. **Each top-level `#`/`##`
heading starts a new slide and is its title** — everything until the next
heading (prose *and* blocks) stays on that slide, so a normal Avodado doc
already presents cleanly. Four heading markers control layout: `## Title {top}`,
`{center}`, `{bottom}`, and `{split}` (consulting layout — prose left, exhibit
right); the marker is stripped from the displayed title. Every non-cover slide
gets a footer (deck title · page number); the `meta` block is the cover slide.
Before any slides / deck ask, read `reference/decks.md` — alignment rules,
pagination behavior, and consulting-style (assertion → exhibit → takeaway)
decks.

## Titles, headings & voice — phrase it the way the user did

Titles are not decoration — they're how a reader navigates. Every document and
nearly every block carries editorial text; **derive it from what the user asked
for**, in their words, never from a scaffold placeholder.

- **`meta` (cover).** `title` = what this document *is*, specific and in the
  user's domain language (not "New document"). `subtitle` = one line on what it
  covers or the question it answers. `tag` = a short category pill (`API · v2`,
  `RFC`, `Runbook`, `INTERNAL`). If the user named the doc, use that name verbatim.
- **Section headings (`##`).** One per block, stating what the reader will see
  ("Request flow", "Data model", "Rollout plan") — not the block type ("Sequence").
- **Every diagram/structured block.** Set `title` (what *this* figure shows) and,
  when a sentence of context helps, `lede`/`description`. The `title` and its `##`
  heading should agree.
- **Use the user's nouns, verbatim.** If they say "tenants", don't write
  "customers"; if they say "shifts", don't write "schedules". Carry their exact
  domain terms into labels, headings, and node names.
- **Match their register.** A formal spec gets precise, neutral titles; rough
  notes get plain, direct ones. Don't inflate "quick notes on auth" into "Authn &
  Authz Architecture Specification".
- **When they give a title or heading, use it as-is.** When they don't, synthesise
  a short, specific one — never a generic stand-in. "DRAFT"/"New document" left in
  a finished doc is a bug.
- **Repurposed blocks must be fully relabelled** (see *Repurpose a block*): the
  `title`, axis/column/corner labels, and units all speak the user's domain.

> Rule of thumb: a reader skimming only the `meta` title and the `##` headings
> should understand the document's shape. If the headings could belong to any
> document, they're too generic — rewrite them in the user's terms.

## YAML pitfalls — quote when in doubt

The YAML parser is doing exactly what you asked. Most "schema errors" are
actually YAML mis-parses. **Quote the value** whenever it contains:

| Character | What goes wrong unquoted | Fix |
|---|---|---|
| `,` (comma) | Inside `{ a, b }` flow style, treated as a separator. Your sentence becomes 3 keys. | `desc: "40 blocks, themes, agent skill"` |
| `:` (colon) | Treated as `key: value`. `1:N` becomes a number sequence. | `card: "1:N"` |
| `#` (hash) | Treated as a comment from there on. | `label: "POST /orders #idempotent"` |
| Leading `*` `&` `!` `|` `>` `%` `@` `\`` | YAML anchor / tag / literal / fold / reserved characters. | Quote the whole value. |
| Leading `-` followed by space | Looks like a list item. | Quote. |
| Numeric-looking (`0`, `02`, `1e3`) | Parsed as a number, fails `string` schemas. | Quote: `delta: "0"`, `version: "1.0"` |
| `yes` / `no` / `true` / `false` / `null` | YAML 1.1 booleans (still around in some parsers). | Quote. |
| Empty | Parsed as null. | Quote: `name: ""` |

Inline-mapping `{ k: v }` is fine for short records (under ~5 fields). For
anything longer, use block-style — easier diffs, fewer comma traps:

```yaml
# ✓ Good — block style for longer records
items:
  - title: Phase 1
    when: now
    status: active
    detail: A longer description with, commas, in, it.
# ✗ Bad — flow-style with unquoted commas
items:
  - { title: Phase 1, when: now, status: active, detail: A longer description with, commas }
```

When you write a `desc` / `note` / `summary` / `description` that contains
prose, **always quote it** — those fields are the #1 source of validation
errors.

## How a block looks

````
## Request flow

```sequence
id: seq-place-order
title: Place order
endpoint: { method: POST, path: /orders }
actors:
  - { id: Client, name: Client }
  - { id: API, name: Orders API }
messages:
  - { from: Client, to: API, label: POST /orders, kind: sync }
  - { from: API, to: Client, label: 201 Created, kind: response }
```
````

Rules:

- The info-string is exactly one of the **87 block types** catalogued in the
  glossary above and specified field-by-field in `reference/blocks/` (the
  `contract.md` table + one family file per block, mapped in `INDEX.md`) —
  never invent new ones.
- The body is **YAML** (JSON is also accepted; YAML is preferred — prefer
  block-style over deep inline maps for readability and clean diffs).
- Use only the fields documented for that block. Keep prose outside blocks.
- A block MAY carry a top-level `id:` (a slug) so other blocks can reference it.
- Most diagram blocks accept optional `title`, `description`, and `lede` —
  these surface in the section header + diagram frame around the SVG.

## Cross-references (`doc#id`)

Blocks become a connected model through references:

- Give a block a unique `id:` (unique across the **whole repo**).
- Reference it as `doc#id`, where `doc` is the target file's path **under the
  docs root** without `.md` (e.g. `orders-api`, or `architecture/overview`).
  A bare `#id` means the current document — **always prefer `#id` when
  referencing inside the same doc**, since it survives renames.
- A reference whose target id does not exist is a **dangling reference** and
  fails validation. Only add a `ref` to an id you know exists (or are creating
  in the same change).
- **Don't repeat the current document's slug in a ref.** If you're editing
  `docs/orders.md` and want to point at `id: seq-place-order` in the same file,
  write `ref: "#seq-place-order"`, NOT `ref: "orders#seq-place-order"`.

The only reference-bearing field in v1 is `userstory.links[].ref`.

## Workflow — always validate

After creating or editing any doc, run the CLI and fix everything it reports:

```
avo check                       # validate all docs: schema + dangling refs + dup ids
avo check docs/orders-api.md    # validate one file
avo check --json                # machine-readable, useful in CI
avo html docs/orders-api.md -o out.html
avo preview docs/orders-api.md  # render and open it
avo serve                       # live-preview the docs site — rebuilds + reloads on save
avo build                       # build the static site (index + nav + cross-doc links) → dist/
avo pdf docs/x.md                # one doc → PDF
avo block <type>                # scaffold a single block (avo template <name> for a doc)
avo demo [family]               # render the built-in block showcase (or one family) and open it
avo sync openapi spec.yaml --out docs/api.md   # generate a doc from an OpenAPI spec
```

`avo check` exits non-zero on any error and names the file, line, and
offending value. **A change is not done until `avo check` passes.**

## When `avo check` fails — error code recipes

Every diagnostic carries a stable code so you can mechanically apply a fix.

| Code | What it means | First thing to check |
|---|---|---|
| `E_PARSE_YAML` | YAML body failed to parse. Almost always a quoting issue. | Re-read *YAML pitfalls* above. Unquoted `,`/`:`/`#` in a `desc` is the usual culprit. |
| `E_SCHEMA` | A field is missing, the wrong type, or an unknown name. Message contains the path (e.g. `sequence: messages.2.kind: ...`). | Compare your YAML against `reference/blocks/contract.md` (and the block's family file). Reject the urge to add fields not listed in this skill — the schema is strict. |
| `E_DANGLING_REF` | A `userstory.links[].ref` points at an id that doesn't exist anywhere in the repo. `value` is the bad ref. | Either fix the ref string, or add the missing `id:` to the target block. Bare `#id` is current-doc; `doc#id` is path-under-docs-root + `#id`. |
| `E_DUP_ID` | The same `id:` was used in two blocks. Message names both files + lines. | Ids are repo-global. Rename one. |
| `E_BAD_REF_FORMAT` | A `ref:` string isn't `doc#id` or `#id` shape. | Match the format exactly. The id slug is `[\w-]+`. |
| `W_EMPTY_BLOCK` | A typed block had an empty body. | Add fields or remove the block. |

### Common schema errors I see often

| Symptom | Cause | Fix |
|---|---|---|
| `Expected string, received number` on `tech: 16` | YAML parsed `16` as a number. | Quote: `tech: "16"`. |
| `Invalid enum value` on `tone: xyz` / `kind: xyz` / `status: xyz` | Used a value not in the enum. | Stick to the documented enum (`tone: note\|tip\|warn\|danger`, etc.). |
| `Unrecognized key(s) in object: 'foo'` | You added a field that isn't in the schema. | Schemas are strict. Either remove the field, or use a documented one. |
| Schemas on the `meta` block fail | You put a `meta` block somewhere other than first. | Move it to the top of the file. |
| `Unrecognized key(s) in object: 'persists'` and similar | Unquoted comma in a flow-style mapping turned a phrase into multiple keys. | Quote the value containing the comma. |

## Do / Don't

**Do**

- Edit the specific block you need to change — surgically, a few lines — rather
  than regenerating a whole document.
- Keep narrative in Markdown prose and structure in blocks.
- Use `title` + `lede` on diagram blocks so the section header reads well.
- Quote YAML values that contain commas, colons, or `1:N` cardinality strings
  (`desc: "40 blocks, themes, agent skill"`, `card: "1:N"`).
- Give a block an `id:` whenever something else might reference it.
- Run `avo check` and resolve all diagnostics before finishing.
- When unsure which architecture block to use, pick `block` for boxes-and-arrows
  or `c4` for actor / system context — both are safe defaults.

**Don't**

- Paste raw HTML, `<svg>`, or `<style>` into a doc. Use blocks.
- Invent block types or fields. The schemas are strict; unknown fields error.
- Reference a `doc#id` that doesn't exist. Either fix the ref or add the id.
- Stuff a whole spec into one giant block. Decompose into 3-5 focused blocks.
- Write a `description` longer than 2 sentences. Use prose instead for long
  narrative.
- Put commas inside flow-style mappings without quoting (see *YAML pitfalls*).
- Reuse the same `id:` in two blocks. Ids are repo-global unique.
- Add a `prose` block AND raw `##` headings for the same idea. Pick one.
- Use `frontend` for backend modules, or `felogic` when you mean `frontend`.
  `frontend` is a top-down hierarchical tree; `felogic` / `belogic` are
  free-positioned module graphs with edges.
- Ship the same document shape twice for different subjects. The playbooks are
  first drafts of an outline; moves 1-2 of the method decide the real one.
