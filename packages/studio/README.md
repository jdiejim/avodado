# @avodado/studio

Avodado Studio — a full-screen local visual editor for Avodado docs (Markdown +
typed YAML blocks). The files on disk stay the single source of truth: the
studio reads and writes them through the CLI's JSON file bridge, and all
parsing, validation, and rendering happens in the browser via `@avodado/core`
and `@avodado/render`.

## Usage

Run it from an Avodado project:

```sh
avo studio
```

The CLI serves the built app (from this package's `dist/app/`) together with
the file-bridge API (`/api/*` + `/__events` SSE) and opens the browser.

## Editing model

Authoring is keyboard-first, directly on the rendered doc:

- **Click** selects — a block on the canvas, or a part inside a rendered
  block (a sequence message, a diagram node, a table cell).
- **Enter** (or double-click) edits the selection: a block opens the edit
  sheet — a schema-generated form with smart per-field controls, plus a raw
  YAML tab — while a diagram part opens an in-place micro-editor for exactly
  that YAML value.
- **Arrow keys** move the selected part — grid cells for diagram nodes,
  reorder for list items, cell navigation on table cells; ⌥+arrows nudge the
  hovered part, ⌫ deletes an item, Tab cycles parts, Esc pops back out.
- **Drag** moves parts on the diagram itself — block-graph nodes snap to
  grid cells, order-based lists reorder with a live insertion indicator.
- **Insert** via the `+` menu (a searchable gallery of every insertable
  block with live-rendered thumbnails) or the `/` slash command; `?` shows
  the full shortcut list.

Edits are written back as surgical rewrites of individual fenced blocks, and
outside changes to the same files (e.g. by an AI agent) repaint live over SSE.

## Development

```sh
# terminal 1 — the file-bridge API on 127.0.0.1:4174 (avo studio --no-open, or a mock)
# terminal 2 — the app with hot reload; /api and /__events proxy to :4174
pnpm --filter @avodado/studio dev
```

`pnpm --filter @avodado/studio build` produces:

- `dist/app/` — the static app (Vite build), and
- `dist/index.js` + `dist/index.d.ts` — a tiny Node entry exporting
  `assetsPath()` so the CLI can locate `dist/app/`.
