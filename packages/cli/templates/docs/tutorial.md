```meta
title: The Avodado tutorial
subtitle: A deck-first tour of the full feature set — render it with `avo slides docs/tutorial.md`.
tag: TUTORIAL · FULL TOUR
```

## What you'll learn {center}

Every `#`/`##` heading you see is one slide. This deck tours the whole block
vocabulary — architecture, data, process, planning, RBAC, and narrative — plus
themes, cross-references, and how slides themselves work.

```drivers
title: The four things Avodado gives you
items:
  - { title: One source of truth, body: "Diagrams live in the .md file, not a separate tool.", tag: "WHAT", icon: doc, accent: blue }
  - { title: Typed blocks, body: "52 block types with strict schemas.", tag: "HOW", icon: grid, accent: green }
  - { title: Validated, body: "avo check gates every change.", tag: "WHY", icon: check, accent: purple }
  - { title: Many outputs, body: "HTML, slides, and PDF from one file.", tag: "WHERE", icon: layers, accent: amber }
```

## Documentation as code

The shift: stop maintaining diagrams in one tool and prose in another. One file,
validated, rendered many ways.

```cvt
title: Before and after
current:
  label: Prose-only docs
  items: [Diagrams rot in a separate tool, Nothing validates them, Copy-paste drift]
target:
  label: Avodado
  items: [Structure lives in the file, avo check gates every change, One source of truth]
note: The .md on disk is always the truth.
```

## The one rule {center}

```pullquote
text: The .md file is the source of truth — edit a block surgically, never regenerate the whole doc.
attribution: The one rule
```

```callout
tone: tip
title: Definition of done
body: "A change isn't finished until `avo check` passes — schemas, references, and duplicate ids all green."
```

## A block = type + YAML

A block is a fenced section whose info-string is the **type** and whose body is
**YAML**. Add an `id:` to reference it; add a `title:` so it reads like a document.

```code
blocks:
  - title: The shape of every block
    lang: markdown
    code: |
      ```stats
      stats:
        - { value: "52", label: Block types, trend: flat }
      ```
```

## System context

Start a system doc with who uses it and what it touches — that's a `c4` context
diagram.

```c4
title: Avodado in context
level: context
nodes:
  - { id: author, col: 1, row: 1, kind: person, name: Author, desc: Writes docs. }
  - { id: avo, col: 2, row: 1, kind: system, name: Avodado }
  - { id: ci, col: 3, row: 1, kind: external, name: CI }
edges:
  - { from: author, to: avo, label: edits .md }
  - { from: avo, to: ci, label: "avo check" }
```

## The build pipeline

`infra` (and its siblings `block` / `event` / `ddd` / `network`) draw boxes and
arrows. Adding `layers:` switches to clean horizontal bands.

```infra
title: Markdown in, many outputs out
systemLabel: "@avodado/*"
layers:
  - { label: Author }
  - { label: Core }
  - { label: Output }
nodes:
  - { id: md, layer: 0, kind: external, name: Markdown }
  - { id: core, layer: 1, kind: service, name: parse + validate }
  - { id: render, layer: 1, kind: service, name: render }
  - { id: html, layer: 2, kind: cdn, name: HTML }
  - { id: pdf, layer: 2, kind: store, name: PDF }
edges:
  - { from: md, to: core }
  - { from: core, to: render }
  - { from: render, to: html }
  - { from: render, to: pdf }
```

## Behavior over time

When A calls B, then B replies — that's temporal, so use `sequence`, not a flow.

```sequence
id: seq-tour
title: Validate a document
endpoint: { method: POST, path: /check }
actors:
  - { id: CLI, name: avo CLI }
  - { id: Core, name: "@avo/core" }
  - { id: User, name: Terminal }
messages:
  - { from: User, to: CLI, label: avo check, kind: sync }
  - { from: CLI, to: Core, label: parse + validate, kind: sync }
  - { from: Core, to: CLI, label: diagnostics, kind: response }
  - { from: CLI, to: User, label: OK / errors, kind: response }
```

## Decisions and branches

A `flow` is for decisions and branches (its cousins `dag`, `dfd`, and `swimlane`
share the look for pipelines, data-flow, and cross-team processes).

