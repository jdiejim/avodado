---
"@avodado/render": minor
"@avodado/core": patch
"@avodado/studio": patch
---

Fixes from the first generation eval (16 fresh-agent scenarios, `evals/generate`).

- Drawings wider than 1600 viewBox units (a 12-state machine, a 14-node data flow, an 8-participant sequence) no longer shrink to half size: the stage keeps the drawing at its natural width and scrolls sideways. Print and slides still fit to the page.
- State-machine numerals dodge state boxes, as the other graph renderers already did.
- Gantt period heads stagger onto two rows when they do not fit their column, and cut with a tooltip when even two columns are too narrow.
- A long quadrant y-axis endpoint label widens the left gutter instead of clipping.
- Slopegraph labels get two more pixels of separation.
- `avo check` hints: an unknown field that looks like a value fragment now names the unquoted-comma trap and shows the quoted form; a string where a list expects an object lists the terse forms that exist for that list.
- Studio bundles the renderer, so its canvas picks up the same fixes.
