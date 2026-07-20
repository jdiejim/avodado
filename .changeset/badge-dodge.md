---
"@avodado/render": patch
"avodado": patch
---

Edge-step numerals (① ② ③) dodge node boxes — a long edge's midpoint can land
on a node in tight layouts, which printed the badge over the node's label.
Badges now nudge off any node box along the edge's axis, and keep clear of
each other when two edges share a corridor. Diagrams without collisions render
byte-identically.