```flow
title: Does it pass?
nodes:
  - { id: start, col: 1, row: 1, kind: start, label: Edit }
  - { id: check, col: 2, row: 1, kind: decision, label: avo check? }
  - { id: ship, col: 3, row: 1, kind: end, label: Ship }
  - { id: fix, col: 2, row: 2, kind: process, label: Fix it }
edges:
  - { from: start, to: check }
  - { from: check, to: ship, label: "pass" }
  - { from: check, to: fix, label: "fail", kind: error }
  - { from: fix, to: check }
```

## A state machine

`state` draws lifecycles — states plus the events that move between them.

```state
title: Document lifecycle
states:
  - { id: s0, col: 1, row: 1, kind: start }
  - { id: draft, col: 2, row: 1, kind: wait, name: DRAFT }
  - { id: review, col: 3, row: 1, kind: active, name: REVIEW }
  - { id: pub, col: 4, row: 1, kind: active, name: PUBLISHED }
  - { id: end, col: 5, row: 1, kind: terminal }
transitions:
  - { from: s0, to: draft, event: create }
  - { from: draft, to: review, event: "avo check" }
  - { from: review, to: pub, event: merge }
  - { from: pub, to: end, event: archive }
```

## The data model

`erd` is for tables, keys, and relationships — never flatten a schema into a plain
table.

```erd
entities:
  - name: docs
    columns:
      - { name: slug, type: text, pk: true }
      - { name: theme, type: text }
  - name: blocks
    columns:
      - { name: id, type: text, pk: true }
      - { name: doc_slug, type: text, fk: true }
      - { name: type, type: text }
relations:
  - { from: docs, to: blocks, card: "1:N" }
```

## Backend internals

`belogic` (and `felogic` for the frontend) draw the controller → service →
repository chain with a UML-stereotype feel.

```belogic
title: How avo render works
nodes:
  - { id: cmd, col: 1, row: 1, kind: controller, name: renderCmd, note: "avo render" }
  - { id: svc, col: 2, row: 1, kind: service, name: Renderer, note: blocks → HTML }
  - { id: reg, col: 1, row: 2, kind: repository, name: BlockRegistry, note: lookup }
  - { id: theme, col: 2, row: 2, kind: gateway, name: ThemeLoader, note: CSS vars }
edges:
  - { from: cmd, to: svc, kind: uses }
  - { from: svc, to: reg, kind: uses }
  - { from: svc, to: theme, kind: uses }
```

## The component tree

`frontend` is a top-down component hierarchy — root, layouts, pages, hooks, stores.

```frontend
title: A docs viewer
nodes:
  - { id: app, kind: root, name: App }
  - { id: layout, parent: app, kind: layout, name: DocLayout }
  - { id: page, parent: layout, kind: page, name: DocPage }
  - { id: doc, parent: page, kind: component, name: AvodadoDoc }
  - { id: hook, parent: doc, kind: hook, name: useTheme }
```

## Access = intersected gates

For RBAC, `composition` shows access as the AND of independent checks — not a
sequence of steps.

```composition
title: How edit access is decided
result: May edit the doc
gates:
  - { kicker: "L1 · Identity", label: Signed in, desc: A valid user., source: "Source: JWT" }
  - { kicker: "L2 · Scope", label: In range, desc: The doc is in scope., source: "Source: lookup" }
  - { kicker: "L3 · Permission", label: Granted, desc: Edit is allowed., source: "Source: app DB" }
```

## Anatomy of an identifier

`anatomy` labels the parts of one delimited string — a permission, a URN, a path.

```anatomy
title: Anatomy of a permission
separator: ":"
parts:
  - { label: App, value: avodado, note: Which product. }
  - { label: Feature, value: docs, note: The area. }
  - { label: Action, value: edit, note: The capability. }
```

## Role × capability

`matrix` is the capability grid — roles down, resources across, a level per cell.

```matrix
title: Who can do what
corner: Role / Action
cols: [Read, Edit, Publish]
rows:
  - { label: Viewer, cells: [Full, "—", "—"] }
  - { label: Author, cells: [Full, Full, "—"] }
  - { label: Maintainer, cells: [Full, Full, Full] }
```

## Weighing approaches

