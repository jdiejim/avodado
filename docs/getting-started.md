```meta
title: Getting started
subtitle: Your first Avodado document — replace this with whatever you need to capture.
tag: GUIDE · v0.1
```

## What is this?

This file is your first Avodado document. It is plain Markdown plus typed,
fenced YAML blocks. Prose stays as prose; anything structured goes in a block.

Open this file in your editor and edit it like normal. Run `avo check` after
edits to validate the schemas and references.

```callout
tone: tip
title: The one rule
body: The .md file on disk is the source of truth. Edit a block surgically;
  do not regenerate the whole document. Run avo check and fix every diagnostic
  before finishing a change.
```

## A few example blocks

```timeline
items:
  - label: P0 — Stand up the docs
    date: today
    status: current
    desc: Run avo check and fix any diagnostics
  - label: P1 — Add the first feature
    date: this week
    status: next
    desc: One feature with a userstory block
  - label: P2 — Wire CI
    date: later
    status: future
    desc: Run avo check on every PR
```

```table
columns: [Block, What it captures]
rows:
  - [meta, Document title and subtitle]
  - [callout, Note / tip / warn / danger]
  - [table, Tabular data]
  - [sequence, Interaction over time (SVG diagram)]
  - [erd, Entities and relations (SVG diagram)]
  - [userstory, Agile story + acceptance criteria + links]
  - [timeline, Phases or milestones]
  - [kanban, Now / next / later board]
  - [tracker, Task list with status + priority]
```

## What next

- Edit this file and run `avo check`.
- Run `avo render docs/getting-started.md -o out.html` and open the result.
- Read `.avodado/skill/SKILL.md` for the full grammar.
