---
"@avodado/render": minor
"@avodado/studio": patch
"avodado": minor
---

Slides stop being a scaled-down page. Two changes, measured across a deck of
one block per type:

**Tabular exhibits take the stage width.** Every table in the library is
already `width:100%`, but the slide's content box shrink-wraps (so the fitter
can enlarge a lone small block), which meant 100% resolved against the table's
own intrinsic width: a three-row `table` covered 27% of the stage and the
fitter's 1.47× ceiling could not rescue it. Tables now get the whole stage and
their size from type rather than transform — 18px rows instead of 13px scaled
up, so hairlines and shadows stay crisp. `table` 27% → 98% of the stage width,
`matrix` 49% → 98%, `heatmap` 43% → 98%, `glossary` 55% → 98%, `scorecard`
58% → 98%. Their page-card borders and shadows drop on the stage, the way the
diagrams' already did.

**A legibility floor for small labels.** The library sets eyebrows, chips,
captions and secondary values at 9–11px because a page is read at 40cm; on a
stage, after the fitter scales an exhibit down, those were reaching the room at
5–8px. Every non-SVG label that measured under 12px is now 12.5px on slides.
Across the library, labels landing under 12px on a slide drop from 641 to 452,
and 14 blocks lose their sub-10px type entirely — `risk`, `drivers`,
`options`, `persona`, `changelog`, `spec`, `kanban` and others.

SVG diagram labels are deliberately untouched: their wrap widths are computed
against the current size and baked into the viewBox, so they move per diagram.
`journey`'s emotion label moves from an inline style to a themed class.