`options` lays out the approaches you considered; the chosen one is highlighted.

```options
title: How should themes work?
items:
  - { kicker: Option 1, title: Hard-code CSS, how: One stylesheet per theme., pros: [Simple], cons: ["Rebuild to change"], verdict: "REJECTED", tone: rejected }
  - { kicker: Option 2, title: JSON theme files, how: Friendly names → CSS vars., pros: [No rebuild, Editable], cons: ["A tiny loader"], verdict: "CHOSEN", tone: chosen }
```

## A one-thing fact sheet

`spec` is a compact label → value sheet; a `steps:` row renders as a pill flow.

```spec
title: The textbook theme
accent: amber
rows:
  - { label: Look, value: "Warm, classic, serif headings." }
  - { label: Override, value: "Any color or font in avodado.theme.json." }
  - { label: Apply, steps: [Edit JSON, "avo render", Done] }
```

## Numbers that matter

`stats` is a strip of KPI cards with deltas and trends.

```stats
stats:
  - { value: "52", label: Block types, trend: flat }
  - { value: "6", label: Themes, delta: "+1", trend: up }
  - { value: "3", label: Output formats, trend: flat }
```

## Plan in phases

`timeline` shows ordered phases with status dots.

```timeline
items:
  - { label: "Write your first doc", date: now, status: current, desc: "Edit, then avo check" }
  - { label: "Gate it in CI", date: next, status: next, desc: "avo check on every PR" }
  - { label: "Present it", date: later, status: future, desc: "avo slides" }
```

## Schedule with dates

When phases have real durations, `gantt` draws bars across periods.

```gantt
periods: [Q1, Q2, Q3, Q4]
tasks:
  - { label: Core, start: 0, span: 1, kind: done }
  - { label: CLI + render, start: 1, span: 2, kind: active }
  - { label: "1.0", start: 3, span: 1, kind: milestone }
```

## Now / Next / Later

`kanban` is flexible named columns of cards.

```kanban
columns:
  - label: Now
    cards:
      - { title: First doc }
      - { title: Pick a theme, tag: design }
  - label: Next
    cards:
      - { title: Wire CI }
  - label: Later
    cards:
      - { title: Author a deck }
```

## Track the work

`tracker` is a task list with status, priority, owner, and due date.

```tracker
items:
  - { task: Scaffold the repo, status: done, priority: high, owner: you }
  - { task: Write getting-started, status: doing, priority: high }
  - { task: Add to CI, status: todo, priority: med }
```

## Tell it as a pyramid

`pyramid` ranks tiers, widening top to bottom — strategy, hierarchy, the test pyramid.

```pyramid
levels:
  - { label: Meta, desc: Title + intent }
  - { label: Big picture, desc: Architecture / landscape }
  - { label: Detail, desc: One flow or module }
  - { label: Plan, desc: Roadmap + tracker }
```

## Prioritize on two axes

`quadrant` plots items in a 2×2 — effort vs impact, risk vs reward, anything.

```quadrant
xAxis: { label: Effort, low: Low, high: High }
yAxis: { label: Impact, low: Low, high: High }
items:
  - { x: 0.25, y: 0.8, label: Add a callout }
  - { x: 0.75, y: 0.85, label: Author a deck }
  - { x: 0.3, y: 0.3, label: Tweak a color }
```

## Map the journey

`journey` walks stages with an optional emotion curve.

```journey
stages: [{ label: Discover }, { label: Author }, { label: Validate }, { label: Ship }]
rows:
  - { label: Tool, cells: ["avo init", "edit .md", "avo check", "avo export"] }
  - { label: Feeling, cells: [Curious, Focused, Tense, Proud] }
emotion: [0.6, 0.7, 0.4, 0.9]
```

## Explain in layers

`layers` is N numbered tiers, each answering one question — great for an L1/L2/L3 model.

```layers
title: A doc in three layers
items:
  - { kicker: L1, title: Prose, source: Markdown, question: "What's the story?", body: Plain paragraphs carry the narrative. }
  - { kicker: L2, title: Blocks, source: typed YAML, question: "What's the structure?", body: "Diagrams, tables, and stories." }
  - { kicker: L3, title: Refs, source: "doc#id", question: "How do they connect?", body: Stories point at the flows that satisfy them. }
```

