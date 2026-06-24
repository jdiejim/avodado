---
name: avodado-docs
description: >-
  Use whenever you author, edit, validate, or review Avodado documentation —
  Markdown files that mix prose with typed YAML blocks (sequence · erd · table ·
  callout · userstory · timeline · kanban · tracker · meta · prose · glossary ·
  proscons · cvt · stats · code · agenda · tree · pyramid · flow · state ·
  dfd · journey · gantt · graph · quadrant · swimlane · c4 · uml · mece · frontend ·
  cluster · block · infra · event · ddd · network · felogic · belogic · dag ·
  wireframe · endpoint · pullquote · layers · matrix · anatomy · composition · drivers · options · spec ·
  list · stories · pattern).
  Trigger on any of: docs/**/*.md in an Avodado repo, the `avo` CLI, any block
  type above, `doc#id` cross-references, presence of `avodado.config.*` or
  `.avodado/skill/SKILL.md` in the workspace, or user mentions "avodado". Covers
  block grammar, every block's fields, the reference scheme, YAML pitfalls, and
  the validate workflow.
---

# Authoring Avodado documents

> Repo location: commit this file at `.avodado/skill/SKILL.md`. `avo init`
> copies it into new projects and writes editor adapters (`CLAUDE.md`,
> `.cursor/rules/avodado.mdc`) that point here so Claude Code, Cursor, and
> other agents pick it up automatically.

Avodado documents are **plain Markdown with typed, fenced YAML blocks**. Prose
is ordinary Markdown; anything structured (a diagram, a table, a user story,
a chart) is a fenced code block whose info-string is the block *type*, with a
YAML body.

**The one rule:** the `.md` file is the source of truth. You edit files
directly. A document must read fine as plain text with no tooling, so never
paste raw HTML or inline SVG — express structure through blocks instead.

## Authoring recipe — follow this every time

Any time you write or edit an Avodado doc, work through these steps in order.
Skipping steps is the source of every authoring failure I've seen.

1. **Identify the doc's job.** Is this an API spec, an architecture overview, a
   roadmap, a runbook, a meeting agenda? The job picks the blocks (see *Choose
   your block* below).
2. **Start with `meta`** — title + subtitle + tag. First block, always.
3. **Add a short prose intro** under `## Overview`. 2-4 sentences. Plain Markdown.
4. **Pick 2-5 blocks that carry the structure.** Don't try to use all 53 in one doc.
   If the content *describes* an architecture, a layering, a pipeline, a component
   tree, or a set of gates, **adapt it to the matching diagram — don't leave it as
   prose and don't flatten it into a table.** A table is for genuinely tabular data
   (rows × columns of values), never for boxes-and-arrows. See *Adapt the content*
   and the *Block glossary* below.
5. **Give each referenceable block an `id:`** (a short slug). Other blocks reach
   it as `doc#id` from elsewhere; bare `#id` works inside the same doc.
6. **Use `title` + optional `lede` on diagram blocks** so the section header reads
   like an editorial document, not a dump of YAML.
7. **Quote any string containing `,` `:` `[` `]` `{` `}` `#` `&` `*` `!` `|` `>`
   `'` `"`.** See *YAML pitfalls* below for the table of things that bite you.
8. **Run `avo check`.** If anything's red, fix it before you call the change
   done. A passing check is the definition of done.

## Choose your block — decision tables

Most authoring failures come from picking the wrong block. Use these tables.

### Block glossary — one line on what each is *for*

The whole vocabulary at a glance. Read this first; it's the map from *a concept in
your head* to *a block*. The detailed family tables below disambiguate the close calls.

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
| `code` | One or more syntax-highlighted snippets under a titled header bar. |
| `tracker` | A task list with status / priority / owner / due. |
| `kanban` | Flexible named columns (e.g. Now / Next / Later) of cards. |
| `timeline` | Phases in order with status dots (done / current / next / future). |
| `gantt` | A schedule — tasks as bars across date columns. |
| `userstory` | An agile story: role / want / soThat + acceptance criteria + links. |
| `sequence` | Messages between actors **over time** (lifelines, returns); optional step list + endpoint pill. |
| `state` | A state machine — states + event transitions (+ a transition table). |
| `flow` | A decision flowchart — start / process / decision / end nodes, with `error` exits. |
| `dag` | A pipeline / DAG — same shapes as `flow`, framed for CI/CD. |
| `dfd` | Data-flow — processes, external entities, and datastores. |
| `swimlane` | A cross-functional process with one horizontal lane per role. |
| `journey` | A user journey across stages, with an optional emotion curve. |
| `erd` | Entity-relationship diagram — tables, columns, PK/FK, crow's-foot cardinality. |
| `uml` | A class diagram — attributes, methods, UML relationships. |
| `c4` | C4 model (context / container / component) — people, systems, containers, stores. |
| `block` | Generic boxes-and-arrows architecture — grid **or** horizontal `layers`, dashed `groups` zones. |
| `infra` | Cloud topology (same engine as `block`) — CDN / gateway / compute / DB, nested account & network zones. |
| `event` | Pub/sub topology (same engine) — producers → topics → consumers. |
| `ddd` | DDD bounded-context map (same engine). |
| `network` | Security zones with trust boundaries (same engine); supports `forbidden` (red) edges. |
| `cluster` | Kubernetes-style namespaces holding services, with replica counts. |
| `frontend` | A top-down component tree — root / layout / page / component / provider / hook / store. |
| `felogic` | Frontend module/logic graph — components, hooks, interfaces, strategies; group zones + egress edges. |
| `belogic` | Backend module/logic graph (same engine) — controller / service / repository / adapter / gateway + egress. |
| `graph` | A generic node-link graph with colour-cycled groups. |
| `mece` | A MECE issue tree — one problem broken into mutually-exclusive branches. |
| `tree` | An indented file/folder hierarchy (HTML, not SVG). |
| `pyramid` | A layered pyramid (strategy / hierarchy), widening top → bottom. |
| `quadrant` | A 2×2 matrix (e.g. effort vs impact) with plotted items. |
| `wireframe` | Low-fi UI mockups inside device frames — desktop / browser / phone screens. |
| `endpoint` | A Swagger-style API endpoint card — method, path, params, request body, responses, examples. |
| `pullquote` | A standout pull-quote with optional attribution. |
| `layers` | A layered explanation — N numbered layers, each a kicker / title / source / question + body. |
| `matrix` | A role × resource capability grid; cells tint by permission level. |
| `anatomy` | The labelled parts of a structured string (e.g. `app:feature:action`). |
| `composition` | Effective access as intersected gates — `gate₁ ∩ gate₂ ∩ … = result`. |
| `drivers` | A grid of factor/driver cards — icon + title + body + tag, the forces that shaped a design. |
| `options` | Approaches explored — cards with pros / cons / verdict; the chosen one is highlighted. |
| `spec` | A labelled spec sheet — `label → value` rows (a value can be an inline step-flow). |
| `list` | A fancy bullet list — bold lead + supporting line per row, in one of four marker styles (accent bar / check / icon / number). |
| `stories` | A collapsible backlog of user stories — many stories as `<details>` accordions in one section. |
| `pattern` | A design-pattern reference card — intent · forces · participants · consequences. |
| `gallery` | A responsive grid of cards — code snippets or notes (a bug gallery, a comparison grid). |

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
| "phases / rollout in order" | `timeline` (status) or `gantt` (real dates) | a `table` |
| "what the user sees / the screen / the app / the bell + feed" | `wireframe` (desktop / browser / phone) | prose |

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

### Architecture and topology (which one when?)

| If you want to show… | Use | Notes |
|---|---|---|
| Who uses the system + which external systems it depends on | `c4` (level: context) | One node per actor / system |
| Containers inside a system, with optional boundary box | `c4` (level: container) | Use `family` to colour-code (client / service / data / store) |
| Components inside one container | `c4` (level: component) | Same shape, finer granularity |
| Generic boxes-and-arrows architecture | `block` | Grid layout; add `groups` for dashed zones; add `layers` to switch to horizontal-band layout |
| Cloud deployment (CDN, gateway, compute, DB, …) | `infra` | Same engine as `block`; conventionally for cloud topology |
| Pub/sub event topology (producers → topics → consumers) | `event` | Same engine; conventionally for choreography |
| Bounded-context map for DDD | `ddd` | Same engine; conventionally for context maps |
| Security zones with trust boundaries | `network` | Same engine; supports `kind: forbidden` edges (red) |
| Kubernetes-style namespaces with services inside | `cluster` | Has its own nested-box engine; supports `replicas` count |

