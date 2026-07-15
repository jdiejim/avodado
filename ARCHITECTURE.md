# Architecture

Avodado is a documentation-as-code system. A pnpm monorepo of five published packages — `@avodado/core`, `render`, `studio`, `mcp`, `cli` — plus one private workspace package (`@avodado/website`, the hosted site), where dependencies always point inward toward a pure `@avodado/core`. **76 canonical block types** (plus 12 permanent aliases for merged old names) ported from `resources/doc-studio.jsx`, each with a zod schema, a typed renderer entry, and (where applicable) shared layout / SVG utilities.

## Guiding principle

**The files on disk are the only source of truth.** The CLI, agents, and any future UI are editors and consumers of those files; none owns state. The core library turns files into a validated in-memory model with a reference graph; everything else consumes that model.

## Layering

```
@avodado/core   ← pure: parse, schemas (76 + aliases), validate, resolve, edit ops. No I/O.
@avodado/render ← @avodado/core. HTML + slide decks out. No DOM, no browser. Theme support.
@avodado/studio ← @avodado/{core, render}. Browser SPA (Vite/React), ships built static assets.
@avodado/mcp    ← @avodado/{core, render}. MCP server over stdio.
@avodado/cli    ← @avodado/{core, render, studio}. Ink TUI. PDF (Playwright) + sync I/O (OpenAPI, CSV). Owns process.exit.
```

One private workspace package sits outside the published graph: `@avodado/website` (avodado.dev — a hosted Next.js app with its own toolchain).

Rules:

