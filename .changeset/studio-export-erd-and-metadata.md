---
"@avodado/core": minor
"@avodado/render": minor
"@avodado/cli": minor
"@avodado/studio": minor
"@avodado/mcp": patch
---

Studio, rendering, and package metadata.

**Studio**
- Toolbar **Export** menu: download the current doc as a standalone HTML page,
  a self-contained slide deck, or a PDF. PDF is produced by a new
  `POST /api/export/pdf` route on the file-bridge server (headless Chromium).
- **ERD drag-to-connect:** selecting an entity shows connector dots; dragging
  to another entity opens a cardinality picker (1:1 / 1:N / N:1 / N:M) that
  appends the relation. Committed as a single undo step.
- Direct-manipulation editing for grid groups (marquee select + resize) and
  column-family blocks.

**Rendering**
- New `cycle` block and grid-group / orthogonal-lane / label-wrap improvements
  across the diagram renderers.

**Metadata**
- SEO-focused `description` + `keywords` across all packages, framed around the
  real use cases: API docs, architecture & system design, ERDs, ADRs, and
  slide/PDF presentations.
