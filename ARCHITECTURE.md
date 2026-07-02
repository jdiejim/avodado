# Architecture

Avodado is a documentation-as-code system. A four-package monorepo where dependencies always point inward toward a pure `@avodado/core`. **87 block types** ported from `resources/doc-studio.jsx`, each with a zod schema, a typed renderer entry, and (where applicable) shared layout / SVG utilities.

## Guiding principle

**The files on disk are the only source of truth.** The CLI, agents, and any future UI are editors and consumers of those files; none owns state. The core library turns files into a validated in-memory model with a reference graph; everything else consumes that model.

## Layering

```
@avodado/core   ← pure: parse, schemas (37), validate, resolve. No I/O.
@avodado/render ← @avodado/core. HTML string out. No DOM, no browser. Theme support.
@avodado/export ← @avodado/core, @avodado/render. HTML + PDF (Playwright).
@avodado/cli    ← @avodado/{core, render, export}. Ink TUI. Owns process.exit.
```

Rules:

- `@avodado/core` does **no I/O**: no file system, no network, no `process`, no DOM. It reads strings and returns models and diagnostics.
- All I/O lives in the **outer rings** (`cli`, `export`).
- Libraries **return diagnostics** as values. They don't `throw` for expected conditions (parse errors, schema violations, dangling refs). The CLI is the only layer that maps diagnostics to console output and exit codes.

## The block registry

The block registry in `@avodado/core` is the architectural backbone:

```ts
export const blockSchemas = {
  meta, callout, table, sequence, erd, userstory, timeline, kanban, tracker,
  prose, glossary, proscons, cvt, stats, code, agenda, tree, pyramid, funnel,
  flow, state, dfd, journey, gantt, graph, quadrant, swimlane,
  c4, uml, mece, frontend, cluster,
  block, infra, event, ddd, network, felogic, belogic, dag,
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

## Block families

Block types are grouped by visual purpose, but the runtime treats them all uniformly through the registry:

| Family | Blocks | Notes |
| --- | --- | --- |
| Document & meta | `meta` | First block only; produces the cover |
| Prose & structure | `prose` `callout` `glossary` | Pure HTML |
| Tables & metrics | `table` `stats` `code` | Pure HTML; `code` does light syntax highlighting |
| Sequence & state | `sequence` `state` | SVG diagrams; `sequence` has rich step list + footer; `state` adds a transition table |
| Data model | `erd` | SVG with PK/FK markers + cardinality pills |
| Architecture | `c4` `block` `infra` `event` `ddd` `network` `cluster` | `block`/`infra`/`event`/`ddd`/`network` share a single render engine (grid or layered); `cluster` has its own nested-box engine; `c4` has its own kind-coloured layout |
| Code-flavoured | `felogic` `belogic` `frontend` `uml` `dag` | `felogic` + `belogic` share an engine (design-pattern node kinds); `frontend` is a top-down component tree; `uml` has class compartments; `dag` reuses the `flow` renderer with a different tag |
| Flow & process | `flow` `dfd` `swimlane` | SVG with orthogonal edge routing |
| Charts & overviews | `graph` `mece` `tree` `gantt` `funnel` `pyramid` `quadrant` `journey` | Mix of SVG and HTML; `tree` is HTML, the rest are SVG |
| Planning & meta | `userstory` `timeline` `kanban` `tracker` `cvt` `proscons` `agenda` | Pure HTML |

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

Four built-in themes (navy / teal / plum / slate). Switching is purely a CSS-variable override applied via `style="…"` on the `.docskin` root — no per-block code changes, no SVG regeneration. Adding a theme means adding one entry to `packages/render/src/themes.ts`.

## Reference scheme

- Any block may carry an `id` (a human-readable slug). Ids are **repo-global unique**.
- A reference is `doc#id` (absolute) or `#id` (within the current document). `doc` is the slug — the path under the docs root, stripped of `.md`.
- In v1 the only reference-bearing field is `userstory.links[].ref`. The `extractRefs` function in the block's registry entry is the single line wiring this. Extending another block to carry references is a one-line addition to its `BlockDef`.
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

Uniform shape: `{ file, line?, level, code, message, value? }`.

## TTY-awareness in the CLI

Pure functions do the work and return `{ diagnostics, exitCode }`. The UI layer just formats:

- **TTY interactive** → Ink renders a colored diagnostics table.
- **Non-TTY / CI / `AVO_PLAIN=1`** → plain `file:line  level  code  message — value` lines.
- **`--json` on `check`** → JSON to stdout; Ink is bypassed entirely.

The top-level always `process.exit(code)` after `waitUntilExit()`.

## Seams left for post-v1

The 37-block renderer is complete. The following are clean extension points, not "TODO" stubs:

- **`@avodado/react`** — React component wrapping the HTML renderer. Dropped from v1 per design choice. To add: a new workspace package depending on `core` + `render`, exporting a single `<AvodadoDocument>` that uses `dangerouslySetInnerHTML`.
- **`@avodado/mcp`** — Model Context Protocol server. The reference graph from `resolveRefs` is the natural data source; tools like `list_docs`, `get_block`, `write_block`, `resolve_refs`.
- **Playground / hosted preview** — web app embedding the renderer with live editing. The renderer is browser-safe (no Node-only APIs).
- **VS Code extension** — inline preview + drag-to-nudge layout write-back.
- **Code↔doc drift sync** — import OpenAPI/SQL and flag mismatches against `erd` / `sequence` blocks.
- **Node-level references** — refs into a block's internals (e.g. `doc#id::field`). The current resolver targets whole blocks only; the `REF_RE` regex and `RefGraph` shape would extend cleanly.
- **Visual diff in CI** — snapshot rendered HTML on PRs and surface changes. SVG geometry is already deterministic, so this is a build-then-compare step.

## Tooling

| | |
| --- | --- |
| Workspace | pnpm |
| Build | tsup (ESM) |
| Tests | Vitest — 116 tests covering core + render + cli |
| Lint | ESLint flat config + typescript-eslint |
| Format | Prettier |
| Release | Changesets |
| CI | GitHub Actions (lint → typecheck → build → playwright install → test) |

Strict TypeScript: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`. No `any` in public APIs.