- `@avodado/core` does **no I/O**: no file system, no network, no `process`, no DOM. It reads strings and returns models and diagnostics.
- All I/O lives in the **outer ring** (`cli`) — including PDF export (Playwright, an optional dependency imported lazily) and the file reads/writes behind `avo sync openapi` / `avo sync csv`. The importers themselves (OpenAPI → markdown, CSV → block fences, `core/src/import/`) are pure and live in `core`, so the studio and MCP server share them.
- Libraries **return diagnostics** as values. They don't `throw` for expected conditions (parse errors, schema violations, dangling refs). The CLI is the only layer that maps diagnostics to console output and exit codes.
- `@avodado/studio` is an outermost consumer of `core` + `render` only (never the CLI's Node/Playwright-bound PDF code). The whole parse → validate → render pipeline runs client-side in the browser; the published package contains only built static assets plus a tiny Node entry (`assetsPath()`) the CLI uses to serve them. The `avo studio` server is a **file bridge** — JSON read/write API + SSE change events, bound to `127.0.0.1` — and never renders. Editing goes through core's surgical edit ops (`replaceBlockBody`, `insertBlock`, `setYamlPath`, …) — including direct on-diagram interactions (click to select a part, Enter to edit it, arrow keys or drag to move it), which compile down to the same ops — so a studio session rewrites individual fenced blocks in place and the files on disk stay the single source of truth.

## The block registry

The block registry in `@avodado/core` is the architectural backbone:

```ts
export const blockSchemas = {
  meta, callout, table, sequence, erd, userstory, timeline, kanban, statustable,
  // … one entry per block type — 76 in total, across 12 families.
  // The full list is `BLOCK_TYPES` in `core/src/types.ts`.
} as const satisfies Record<BlockType, ZodTypeAny>;

export type BlockDataMap = { [K in BlockType]: z.infer<(typeof blockSchemas)[K]> };

export interface BlockDef<K extends BlockType> {
  readonly type: K;
  readonly schema: (typeof blockSchemas)[K];
  readonly extractRefs?: (data: BlockDataMap[K]) => readonly string[];
}

export type BlockRegistry = { readonly [K in BlockType]: BlockDef<K> };
```

The same `Record<BlockType, …>` pattern propagates to every rendering target — for instance, `@avodado/render` defines `HtmlRendererRegistry = { [K in BlockType]: (data: BlockDataMap[K]) => string }`. Adding a new block type in `core` is a one-line change to `BLOCK_TYPES`, and `tsc` then immediately surfaces every registry that hasn't been extended.

This is intentional: there's exactly one place to add a block (its schema), and the type system makes us update every consumer. No scattered switch statements, no runtime `default: throw new Error('unknown block')` clauses to keep in sync.

## Block aliases

Twelve former block types merged into canonical ones (`infra`/`event`/`ddd`/`network` → `block` + `preset`, `belogic` → `felogic` + `variant: be`, `dag` → `flow` + `variant: dag`, `waterfall`/`funnel` → `chart` + `kind`, `diff`/`terminal` → `code` + `kind`, `mece` → `tree` + `variant: issue`, `tracker` → `statustable` + `variant: tracker`). The old spellings are **permanent aliases**, defined once in `core/src/blocks/aliases.ts` (`BLOCK_ALIASES`, with the derived `BLOCK_SYNONYMS` for search/insert UIs):

- The **splitter** recognises an alias fence and records the tag as written in the segment's `sourceType`; the segment's `kind` is always canonical.
- The **parser** shallow-merges the alias `patch` (e.g. `{ kind: 'waterfall' }`) into the parsed body — only for keys the body doesn't set, so the body always wins.
- **Rendering** is byte-identical to the pre-merge output (pinned parity fixtures); the SECTION eyebrow uses the alias's historical label via `sourceType`.
- **Validation** surfaces the mapping as a `W_ALIAS_TYPE` warning — informational; warnings never fail `avo check`.
- **Editing stays faithful**: edit ops never rewrite fence lines, so aliased fences survive studio editing byte-for-byte; new insertions always write canonical names.

## Block families

Block types are grouped into 12 families (`BLOCK_FAMILIES` / `BLOCK_FAMILY` in the core catalog), but the runtime treats them all uniformly through the registry:

| Family | Blocks |
| --- | --- |
| Narrative & prose (9) | `meta` `callout` `prose` `glossary` `figure` `faq` `divider` `bignumber` `takeaways` |
| Tables & code (4) | `table` `stats` `code` `slo` |
| API (3) | `endpoint` `pullquote` `layers` |
| Architecture (7) | `c4` `uml` `frontend` `cluster` `block` `felogic` `archmap` |
| Flows & state (6) | `sequence` `flow` `state` `dfd` `swimlane` `steps` |
| Data model (1) | `erd` |
| Charts & overviews (8) | `tree` `pyramid` `journey` `gantt` `graph` `quadrant` `chart` `heatmap` |
| Planning & backlogs (13) | `userstory` `timeline` `kanban` `proscons` `cvt` `agenda` `list` `stories` `pattern` `gallery` `changelog` `risk` `statustable` |
| Business & decisions (12) | `matrix` `anatomy` `composition` `drivers` `options` `spec` `envelope` `swot` `okr` `persona` `team` `scorecard` |
| Design system (5) | `wireframe` `palette` `typescale` `dodont` `inventory` |
| Algorithms (4) | `array` `linkedlist` `bintree` `hashmap` |
| AI & agents (4) | `agentloop` `trace` `prompt` `context` |

## Renderer fidelity

`@avodado/render` is a faithful TypeScript port of `resources/doc-studio.jsx`:

- The house CSS (`packages/render/src/css.ts`) is the verbatim doc-studio stylesheet, namespaced under `.docskin`.
- Each block renderer matches the JSX component's DOM signature (class names, element structure, geometry constants).
- SVG diagrams use integer-only coordinates so snapshots are byte-deterministic.
- Diagrams are wrapped in a `<div class="diagram">` frame with a colour-coded tag pill (e.g. `POST`, `C4`, `SEQUENCE`) and optional title / description / figure number.
- Each typed block is wrapped in a `.section-block` with a `SECTION NN · LABEL` eyebrow, matching `resources/sample-orders-api.html`.

Shared SVG utilities live under `packages/render/src/svg/`:

| Utility | Purpose |
| --- | --- |
| `globalDefsSvg()` | Emits the shared `<defs>` (markers + drop-shadow filter) once at the top of every document |
| `ortho(A, B)` | Manhattan / orthogonal edge routing |
| `wrapText(t, max, lines)` | Word-aware line wrapping for diagram labels |
| `edgePill(p, label, err?)` | Rounded edge-label background |
| `blockStyle(kind)` | Maps service `kind` → `{accent, fill, text}` |
| `nodeGlyph(kind, x, y, c)` | Returns small SVG glyph (database cylinder, queue bars, function ƒ, …) |
| `GEDGE` | Per-kind edge stroke style table (`solid`/`dashed`/`forbidden`/`error`) |

## Theme system

Six built-in themes (`textbook` — the default — plus `minimal` / `teal` / `slate` / `dark` / `soft`). Switching is purely a CSS-variable override applied via `style="…"` on the `.docskin` root — no per-block code changes, no SVG regeneration. Adding a theme means adding one entry to `packages/render/src/themes.ts`.

## Reference scheme

- Any block may carry an `id` (a human-readable slug). Ids are **repo-global unique**.
- A reference is `doc#id` (absolute) or `#id` (within the current document). `doc` is the slug — the path under the docs root, stripped of `.md`.
- Two block types carry references today: `userstory` (`links[].ref`) and `stories` (`items[].links[].ref`). The `extractRefs` function in each block's registry entry is the single place wiring this. Extending another block to carry references is a small addition to its `BlockDef`.
- The resolver builds `{ id → { doc, block } }` and `{ from, to }` edges across all docs and emits diagnostics for **duplicate ids** and **dangling refs**, each with file + line + offending value.

## Diagnostic taxonomy

Stable codes that the CLI can sort, filter, and format:

| Code | Level | When |
| --- | --- | --- |
| `E_PARSE_YAML` | error | YAML body failed to parse |
| `E_SCHEMA` | error | Zod validation issue |
| `E_DUP_ID` | error | Same id used twice |
| `E_DANGLING_REF` | error | Ref target not found |
| `E_BAD_REF_FORMAT` | error | Ref doesn't match `doc#id` or `#id` |
| `E_UNKNOWN_BLOCK` | error | Defensive (splitter should prevent) |
| `W_EMPTY_BLOCK` | warn | Typed block with empty body |
| `W_SUSPECT_BLOCK` | warn | Fence tag looks like a typo of a real block type (rendered as plain text; carries a did-you-mean suggestion) |
| `W_ALIAS_TYPE` | warn | Fence uses one of the 12 permanent alias names (e.g. `waterfall`) — parsed and rendered as its canonical type; informational only |
| `W_DUP_HEADING` | warn | Markdown heading nearly duplicated by the following block's `title` (renders as two stacked headings) |

Uniform shape: `{ file, line?, level, code, message, value? }`.

## TTY-awareness in the CLI

Pure functions do the work and return `{ diagnostics, exitCode }`. The UI layer just formats:

- **TTY interactive** → Ink renders a colored diagnostics table.
- **Non-TTY / CI / `AVO_PLAIN=1`** → plain `file:line  level  code  message — value` lines.
- **`--json` on `check`** → JSON to stdout; Ink is bypassed entirely.

The top-level always `process.exit(code)` after `waitUntilExit()`.

## Shipped seams and remaining extension points

The 76-block renderer is complete. Several of the original post-v1 seams have since shipped as workspace packages:

- **`@avodado/mcp`** — Model Context Protocol server (published). Tools: `check_document`, `render_document`, `list_block_types`, `get_block_schema`, `resolve_refs`, `sync_openapi`, `get_authoring_guide`. The OpenAPI generator it uses comes straight from `@avodado/core` (`core/src/import/openapi/`) — no vendored copies.
- **`@avodado/studio`** — the visual editor served by `avo studio` (see the layering rules above).
- **Importers** — `packages/core/src/import/`: pure external-source importers (OpenAPI → whole docs, CSV → `table`/`statustable`/`chart` fences) plus the small importer registry (`IMPORTERS` / `importerForFile`). Exposed as `avo sync openapi` / `avo sync csv`, the MCP `sync_openapi` tool, and the studio’s drag-drop / “Import…” flow.

Still clean extension points, not "TODO" stubs:

- **`@avodado/react`** — React component wrapping the HTML renderer. Dropped from v1 per design choice. To add: a new workspace package depending on `core` + `render`, exporting a single `<AvodadoDocument>` that uses `dangerouslySetInnerHTML`.
- **Node-level references** — refs into a block's internals (e.g. `doc#id::field`). The current resolver targets whole blocks only; the `REF_RE` regex and `RefGraph` shape would extend cleanly.
- **Visual diff in CI** — snapshot rendered HTML on PRs and surface changes. SVG geometry is already deterministic, so this is a build-then-compare step.

## Tooling

| | |
| --- | --- |
| Workspace | pnpm |
| Build | tsup (ESM) |
| Tests | Vitest — 690+ tests across core, render, studio, mcp, and the CLI |
| Lint | ESLint flat config + typescript-eslint |
| Format | Prettier |
| Release | Changesets |
| CI | GitHub Actions (lint → typecheck → build → playwright install → test) |

Strict TypeScript: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`. No `any` in public APIs.
