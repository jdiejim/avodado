# @avodado/render

## 0.0.2

### Patch Changes

- Replace the default theme with `minimal` — a clean, modern, Vercel-style look (white paper, near-black ink, a single `#0070f3` blue accent, geometric sans, subtle rounding). The `navy`/editorial theme is removed; `minimal` is now the default.
- Updated dependencies
  - @avodado/core@0.0.2

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

- Updated dependencies [aaa2610]
  - @avodado/core@0.0.1
