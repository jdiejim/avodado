---
"@avodado/core": minor
"@avodado/render": minor
"@avodado/studio": patch
---

`swimlane` is the block for "who does which step, in what order", and it is harder to get wrong.

- A step names its lane by label or id (`lane: Sales`, case-insensitive) as well as by index; an unknown lane is `E_SWIMLANE_LANE`, listing the lanes.
- `col` is optional. Columns derive from the links — a step sits one column after its predecessors; unlinked steps follow — through `swimlanePlacements` in core, so the renderer, the Studio canvas, and `avo check` agree.
- `phases` bands the columns as a header row (BPMN milestones). Links take `kind: dashed | error` and the `-->` / `-x->` arrows. Steps take `note` and `accent: true`, and the terse form `id: Label · Lane · kind`.