> `block` / `infra` / `event` / `ddd` / `network` share **one renderer**.
> They differ only by the colored tag pill above the diagram (ARCH / INFRA / EVENT
> / DDD / ZONES). Pick the slug that best signals intent to a reader; the YAML
> grammar is identical.

### Charts and overviews

| If you want to show… | Use |
|---|---|
| KPI values with deltas + up/down arrows | `stats` |
| Tabular data with optional cell tones | `table` |
| Task list with status / owner / priority / due | `tracker` |
| Now / Next / Later flexible columns | `kanban` |
| Phases with status dots (done / current / next / future) | `timeline` |
| Schedule with date columns and bars | `gantt` |
| Hierarchical / strategic pyramid (top→bottom widening) | `pyramid` |
| 2×2 matrix (effort vs impact, etc.) | `quadrant` |
| User journey across stages with optional emotion curve | `journey` |
| The forces / drivers / requirements behind a design (icon cards) | `drivers` |
| A compact fact sheet for one thing (label → value rows, optional step-flow) | `spec` |
| Role × resource capability grid (a value per cell) | `matrix` |

### Process and flow

| If you want to show… | Use |
|---|---|
| Sequence of messages over time (with optional step-by-step list + endpoint tag) | `sequence` |
| State machine with transitions + transition table | `state` |
| Generic decision flow with diamonds + stadium nodes | `flow` |
| Data-flow with processes, externals, datastores | `dfd` |
| Cross-functional flow with horizontal lanes per role | `swimlane` |
| CI/CD pipeline (same shapes as `flow`, navy DAG tag) | `dag` |
| Access as intersected gates that all must hold (`A ∩ B ∩ C = result`) | `composition` |

### Code-flavoured

| If you want to show… | Use |
|---|---|
| Class diagram with attrs/methods + UML markers | `uml` |
| Top-down React/Vue component tree | `frontend` |
| Frontend module graph with design patterns + interface stereotypes | `felogic` |
| Backend module graph — same engine as felogic | `belogic` |
| One or more syntax-highlighted code snippets | `code` |
| MECE issue tree (left → right with depth-coloured branches) | `mece` |
| Indented file/folder hierarchy (HTML, not SVG) | `tree` |
| Generic node-link graph with `group:` colour cycling | `graph` |

### Narrative and structure

| If you want to show… | Use |
|---|---|
| Note / tip / warning / danger box | `callout` |
| Structured prose (h3 + p + ul + quote sub-blocks) | `prose` |
| Term / definition rows | `glossary` |
| Two-column pros vs cons (one option) | `proscons` |
| Several approaches/options weighed, each with a verdict | `options` |
| Before / after, "current" → "target" | `cvt` |
| Meeting agenda (time + duration + title + owner) | `agenda` |
| One user story + acceptance criteria + cross-doc links | `userstory` |
| A **backlog** of many user stories (collapsible) | `stories` |
| A polished / styled bullet list (highlights, checklist, numbered) | `list` |
| A standout quote / takeaway | `pullquote` |
| N numbered explanatory tiers (L1/L2/L3), each one question | `layers` |
| Anatomy of a delimited string (`app:feature:action`) | `anatomy` |
| A Swagger-style HTTP endpoint reference | `endpoint` |
| A design pattern explained (repository, CQRS, hexagonal, saga…) | `pattern` |

## Mixing blocks — document recipes

A good Avodado doc is **2-5 blocks, each a different lens** on the subject —
*orient → big picture → detail → plan*. Don't show the same thing in two block
types, and don't reach for all 53. Start from the doc's job and pick a stack:

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

**Rules for combining:**

- **One `meta`, first, always.** Everything after it is optional.
- **Each block earns its place as a distinct lens.** `c4`/`block` shows the
  *structure*; `sequence`/`flow` shows *behavior*; `timeline`/`tracker` shows
  *plan*. If two blocks would draw the same boxes (`c4` **and** `block` for the
  same components, or `flow` **and** `sequence` for the same steps), keep one.
- **Connect, don't repeat.** Give the referenced block an `id:` and point at it
  with `userstory.links[].ref: doc#id` instead of redrawing it elsewhere.
- **Omit a block whose data is thin.** Fewer than ~3 nodes/rows? Fold it into a
  `callout` or a prose list — an almost-empty diagram reads worse than a sentence.
- **Order top-to-bottom as the reader needs it:** orient (`meta` + intro) → the
  big picture (context / landscape) → the detail (one module / one flow) → what's
  next (plan / tracker).

## Document playbooks — from a one-line ask to a block stack

