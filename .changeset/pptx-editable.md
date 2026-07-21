---
"avodado": minor
"@avodado/render": minor
---

Editable PowerPoint: `avo pptx --editable` emits native PowerPoint elements —
text boxes with real bullets, tables, dark code boxes, stat cards, callouts,
quotes, and actual PowerPoint charts for `chart` blocks — so the deck's words
are editable in PowerPoint. Only diagram blocks (sequence, flow, ERD, C4, …)
are placed as crisp screenshots, and Chromium only launches when a document
actually contains one. The render package now exposes each slide's structured
`parts` (prose text / block type + data) on the slide model for
structure-aware exporters.
