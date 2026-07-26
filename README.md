<p align="center">
  <img src="./avodado_logo.png" alt="Avodado" width="170" />
</p>

<h1 align="center">Avodado</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/avodado"><img src="https://img.shields.io/npm/v/avodado?label=avodado&color=4f46e5" alt="npm" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="license" /></a>
  <a href="https://www.npmjs.com/package/@avodado/core"><img src="https://img.shields.io/npm/types/@avodado/core" alt="types" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/avodado" alt="node" /></a>
  <a href="https://pnpm.io"><img src="https://img.shields.io/badge/maintained%20with-pnpm-f69220" alt="pnpm" /></a>
</p>

<p align="center"><strong>Documentation-as-code.</strong> Write Markdown with typed, fenced YAML blocks — diagrams, tables, API references, decision records — and every block validates like code. Your AI agent authors it, <a href="#-edit-visually--avo-studio">Studio</a> edits it, and one command turns it into a themed website, a slide deck, or a PDF.</p>

---

**Your documentation has a schema.** Anywhere prose belongs, it's plain Markdown. Anywhere _structure_ belongs — a sequence diagram, an ERD, a table, a user story, a chart — it's a fenced block whose info-string is the block type, with a YAML body that validates against a strict schema:

````
docs/orders.md
─────────────
## Request flow

```sequence
id: seq-place-order
title: Place order
endpoint: { method: POST, path: /orders }
actors:
  - { id: Client, name: Client }
  - { id: API, name: Orders API }
messages:
  - Client -> API: POST /orders
  - API --> Client: 201 Created
```
````

