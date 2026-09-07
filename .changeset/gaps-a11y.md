---
'@avodado/render': minor
'@avodado/studio': patch
'avodado': patch
---

Accessibility and editing gaps: named diagrams, non-text contrast, nested group
padding, and a draggable `saga`.

**Diagram SVGs announce what they contain.** Every diagram carried a generic
`<title>` ("Sequence diagram"), which tells a screen-reader user only what kind
of picture they cannot see. Each now builds its name from its own data —
`Sequence diagram: /orders, 3 messages between 3 actors`,
`Flowchart: Checkout, 3 steps`, `Entity relationship diagram: 2 entities` — and
carries it on both `<title>` and a matching `aria-label`, with `role="img"`.
Wired through `sequence`, `flow`, `erd`, `block` (grid and layered), `c4`,
`spans`, `saga`, `state`, and `dfd`.

**Meaningful lines reach 3:1.** `contrast-audit.mjs` gained a `--nontext` mode
for WCAG 1.4.11: it measures every stroked SVG shape that carries meaning — a
node outline, a chip outline, an arrow, a border that encodes state — against
the surface behind it, and skips decoration (`data-decorative`, plus strokes
that paint exactly what is already behind them or their own fill). The showcase
went from 96 failures to 3. `--rule-solid` darkens to `#807b70` (light) /
`#787f95` (dark) so a secondary node, a group panel and a chip outline are
visible; `--series-1` and `--series-3` darken a step so every chart series
clears 3:1. Gridlines, row separators, glyph silhouette detail and knockout
gaps are marked `data-decorative` instead of darkened. Wireframe input and card
outlines move from the decorative hairline to `--rule-solid`. Text contrast is
unchanged at zero failures.

**Nested groups no longer clip.** `flow`, `dfd`, `state`, `c4` and `felogic`
accept a group `parent` but did not grow their diagram padding for it, so a
nested group flush against the top edge lost its tab. All five now wire
`nestingPads`; `felogic` also draws declared nesting (it previously ignored
`parent`). Documents with no `parent` render byte-identically.

**A saga can be reordered in Studio.** A saga step's position IS its array
index — the schema has no `col`/`row` — so `saga` joins the order-based drag
set: dragging a step (or its compensation card) along the row splices it to a
new index in one undo step, and the arrow keys do the same one step at a time.
