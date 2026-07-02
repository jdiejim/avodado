<p align="center">
  <img src="./avodado_logo.png" alt="Avodado" width="170" />
</p>

<h1 align="center">Avodado</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@avodado/cli"><img src="https://img.shields.io/npm/v/@avodado/cli?label=%40avodado%2Fcli&color=4f46e5" alt="npm" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="license" /></a>
  <a href="https://www.npmjs.com/package/@avodado/core"><img src="https://img.shields.io/npm/types/@avodado/core" alt="types" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/@avodado/cli" alt="node" /></a>
  <a href="https://pnpm.io"><img src="https://img.shields.io/badge/maintained%20with-pnpm-f69220" alt="pnpm" /></a>
</p>

**Documentation-as-code.** Plain Markdown with typed, fenced YAML blocks. The files on disk are the only source of truth — the CLI, any AI agent, an [MCP server](./packages/mcp), and any UI are all just editors and consumers of those files.

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
  - { from: Client, to: API, label: POST /orders, kind: sync }
  - { from: API, to: Client, label: 201 Created, kind: response }
```
````

Anywhere prose belongs, it's plain Markdown. Anywhere structure belongs (a diagram, a table, a user story, a chart), it's a fenced block whose info-string is the block type, with a YAML body.

## How it works

1. **Write** `docs/*.md` — normal Markdown, plus fenced blocks (` ```sequence `, ` ```erd `, ` ```table `…) for anything structured.
2. **Check** — `avo check` validates every block's schema and your `doc#id` cross-references, printing precise, fixable diagnostics (line, column, "did you mean?"). Gate CI on it.
3. **Render** — `avo html` / `avo preview` turn a doc into a styled, self-contained HTML page (6 themes, inline SVG diagrams, no runtime).

The `.md` files are the **source of truth**. Humans edit them in any editor; AI agents author them via the bundled skill (`avo init`) or the [MCP server](./packages/mcp). Same files, many editors.

## Quick start

```bash
pnpm add -D @avodado/cli              # or npm / yarn
pnpm exec avo demo                    # see it instantly — renders the showcase and opens it
pnpm exec avo tour                    # guided, hands-on walkthrough (7 short chapters)
pnpm exec avo init                    # scaffold docs/, config, skill, editor adapters
pnpm exec avo check                   # validate (exits non-zero on any error)
pnpm exec avo html docs/orders.md -o orders.html
pnpm exec avo pdf docs/orders.md      # → orders.pdf
```

`avo init` is an interactive wizard — it asks which AI tools you use and which theme you want, then scaffolds:

- `docs/getting-started.md` + `docs/tutorial.md` — an 80/20 quick start and a deck-first tour of every block (`avo slides docs/tutorial.md`)
- `.avodado/skill/SKILL.md` — the authoring skill (block grammar + worked examples for all 87 blocks)
- **editor adapters** for the tools you pick — Claude Code (`CLAUDE.md`), Cursor (`.cursor/rules/avodado.mdc`), GitHub Copilot (`.github/copilot-instructions.md`), Windsurf (`.windsurfrules`)
- `avodado.theme.json` when you choose a non-default or custom theme

…so any AI agent in your repo can author Avodado docs immediately. Pass `--yes` to skip the wizard and scaffold with defaults (handy in CI).

Using an AI tool **without** a repo-file convention — Microsoft 365 Copilot, a custom GPT, ChatGPT, Gemini? Run `avo skill` to print the whole authoring grammar as a copy-paste **system prompt** (it also lands on your clipboard); paste it into the tool's system / custom-instructions box.

## Use it from any AI client (MCP)

[`@avodado/mcp`](./packages/mcp) exposes the doc tooling — validate, render, block schemas, the authoring guide — over the Model Context Protocol:

```bash
claude mcp add avodado -- npx -y @avodado/mcp
```

```jsonc
// Claude Desktop / Cursor
{ "mcpServers": { "avodado": { "command": "npx", "args": ["-y", "@avodado/mcp"] } } }
```

`avo mcp` prints these snippets (and more) in the terminal; `avo mcp --stdio` starts the server directly.

## The 87 block types

| Family | Blocks |
|---|---|
| Document & meta | `meta` |
| Prose & structure | `prose` `callout` `glossary` `pullquote` `layers` `list` `figure` `faq` |
| Tables & metrics | `table` `stats` `slo` `code` `terminal` `gallery` `diff` |
| API reference | `endpoint` |
| Sequence & state | `sequence` `state` |
| Data model | `erd` |
| Architecture | `c4` `block` `infra` `event` `ddd` `network` `cluster` `archmap` |
| Code-flavoured | `felogic` `belogic` `frontend` `uml` `dag` `pattern` |
| Flow & process | `flow` `dfd` `swimlane` `steps` |
| Charts & overviews | `graph` `mece` `tree` `gantt` `pyramid` `quadrant` `journey` `chart` `waterfall` `heatmap` |
| Business & strategy | `swot` `funnel` `okr` `persona` |
| Design system | `palette` `typescale` `dodont` `inventory` |
| Algorithms & data structures | `array` `linkedlist` `bintree` `hashmap` |
| AI & agents | `agentloop` `trace` `prompt` `context` |
| Access control / RBAC | `matrix` `anatomy` `composition` |
| Presentation cards | `drivers` `options` `scorecard` `spec` `envelope` `team` |
| Planning & meta | `userstory` `stories` `timeline` `changelog` `kanban` `tracker` `risk` `cvt` `proscons` `agenda` |
| UI mockups | `wireframe` |

Full schemas with worked examples live in `.avodado/skill/SKILL.md`.

## Themes

Six built-in themes — pass via `renderDocument(doc, { theme })`, or set one with `avo theme`:

| Theme | Look |
|---|---|
| `textbook` | Warm classic (default) — cream paper, deep academic navy + terracotta, serif display & body, large headings |
| `minimal` | Clean modern — white, near-black ink, single blue accent, geometric sans |
| `soft` | Modern light — indigo accent, rounded surfaces, sans display |
| `dark` | Full dark mode |
| `teal` | Teal + amber highlight |
| `slate` | Slate sans — Helvetica display, teal highlight |

Themes override CSS variables on the `.docskin` root, so SVG diagrams retint along with the prose.

**Custom themes.** A theme file picks a base theme and overrides any friendly color (`primary`, `accent`, `ink`, `paper`, …) or font slot (`display`, `body`, `mono`). Install one **globally** with `avo theme install <path>` (lands in `~/.avodado/themes/`, usable in every project) or scaffold a blank one with `avo theme new <name>`. `avo theme` lists global + project themes together; `avo theme use <name>` activates it for the project, and `--global` makes it the default for **every** project (`~/.avodado/avodado.theme.json`, applied wherever a project has no theme of its own). No rebuild — just re-render.

## Cross-references (`doc#id`)

Any block may carry a top-level `id:`. Other blocks reference it as `doc#id` (or `#id` for the same document):

```userstory
id: US-142
role: shopper
want: pay in one step
soThat: I can complete my purchase quickly
links:
  - { ref: orders-api#seq-place-order, label: Request flow }
```

- Ids are **repo-global unique**. Duplicate id → `avo check` fails with both file/line locations.
- A `ref` pointing at an id that doesn't exist → `avo check` fails with the file, line, and the offending ref string.

CI gates on this naturally: `avo check` exits non-zero on any error.

## Packages

| Package | Purpose |
| --- | --- |
| [`@avodado/core`](./packages/core) | Parser, Zod block schemas (all 87 types), validation, reference resolver. Pure (no I/O). |
| [`@avodado/render`](./packages/render) | `renderDocument` (standalone HTML) + `renderDocumentParts` (embeddable). Inline CSS + SVG, 6 themes. |
| [`@avodado/export`](./packages/export) | `toHtml(doc)` + `toPdf(doc)` (Playwright headless Chromium). |
| [`@avodado/cli`](./packages/cli) | `avo` — `init / block / template / check / render / html / slides / pdf / preview / demo / catalog / design / skill / theme / sync` + per-tool installers. |
| [`@avodado/sync`](./packages/sync) | Generate Avodado docs from external sources (OpenAPI). |
| [`@avodado/mcp`](./packages/mcp) | Model Context Protocol server exposing the doc tooling to any MCP client. |

## CLI reference

**New here?** `avo demo` to see it · `avo tour` for a guided walkthrough · `avo init` to start a project · edit `docs/*.md` · `avo check` before every commit · `avo preview docs/x.md` to view.

Every command at a glance:

| Command | What it does |
|---|---|
| `avo init` | Scaffold a project — docs, config, skill, editor adapters (interactive; `--yes` for CI) |
| `avo check [globs]` | Validate docs — schemas, refs, duplicate ids (exits non-zero on errors; `--json`) |
| `avo preview <in>` | Render to a temp HTML file and open it |
| `avo serve` | Serve the docs site locally with live reload — rebuilds + reloads on save (`--port`, `--no-open`) |
| `avo build` | Build a static HTML site from all docs — index, sidebar nav, cross-doc links (`--out`) |
| `avo html / slides / pdf <in>` | Render one doc to HTML, a slide deck, or a PDF (`-p` opens, `-o` writes) |
| `avo demo [family] [-s]` | Render the built-in showcase — every block, or one family (`agentic`, `architecture`, …); bare `avo demo` in a terminal shows a picker (`-s` for slides) |
| `avo catalog [-p\|-s]` | List every block + description in the terminal, grouped by family (`-p` opens an HTML gallery, `-s` a deck) |
| `avo tour` | A guided, hands-on walkthrough — blocks, validation, previews, decks (7 short chapters) |
| `avo design [slug]` | Design-pattern library (106: system · AI/agent · code) — grab a template; `-p`/`-s` for the gallery |
| `avo block / template` | Scaffold a single block or a doc template |
| `avo skill` | Print the authoring grammar as a copy-paste system prompt |
| `avo theme [name]` | Pick / list / create / install the theme (installs global by default; `--global` to apply everywhere) |
| `avo sync openapi <spec>` | Generate an API doc from an OpenAPI spec |
| `avo install <tool>` | Install/update the skill + an AI-tool adapter (`claude` \| `cursor` \| `copilot` \| `windsurf`) |
| `avo mcp` | MCP client setup snippets; `avo mcp --stdio` runs the server (spawns `@avodado/mcp`) |

**Scaffold**

```
avo init                              # interactive wizard: docs/, config, skill, editor adapters
avo init --yes                        # …with defaults, no prompts (CI)
avo block list                        # list all 87 block types
avo block sequence                    # scaffold a doc around a sequence block → stdout
avo block sequence -o docs/orders.md  # …write it to a file
avo template list                     # list document templates (adr, design-doc, deck, …)
avo template adr -o docs/adr-001.md   # scaffold a doc from a document template
```

**Validate**

```
avo check                             # validate all docs (default: docs/**/*.md)
avo check docs/orders.md              # validate one file or glob
avo check --json                      # machine-readable diagnostics
```

**Render**

```
avo preview docs/orders.md            # render to a temp file and open it
avo serve                             # serve the whole docs site — live reload on save
avo build                             # build the static site (index + nav) → dist/
avo html  docs/orders.md [-p]         # one doc → HTML        (-p / --preview opens it)
avo slides docs/plan.md  [-p]         # one doc → slide deck  (one slide per #/## heading)
avo pdf   docs/plan.md   [-p]         # one doc → PDF
```

**Explore**

```
avo tour                              # guided, hands-on walkthrough (7 short chapters)
avo demo                              # render the built-in showcase (every block) and open it
avo demo agentic                      # …just one block family (agentic | architecture | flows | …)
avo demo -s                           # …as a slide deck (works with a family too)
avo catalog                           # list every block + description, grouped by family
avo catalog -p   [-s]                 # …open an HTML gallery of live samples (-s for a deck)
avo design                            # list design patterns (system · AI/agent · GoF)
avo design strategy                   # print a ready `pattern` + diagram template (copies to clipboard)
avo design rag -o docs/x.md           # …or scaffold it into a doc
avo design -p   [--system|--ai|--code] [-s]   # open the pattern gallery (HTML; -s for a deck)
```

**Author with AI**

```
avo skill                             # print the grammar as a system prompt (copies to clipboard)
avo skill -o avodado.md               # …or save it to a file   ·   avo skill --raw for the bare skill
avo install claude                    # install/update the skill + Claude Code adapter
avo install cursor                    # …Cursor  ·  avo install copilot  ·  avo install windsurf
```

**Themes & sync**

```
avo theme                       # interactive picker — built-ins + your saved themes (✓ marks the current)
avo theme list                  # list built-ins + saved themes (global + project, marked)
avo theme install ./my.theme.json   # validate + add a theme GLOBALLY (~/.avodado/themes) — usable in every project
avo theme install ./my.theme.json --local    # …or only this project (.avodado/themes)
avo theme use sunset            # set the project default (shorthand: avo theme sunset)
avo theme use sunset --global   # set the default for EVERY project (~/.avodado/avodado.theme.json)
avo theme new sunset [--global] # scaffold a new custom theme to fill in
avo theme use dark              # built-ins: textbook|minimal|soft|dark|teal|slate
avo sync openapi spec.yaml --out docs/api.md   # generate a doc from an OpenAPI spec
```

The one-doc shortcuts (`html`/`slides`/`pdf`) take `-o, --output <path>` to write a
specific file, or `-p, --preview` to render to a temp file and open it in your browser.

Exit codes: `0` clean · `1` errors present · `2` CLI usage error. Set `AVO_PLAIN=1` (or run in CI) to force plain output in a TTY.

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

PDF export needs Chromium. `avo pdf` **downloads it automatically on first use** (the matching build, ~100 MB, one time). To pre-install manually: `npx playwright install chromium`.

## License

[MIT](./LICENSE)