`avo check` fails CI when a block is wrong — a bad field, a broken cross-reference, a duplicate id — with a precise, fixable diagnostic (line, column, "did you mean?"). The `.md` files on disk stay the **single source of truth**. The CLI, any AI agent, the [MCP server](./packages/mcp), and [Studio](#-edit-visually--avo-studio) are all just editors and consumers of those files.

## What you can document

One grammar covers the docs a software team actually writes:

| For… | Use blocks like |
|---|---|
| **API references** | `endpoint` · `table` · `sequence` · `code` |
| **Architecture & system design** | `c4` · `archmap` · `block` · `cluster` · `erd` · `dfd` |
| **Sequence & state** | `sequence` · `state` · `flow` · `swimlane` |
| **ADRs & decision records** | `drivers` · `options` · `scorecard` · `proscons` · `callout` |
| **Frontend & design systems** | `palette` · `typescale` · `dodont` · `wireframe` · `frontend` |
| **Planning & backlogs** | `userstory` · `kanban` · `timeline` · `gantt` · `risk` |
| **Charts & overviews** | `chart` · `stats` · `heatmap` · `quadrant` · `journey` |
| **Slide presentations** | any doc → `avo slides` (one slide per heading) |

Full list: **[79 block types](#the-79-block-types)** across 12 families.

## Quick start

```bash
pnpm add -D avodado             # or npm / yarn  ·  or run once: npx avodado demo

avo demo                        # see it instantly — renders the showcase and opens it
avo init                        # scaffold docs/, config, the AI skill, editor adapters
avo check                       # validate everything (exits non-zero on any error)
avo studio                      # open the visual editor — edit, preview, export
```

New here? `avo tour` is a guided, hands-on walkthrough in 7 short chapters.

---

# Recipes

## 🚀 Start a project — `avo init`

`avo init` is an interactive wizard. It asks which AI tools you use and which theme you want, then scaffolds a ready-to-go project:

```bash
avo init            # interactive
avo init --yes      # defaults, no prompts (great for CI)
```

You get:

- **`docs/getting-started.md` + `docs/tutorial.md`** — an 80/20 quick start and a deck-first tour of every block (`avo slides docs/tutorial.md`).
- **`.avodado/skill/SKILL.md`** — the authoring skill: the full block grammar with a worked example for all 79 blocks.
- **Editor adapters** for the tools you picked — Claude Code (`CLAUDE.md`), Cursor (`.cursor/rules/avodado.mdc`), GitHub Copilot (`.github/copilot-instructions.md`), Windsurf (`.windsurfrules`).
- **`avodado.theme.json`** if you chose a custom theme.

## 🤖 Write docs with AI — the skill + MCP

This is the point: **let your AI agent write the blocks for you.** After `avo init`, every AI tool in your repo already knows the grammar (that's what the adapters install), so you can just ask:

> "Document the checkout flow as a sequence diagram and add an ERD for the orders table."

Three ways to wire AI in:

```bash
# 1. In-repo agents (Claude Code, Cursor, Copilot, Windsurf) — installed by `avo init`,
#    or add/update one anytime:
avo install claude       # · cursor · copilot · windsurf

# 2. Any AI with no repo convention (ChatGPT, a custom GPT, Gemini, M365 Copilot):
avo skill                # prints the whole grammar as a system prompt (also copies to clipboard)
                         # → paste it into the tool's system / custom-instructions box

# 3. Any MCP client (Claude Desktop, Cursor) — the tooling as live tools:
claude mcp add avodado -- npx -y @avodado/mcp
```

The agent writes `docs/*.md`; you run `avo check` to keep it honest. Same files, many editors — see [`@avodado/mcp`](./packages/mcp).

## 🎨 Edit visually — `avo studio`

```bash
avo studio               # opens http://localhost:… (files stay the source of truth)
```

Studio is a local visual editor that opens on a **Home page** of your docs —
click a card and you're editing it in place (schema-aware forms or raw YAML,
live preview). **Present** (⇧⌘P) shows the current doc as slides, and **Site ↗**
opens the built docs site in its own tab.

Every edit writes straight back to the `.md` file (atomic, hash-guarded), so Studio, your editor, and your AI agent all stay in sync.

**Export, right from the toolbar.** The **Export** button turns the doc you're looking at — unsaved edits included — into a file:

| Button | Output |
|---|---|
| **HTML page** | A standalone, themed `.html` — inline CSS + SVG, no runtime. |
| **Slide deck (HTML)** | A self-contained `.slides.html` presentation. |
| **PDF** | A print-ready PDF (headless Chromium; downloaded once on first use). |
| **PowerPoint** | A real `.pptx` — every slide photographed at 2× as a full-bleed 16:9 image, titles as speaker notes. Add `--editable` for native text boxes, bullets, tables, code and charts (diagrams stay images). |

## 📄 Turn a doc into HTML, slides, a PDF, or a PowerPoint deck

The same exports from the CLI, for any doc:

```bash
avo html   docs/orders.md          # → orders.html   (standalone, themed)
avo slides docs/plan.md            # → plan.slides.html  (one slide per # / ## heading)
avo pdf    docs/plan.md            # → plan.pdf
avo pptx   docs/plan.md            # → plan.pptx  (real PowerPoint, slides as crisp images)
avo pptx   docs/plan.md --editable # → native text/tables/charts you can edit in PowerPoint
avo preview docs/orders.md         # render to a temp file and just open it
```

Add `-p` to open the result in your browser, or `-o <path>` to choose the filename.

## 🌐 Build a docs site — `avo build`

```bash
avo build                # → dist/ : index, sidebar nav, cross-doc links, Doc | Slides toggle
```

A static site from all your docs — deploy the folder anywhere.

## 🎭 Theme it — `avo theme`

Six built-in themes, and any doc retints instantly (SVG diagrams included):

| Theme | Look |
|---|---|
| `textbook` | Warm classic (default) — cream paper, academic navy + terracotta, serif |
| `minimal` | Clean modern — white, near-black ink, single blue accent |
| `soft` | Indigo accent, rounded surfaces, sans display |
| `dark` | Full dark mode |
| `teal` | Teal + amber highlight |
| `slate` | Slate sans — Helvetica display, teal highlight |

```bash
avo theme                        # interactive picker (✓ marks the current)
avo theme use dark               # set the project theme
avo theme new sunset             # scaffold a custom theme to fill in
avo theme install ./my.theme.json   # add a custom theme globally (usable in every project)
```

A custom theme picks a base and overrides any friendly color (`primary`, `accent`, `ink`, `paper`, …) or font slot (`display`, `body`, `mono`). No rebuild — just re-render.

## ✅ Validate — `avo check`

```bash
avo check                        # all docs (default: docs/**/*.md)
avo check docs/orders.md         # one file or glob
avo check --json                 # machine-readable diagnostics
```

Exits non-zero on any error, so it drops straight into CI. It catches bad fields, unknown block types, duplicate ids, and broken `doc#id` references — with the exact file, line, and a suggestion.

---

## The 79 block types

| Family | Blocks |
|---|---|
| Document & meta | `meta` |
| Prose & structure | `prose` `callout` `glossary` `pullquote` `layers` `list` `figure` `faq` `divider` `bignumber` `takeaways` |
| Tables & metrics | `table` `stats` `slo` `code` `gallery` `benchmark` |
| API reference | `endpoint` |
| Sequence & state | `sequence` `state` |
| Data model | `erd` |
| Architecture | `c4` `block` `cluster` `archmap` |
| Code-flavoured | `felogic` `frontend` `uml` `pattern` |
| Flow & process | `flow` `dfd` `swimlane` `steps` |
| Charts & overviews | `graph` `tree` `gantt` `pyramid` `quadrant` `journey` `chart` `heatmap` `sankey` |
| Business & strategy | `swot` `okr` `persona` |
| Design system | `palette` `typescale` `dodont` `inventory` |
| Algorithms & data structures | `array` `linkedlist` `bintree` `hashmap` |
| AI & agents | `agentloop` `trace` `prompt` `context` |
| Access control / RBAC | `matrix` `anatomy` `composition` |
| Presentation cards | `drivers` `options` `scorecard` `spec` `envelope` `team` |
| Planning & meta | `userstory` `stories` `timeline` `changelog` `kanban` `statustable` `risk` `cvt` `proscons` `agenda` |
| UI mockups | `wireframe` |

Some blocks fold former separate types into a variant — `block` takes `preset: infra | event | ddd | network`, `chart` takes `kind: waterfall | funnel`, `code` takes `kind: diff | terminal`, and so on. The 12 old names (`infra` `event` `ddd` `network` `belogic` `dag` `waterfall` `funnel` `diff` `terminal` `mece` `tracker`) stay **permanent aliases**: existing docs keep validating and rendering byte-for-byte, with only an informational `W_ALIAS_TYPE` warning. Full schemas with worked examples live in `.avodado/skill/SKILL.md`.

## Cross-references (`doc#id`)

Any block can carry a top-level `id:`; other blocks reference it as `doc#id` (or `#id` within the same document):

```userstory
id: US-142
role: shopper
want: pay in one step
soThat: I can complete my purchase quickly
links:
  - { ref: orders-api#seq-place-order, label: Request flow }
```

- Ids are **repo-global unique** — a duplicate fails `avo check` with both locations.
- A `ref` to an id that doesn't exist fails `avo check` with the file, line, and the offending ref.

CI gates on this for free.

## Packages

| Package | Purpose |
| --- | --- |
| [`@avodado/core`](./packages/core) | Parser, Zod block schemas (all 79 types + 12 permanent aliases), validation, reference resolver. Pure — no I/O. |
| [`@avodado/render`](./packages/render) | All rendering: `renderDocument` (standalone HTML) + `renderDocumentParts` (embeddable) + `toSlides` (self-contained decks). Inline CSS + SVG, 6 themes. |
| [`avodado`](./packages/cli) | The `avo` CLI (also runs as `avodado`) — `init · check · studio · build · html · slides · pdf · demo · catalog · design · tour · skill · theme · sync` + per-tool installers. PDF export (Playwright) lives here. |
| [`@avodado/studio`](./packages/studio) | The local visual editor served by `avo studio` — a Home page of your docs, in-place editing, Present, plus HTML / slides / PDF export. |
| [`@avodado/mcp`](./packages/mcp) | Model Context Protocol server exposing the doc tooling to any MCP client. |

## Full CLI reference

<details>
<summary><strong>Every command at a glance</strong></summary>

| Command | What it does |
|---|---|
| `avo init` | Scaffold a project — docs, config, skill, editor adapters (interactive; `--yes` for CI) |
| `avo check [globs]` | Validate docs — schemas, refs, duplicate ids (exits non-zero on errors; `--json`) |
| `avo preview <in>` | Render to a temp HTML file and open it |
| `avo studio` | The local editor — a **Home** page of your docs, edit in place, **Present** as slides, **Export** HTML/slides/PDF, built site one click away (`--port`, `--no-open`) |
| `avo build` | Build a static HTML site from all docs — index, sidebar nav, cross-doc links (`--out`) |
| `avo html / slides / pdf <in>` | Render one doc to HTML, a slide deck, or a PDF (`-p` opens, `-o` writes) |
| `avo demo [family] [-s]` | Render the built-in showcase — every block, or one family; bare `avo demo` shows a picker (`-s` for slides) |
| `avo catalog [-p\|-s]` | List every block + description, grouped by family (`-p` HTML gallery, `-s` a deck) |
| `avo tour` | Guided, hands-on walkthrough (7 short chapters) |
| `avo design [slug]` | Design-pattern library (system · AI/agent · code) — grab a template; `-p`/`-s` for the gallery |
| `avo block / template` | Scaffold a single block or a doc template |
| `avo skill` | Print the authoring grammar as a copy-paste system prompt |
| `avo theme [name]` | Pick / list / create / install a theme (`--global` to apply everywhere) |
| `avo sync openapi <spec>` | Generate an API doc from an OpenAPI spec |
| `avo sync csv <file>` | Turn a CSV into a `table`/`statustable`/`chart` block, or a whole doc with `--out` |
| `avo install <tool>` | Install/update the skill + an AI-tool adapter (`claude` \| `cursor` \| `copilot` \| `windsurf`) |
| `avo mcp` | MCP client setup snippets; `avo mcp --stdio` runs the server |

Exit codes: `0` clean · `1` errors present · `2` CLI usage error. Set `AVO_PLAIN=1` (or run in CI) to force plain output in a TTY.

</details>

## Architecture, in one paragraph

`@avodado/core` parses Markdown into segments (prose or typed blocks). The **block registry** in core is a `Record<BlockType, BlockDef>` — adding a block type requires updating the schema and every rendering registry in lock-step (omitting one is a compile error). The renderer turns a Document into HTML via a parallel `Record<BlockType, (data) => string>` map; export wraps render with a PDF path; the CLI wires it together with I/O; the MCP server exposes it to agents. Dependencies always point inward to `core`; only the CLI throws and sets exit codes. See [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Development

```bash
pnpm install
pnpm typecheck      # all packages
pnpm test           # vitest across all packages
pnpm lint           # ESLint + typescript-eslint
pnpm build          # tsup, ESM
```

PDF and PowerPoint export need Chromium. `avo pdf` / `avo pptx` (and Studio's PDF/PowerPoint export) **downloads it automatically on first use** (the matching build, ~100 MB, one time). To pre-install: `npx playwright install chromium`.

## License

[MIT](./LICENSE)
