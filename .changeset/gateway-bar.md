---
"@avodado/render": minor
"@avodado/core": minor
"@avodado/studio": patch
---

Diagram conventions checked against practice.

- `block` and `cluster`: `gateway`, `lb`, `proxy`, and `ingress` draw as the tall vertical bar of system-design diagrams instead of a hexagon or octagon. A bar spans the rows of the services it fans out to on its own, or the rows `h` names; arrows meet the bar, not the cell around it. `block` nodes accept `h` (row span) beside `w`.
- New `W_EDGE_LABEL` warning: a `c4` relationship without a `label`. The C4 notation asks every line to name its intent and container lines their technology.
- The skill's organizing guide adds the four document kinds (tutorial, how-to, reference, explanation) with the blocks each reaches for.