When the user names a *kind* of document ("write an ADR", "a situation/resolution
write-up", "a roadmap", "a cloud architecture"), reach for the matching playbook
below. Each is a **starting skeleton**, not a cage: keep the blocks that carry
real content, drop the ones you have nothing for, and always open with `meta` +
a short prose intro. Treat the listed order as the reading order.

| The user asks for… | Trigger words | Block stack (in order) |
|---|---|---|
| **ADR** (decision record) | "ADR", "decision record", "why did we choose" | `meta` (tag `ADR-NNN`) → prose *Context* → `options` (or `proscons` if one option) → `callout` *Decision* → `proscons`/`table` *Consequences* → `tracker` *Follow-ups* |
| **Situation → Resolution** | "situation/complication/resolution", "problem → approach → answer", "write-up of how we solved" | `meta` → prose *Situation* → `drivers` *Forces* → `callout: warn` *Complication* → `options` *Approaches* → `spec` *Chosen approach* → `composition`/`sequence` *How it works* |
| **Roadmap / plan** | "roadmap", "delivery plan", "timeline", "what ships when" | `meta` → `stats` *Targets* → `timeline` (phases) **or** `gantt` (real dates) → `kanban` *Now/Next/Later* → `tracker` *Workstreams* |
| **Cloud architecture** | "cloud arch", "AWS/GCP/Azure design", "infra", "deployment topology" | `meta` → `drivers` *Requirements/NFRs* → `c4` (context) → `infra` *Topology* → `sequence` *Key request* → `table` *Stack choices* → `callout` *Trade-offs* |
| **Access model / RBAC** | "RBAC", "permissions", "access model", "roles & scopes" | `meta` → `drivers` *Requirements* → `layers` **or** `composition` *The model* → `options` *Approaches* → `spec` *Chosen* → `anatomy` *Permission string* → `matrix` *Role × capability* → `sequence` *Authz flow* → `userstory` *Backlog* |
| **API / endpoint spec** | "API spec", "endpoint docs", "REST/HTTP reference" | `meta` → `endpoint` (one per route) → `sequence` *Request flow* → `erd` *Data touched* → `table` *Status codes* |
| **Design doc / RFC** | "design doc", "RFC", "technical proposal" | `meta` → prose *Problem* → `mece` *Problem breakdown* → `options` *Alternatives* → `c4`/`block` *Proposed design* → `sequence`/`flow` *Behavior* → `tracker` *Open questions* |
| **Runbook / procedure** | "runbook", "on-call", "incident procedure", "how to operate" | `meta` → `callout` *When to use* → `flow` **or** `swimlane` *Procedure* → `code` *Commands* → `table` *Symptom → action* |
| **System overview** | "architecture overview", "how the system works", "onboarding doc" | `meta` → `c4` (context) → `block`/`infra` *Landscape* → `felogic`/`belogic` *One module* → `sequence` *A key flow* |
| **System design (pattern-driven)** | "design a notification system", "event-driven architecture", "how would you build X at scale", "high-level design" | `meta` → `drivers` *Requirements / NFRs* → `options` *Approaches, with a recommendation* → for each chosen pattern, its **`avo design <slug>`** card + structure diagram → `infra`/`c4` *Whole system* → `sequence` *Key flow* → `tracker` *Open questions* |
| **Presentation / deck** | "slides", "deck", "present this", "pitch" | `meta` (cover) → **one slide per `#`/`##` heading**, each heading + one strong block (`drivers`/`stats`/`pyramid`/`quadrant`/`timeline`/a diagram). See *Slide decks* below. |

> These compose: a big design doc might embed the **cloud architecture** stack in
> one section and the **access model** stack in another. Pick the playbook per
> *section*, not just per document. If the ask doesn't match any playbook, fall
> back to *Mixing blocks* above — job → core blocks.

> **Pattern-driven design — the key move.** When the user says "design an X"
> (e.g. "a notification system, event-driven"), don't free-hand it: (1) infer the
> requirements into a `drivers` block; (2) identify the building-block patterns
> from the library (event-driven → `pub-sub`, `message-queue`, `idempotency`,
> maybe `cqrs`/`event-sourcing`) and pull each via `avo design <slug>` for a ready
> card + diagram; (3) **always present `options`** — 2-3 viable approaches with
> pros/cons and a clear recommendation (`tone: chosen`); (4) assemble the chosen
> pieces into one `infra`/`c4` of the whole system + a `sequence` of the main
> flow. The reader should see *why* this design, the trade-offs, and the shape.

## Slide decks (`avo slides`)

Any document renders as a deck with `avo slides`. **Each top-level heading
(`#`/`##`) starts a new slide and is its title.** Everything until the next
heading — prose *and* every block — stays on that slide, so a slide can hold
several blocks. (`###`+ headings stay in the slide body; to keep things on the
same slide, just don't add a new `#`/`##`.)

````md
# Why now
A sentence of context, then any blocks under this heading.

```drivers
items:
  - { title: Slow, body: "p95 hit 2.4s.", icon: clock, accent: amber }
```

# The fix
Next heading → next slide. This one stacks two blocks.

```stats
stats:
  - { value: "800ms", label: New p95 target, trend: flat }
```

```callout
tone: success
body: Both blocks land on "The fix" slide.
```
````

- This means a normal Avodado doc (sections under `##` headings) already
  presents cleanly — no special markup needed. To author *for* slides, write one
  `##` heading per slide and keep each to **one idea**: a heading plus one strong
  visual (a diagram, `drivers`, `stats`, `pyramid`, `quadrant`, `timeline`) reads
  better than dense prose.
- **Vertical alignment is automatic** — light slides (one block, little prose)
  center; heavier slides (stacked blocks or lots of prose) top-align. To force it,
  add a marker to the heading: `## Title {top}`, `## Title {center}`, or
  `## Title {bottom}` (the marker is stripped from the displayed title).
- The `meta` block is the cover slide. A doc with **no headings at all** falls
  back to one slide per block (legacy behavior).

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

- The info-string is exactly one of the **53 block types** listed below — never
  invent new ones.
- The body is **YAML** (JSON is also accepted; YAML is preferred — prefer
  block-style over deep inline maps for readability and clean diffs).
- Use only the fields documented for that block. Keep prose outside blocks.
- A block MAY carry a top-level `id:` (a slug) so other blocks can reference it.
- Most diagram blocks accept optional `title`, `description`, and `lede` —
  these surface in the section header + diagram frame around the SVG.

## Block data shapes — required vs optional (the contract)

Every block also carries optional `title`, `description`, `lede` (editorial text
rendered around the diagram) and an optional top-level `id:` — **none are ever
required**, so they're left out of the table below, which shows only the
*structural* payload. `*` marks a **required** field; everything else is optional.
**Omit optional fields you have no value for** — don't pad them with empty strings.
`(n)` marks a **number** (don't quote it); every other value is a string.

| Block | Structural shape (`*` = required, `(n)` = number) | Closed enums |
|---|---|---|
| `meta` | `title` `subtitle` `tag` `logo` | — |
| `callout` | `tone` `title` `body` | tone: note · tip · warn · danger |
| `prose` | `blocks[]`: `type` `text` `items[]` | type: h · p · ul · ol · quote |
| `glossary` | `terms[]`: `term*` `def*` | — |
| `proscons` | `prosLabel` `consLabel` `pros[]` `cons[]` | — |
| `cvt` | `current{label, items[]}` `target{label, items[]}` `note` | — |
| `agenda` | `items[]`: `title*` `time` `duration` `owner` `desc` | — |
| `table` | `columns[]`: string \| `{label*, align, highlight}` · `rows[][]`: string \| number \| `{v*, tone, lead, highlight}` · `note` | align: l · c · r — tone: pos · neg · warn · muted |
| `stats` | `stats[]`: `value*` `label*` `delta` `trend` `accent` | trend: up · down · flat |
| `code` | `blocks[]`: `code*` `title` `lang` | — |
| `tracker` | `items[]`: `task*` `status` `priority` `owner` `due` | status: todo · doing · done · blocked — priority: high · med · low |
| `kanban` | `columns[]`: `label*` `cards[]`: `title*` `tag` | — |
| `timeline` | `items[]`: `label*` `date` `desc` `status` | status: done · current · next · future |
| `gantt` | `periods[]` · `tasks[]`: `label*` `start`(n) `span`(n) `kind` | kind: done · active · current · milestone |
| `userstory` | `role` `want` `soThat` `priority` `points`(n) · `criteria[]`: `given` `when` `then` · `links[]`: `ref` `mode` `label` | — |
| `sequence` | `actors[]`: `id*` `name*` `sub` `external` · `messages[]`: `from*` `to*` `label` `kind` `summary` `code` `note` · `endpoint{method*, path*, status}` · `foot[]`: `label*` `value*` | msg kind: sync · response · async · error · note — method: GET · POST · PUT · PATCH · DELETE |
| `state` | `states[]`: `id*` `col*`(n) `row*`(n) `name` `kind` · `transitions[]`: `from*` `to*` `event*` `guard` | kind: start · terminal · active · wait |
| `flow` / `dag` | `nodes[]`: `id*` `col*`(n) `row*`(n) `w`(n) `label*` `kind` · `edges[]`: `from*` `to*` `label` `kind` | node kind: start · end · decision · process — edge kind: error |
| `dfd` | `nodes[]`: `id*` `col*`(n) `row*`(n) `name*` `kind` `num` · `edges[]`: `from*` `to*` `label` | kind: process · external · store · datastore |
| `swimlane` | `lanes[]`: `label*` · `steps[]`: `id*` `col*`(n) `lane*`(n) `label*` `kind` · `links[]`: `from*` `to*` `label` | kind: action · decision · start · end · wait |
| `journey` | `stages[]`: `label*` · `rows[]`: `label*` `cells[]` · `emotion[]`(n, 0..1) | — |
| `erd` | `entities[]`: `name*` `columns[]`: `name*` `type` `pk`(bool) `fk`(bool) · `relations[]`: `from*` `to*` `label` `card` | card: "1:1" · "1:N" · "N:M" (quote!) |
| `uml` | `classes[]`: `id*` `col*`(n) `row*`(n) `name*` `stereotype` `attrs[]` `methods[]` · `rels[]`: `from*` `to*` `label` `kind` | rel kind: inheritance · extends · implementation · implements · composition · aggregation · dependency · association |
| `c4` | `level` `boundary{label*}` · `nodes[]`: `id*` `col*`(n) `row*`(n) `w`(n) `kind*` `family` `name*` `tech` `desc` · `edges[]`: `from*` `to*` `label` `kind` | level: context · container · component — node kind: person · system · external · store · container · component — edge kind: solid · dashed · forbidden · error |
| `block` `infra` `event` `ddd` `network` | `systemLabel` · `layers[]`: `label*` · `groups[]`: `id` `col*`(n) `row*`(n) `cols`(n) `rows`(n) `label*` `color` · `nodes[]`: `id*` `name*` (`col`(n)+`row`(n) **or** `layer`(n)) `w`(n) `kind` `tech` · `edges[]`: `from*` `to*` `label` `kind` | node kind: free string (client · service · microservice · db · cache · queue · gateway · cdn · external · …) — edge kind: solid · dashed · forbidden · error |
| `cluster` | `clusters[]`: `id*` `label*` `kind` · `services[]`: `id*` `cluster*` `label*` `kind` `tech` `replicas`(n) · `edges[]`: `from*` `to*` `label` `kind` | edge kind: solid · dashed · forbidden · error |
| `frontend` | `nodes[]`: `id*` `name*` `parent` `kind` `note` | kind: root · layout · page · component · leaf · provider · context · hook · store · state |
| `felogic` / `belogic` | `groups[]` (as `block`) · `nodes[]`: `id*` `col*`(n) `row*`(n) `w`(n) `kind` `name*` `note` · `edges[]`: `from*` `to*` `label` `kind` | node kind: free string (controller · service · repository · adapter · interface · strategy · hook · …) — edge kind: uses · implements · reads · egress · https · api · dashed · async |
| `graph` | `nodes[]`: `id*` `col*`(n) `row*`(n) `label*` `group`(n) · `edges[]`: `from*` `to*` `label` `dir` | dir: directed · undirected |
| `mece` | `nodes[]`: `id*` `parent` `label*` `note` | — |
| `tree` | `nodes[]`: `id*` `parent` `label*` `note` | — |
| `pyramid` | `levels[]`: `label*` `desc` | — |
| `quadrant` | `xAxis{label, low, high}` `yAxis{label, low, high}` · `items[]`: `x*`(n, 0..1) `y*`(n, 0..1) `label*` | — |
| `wireframe` | `screens[]`: `device` `title` `url` `label` `elements[]`: `type` `label` `rows`(n) `align` `tone` | device: desktop · browser · phone — element type: header · subheader · text · button · input · search · image · avatar · card · list · nav · tabs · divider · badge · toggle · spacer — align: l · c · r — tone: accent · muted · danger |
| `endpoint` | `method*` `path*` `title` `description` `auth` · `params[]`: `name*` `in` `type` `required`(bool) `desc` · `body[]`: `name*` `type` `required`(bool) `desc` · `responses[]`: `status*`(n) `desc` · `request` `response` | method: GET · POST · PUT · PATCH · DELETE · HEAD · OPTIONS — `in`: path · query · header · cookie |
| `pullquote` | `text*` `attribution` | — |
| `layers` | `title` `description` · `items[]`: `title*` `kicker` `source` `question` `body` | — |
| `matrix` | `title` `description` `corner` `cols*[]` · `rows[]`: `label*` `cells*[]` (one per col, in order) | cell tints: Full/Admin/Write/✓ → green · —/None/✗ → muted · else → amber |
| `anatomy` | `title` `description` `separator` (default `:`) · `parts[]`: `label*` `value*` `note` | — |
| `composition` | `title` `description` `result` · `gates[]`: `label*` `desc` `kicker` `source` | renders `gate₁ ∩ gate₂ ∩ … = result`; per-gate `kicker`/`source` add a coloured header + source line |
| `drivers` | `title` `description` · `items[]`: `title*` `body` `tag` `icon` `accent` | icon: location·shield·grid·lock·key·user·clock·check·database·bolt·flag·doc·link·eye·server·layers — accent: navy·blue·teal·green·amber·purple·red·gray |
| `options` | `title` `description` · `items[]`: `title*` `kicker` `how` `pros[]` `cons[]` `verdict` `tone` | tone: rejected·viable·chosen·warn·neutral (chosen is highlighted) |
| `spec` | `title` `description` `accent` · `rows[]`: `label*` (`value` **or** `steps[]`) | a `steps[]` row renders as an arrow-joined pill flow — accent as in `drivers` |
| `list` | `title` `description` `style` `accent` · `items[]`: `lead*` `text` `icon` `accent` `done`(bool) | style: accent · check · icon · number — icon/accent as in `drivers`; `done: false` dims a check row |
| `stories` | `title` `description` · `items[]`: `id` `title` `role` `want` `soThat` `priority` `points`(n) `tags[]` `open`(bool) · `criteria[]`: `given` `when` `then` · `links[]`: `ref` `mode` `label` | each item is a collapsible story; `open: true` starts expanded; `links[].ref` is a real `doc#id` cross-reference |
| `pattern` | `name*` `category` `intent` `forces[]` `solution` `structure` `note` · `participants[]`: `name*` `role` · `consequences{pros[], cons[]}` | — |
| `gallery` | `title` `description` `cols`(n) · `items[]`: `title` `code` `lang` `caption` `accent` | a card with `code` renders a highlighted snippet; without it, a title+caption note. Responsive grid (set `cols` to fix the column count). |

**Reading the contract:**

- A block with **no items at all** is a `W_EMPTY_BLOCK` warning — give it content
  or delete it. The `*` fields are the minimum to make each item valid.
- **Grid blocks** (`flow` · `state` · `dfd` · `c4` · `uml` · `graph` · `swimlane`
  · `felogic`/`belogic` · grid-mode `block`) require `col`/`row` (1-indexed) on
  every node. Adding `layers:` to `block`/`infra`/`event`/`ddd`/`network` switches
  them to band layout, where nodes use `layer:` (an index) instead of `col`/`row`.
- **Numbers stay unquoted:** coordinates (`col` `row` `lane` `w`), `points`,
  `replicas`, `group`, `start`/`span`, quadrant `x`/`y`, and `emotion[]`. Quote
  anything string-like that *looks* numeric (`version`, `delta: "0"`) — see *YAML
  pitfalls*.
- **`kind` is optional on most nodes/edges** — omit it for the neutral default;
  set it only to get the right glyph, colour, or marker.

## The 53 block types — by family

### API reference

#### `endpoint` — a Swagger-style API endpoint card
```endpoint
method: POST            # GET | POST | PUT | PATCH | DELETE | HEAD | OPTIONS
path: /orders/{cartId}
title: Create an order
description: Convert a cart into an order.
auth: Bearer <token>
params:                 # path / query / header / cookie parameters
  - { name: cartId, in: path, type: uuid, required: true, desc: Cart to convert }
  - { name: dry-run, in: query, type: boolean, desc: Validate without persisting }
body:                   # request-body fields
  - { name: items, type: "Item[]", required: true, desc: Line items }
responses:
  - { status: 201, desc: Order created }
  - { status: 400, desc: Invalid cart }
request: |             # optional example request body (verbatim)
  { "items": [{ "sku": "A1", "qty": 2 }] }
response: |            # optional example response body
  { "id": "ord_123", "status": "pending" }
```
Only `method` and `path` are required. `params[].in` is `path | query | header | cookie`. For a whole spec, generate docs with `avo sync openapi`.

#### `pullquote` — a standout quote
```pullquote
text: Site group = read at that plant. Role group = extra actions on top.
attribution: The taxonomy in one line
```

#### `layers` — a layered explanation (N numbered layers)
```layers
title: Access in three layers
items:
  - { kicker: L1, title: Identity, source: Entra JWT, question: "Signed in?", body: Validate the token. }
  - { kicker: L2, title: Site scope, source: lookup, question: "Which sites?", body: Confirm site is in range. }
  - { kicker: L3, title: Permission, source: App DB, question: "May you do this?", body: Resolve from the matrix. }
```
Use `layers` (not a table) when content reads as ordered tiers each answering one question — e.g. an L1/L2/L3 model. `callout` also now supports `tone: success` (green).

### Access control / RBAC

#### `matrix` — a role × resource capability grid
```matrix
title: Who can do what
corner: Role / App          # optional top-left cell label
cols: [Billing, Reports, Admin]
rows:
  - { label: Owner,   cells: [Full, Full, Full] }
  - { label: Manager, cells: [Full, Read, "—"] }
  - { label: Viewer,  cells: [Read, Read, "—"] }
```
`cells` is positional — one value per `cols` entry, in order. Cells tint by meaning:
`Full`/`Admin`/`Write`/`✓` → green, `—`/`None`/`✗` → muted, anything else → amber.
Use `matrix` (not `table`) for a capability grid where the columns are resources and
each cell is a permission level.

#### `anatomy` — the parts of a structured string (e.g. a permission)
```anatomy
title: Anatomy of a permission
separator: ":"              # optional, defaults to ":"
parts:
  - { label: App,     value: atlas,         note: Which product. }
  - { label: Feature, value: billing,       note: The area within the app. }
  - { label: Action,  value: invoices.read, note: The specific capability. }
```
Renders the full string (`atlas:billing:invoices.read`) with each segment coloured,
then a labelled card per segment. Use it to explain one identifier's shape — a
permission string, a resource URN, a topic name.

#### `composition` — effective access as intersected gates
```composition
title: How access is decided
result: May read invoices   # optional effective-result card
gates:
  - { label: Identity,   desc: A valid signed-in user. }
  - { label: Scope,      desc: The request is in range. }
  - { label: Permission, desc: The action is granted. }
```
Renders `gate₁ ∩ gate₂ ∩ … = result`. Use it when access is the AND of several
independent checks (authn ∩ scope ∩ permission), not a sequence of steps (use
`flow`/`sequence` for ordered steps).

### Presentation cards

#### `drivers` — the forces that shaped a design
```drivers
title: What guided the architecture
items:
  - { title: Single sign-on, body: One login carries the user everywhere., tag: "HOW: token", icon: lock, accent: purple }
  - { title: Read per site, body: "Access is scoped to the user's sites.", tag: "WHERE: site group", icon: location, accent: green }
  - { title: Governed roles, body: "An IGA requests, approves, certifies.", tag: "WHO: role groups", icon: shield, accent: blue }
  - { title: Per-app permissions, body: The same role differs per app., tag: "WHAT: matrix", icon: grid, accent: amber }
```
A grid of "the N drivers/requirements behind this." `icon` is one of a fixed set
(location · shield · grid · lock · key · user · clock · check · database · bolt ·
flag · doc · link · eye · server · layers); `accent` colours the top edge + icon.

#### `options` — approaches explored, with a verdict
```options
title: Approaches explored
items:
  - { kicker: Option 1, title: App-managed roles, how: Roles in our own DB., pros: [Full control], cons: ["Second source of truth"], verdict: "REJECTED — fails the constraint", tone: rejected }
  - { kicker: Option 2, title: Global role groups, how: One global group per role., pros: [Fewest groups], cons: ["A role applies at every site"], verdict: "VIABLE — fallback", tone: viable }
  - { kicker: Option 3, title: Per-site role groups, how: One group per persona per site., pros: [Least privilege], cons: [Most groups], verdict: "CHOSEN", tone: chosen }
```
Use when you weighed several approaches. Each card is one option; `tone: chosen`
highlights the winner. For one option's trade-offs alone, use `proscons`.

#### `spec` — a labelled spec sheet
```spec
title: Per-site role groups
accent: green
rows:
  - { label: Groups, value: "SiteN-Users (read) + SiteN-<Persona> per staffed plant." }
  - { label: Roles, value: "Each group reads as (site, role); the token carries the scope." }
  - { label: Resolution, steps: [Decode token, "Read (site, role)", Check matrix] }
  - { label: Cost, value: "Up to Sites × Roles groups; a new role multiplies them." }
```
A compact "fact sheet" for one approach/component. A row with `steps:` renders as
an arrow-joined pill flow (great for a short resolution pipeline).

### Lists, backlogs & patterns

#### `list` — a fancy bullet list (four marker styles)
```list
title: What you get
style: accent              # accent (left bar, default) | check | icon | number
items:
  - { lead: Typed blocks, text: "49 strict schemas, validated by avo check.", accent: blue }
  - { lead: One source of truth, text: Diagrams live in the .md file., accent: green }
  - { lead: Many outputs, text: "HTML, slides, and PDF from one file.", accent: amber }
```
Each item is a bold `lead` + optional `text`. `style` picks the marker: `accent`
(coloured left bar), `check` (ticks — `done: false` shows a hollow grey dot),
`icon` (an `icon` per item, same set as `drivers`), or `number` (auto-numbered
badges). `accent` (per item or block-level) tints the marker. Use `list` for a
polished bullet list; use `tracker` when items have status/owner/due, `drivers`
for a card grid, or `steps` in a `spec` row for an inline pipeline.

#### `stories` — a collapsible user-story backlog
```stories
title: Sprint backlog
items:
  - { id: US-1, title: One-step checkout, role: shopper, want: pay in one step, soThat: I finish faster, priority: High, points: 5, tags: [checkout], open: true, criteria: [{ given: items in cart, when: I pay, then: an order is created }], links: [{ ref: orders-api#seq-place-order, label: Request flow }] }
  - { id: US-2, title: Save card, role: returning shopper, want: store a card, soThat: I skip re-entry, priority: Med, points: 3 }
```
Renders every story as a `<details>` accordion (no JavaScript) in **one** section —
the summary shows the id, title, points, and priority; expanding reveals the
narrative, acceptance `criteria`, and `links`. `open: true` starts a story
expanded. Use `stories` for a backlog of many; use a single `userstory` block when
one story deserves its own full section. `links[].ref` is a real `doc#id`
cross-reference (checked by `avo check`).

#### `pattern` — a design-pattern reference card
```pattern
name: Repository
category: Backend
intent: Hide persistence behind a collection-like interface so the domain never sees the database.
forces: [Swap the data store, Unit-test without a DB, No query leaks into the domain]
participants:
  - { name: OrderRepository, role: interface the service depends on }
  - { name: PgOrderRepository, role: Postgres implementation }
  - { name: OrderService, role: caller (domain logic) }
consequences:
  pros: [Swappable storage, Testable with a fake]
  cons: [Another layer, Risk of anemic pass-through]
```
A GoF-style card for explaining one pattern (repository, CQRS, saga, hexagonal,
strategy…). Pair it with a `belogic` graph (the structure) and a `sequence` (the
runtime) for a complete pattern tutorial. Only `name` is required.

#### `gallery` — a responsive grid of cells

A **real grid** (2 columns by default; set `cols` to 3–4). Each cell is one of
three kinds — a plain **note**, a **code** snippet, or a **nested block** (a whole
diagram). Mix them freely. The nested block is validated against its own schema,
so a diagram-in-a-cell is checked exactly like a top-level one. Reach for
`gallery` (not a multi-block `code`) when you want cards/diagrams in a grid rather
than stacked.

**Grid with text** — `title` + `caption` cells (a comparison, a checklist of points):
```gallery
title: When to reach for it
cols: 2
items:
  - { title: Use a queue, caption: "Spiky load, slow downstream, work can be deferred.", accent: green }
  - { title: Call directly, caption: "Low latency needed and the dependency is fast + reliable.", accent: amber }
```

**Grid with code** — each cell a `code` snippet (a "bug gallery" / spot-the-bug set):
```gallery
title: Bug gallery
cols: 2
items:
  - { title: "N+1 query", lang: JavaScript, accent: red, caption: "1000 users = 1001 queries. Fix: JOIN.", code: "users.forEach(async u =>\n  await q('...WHERE user_id=?', u.id));" }
  - { title: "Off-by-one", lang: JavaScript, accent: amber, caption: "arr[len] is undefined. Fix: < not <=.", code: "for (let i=0; i<=arr.length; i++)\n  process(arr[i]);" }
```

**Grid with diagrams** — each cell a nested `block` (compare architectures side by side):
```gallery
title: Pick an approach
cols: 3
items:
  - { title: Monolith, caption: One deployable., block: { type: c4, level: container, nodes: [{ id: u, col: 1, row: 1, kind: person, name: User }, { id: app, col: 2, row: 1, kind: container, family: service, name: App }], edges: [{ from: u, to: app }] } }
  - { title: Microservices, caption: Independent services., block: { type: c4, level: container, nodes: [{ id: gw, col: 1, row: 1, kind: container, family: service, name: Gateway }, { id: a, col: 2, row: 1, kind: container, family: service, name: Orders }], edges: [{ from: gw, to: a }] } }
  - { title: Event-driven, caption: Async via a broker., block: { type: block, nodes: [{ id: p, col: 1, row: 1, kind: producer, name: Producer }, { id: bus, col: 2, row: 1, kind: topic, name: Bus }], edges: [{ from: p, to: bus }] } }
```

> **Don't hand-write a pattern from memory — grab a vetted template.** Avodado
> ships a library of common patterns (system-design building blocks *and* the GoF
> code patterns). Run `avo design` to list them, then `avo design <slug>` to get a
> ready template — a `pattern` card **plus a structure diagram** (`belogic` with
> interface/impl stereotypes for code, `block` with glyphs for system) — to adapt
> (or `avo design <slug> -o docs/x.md`).
> Slugs include: **system design** — `caching` `load-balancing` `cdn` `sharding`
> `replication` `rate-limiting` `message-queue` `pub-sub` `cqrs` `event-sourcing`
> `api-gateway` `circuit-breaker` `consistent-hashing` `idempotency` `saga`
> `leader-election` `bloom-filter` `write-ahead-log` `outbox` `sidecar`
> `service-discovery` `blue-green-deploy` `backpressure` `feed-fanout`
> `distributed-lock` `heartbeat` `quorum` `cdc` `webhooks` `oauth2`
> `cicd-pipeline` `two-phase-commit` `geohashing` `event-driven` `microservices`
> `event-streaming` `service-mesh` `strangler-fig` `bff` `scatter-gather`
> `dead-letter-queue` `database-per-service` `lambda-architecture` `async-write`
> `failover` `indexing`;
> **AI / agents** — `rag` `react` `tool-use` `prompt-chaining` `routing`
> `reflection` `multi-agent` `guardrails` `memory` `evaluator-optimizer`
> `parallelization` `augmented-llm`;
> **code (GoF)** — `factory-method` `abstract-factory` `builder` `prototype`
> `singleton` `adapter` `bridge` `composite` `decorator` `facade` `flyweight`
> `proxy` `chain-of-responsibility` `command` `iterator` `mediator` `memento`
> `observer` `state` `strategy` `template-method` `visitor`. Each template is a
> `pattern` card **plus a structure diagram** chosen to fit (UML class diagram
> for code; `block`/`flow`/`state`/`sequence` for system & AI). `avo design -p`
> (or `--system` / `--ai` / `--code`, `-s` for slides) opens the gallery. When the user names a
> known pattern, prefer the template over improvising, then tailor it.

> **Comparing patterns → use a `gallery`.** When the user says "compare X vs Y"
> (e.g. "adapter vs command", "monolith vs microservices", "REST vs gRPC"), don't
> write prose or a table — put each side in a `gallery` cell as a nested block so
> they sit **side by side**. Grab each via `avo design <slug>` and nest its
> `pattern` card (or its diagram). Use `cols: 2` for two, `cols: 3` for three.

```gallery
title: Adapter vs Command
cols: 2
items:
  - { block: { type: pattern, name: Adapter, category: Structural, intent: "Convert one interface into another a client expects.", participants: [{ name: Target, role: interface the client wants }, { name: Adapter, role: translates calls }, { name: Adaptee, role: existing class }], consequences: { pros: [Reuse incompatible code], cons: [Extra indirection] } } }
  - { block: { type: pattern, name: Command, category: Behavioral, intent: "Wrap a request as an object to queue, log, and undo.", participants: [{ name: Command, role: "execute() / undo()" }, { name: Invoker, role: triggers commands }, { name: Receiver, role: does the work }], consequences: { pros: [Undo + queue + log], cons: [Many small classes] } } }
```

### Document & meta

#### `meta` — document cover (first block only)
```meta
title: Orders API
subtitle: How the orders service accepts and persists a purchase.
tag: API · v1
logo: https://example.com/logo.png   # optional brand logo in the cover (use an absolute https URL)
```
`logo` is optional — an absolute https URL (or path) shown above the title on the
document and slide cover.

### Prose & structure

#### `prose` — structured prose (heading / paragraph / list / quote)
```prose
title: Background
blocks:
  - { type: h, text: Why this exists }
  - { type: p, text: A short paragraph explaining context. }
  - { type: ul, items: [Idea one, Idea two] }
  - { type: quote, text: A pull-quote. }
```

#### `callout` — note / tip / warning / danger
```callout
tone: warn
title: Idempotency required
body: Clients must send an Idempotency-Key header so retries are safe.
```
`tone` is `note | tip | warn | danger`.

#### `glossary` — term / definition rows
```glossary
terms:
  - { term: Idempotent, def: A replay produces the same outcome. }
  - { term: SLO, def: Service-level objective the team commits to. }
```

### Tables & metrics

#### `table` — comparison table
```table
columns: [Code, Meaning, When]
rows:
  - [201, Created, Order persisted]
  - [409, Conflict, Idempotency key reused]
```
Columns may be objects: `{ label, align: l|c|r, highlight: boolean }`. Cells
may be objects: `{ v: value, tone: pos|neg|warn|muted, lead: boolean,
highlight: boolean }`. Optional top-level `note`.

#### `stats` — KPI / metric cards
```stats
title: This quarter
stats:
  - { value: 12.4k, label: Active users, delta: "+18%", trend: up }
  - { value: 99.95%, label: Uptime, delta: "0", trend: flat }
```
`trend` is `up | down | flat`. `delta` is a string.

#### `code` — one or more code blocks
```code
blocks:
  - title: schema.sql
    lang: PostgreSQL
    code: |
      CREATE TABLE orders (id uuid PRIMARY KEY, total numeric);
```
Renders on a dark editor surface with syntax highlighting (kw, str, num, fn, ty,
com tokens) and a title bar — the same code styling applies in `gallery` cells and
`sequence` step snippets.

### Sequence & state

#### `sequence` — interaction over time (rich SVG + step list + footer)
```sequence
id: seq-place-order
title: One transaction wraps authorize + persist.
lede: Time runs downward. Solid arrows are sync; dashed are responses.
description: Happy path shown.
endpoint: { method: POST, path: /orders }
actors:
  - { id: Client, name: Client, sub: web / mobile }
  - { id: API, name: Orders API, sub: orders handler }
  - { id: PG, name: Postgres, sub: orders }
  - { id: Payment, name: Payment GW, sub: external, external: true }
messages:
  - { from: Client, to: API, label: POST /orders, kind: sync, summary: "Place the order with cart, token, idempotency key.", code: "POST /orders\nIdempotency-Key: ..." }
  - { from: API, to: API, kind: note, label: validate token, summary: "Validate bearer, check idempotency key." }
  - { from: API, to: PG, label: INSERT order, kind: sync, summary: "Open the txn and insert in PENDING.", note: "Required index: orders(idempotency_key)." }
  - { from: PG, to: API, label: order_id, kind: response, summary: "Returns the new order_id." }
  - { from: API, to: Client, label: 201 Created, kind: response, summary: "201 with the order." }
foot:
  - { label: Target p95, value: 250ms }
  - { label: Idempotent, value: via Idempotency-Key (24h TTL) }
```
Each message: `from` + `to` (must match an actor `id`), `label`,
optional `kind` (`sync | response | async | error | note`).
- `note` kind is a numbered annotation on one lane — no arrow.
- `summary` (long form for the step list under the SVG),
- `code` (a code snippet inside the step item),
- `note` field (italic-gray sub-note below the summary).
`endpoint.method` colours the tag pill (POST → navy, GET → green, etc.).
`foot` items render as key/value pills beneath the diagram.

#### `state` — state machine (+ transition table)
```state
title: Order lifecycle
states:
  - { id: s0, col: 1, row: 1, kind: start }
  - { id: pending, col: 2, row: 1, kind: wait, name: PENDING }
  - { id: confirmed, col: 3, row: 1, kind: active, name: CONFIRMED }
  - { id: end, col: 4, row: 1, kind: terminal }
transitions:
  - { from: s0, to: pending, event: create }
  - { from: pending, to: confirmed, event: pay }
  - { from: confirmed, to: end, event: ship }
```
`kind` on a state is `start | terminal | active | wait`.

### Data model

#### `erd` — entities and relations
```erd
entities:
  - name: orders
    columns:
      - { name: id, type: uuid, pk: true }
      - { name: user_id, type: uuid, fk: true }
relations:
  - { from: orders, to: order_items, card: "1:N" }
```
Column flags are booleans (`pk: true`, `fk: true`). Relation `card` is
`"1:1" | "1:N" | "N:M"`. Quote cardinality values because YAML parses the
unquoted form as a number sequence.

### Architecture diagrams

#### `c4` — context / container / component
```c4
title: System context
level: container
boundary: { label: ShopCo platform }
nodes:
  - { id: user, col: 1, row: 1, kind: person, name: Shopper, desc: A customer. }
  - { id: api, col: 2, row: 1, kind: container, family: service, name: Orders API, tech: Go }
  - { id: pay, col: 3, row: 1, kind: external, name: Payment GW }
edges:
  - { from: user, to: api, label: places order }
  - { from: api, to: pay, label: authorises }
```
`kind` is `person | system | external | store | container | component`.
`family` (for `container`/`component`): `client | service | data | store |
controller | repo | external`. Edge `kind` is `solid | dashed | forbidden |
error`. Optional `boundary` draws a dashed box around the internal nodes.

#### `block` — grid architecture with optional groups
```block
title: System architecture
groups:
  - { col: 1, row: 1, cols: 1, rows: 2, label: Edge, color: "#0e54a1" }
nodes:
  - { id: api, col: 2, row: 1, kind: service, name: API, tech: Go }
  - { id: pg, col: 2, row: 2, kind: store, name: Postgres }
edges:
  - { from: api, to: pg }
```
Node `kind` is one of: `client · service · microservice · compute · container ·
data · store · db · database · bucket · blob · object · queue · cache · gateway
· lb · function · lambda · cdn · external · producer · topic · consumer ·
context · firewall`. Known kinds get coloured + glyphed automatically.

**Nested zones (AWS-style VPC / subnets).** `groups` can overlap to nest: draw
the outer zone (e.g. a VPC) as one big group, then inner zones (public / private
subnets) as smaller groups inside its cell range. The renderer paints larger
groups first, so smaller ones layer on top. Nodes still sit in grid `col`/`row`
cells; the groups just frame them.
```infra
title: VPC topology
groups:
  - { col: 2, row: 1, cols: 3, rows: 3, label: "VPC 10.0.0.0/16", color: "#0e54a1" }
  - { col: 2, row: 1, cols: 3, rows: 1, label: Public subnet, color: "#1f9747" }
  - { col: 2, row: 2, cols: 3, rows: 1, label: "Private subnet · app", color: "#1a6dbe" }
nodes:
  - { id: cf, col: 1, row: 1, kind: cdn, name: CloudFront }
  - { id: alb, col: 2, row: 1, kind: gateway, name: ALB }
  - { id: svc, col: 2, row: 2, kind: microservice, name: orders, tech: ECS }
edges:
  - { from: cf, to: alb }
  - { from: alb, to: svc }
```

#### `infra` — same engine, layered layout
```infra
title: AWS topology
systemLabel: ShopCo · us-east-1
layers:
  - { label: Edge }
  - { label: Compute }
  - { label: Data }
nodes:
  - { id: cf, layer: 0, kind: cdn, name: CloudFront }
  - { id: api, layer: 1, kind: service, name: API }
  - { id: pg, layer: 2, kind: store, name: orders-db }
```
Presence of `layers` switches `block`/`infra` to horizontal-band layout.
Nodes use `layer: <index>` instead of `col`/`row`.

#### `event` — pub / sub choreography (same shape as block)
```event
title: Order events
nodes:
  - { id: orders, col: 1, row: 1, kind: producer, name: orders }
  - { id: bus, col: 2, row: 1, kind: topic, name: order.events }
  - { id: ship, col: 3, row: 1, kind: consumer, name: shipping }
edges:
  - { from: orders, to: bus }
  - { from: bus, to: ship }
```

#### `ddd` — bounded-context map (same shape as block)
```ddd
title: Bounded contexts
nodes:
  - { id: cat, col: 1, row: 1, kind: context, name: Catalog }
  - { id: order, col: 2, row: 1, kind: context, name: Orders }
edges:
  - { from: order, to: cat, label: reads, kind: dashed }
```

#### `network` — security zones (same shape as block)
Uses the `firewall` glyph and red zone tag.

#### `cluster` — k8s-style nested boxes with services
```cluster
title: Production cluster
clusters:
  - { id: api, label: api namespace, kind: namespace }
services:
  - { id: web, cluster: api, label: web, kind: service, tech: Next.js, replicas: 3 }
  - { id: orders, cluster: api, label: orders, kind: service, tech: Go, replicas: 4 }
edges:
  - { from: web, to: orders }
```
`replicas` renders as small bars (capped at 5 + `×N` label).

### Code-flavoured architecture

#### `felogic` / `belogic` — frontend / backend module graph
```felogic
title: Frontend logic
groups:
  - { id: app, label: App (browser), col: 1, row: 1, cols: 3, rows: 3, color: "#0e54a1" }
nodes:
  - { id: ui, col: 1, row: 1, kind: component, name: Checkout UI }
  - { id: iface, col: 2, row: 2, kind: interface, name: DiscountStrategy }
  - { id: impl, col: 1, row: 3, kind: strategy, name: PercentOff }
edges:
  - { from: ui, to: iface, kind: uses }
  - { from: impl, to: iface, kind: implements }
```
`belogic` is the same engine for the backend — use it to draw the
controller → service → repository chain (with a UML feel):
```belogic
title: Orders API — the request chain
groups:
  - { id: api, label: "orders/api", col: 1, row: 1, cols: 2, rows: 2, color: "#0e54a1" }
  - { id: io, label: Egress, col: 3, row: 1, cols: 1, rows: 2, color: "#6b7280" }
nodes:
  - { id: ctl, col: 1, row: 1, kind: controller, name: createOrder, note: "POST /orders" }
  - { id: svc, col: 2, row: 1, kind: service, name: OrderService, note: "validate + place" }
  - { id: repo, col: 1, row: 2, kind: repository, name: OrderRepo, note: persist }
  - { id: gw, col: 2, row: 2, kind: gateway, name: PaymentGateway, note: charge }
  - { id: db, col: 3, row: 1, kind: db, name: orders-db, note: Postgres }
edges:
  - { from: ctl, to: svc, kind: uses }
  - { from: svc, to: repo, kind: uses }
  - { from: svc, to: gw, kind: uses }
  - { from: repo, to: db, kind: egress }
```
Node `kind` is one of: `engine | core · interface · strategy · adapter ·
controller | handler | route · gateway · service | usecase · apiclient | client ·
repository | repo | dao · worker | consumer · middleware · model | entity ·
db | store | database · cache · queue | bus | broker · state | store_state ·
hook · external | backend | api | thirdparty`. Edge `kind` is
`uses | implements | egress | https | api | reads | dashed | async`. These kinds
render with a UML «stereotype» banner: `interface · controller · service ·
repository · adapter · gateway · strategy` — so a backend graph reads like a
stereotyped component diagram. Labels wrap to fit, so they never overflow.

#### `frontend` — top-down component tree
```frontend
title: React component tree
nodes:
  - { id: app, kind: root, name: App }
  - { id: layout, parent: app, kind: layout, name: Layout }
  - { id: page, parent: layout, kind: page, name: HomePage }
  - { id: hook, parent: page, kind: hook, name: useData }
```
`kind` is `root | layout | page | component | leaf | provider | context |
hook | store | state`. Parents render above children with link paths.

#### `uml` — class diagram
```uml
classes:
  - { id: order, col: 1, row: 1, name: Order, attrs: ["id: UUID", "status: Status"], methods: ["place()", "cancel()"] }
  - { id: status, col: 1, row: 2, name: Status, stereotype: enumeration, attrs: ["PENDING", "CONFIRMED"] }
rels:
  - { from: order, to: status, kind: association, label: has }
```
Relation `kind` is `inheritance | extends | implementation | implements |
composition | aggregation | dependency | association` (drives the marker
shape).

#### `dag` — pipeline / DAG (reuses flow's renderer)
```dag
title: CI pipeline
nodes:
  - { id: src, col: 1, row: 1, kind: start, label: Source }
  - { id: build, col: 2, row: 1, kind: process, label: Build }
  - { id: deploy, col: 3, row: 1, kind: end, label: Deploy }
edges:
  - { from: src, to: build }
  - { from: build, to: deploy }
```

### Flow & process

#### `flow` — flowchart with decisions
```flow
title: Decision flow
nodes:
  - { id: start, col: 1, row: 1, kind: start, label: Start }
  - { id: check, col: 2, row: 1, kind: decision, label: Token valid? }
  - { id: ok, col: 3, row: 1, kind: end, label: Done }
  - { id: bad, col: 2, row: 2, kind: end, label: Reject }
edges:
  - { from: start, to: check }
  - { from: check, to: ok, label: "yes" }
  - { from: check, to: bad, label: "no", kind: error }
```
`kind` is `start | end | decision | process`. Edge `kind: error` (or labels
starting with `no/fail/error/reject`) render in red.

#### `dfd` — data-flow diagram
```dfd
nodes:
  - { id: client, col: 1, row: 1, kind: external, name: Client }
  - { id: proc, col: 2, row: 1, kind: process, name: Place order, num: 1 }
  - { id: db, col: 3, row: 1, kind: store, name: orders }
edges:
  - { from: client, to: proc }
  - { from: proc, to: db }
```
`kind` is `process | external | store | datastore`. Optional `num` on
processes.

#### `swimlane` — cross-functional process
```swimlane
lanes:
  - { label: Customer }
  - { label: Sales }
steps:
  - { id: req, col: 1, lane: 0, kind: start, label: Submit }
  - { id: fulfill, col: 2, lane: 1, label: Fulfill }
links:
  - { from: req, to: fulfill }
```
Step `kind` is `action | decision | start | end | wait`.

### Charts & overviews

#### `graph` — node-link graph
```graph
nodes:
  - { id: a, col: 1, row: 1, label: Module A, group: 0 }
  - { id: b, col: 2, row: 1, label: Module B, group: 1 }
edges:
  - { from: a, to: b, dir: undirected }
```
`group: <n>` cycles through the chart palette. Edge `dir` is `directed`
(default) or `undirected`.

#### `mece` — issue tree (MECE breakdown)
```mece
title: Why are conversions down?
nodes:
  - { id: root, label: Lower conversion }
  - { id: traffic, parent: root, label: Traffic quality }
  - { id: friction, parent: root, label: Funnel friction }
  - { id: f1, parent: friction, label: Slow checkout, note: p95 > 4s }
```
Left-to-right tree, depth-coloured stripes, DFS layout.

#### `tree` — indented hierarchy (HTML, not SVG)
```tree
nodes:
  - { id: src, label: src }
  - { id: components, parent: src, label: components }
  - { id: index, parent: src, label: index.ts, note: entry }
```

#### `gantt` — schedule bars
```gantt
periods: [Q1, Q2, Q3, Q4]
tasks:
  - { label: Discovery, start: 0, span: 1, kind: done }
  - { label: Build, start: 1, span: 2, kind: active }
  - { label: GA, start: 3, span: 1, kind: milestone }
```
Task `kind` is `done | active | current | milestone` (drives bar colour).

#### `pyramid` — stacked hierarchy (top → bottom widening)
```pyramid
levels:
  - { label: Vision, desc: Long-term direction }
  - { label: Tactics, desc: This quarter }
```

#### `quadrant` — 2×2 matrix
```quadrant
xAxis: { label: Effort, low: Low, high: High }
yAxis: { label: Impact, low: Low, high: High }
items:
  - { x: 0.2, y: 0.8, label: Quick win }
  - { x: 0.8, y: 0.8, label: Big bet }
```
`x` / `y` are 0..1.

#### `journey` — user journey map with optional emotion curve
```journey
stages: [{ label: Discover }, { label: Sign up }, { label: Pay }]
rows:
  - { label: Touchpoint, cells: [Landing, Form, Checkout] }
  - { label: Friction, cells: [Low, High, Medium] }
emotion: [0.7, 0.3, 0.8]
```

### Planning & meta

#### `userstory` — agile story + acceptance criteria + links
```userstory
id: US-142
role: shopper
want: pay for my cart in one step
soThat: I can complete my purchase quickly
priority: High
points: 5
criteria:
  - { given: I have items, when: I submit valid payment, then: an order is created }
links:
  - { ref: orders-api#seq-place-order, mode: sequence, label: Request flow }
```
`links` may use `ref: doc#id` (a real cross-reference) or a plain label.

#### `timeline` — phases / roadmap
```timeline
items:
  - { label: P0 — Core, date: now, status: current, desc: parser + resolver }
  - { label: P1 — CLI, date: next, status: next, desc: init / check / render }
```
`status` is `done | current | next | future` (colours the dot).

#### `kanban` — flexible columns
```kanban
columns:
  - label: Now
    cards:
      - { title: Core parser }
      - { title: Validation, tag: priority }
  - label: Next
    cards:
      - { title: Hot reload }
```

#### `tracker` — task list with status / priority / owner / due
```tracker
items:
  - { task: First task, status: doing, priority: high, owner: alice, due: 2026-01-15 }
  - { task: Second task, status: todo, priority: med }
```
`status` is `todo | doing | done | blocked`; `priority` is `high | med | low`.

#### `cvt` — current vs target (before / after)
```cvt
title: Migration plan
current:
  label: Today
  items: [Single monolith, Shared DB, Manual deploys]
target:
  label: Target
  items: [Modular services, Per-service stores, Continuous releases]
note: Migrate one service per quarter.
```

#### `proscons` — pros vs cons (two columns)
```proscons
prosLabel: Synchronous
consLabel: Asynchronous
pros: [Easy to reason about, One transaction]
cons: [Latency-bound, Single point of failure]
```

#### `agenda` — meeting agenda
```agenda
items:
  - { time: "09:00", duration: 30m, title: Round-robin, owner: Host }
  - { time: "09:30", duration: 60m, title: Deep dive, desc: API team }
```

### UI mockups

#### `wireframe` — low-fi screen mockups (desktop / browser / phone)
```wireframe
title: What the user sees
screens:
  - device: browser
    title: Notification center
    url: app.example.com/inbox
    label: Desktop — notification center
    elements:
      - { type: nav, label: "Home, Inbox, Settings" }
      - { type: header, label: Notifications }
      - { type: badge, label: "3 new", tone: danger, align: r }
      - { type: list, rows: 4 }
      - { type: button, label: Mark all as read }
  - device: phone
    title: "9:41"
    label: iPhone — live bell + feed
    elements:
      - { type: header, label: Alerts }
      - { type: card, rows: 3 }
      - { type: tabs, label: "Home, Search, Bell, You" }
```
`screens` lay out left-to-right; each picks a `device` frame (`desktop` /
`browser` / `phone`) and stacks `elements` top-to-bottom. `device: browser`
shows an address bar (`url`); `phone` adds a notch + home indicator. `title`
is the window/status-bar text, `label` is the caption under the frame.

Element `type` is one of: `header · subheader · text · button · input · search
· image · avatar · card · list · nav · tabs · divider · badge · toggle ·
spacer`. `rows` repeats stack-like elements (`list` / `card`) or sizes `text` /
`spacer`. `nav` / `tabs` read their items from a **comma-separated** `label`
(quote it). `align` is `l | c | r`; `tone` is `accent | muted | danger` (colours
buttons, badges, toggles). Keep it low-fidelity — it's a wireframe, not a comp.

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
avo render docs/orders-api.md -o out.html
avo preview docs/orders-api.md  # render and open it
avo pdf docs/x.md                # one doc → PDF
avo block <type>                # scaffold a single block (avo template <name> for a doc)
avo sync openapi spec.yaml --out docs/api.md   # generate a doc from an OpenAPI spec
```

`avo check` exits non-zero on any error and names the file, line, and
offending value. **A change is not done until `avo check` passes.**

## When `avo check` fails — error code recipes

Every diagnostic carries a stable code so you can mechanically apply a fix.

| Code | What it means | First thing to check |
|---|---|---|
| `E_PARSE_YAML` | YAML body failed to parse. Almost always a quoting issue. | Re-read *YAML pitfalls* above. Unquoted `,`/`:`/`#` in a `desc` is the usual culprit. |
| `E_SCHEMA` | A field is missing, the wrong type, or an unknown name. Message contains the path (e.g. `sequence: messages.2.kind: ...`). | Compare your YAML against the block reference. Reject the urge to add fields not listed in this skill — the schema is strict. |
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

## Field semantics — clarifications

A few fields are easy to misuse. Lock these in.

- `sequence.actors[].sub` is the **subtitle** under the actor's name on the
  lane head (e.g. `sub: web / mobile`, `sub: orders handler`). Keep it short —
  2-4 words.
- `sequence.actors[].external: true` darkens the lane (slate instead of navy),
  signaling the actor lives outside your service boundary.
- `sequence.messages[].kind: note` is **not a message** — it's a numbered
  annotation on the from-actor's lane, with no arrow. Use it for things like
  "validate token" that don't cross a boundary.
- `sequence.messages[].summary` is the longer text shown in the step-by-step
  list **below** the SVG. Keep `label` short (the SVG arrow) and put detail in
  `summary`. `code:` adds a `<pre>` snippet inside the step item.
- On most diagram blocks: `lede` renders as a `<p class="section-lede">` under
  the section title, sized for an editorial paragraph. `description` renders
  inside the diagram frame as the diagram's caption. Use both when you have
  both kinds of text to convey.
- `userstory.links[].ref` is the only field in v1 that creates a real
  cross-document reference. Other `links` items render as plain chips.
- `block` / `infra` / `event` / `ddd` / `network` use **identical YAML** — the
  block type slug only changes the colored tag pill. Pick the slug that best
  signals intent to a reader, not for any structural reason.
- `userstory.id` is what other docs reference. Use a short stable id like
  `US-142`, not a sentence.
- Diagram blocks with `layers:` set go into **horizontal-band layout**. Without
  `layers:` they use **grid layout** with `col`/`row`. Don't mix — the renderer
  uses the presence of `layers` to switch modes.

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

## Quick block index (in case you forget)

| Family | Blocks |
|---|---|
| Document & meta | `meta` |
| Prose & structure | `prose` `callout` `glossary` `pullquote` `layers` `list` |
| Tables & metrics | `table` `stats` `code` `gallery` |
| API reference | `endpoint` |
| Sequence & state | `sequence` `state` |
| Data model | `erd` |
| Architecture | `c4` `block` `infra` `event` `ddd` `network` `cluster` |
| Code-flavoured | `felogic` `belogic` `frontend` `uml` `dag` `pattern` |
| Flow & process | `flow` `dfd` `swimlane` |
| Charts & overviews | `graph` `mece` `tree` `gantt` `pyramid` `quadrant` `journey` |
| Access control / RBAC | `matrix` `anatomy` `composition` |
| Presentation cards | `drivers` `options` `spec` |
| Planning & meta | `userstory` `stories` `timeline` `kanban` `tracker` `cvt` `proscons` `agenda` |
| UI mockups | `wireframe` |
