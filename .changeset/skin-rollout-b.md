---
'@avodado/render': patch
'@avodado/studio': patch
---

Editorial skin, group B — charts and data-structure renderers move to the role tokens (`DESIGN.md`): `chart` (every kind), `heatmap`, `treemap`, `sankey`, `slopegraph`, `quadrant`, `venn`, `wardley`, `gantt`, `journey`, `stats`, `palette`, `fishbone`, `tree` (issue / org), `array`, `linkedlist`, `bintree`, `hashmap`. Charts spend colour on series only: one series is `ink`, 2–5 series take the desaturated `--series-1…5` ramp in order, `accent: red` is `negative`; donut / gauge / waterfall / funnel step down the ink ramp. Heatmaps ramp `paper-2` → `ink` in five steps. Every diagram emits a legend strip naming the encodings it used; algorithm tones (`active` / `target` / `visited` / `muted`) are told apart by outline, fill and dash. No hex in any of these renderers; `svg/dsTone.ts` is the one file that carries the series fallbacks.
