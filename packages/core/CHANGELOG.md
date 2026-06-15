# @avodado/core

## 0.3.0

### Minor Changes

- Gap-filling blocks (inspired by replicating a rich design doc), bringing the catalog to **44**:
  - **`pullquote`** — a standout pull-quote with optional attribution.
  - **`layers`** — a layered explanation: N numbered layers, each with a kicker / title / source / question + body (e.g. an L1/L2/L3 model).
  - **`callout` gains a `success` tone** (green).
  - **`userstory` is richer** — optional `title` and `tags`, shown as a header with the points pill.

  All wired through the schema, renderer, `avo new` templates, and the authoring skill.

## 0.2.0

### Minor Changes

- Add a dedicated **`endpoint`** block — a Swagger-style API endpoint card. One block captures an HTTP operation: `method` + `path`, optional `title`/`description`/`auth`, `params` (path/query/header/cookie), request-`body` fields, `responses` (status + description + example), and optional `request`/`response` examples. Method and status codes are colour-coded. The block catalog is now 42 types; `avo new --type endpoint` scaffolds a starter, and the authoring skill documents it.

## 0.1.0

### Minor Changes

- - **Auto-layout for the coordinate diagrams.** `flow`/`dag`, `c4`, `state`, `dfd`, and `uml` no longer require `col`/`row` on every node — when coordinates are omitted, a clean layered grid is derived from the edges (dagre) so you can declare just nodes + relationships. Explicit `col`/`row` are still honored exactly (fully backward-compatible).
  - **ERD crow's-foot notation.** Relations now render proper crow's-foot ends (one / many) derived from `card`, and show the relation `label` on the edge. Added `N:1` to the `card` values (the common many-to-one shape).

## 0.0.2

### Patch Changes

- Replace the default theme with `minimal` — a clean, modern, Vercel-style look (white paper, near-black ink, a single `#0070f3` blue accent, geometric sans, subtle rounding). The `navy`/editorial theme is removed; `minimal` is now the default.

## 0.0.1

### Patch Changes

- aaa2610: Initial public release (0.0.1).
  - **@avodado/core** — parser, Zod schemas for all 41 block types, the typed block
    registry, document validator with precise diagnostics (line/column, did-you-mean,
    hints), and the cross-document reference resolver.
  - **@avodado/render** — `renderDocument` (standalone styled HTML) and
    `renderDocumentParts` (embeddable parts: CSS + body + sections) with inline SVG
    diagrams and 6 themes.
  - **@avodado/export** — HTML + PDF export (PDF via Playwright, optional).
  - **@avodado/cli** — the `avo` CLI: `init / new / check / render / preview / export /
sync`, with a code-frame diagnostics UI and the authoring skill scaffolder.
  - **@avodado/sync** — generate Avodado docs from external sources (OpenAPI).
  - **@avodado/mcp** — Model Context Protocol server exposing the doc tooling to any
    MCP client.
