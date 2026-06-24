```meta
title: Getting started with Avodado
subtitle: The 80/20 tour — what Avodado is, how a doc is built, and the handful of commands you'll use every day.
tag: GUIDE · START HERE
```

## What is Avodado?

Avodado is **documentation-as-code**: a doc is plain Markdown with typed, fenced
YAML blocks, and the `.md` file on disk is the single source of truth. Prose stays
prose; anything structured — a diagram, a table, a roadmap, a user story — goes in
a block that renders to clean HTML, slides, or PDF.

```callout
tone: tip
title: The one rule
body: "The .md file is the source of truth. Edit a block surgically — never regenerate a whole document — and run `avo check` until it passes. A passing check is the definition of done."
```

## Anatomy of a block

Every block is a fenced code block whose **info-string is the block type** and
whose **body is YAML**. Give a block an `id:` when you want to reference it; set a
`title:` so the rendered section reads like a document.

```code
blocks:
  - title: A sequence block
    lang: markdown
    code: |
      ```sequence
      id: seq-gs-checkout
      title: Place an order
      actors:
        - { id: Client, name: Client }
        - { id: API, name: Orders API }
      messages:
        - { from: Client, to: API, label: POST /orders, kind: sync }
        - { from: API, to: Client, label: 201 Created, kind: response }
      ```
```

That block renders as a real SVG sequence diagram — here it is live:

```sequence
id: seq-gs-checkout
title: Place an order
lede: Time runs downward. Solid arrows are calls; dashed are responses.
endpoint: { method: POST, path: /orders }
actors:
  - { id: Client, name: Client, sub: web / mobile }
  - { id: API, name: Orders API, sub: orders handler }
  - { id: DB, name: Postgres, sub: orders }
messages:
  - { from: Client, to: API, label: POST /orders, kind: sync }
  - { from: API, to: DB, label: INSERT order, kind: sync }
  - { from: DB, to: API, label: order_id, kind: response }
  - { from: API, to: Client, label: 201 Created, kind: response }
```

## The everyday workflow

Four steps, over and over: scaffold once, then edit → validate → render.

```flow
title: Author → validate → render
nodes:
  - { id: init, col: 1, row: 1, kind: start, label: avo init }
  - { id: edit, col: 2, row: 1, kind: process, label: Edit the .md }
  - { id: check, col: 3, row: 1, kind: decision, label: avo check passes? }
  - { id: render, col: 4, row: 1, kind: end, label: render / preview }
  - { id: fix, col: 3, row: 2, kind: process, label: Fix diagnostics }
edges:
  - { from: init, to: edit }
  - { from: edit, to: check }
  - { from: check, to: render, label: "yes" }
  - { from: check, to: fix, label: "no", kind: error }
  - { from: fix, to: edit }
```

## The CLI you'll actually use

```table
columns: [Command, What it does]
rows:
  - ["avo init", Scaffold a project + your AI-tool adapters (Claude / Cursor / Copilot / Windsurf)]
  - ["avo check [globs]", "Validate schemas, references, and duplicate ids — exits non-zero on errors"]
  - ["avo preview <file>", Render to a temp HTML file and open it in your browser]
  - ["avo html / slides / pdf <file>", Render one doc to a standalone HTML page, a slide deck, or a PDF]
  - ["avo export docs/**/*.md", Batch-export many docs to html / slides / pdf]
  - ["avo demo [format]", Render the built-in showcase of every block]
  - ["avo new / block / template", Scaffold a new doc, a single block, or a doc template]
  - ["avo prompt [name]", Copy a ready-to-paste authoring prompt for an AI agent]
  - ["avo skill", "Copy the authoring grammar as a system prompt — for Copilot / custom GPTs / any AI"]
  - ["avo theme [name]", Pick / list / install a document theme]
  - ["avo sync openapi <spec>", Generate an API doc straight from an OpenAPI file]
```

## A few blocks to get the feel

You compose a doc from **2–5 blocks, each a different lens**. A KPI strip:

```stats
stats:
  - { value: "52", label: Block types, trend: flat }
  - { value: "6", label: Built-in themes, trend: up }
  - { value: "3", label: Export formats, trend: flat }
```

A roadmap as a timeline:

```timeline
items:
  - { label: "Write your first doc", date: now, status: current, desc: "Edit this file, run avo check" }
  - { label: "Wire it into review", date: next, status: next, desc: "Run avo check in CI on every PR" }
  - { label: "Present it", date: later, status: future, desc: "avo slides turns headings into a deck" }
```

## Connect blocks with `doc#id`

Give a block an `id:`, then point at it as `doc#id` (or bare `#id` in the same
file). The only reference-bearing field today is `userstory.links[].ref`, and a
dangling reference fails `avo check` — so the model stays honest.

```userstory
id: US-1
role: new user
want: see how a cross-reference works
soThat: I can wire stories to the diagrams that satisfy them
priority: High
points: 2
criteria:
  - { given: I open this doc, when: I follow the link, then: I land on the request flow }
links:
  - { ref: "#seq-gs-checkout", mode: sequence, label: Request flow }
```

## Themes & slides

- **Themes.** Six built-ins (`textbook` · `minimal` · `soft` · `dark` · `teal` ·
  `slate`). Run `avo theme` to pick one, or `avo theme new <name>` to craft a
  custom one in `.avodado/themes/`. No rebuild — re-render and it's applied.
- **Slides.** Any doc is a deck: `avo slides <file>`. Each `#`/`##` heading starts
  a new slide and is its title; everything under it rides along. See the advanced
  tutorial (`docs/tutorial.md`) for a deck-first walkthrough of the whole feature
  set.

```callout
tone: note
title: Next steps
body: "Edit this file and run `avo check`. Then open `docs/tutorial.md` for the full feature tour, and read `.avodado/skill/SKILL.md` for the complete block grammar."
```
