# Avodado blocks — Algorithms & data structures

Part of the **avodado-docs** skill (the hub is `SKILL.md`, two folders up).
Field contracts and examples for this family's blocks. The at-a-glance contract
table for all 87 blocks is `contract.md` beside this file; the block → family
map is `INDEX.md`. Schemas reject unknown fields — use exactly these.

### Algorithms & data structures

Purpose-built for algorithm walkthroughs and CS explainers — one **step per
block** (freeze a moment, don't animate). All four share the same `tone` enum:
`active` (navy — the element under examination) · `visited` (light blue —
already processed) · `target` (green — the goal) · `muted` (gray — out of
play). For graph algorithms (BFS / DFS / Dijkstra), use `graph` with node
`state` + edge `weight` instead.

#### `array` — array cells for algorithm walkthroughs
```array
title: Binary search for 27 — step 2
description: mid lands on 19, so the search space halves to the right.
items:
  - { value: "3", tone: muted }
  - { value: "7", tone: muted }
  - { value: "12", label: lo }
  - { value: "19", tone: active, label: mid }
  - { value: "27", tone: target }
  - { value: "41", label: hi }
window: { from: 2, to: 5, label: search space }
```
A row of square cells. `value` is a **string — quote numbers** (`value: "19"`).
Indices render above each cell (`showIndex`, default true); a pointer `label`
("i", "lo", "mid") renders **below** its cell with a ▲ tick; `window` draws a
navy-dashed outline around a 0-based **inclusive** index range (out-of-bounds
values clamp). Use `array` for binary search, two pointers, and sliding
windows; use `table` for genuinely tabular data.

#### `linkedlist` — pointer-chain diagram
```linkedlist
title: Reversing a list — step 2
nodes:
  - { value: "9", tone: visited, label: prev }
  - { value: "4", tone: active, label: curr }
  - { value: "7", label: next }
  - { value: "1" }
```
Boxed nodes (a value cell + a pointer-dot cell) joined by arrows. `kind:
doubly` adds a second, lower back-arrow per link; `nullEnd` (default true)
terminates the chain in a ∅ ground symbol. A node `label` ("head", "curr")
renders **above** its node with a ▼ tick. Use `linkedlist` for pointer
manipulation (reversal, insertion, fast/slow); use `flow` for control flow.

#### `bintree` — binary tree
```bintree
title: BST search for 27
nodes:
  - { id: root, value: "19", tone: visited }
  - { id: l, value: "8", parent: root, side: left }
  - { id: r, value: "31", parent: root, side: right, tone: active }
  - { id: rl, value: "27", parent: r, side: left, tone: target }
  - { id: rr, value: "40", parent: r, side: right }
```
Nodes reference their `parent` by id and **must** set `side: left | right`
when they do — a parent without a side is a schema error, and so is placing
two children on one side. Parentless nodes are roots; multiple roots lay out
side by side (handy for showing rotations). A parent centres over its
children and single-child nodes offset toward their side, so unbalanced
chains slant instead of stacking. Tint the chain down to a `target` to show a
search path. Use `bintree` for BSTs, heaps, and traversals; use `tree` for
file hierarchies and `mece` for issue breakdowns.

#### `hashmap` — buckets + chained entries
```hashmap
title: Chained hash table
description: "hash(key) % 8 — plum and grape collide in bucket 2."
buckets: 8
entries:
  - { key: apple, value: "3", bucket: 0 }
  - { key: plum, value: "9", bucket: 2, tone: active }
  - { key: grape, value: "1", bucket: 2 }
  - { key: fig, value: "7", bucket: 5, tone: muted }
```
A vertical column of bucket slots (indices `0..buckets-1`); each bucket's
entries chain rightward as rounded `key: value` pills joined by arrows —
collision chains read left → right in entry order. Empty buckets show a dim
"—". Entries whose `bucket` falls outside `0..buckets-1` are **skipped**, not
clamped — they simply don't render, so fix the index. Rendering caps at 12
buckets with a "+N more" note; keep the count small enough to read. Use
`hashmap` for hashing / collision walkthroughs; use `table` for plain
key-value listings.
