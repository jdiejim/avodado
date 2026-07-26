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
(default) or `undirected`. Weightless edges can use the terse
`a -> b: label` form (`-->` dashed, `-x->` error); use the object form when an
edge carries `weight` or `dir`. For algorithm walkthroughs (BFS / DFS /
Dijkstra visit order) set node `state` — `visited · current · frontier ·
target` — which overrides the group colour; edge `weight` (a number) renders
on the edge pill, combined with a `label` as "label · w".

#### `tree` — indented hierarchy (HTML, not SVG)
```tree
nodes:
  - { id: src, label: src }
  - { id: components, parent: src, label: components }
  - { id: index, parent: src, label: index.ts, note: entry }
```

**`variant: issue`** draws the same nodes as a MECE issue tree — one problem
split into mutually-exclusive branches (left-to-right SVG, depth-coloured
stripes, DFS layout). The old `mece` type is its permanent alias:
```tree
variant: issue
title: Why are conversions down?
nodes:
  - { id: root, label: Lower conversion }
  - { id: traffic, parent: root, label: Traffic quality }
  - { id: friction, parent: root, label: Funnel friction }
  - { id: f1, parent: friction, label: Slow checkout, note: p95 > 4s }
```

**Give the nodes a `value` and it becomes a driver tree.** The hierarchy stops
being an outline and starts being arithmetic: each node shows its number and
its share of its parent, so the row that owns the total is obvious.
```tree
unit: ms
nodes:
  - { id: p95, label: Checkout p95, value: 2400 }
  - { id: cap, parent: p95, label: Payment capture, value: 1780 }
  - { id: psp, parent: cap, label: PSP round trip, value: 1520 }
  - { id: db, parent: p95, label: Order write, value: 380 }
```
p95 = capture (74%) + order write (16%) + the rest — the same move works for
revenue = price × volume, or cost by component.
#### `gantt` — schedule bars
```gantt
periods: [Q1, Q2, Q3, Q4]
tasks:
  - { label: Discovery, start: 0, span: 1, kind: done }
  - { label: Build, start: 1, span: 2, kind: active }
  - { label: GA, start: 3, span: 1, kind: milestone }
```
Task `kind` is `done | active | current | milestone` (drives bar colour).

#### `chart` — a data chart (bar / stacked / line / area / scatter / donut / gauge / radar / waterfall / funnel)
```chart
title: p95 latency by week
kind: line               # bar (default) | stacked | line | area | scatter | donut | gauge | radar | waterfall | funnel
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
**`kind: stacked`** sums each column instead of standing the series side by
side — for when the total matters as much as the split; the y-axis scales to
the totals and each column is labelled with its own. **`kind: scatter`** plots
the same `labels` + `series` as unjoined points, for when the x order carries
no meaning and the question is where things cluster.

**`kind: gauge`** — radial progress against a ceiling. A donut says how a
whole splits up; a gauge says how far along one number is, which is the shape
an SLO, a quota, a migration or a rollout actually has. `max` is the full
sweep (default 100, the percentage case):
```chart
title: Migration progress
kind: gauge
unit: "%"
items:
  - { label: Services migrated, value: 68, desc: of 42 services }
```
One item draws a single dial with the value in the middle and `desc` under it;
several become concentric rings, outermost first, with a legend — good for
three or four related percentages, not for a breakdown that should sum to a
whole (that is `donut`).

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

**`kind: waterfall`** — a budget cascade. Driven by `items` (each may carry a
`desc`), with an optional `budget` cap. The old `waterfall` type is its
permanent alias:
```chart
kind: waterfall
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
"over" chip. Use it for latency budgets and cost breakdowns — *how parts add
up against a cap*; use a plain `chart` kind for series over categories and
`kind: funnel` for stage-to-stage drop-off.

