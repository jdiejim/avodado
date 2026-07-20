---
"@avodado/render": patch
"@avodado/core": patch
"avodado": patch
---

Slides: the stage-column treatment now covers every stacked text block —
`agenda`, `spec`, `inventory`, `slo`, `okr`, and `risk` join list/takeaways/
steps/faq/glossary/prose lists (2 columns at 4+ items, 3 at 8+). Blocks that
are already grids (team, persona, drivers, gallery) or whose vertical order is
the point (layers, changelog) are untouched. Also fixes the terse OKR
key-result sugar: `· 60` / `· 60%` now lands as the schema's 0-1 fraction, so
progress bars show the real percentage instead of clamping to 100%.
