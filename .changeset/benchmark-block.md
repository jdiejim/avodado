---
"@avodado/core": minor
"@avodado/render": minor
"@avodado/studio": patch
"@avodado/mcp": patch
"avodado": minor
---

New **`benchmark`** block — measured results side by side, in the shape model
cards and vendor comparisons use: subject columns × metric rows, each metric
carrying the benchmark's own name under its label.

The winner in each row is **derived, not authored**: the numbers are read out of
the cells (`$0.14`, `310 ms`, `1861` and `43.3%` all compare), then bolded and
tinted. `better: low` flips it for latency and cost, `better: none` turns it
off, and `best: true` forces a tie or a non-numeric winner. `featured: true`
outlines one subject's whole column; `tone: muted` tints a rival's win gray so
it doesn't read as your win. A row measured under several conditions names them
in `variants` and gives each subject one value per condition — they stack in
the cell, captioned, and each condition is compared on its own line.