**`kind: funnel`** — a conversion funnel, also driven by `items` (`stages` is
accepted as a legacy synonym from the `funnel`-type era, which is now a
permanent alias):
```chart
kind: funnel
title: Signup → paid conversion
unit: users
items:
  - { label: Visited landing page, value: 48000 }
  - { label: Started signup, value: 9600, desc: email + password }
  - { label: Activated, value: 4300, desc: created a first doc }
  - { label: Upgraded to paid, value: 860 }
```
Stacked centered bands, each width proportional to `value` (with a floor so
labels fit); a mono `↓ NN%` chip between bands shows stage-to-stage conversion.
`value` is a plain **number** (no separators — the renderer formats it);
`unit` suffixes the value. Use `kind: funnel` when the story is *drop-off
between ordered stages*; use `journey` for the qualitative experience across
stages.

#### `sankey` — how much moves between stages

`flow` and `dfd` show that a path exists; `sankey` shows how heavy it is. Node
height and ribbon thickness are the same scale, so the widest ribbon leaving a
stage IS where the volume goes — cloud spend, traffic by route, a funnel with
its drop-off.
```sankey
title: Where the cloud bill goes
unit: k
links:
  - { from: Bill, to: Compute, value: 62 }
  - { from: Bill, to: Storage, value: 28 }
  - { from: Compute, to: Serving, value: 38 }
  - { from: Compute, to: Batch, value: 24 }
```
Nodes are inferred from the links, so a bare link list is a complete block.
Declare `nodes` only to give one a nicer label, an accent, or a fixed column:
```sankey
title: Signup funnel with drop-off
unit: k
nodes:
  - { id: visits, label: Visits, accent: navy }
  - { id: bounced, label: Bounced, accent: red }
links:
  - { from: visits, to: signup, value: 32 }
  - { from: visits, to: bounced, value: 68 }
```
A node's column is the longest chain of links reaching it, so a stage always
sits right of everything feeding it; `col` (1-indexed) pins one when the
derived depth reads wrong. Use `sankey` for volumes, `funnel` (a `chart` kind)
for a single ordered drop-off, and `flow` when only the path matters.

#### `treemap` — proportional composition

Where a donut gives up. Six slices is a donut; thirty services by spend, or a
bundle by module, is a treemap — area is the value, so the big tiles are the
answer and the small ones still have a place to sit.
```treemap
title: Cloud spend by service
unit: k
items:
  - { label: Compute, value: 62, desc: EC2 + Lambda }
  - { label: Storage, value: 28 }
  - { label: Databases, value: 24 }
  - { label: Network, value: 16 }
  - { label: Observability, value: 11, accent: amber }
```
Tiles are laid out squarified — near-square and biggest-first — which is what
makes their areas comparable by eye. Each shows its value and share of the
total; the label, value and `desc` appear only where the tile can hold them,
and the tooltip always carries all three.

#### `venn` — two or three overlapping sets

For scope, ownership and responsibility, where the interesting part is what two
groups share:
```venn
title: Who owns what
sets:
  - { label: Platform, desc: runtime and CI }
  - { label: Product, desc: features and UX }
shared:
  - { sets: [Platform, Product], label: Release process }
```
Positions are fixed (two circles, or three on a triangle) because a Venn names
regions rather than measuring them. `shared.sets` matches set **labels**: two
names put the label in that lens, all three put it in the middle.

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

Give the nodes a `value` and the hierarchy stops being an outline and starts
being arithmetic: each node shows its number and its share of its parent, so
the row that owns the total is obvious.
```tree
unit: ms
nodes:
  - { id: p95, label: Checkout p95, value: 2400 }
  - { id: cap, parent: p95, label: Payment capture, value: 1780 }
  - { id: psp, parent: cap, label: PSP round trip, value: 1520 }
  - { id: db, parent: p95, label: Order write, value: 380 }
```
p95 = capture (74%) + order write (16%) + the rest — the same move works for
revenue = price × volume, or cost by component.

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
