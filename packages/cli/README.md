# avodado

**Documentation-as-code.** Write docs as plain Markdown with typed, fenced YAML blocks — diagrams, tables, API references, decision records — and `avo` validates them like code, renders them to HTML, slides, or PDF, and lets you edit them in a visual studio. The `.md` files on disk stay the single source of truth.

`avo` is the command-line tool. It shows a friendly interactive UI in your terminal, and plain text output in CI.

## Install

```bash
pnpm add -D avodado      # or: npm i -D avodado  ·  yarn add -D avodado
```

The command is available as both `avo` (short) and `avodado`. Try it with no install: `npx avodado demo`.

> Previously published as `@avodado/cli` — now **`avodado`**. Same tool; update your dependency.

## Quick example

A doc is normal Markdown, plus fenced blocks for anything structured. Put this in `docs/orders.md`:

````markdown
## Checkout flow

```sequence
title: Place an order
actors:
  - { id: user, name: Shopper }
  - { id: api, name: Orders API }
messages:
  - user -> api: POST /orders
  - api --> user: 201 Created
```
````

Then run:

```bash
avo check docs/orders.md      # validates every block against its schema
avo html  docs/orders.md -p   # renders a styled HTML page and opens it
avo slides docs/orders.md -p  # …or a slide deck   ·   avo pdf docs/orders.md  → a PDF
avo studio                    # edit visually — forms + live preview
```

`avo check` prints the exact file, line, and a fix when something's wrong (a bad field, a broken link, a duplicate id), and exits non-zero — so it drops straight into CI.

## Get started on a real project

```bash
avo demo        # see it instantly — renders a showcase of every block and opens it
avo init        # scaffold docs/ and avodado.config.json
avo block       # every block type on one line; avo block <type> for fields + example
```

## Let your AI write the docs

Install the authoring skill into your agent once, then ask it to "document the checkout flow as a sequence diagram." The agent looks blocks up with `avo block <type>` and validates with `avo check`.

```bash
npx skills add jdiejim/avodado -g   # Claude Code, Cursor, Codex, OpenCode, Copilot, and 70+ agents
avo skill                            # print the whole skill as one document (paste into ChatGPT / any AI)
avo mcp                              # setup for Model Context Protocol clients (@avodado/mcp)
```

## Common commands

```bash
avo check [globs]                 # validate docs (default: docs/**/*.md; --json for machine output)
avo html | slides | pdf <file>    # render one doc (-p opens it, -o writes to a path)
avo build                         # build a static HTML site from all docs → dist/
avo studio                        # local visual editor: edit, browse the site, present as slides
avo new <template|block>          # scaffold a doc (adr, runbook…) or a single block (sequence, erd…)
avo sync openapi <spec>           # generate an API doc from an OpenAPI spec
avo sync csv <file>               # turn a CSV into a table / chart block
avo sync sql|dbml|prisma <file>   # turn a database schema into an erd block
```

Run `avo --help` (or `avo <command> --help`) for everything.

## Exit codes (for CI)

| Code | Meaning |
| --- | --- |
| `0` | Clean (or warnings only) |
| `1` | One or more errors — `avo check` failed |
| `2` | Usage error (e.g. a missing flag) |

Set `AVO_PLAIN=1` to force plain text output even in a terminal.

## Configuration

Optional `avodado.config.{json,ts,js,mjs,yml,yaml}` in your project root. Defaults:

```json
{ "docsDir": "docs", "outDir": "dist" }
```

## Learn more

Full docs and the block reference: **[avodado.dev](https://avodado.dev)**.