## Weigh the trade-offs

`proscons` weighs two sides of one decision.

```proscons
prosLabel: HTML output
consLabel: PDF output
pros: [Interactive, Live theme switch, Tiny files]
cons: [Print-ready, Email-friendly, Needs Chromium once]
```

## Break it down (MECE)

`mece` decomposes one thing into exhaustive, non-overlapping parts.

```mece
title: What goes in a doc?
nodes:
  - { id: root, label: A doc }
  - { id: prose, parent: root, label: Prose }
  - { id: struct, parent: root, label: Structure }
  - { id: diag, parent: struct, label: Diagrams }
  - { id: tab, parent: struct, label: Tables }
```

## An HTTP endpoint

`endpoint` is a Swagger-style card; `avo sync openapi` can generate a whole set.

```endpoint
method: POST
path: /docs/{slug}/check
title: Validate a document
description: Run schema + reference checks on one doc.
params:
  - { name: slug, in: path, type: string, required: true, desc: Doc to validate }
responses:
  - { status: 200, desc: No diagnostics }
  - { status: 422, desc: Diagnostics found }
```

## What the user sees

`wireframe` sketches low-fi screens inside device frames.

```wireframe
title: The rendered page
screens:
  - device: browser
    title: Rendered doc
    url: localhost/out.html
    label: An Avodado page in the browser
    elements:
      - { type: header, label: The Avodado tutorial }
      - { type: text, rows: 2 }
      - { type: image, label: sequence diagram }
      - { type: button, label: Switch theme, tone: accent }
```

## Connect with `doc#id`

Give a block an `id:`, then reference it with `doc#id` (or bare `#id` in the same
file). A dangling ref fails `avo check`. This story links to the flow above.

```userstory
id: US-tour
role: doc author
want: link a story to the flow that satisfies it
soThat: the document becomes a connected, checkable model
priority: Med
points: 3
criteria:
  - { given: a sequence has an id, when: I add a matching ref, then: avo check resolves it }
links:
  - { ref: "#seq-tour", mode: sequence, label: The validate flow }
```

## Key terms

`glossary` is plain term → definition rows.

```glossary
terms:
  - { term: Block, def: A fenced section whose info-string is a typed block name. }
  - { term: "doc#id", def: "A cross-reference to a block id, checked by avo check." }
  - { term: Theme, def: A named set of colors and fonts applied at render time. }
```

## Six themes, no rebuild

```table
columns: [Theme, Feel]
rows:
  - [textbook, "Warm, classic, serif (default)"]
  - [minimal, Clean modern white]
  - [soft, Modern light, indigo accent]
  - [dark, Full dark mode]
  - [teal, Teal + amber]
  - [slate, Slate sans]
note: Run `avo theme` to pick one, or `avo theme new <name>` for a custom one.
```

## How slides work {top}

This whole file is a deck. The rules:

```callout
tone: note
title: Authoring for slides
body: "Each `#`/`##` heading starts a slide and is its title. Everything under it — prose and blocks — rides along, so a slide can stack several blocks. Alignment is automatic; force it with a heading marker: `{top}`, `{center}`, or `{bottom}`."
```

## Always validate {center}

```code
blocks:
  - title: The loop
    lang: bash
    code: |
      avo check                 # validate everything
      avo preview docs/x.md     # render + open
      avo slides docs/x.md      # present it
      avo export docs/**/*.md --format pdf --out dist/
```

## Recap

```table
columns: [If you want to show…, Reach for]
rows:
  - [Who uses the system, "c4 (context)"]
  - [Boxes and arrows / topology, "block · infra · event · ddd · network"]
  - [A call-and-response over time, sequence]
  - [Branches and decisions, "flow · dag · swimlane · dfd"]
  - [Tables, keys, relationships, erd]
  - [Module internals, "belogic · felogic · frontend · uml"]
  - [Access rules, "composition · anatomy · matrix"]
  - [A weighed decision, "options · proscons · cvt"]
  - [A plan, "timeline · gantt · kanban · tracker"]
  - [A story or chart, "pyramid · quadrant · journey · stats · mece"]
note: The full grammar lives in .avodado/skill/SKILL.md.
```
