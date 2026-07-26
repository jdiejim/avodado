---
"@avodado/core": minor
"@avodado/render": minor
"@avodado/studio": patch
"@avodado/mcp": patch
"avodado": minor
---

Two additions from a pass over the whole library, looking for what a technical
doc still can't draw.

**New `sankey` block — how much moves between stages.** `flow` and `dfd` show
that a path exists; nothing showed how heavy it is. Node height and ribbon
thickness are the same scale, so the widest ribbon leaving a stage IS where the
volume goes: cloud spend by service, traffic by route, a funnel with its
drop-off. Nodes are inferred from the links, so the minimum body is a list of
`from -> to: value`; declare `nodes` only to relabel, colour, or pin a column.
A node's column is the longest link chain reaching it, so a stage always sits
right of everything feeding it.

**New `chart` kind: `gauge` — radial progress against a ceiling.** A donut says
how a whole splits up; a gauge says how far along one number is, which is the
shape an SLO, a quota, a migration or a rollout actually has. `max` is the full
sweep (default 100, the percentage case). One item draws a single dial with the
value in the middle; several become concentric rings with a legend.

The block count goes 78 → 79.
