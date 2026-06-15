```meta
title: Avodado
subtitle: A roadmap for docs that stay ripe — typed blocks any agent can keep up to date in your repo.
tag: ROADMAP · v0.1
```

## The bet

Avodado treats the files on disk as the only source of truth. The CLI, the coding
agent, and the preview UI are all just editors and consumers of those files — none
of them owns state. Documentation is plain Markdown with typed YAML blocks, so it
reads fine with no tooling, diffs cleanly, and an LLM can edit one block surgically
instead of regenerating a whole page.

This very document is written in that format and rendered by the `avo` renderer.

```callout
tone: note
title: Build discipline
body: Each phase ships complete before the next begins. A working avo check and a
  live playground will teach you more about what to build next than any amount of
  up-front planning. Ten halves is the failure mode; three wholes is the goal.
```

## Phases

```timeline
items:
  - label: P0 — Core
    date: now
    status: current
    desc: parser + block schemas + the reference resolver
  - label: P1 — CLI
    date: next
    status: next
    desc: avo init / dev / check / new
  - label: P2 — Playground
    date: next
    status: next
    desc: hosted live renderer + shareable links
  - label: P3 — MCP + CI
    date: later
    status: future
    desc: avo MCP server + PR validation and visual diff
  - label: P4 — Theme + export
    date: later
    status: future
    desc: brand the whole block set + PDF/PNG + JSON schema for editors
  - label: P5 — VS Code + code-sync
    date: later
    status: future
    desc: inline preview + drift checks against schema and OpenAPI
  - label: P6 — Hosted agent
    date: future
    status: future
    desc: the eventual SaaS — generate docs online
```

## What is in flight

```kanban
columns:
  - label: Now
    cards:
      - { title: Core parser, tag: md → typed blocks }
      - { title: YAML + JSON dual parsing }
      - { title: Block schemas + validators }
      - { title: avo check, tag: validate + resolve refs }
      - { title: avo init scaffold }
  - label: Next
    cards:
      - { title: avo dev, tag: watch + hot reload }
      - { title: avo new, tag: templates + TUI picker }
      - { title: Hosted playground + share links }
      - { title: avo MCP server }
  - label: Later
    cards:
      - { title: PR visual diff in CI }
      - { title: avo theme, tag: brand all blocks }
      - { title: PDF + PNG export }
      - { title: VS Code extension }
      - { title: Code → doc drift checks }
      - { title: Hosted generation agent }
```

## Phase 0 — Core breakdown

```tracker
items:
  - { task: Markdown splitter (prose vs typed blocks), status: done, priority: high }
  - { task: YAML/JSON block parsing, status: done, priority: high }
  - { task: Block schema definitions, status: doing, priority: high }
  - { task: Reference resolver (doc#id graph), status: doing, priority: high }
  - { task: avo check command, status: todo, priority: high }
  - { task: Theme token plumbing for SVG, status: todo, priority: med }
  - { task: Node-level refs (block internals), status: todo, priority: low }
```

## Surfaces

Meet developers where they already are — terminal, browser, CI, editor, agent.

```table
columns: [Surface, What it does, Phase]
rows:
  - [CLI, Authoring + validation in the terminal, P1]
  - [Playground, Live web renderer + shareable links, P2]
  - [MCP server, Any agent reads + writes the doc model, P3]
  - [CI, Validate + visual diff on every PR, P3]
  - [VS Code, Inline preview + drag-to-nudge layout, P5]
  - [Hosted agent, Generate docs online (BYO optional), P6]
```

## North star

The blocks carry ids and reference each other by `doc#id`, so the doc set stops being
a pile of isolated diagrams and becomes a navigable, typed model of the system. An
agent can traverse it — *payments moved namespaces, update everything that references
it* — and CI can fail on a dangling reference. The beautiful document is a side effect
of a structured model that stays in sync.

```callout
tone: tip
title: The one decision to pin down first
body: The reference scheme. Repo-global human-readable ids, whole-block references for
  v1, node-level references later. Everything downstream depends on this fork.
```
