# @avodado/cli

## 0.2.9

### Patch Changes

- Zone/container styling for `infra`, `network`, `block`, `event`, `ddd` is more elegant: the group boundaries lose their tinted background and solid label badges in favour of a clean dashed outline with a plain top-left label (matching the `felogic`/`belogic` look), and the containers + overall diagram get noticeably more padding so nodes and connections breathe.
- Updated dependencies
  - @avodado/render@0.2.6
  - @avodado/export@0.0.12

## 0.2.8

### Patch Changes

- - **Square-left accent cards everywhere.** The remaining diagram blocks with a left accent stripe — `cluster`, `frontend`, `mece` — now use the same flush square-left corner as the others, so no diagram has the "weird" rounded notch behind the stripe.
  - **`uml`** markers are smaller and fixed-size (the composition/aggregation diamonds no longer look oversized), and the class boxes are a touch narrower.
- Updated dependencies
  - @avodado/render@0.2.5
  - @avodado/export@0.0.11

## 0.2.7

### Patch Changes

- - **`uml`** relationship markers (especially the composition/aggregation diamonds) are smaller, so they read in proportion to the now-compact class boxes.
  - **`infra`/cloud** reverts to the stripe-style service cards (the look that worked) and instead gives the zone/group containers noticeably more interior padding so nodes aren't cramped against the boundary.
- Updated dependencies
  - @avodado/render@0.2.4
  - @avodado/export@0.0.10

## 0.2.6

### Patch Changes

- - **`uml` class diagrams reworked.** Classes are laid out with dagre using their real sizes and relationships are routed through dagre's points as smooth, rounded paths (same engine as the ERD) — so arrows no longer overlap or read as jagged. Boxes and markers are smaller and theme-aware.
  - **`infra` / cloud diagrams redesigned** in the style of AWS/GCP/Azure architecture diagrams: each service is a clean white card with a coloured icon badge, the service name, and an optional type line. Nodes without a glyph show their initial in the badge.
- Updated dependencies
  - @avodado/render@0.2.3
  - @avodado/export@0.0.9

## 0.2.5

### Patch Changes

- - **Square-left accent cards.** Diagram nodes with a left accent stripe (`c4`, `felogic`/`belogic`, `infra`/`block`/`network`/`event`/`ddd`) now have square top-left/bottom-left corners so the stripe sits flush — no more "weird" rounded notch. Right corners stay rounded.
  - **Cloud/infra now matches the `felogic` look** — same card proportions and flush-stripe treatment, plus the earlier extra padding for zone boxes.
  - **`uml` classes are smaller again** (narrower boxes, smaller fonts, wider gaps) so relationship arrows have room and stop overlapping.
- Updated dependencies
  - @avodado/render@0.2.2
  - @avodado/export@0.0.8

## 0.2.4

### Patch Changes

- Diagram rendering polish:
  - **Edge labels are never crossed out.** All diagram renderers (`flow`/`dag`, `c4`, `state`, `dfd`, `uml`, `block`/`infra`/`event`/`ddd`/`network`) now draw labels in a final pass, on top of the lines and nodes — fixing the "state lifecycle" labels being struck through by later transitions. Label pills are theme-aware.
  - **`dfd`** boxes are smaller with more separation so flow labels fit between them.
  - **`c4`** person nodes draw the persona glyph in the top-right corner, clear of the title/description text.
  - **`uml`** class boxes and fonts are smaller; the class boxes and compartment rules now follow the theme.
  - **`infra`/`block`/`network`/etc.** get more outer padding/margin and theme-aware layered-mode colors.
  - Left-accent blocks (`callout`, `userstory`, `toc`, kanban cards) have square accent (left) corners and rounded right corners.

- Updated dependencies
  - @avodado/render@0.2.1
  - @avodado/export@0.0.7

## 0.2.3

### Patch Changes

- - **Auto-layout for the coordinate diagrams.** `flow`/`dag`, `c4`, `state`, `dfd`, and `uml` no longer require `col`/`row` on every node — when coordinates are omitted, a clean layered grid is derived from the edges (dagre) so you can declare just nodes + relationships. Explicit `col`/`row` are still honored exactly (fully backward-compatible).
  - **ERD crow's-foot notation.** Relations now render proper crow's-foot ends (one / many) derived from `card`, and show the relation `label` on the edge. Added `N:1` to the `card` values (the common many-to-one shape).
- Updated dependencies
  - @avodado/core@0.1.0
  - @avodado/render@0.2.0
  - @avodado/export@0.0.6
  - @avodado/sync@0.0.3

## 0.2.2

### Patch Changes

- ERD relations now connect at the **field level** — each edge is routed from the foreign-key row in the source entity to the primary-key row in the target entity (arrowhead into the PK row), instead of attaching at the box centre. dagre still handles box placement; edges route orthogonally through the gap between boxes.
- Updated dependencies
  - @avodado/render@0.1.2
  - @avodado/export@0.0.5

## 0.2.1

### Patch Changes

- - **ERD block remodeled** — entity placement and edge routing are now computed with a real graph-layout pass (dagre), so boxes don't overlap and relations route cleanly around them instead of cutting across the diagram. Foreign keys still point an arrowhead into the target entity (FK → PK), with cardinality labels on the edges. Entities longer than 10 columns are truncated with a "… +N more" row for readability.
  - **Textbook theme now uses a sans-serif typeface** (warm palette, larger headings, and cream paper are unchanged).
- Updated dependencies
  - @avodado/render@0.1.1
  - @avodado/export@0.0.4

## 0.2.0

### Minor Changes

- - **New default theme `textbook`** — a warm, classic, printed-page look: cream paper, deep academic navy + terracotta accent, serif display & body, and larger headings. The former default is still available as the `minimal` theme.
  - **ERD foreign keys now connect FK → PK** — relations attach to the foreign-key row in the source entity and point an arrowhead into the primary-key row of the target (instead of generic top-edge arrows). ERD colors now follow the active theme.
  - **`avo init` installs one unified skill across tools** — the same `avodado-docs` skill (`SKILL.md`) is written into each tool's native skill location (Claude Code, Cursor, Windsurf) plus a Copilot prompt file, and **agents** are generated where supported (Claude Code, GitHub Copilot). Instruction files are now consistent pointers.
  - Removed the dead `$schema` URL from the scaffolded `avodado.config.json`.

### Patch Changes

- Updated dependencies
  - @avodado/render@0.1.0
  - @avodado/export@0.0.3

## 0.1.1

### Patch Changes

- Fix `avo --version` (and the help banner) reporting a hard-coded `0.0.1` — the CLI now reads its real version from its own package.json.

## 0.1.0

### Minor Changes

- Interactive `avo init`: a guided wizard (with a cfonts AVODADO banner) that asks which AI tools you use — Claude Code, Cursor, GitHub Copilot, Windsurf — and writes only those editor adapters, then lets you pick a theme (with a Custom option that scaffolds `avodado.theme.json`). Pass `--yes` to skip the wizard and scaffold with defaults (CI/non-interactive).

## 0.0.2

### Patch Changes

- Replace the default theme with `minimal` — a clean, modern, Vercel-style look (white paper, near-black ink, a single `#0070f3` blue accent, geometric sans, subtle rounding). The `navy`/editorial theme is removed; `minimal` is now the default.
- Updated dependencies
  - @avodado/core@0.0.2
  - @avodado/render@0.0.2
  - @avodado/export@0.0.2
  - @avodado/sync@0.0.2

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
  - @avodado/render@0.0.1
  - @avodado/export@0.0.1
  - @avodado/sync@0.0.1
