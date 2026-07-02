# Avodado blocks — Charts & overviews

Part of the **avodado-docs** skill (the hub is `SKILL.md`, two folders up).
Field contracts and examples for this family's blocks. The at-a-glance contract
table for all 87 blocks is `contract.md` beside this file; the block → family
map is `INDEX.md`. Schemas reject unknown fields — use exactly these.

### Charts & overviews

#### `graph` — node-link graph
```graph
title: BFS from web — step 2
nodes:
  - { id: web, col: 1, row: 1, label: web, state: visited }
  - { id: auth, col: 2, row: 1, label: auth, state: current }
  - { id: orders, col: 2, row: 2, label: orders, state: frontier }
  - { id: mail, col: 3, row: 2, label: mailer, state: target }
edges:
  - { from: web, to: auth, weight: 1 }
  - { from: web, to: orders, weight: 4 }
  - { from: orders, to: mail, label: async, weight: 2 }
```
`group: <n>` cycles through the chart palette. Edge `dir` is `directed`
(default) or `undirected`. For algorithm walkthroughs (BFS / DFS / Dijkstra
visit order) set node `state` — `visited · current · frontier · target` —
which overrides the group colour; edge `weight` (a number) renders on the edge
pill, combined with a `label` as "label · w".

#### `mece` — issue tree (MECE breakdown)
```mece
title: Why are conversions down?
nodes:
  - { id: root, label: Lower conversion }
  - { id: traffic, parent: root, label: Traffic quality }
  - { id: friction, parent: root, label: Funnel friction }
  - { id: f1, parent: friction, label: Slow checkout, note: p95 > 4s }
```
Left-to-right tree, depth-coloured stripes, DFS layout.

#### `tree` — indented hierarchy (HTML, not SVG)
```tree
nodes:
  - { id: src, label: src }
  - { id: components, parent: src, label: components }
  - { id: index, parent: src, label: index.ts, note: entry }
```

#### `gantt` — schedule bars
```gantt
periods: [Q1, Q2, Q3, Q4]
tasks:
  - { label: Discovery, start: 0, span: 1, kind: done }
  - { label: Build, start: 1, span: 2, kind: active }
  - { label: GA, start: 3, span: 1, kind: milestone }
```
Task `kind` is `done | active | current | milestone` (drives bar colour).

#### `chart` — a data chart (bar / line / area / donut / radar)
```chart
title: p95 latency by week
kind: line               # bar (default) | line | area | donut | radar
unit: ms                 # optional value suffix
labels: [W1, W2, W3, W4]
series:
  - { label: /orders, accent: navy, values: [240, 220, 185, 150] }
  - { label: /search, accent: teal, values: [310, 285, 260, 230] }
```
`labels` + `series` drive `bar` / `line` / `area` (one or more series, coloured
by `accent` or an automatic cycle); `donut` uses `items` instead:
```chart
title: Traffic by client
kind: donut
unit: "%"
items:
  - { label: Web, value: 62, accent: navy }
  - { label: iOS, value: 23, accent: teal }
  - { label: Android, value: 15, accent: amber }
```
`radar` draws a polygon web — `labels` become the axes (3+ required) and each
series is a stroked polygon over concentric rings:
```chart
title: Vendor comparison
kind: radar
labels: [Throughput, Latency, Cost, Ops burden, Ecosystem]
series:
  - { label: Kafka, accent: navy, values: [5, 4, 2, 2, 5] }
  - { label: SQS, accent: amber, values: [3, 3, 5, 5, 3] }
```
Optional `max` caps the y-axis (radar: the outer ring) instead of auto-scaling
to the data. Values are plain numbers — negatives clamp to 0. Use `chart` for
real numeric series; use `stats` for a handful of headline KPIs and `gantt`
for schedules.

#### `waterfall` — a budget cascade
```waterfall
title: API latency budget
unit: ms                 # default ms
budget: 250              # optional dashed cap line
items:
  - { label: DNS + TLS, value: 35 }
  - { label: Gateway, value: 20, desc: auth + routing }
  - { label: Service, value: 90 }
  - { label: Database, value: 70 }
```
Horizontal cascading bars — each starts where the previous total ended, and a
navy TOTAL bar closes the run. With `budget` set, a dashed line marks the cap:
any segment past it tints red and the total row gets a green "under" / red
"over" chip. Use `waterfall` for latency budgets and cost breakdowns — *how
parts add up against a cap*; use `chart` for series over categories and
`funnel` for stage-to-stage drop-off.

#### `heatmap` — a numeric grid with an intensity ramp
```heatmap
title: p95 latency by region × hour
unit: ms
xLabels: ["00", "06", "12", "18"]
rows:
  - { label: us-east-1, values: [120, 135, 210, 265] }
  - { label: eu-west-1, values: [110, 150, 240, 190] }
  - { label: ap-south-1, values: [180, 220, 310, 280] }
```
Row labels left, column labels on top; each cell tints on a single-hue ramp
from light (low) to deep blue (high), normalized between the data min and max
(override with explicit `min` / `max`). A slim min → max legend sits beneath.
Short rows pad missing cells as blank tiles. Use `heatmap` for a dense value
grid (latency × hour, load × region); use `matrix` for *categorical*
capability cells and `table` when the reader needs exact rows.

#### `pyramid` — stacked hierarchy (top → bottom widening)
```pyramid
levels:
  - { label: Vision, desc: Long-term direction }
  - { label: Tactics, desc: This quarter }
```

#### `quadrant` — 2×2 matrix
```quadrant
xAxis: { label: Effort, low: Low, high: High }
yAxis: { label: Impact, low: Low, high: High }
items:
  - { x: 0.2, y: 0.8, label: Quick win }
  - { x: 0.8, y: 0.8, label: Big bet }
```
`x` / `y` are 0..1.

#### `journey` — user journey map with optional emotion curve
```journey
stages: [{ label: Discover }, { label: Sign up }, { label: Pay }]
rows:
  - { label: Touchpoint, cells: [Landing, Form, Checkout] }
  - { label: Friction, cells: [Low, High, Medium] }
emotion: [0.7, 0.3, 0.8]
```
