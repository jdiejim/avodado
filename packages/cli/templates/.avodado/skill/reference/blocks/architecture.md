# Avodado blocks — Architecture

Part of the **avodado-docs** skill (the hub is `SKILL.md`, two folders up).
Field contracts and examples for this family's blocks. The at-a-glance contract
table for all 87 blocks is `contract.md` beside this file; the block → family
map is `INDEX.md`. Schemas reject unknown fields — use exactly these.

### Architecture diagrams

#### `c4` — context / container / component
```c4
title: Clip-sharing platform — containers
level: container
boundary: { label: ClipShare platform }
nodes:
  - { id: creator, col: 1, row: 1, kind: person, name: Creator, desc: Uploads clips. }
  - { id: api, col: 2, row: 1, kind: container, family: service, name: Upload API, tech: Go }
  - { id: worker, col: 3, row: 1, kind: container, family: service, name: Transcoder, tech: FFmpeg workers }
  - { id: media, col: 2, row: 2, kind: store, name: Object store, tech: S3 }
  - { id: cdn, col: 3, row: 2, kind: external, name: CDN }
edges:
  - { from: creator, to: api, label: uploads, tech: HTTPS }
  - { from: api, to: media, label: raw media, tech: S3 API }
  - { from: api, to: worker, label: enqueue job, kind: dashed }
  - { from: worker, to: media, label: renditions }
  - { from: cdn, to: media, label: origin pull, kind: dashed }
```
`kind` is `person | system | external | store | container | component`.
`family` (for `container`/`component`): `client | service | data | store |
controller | repo | external`. Edge `kind` is `solid | dashed | forbidden |
error`; edge `tech` renders as `label [tech]` (the C4 protocol convention).
`col`/`row` are optional — omit them everywhere for auto-layout (*quick mode*).
Optional `boundary` draws one dashed box auto-fitted around the internal nodes;
`boundaries[]` draws several named boxes, each around an explicit id list:
```yaml
boundaries:
  - { label: ClipShare platform, nodes: [api, worker, media], color: "#0e54a1" }
  - { label: Partner estate, nodes: [cdn], color: "#991b1b" }
```
`kind: store` draws as a true database cylinder; `kind: external` draws with a
dashed border (outside your control); the frame tag shows the level
(`C4 · CONTAINER`); the legend derives from the kinds you actually used.

**C4 done right — the rules that make it professional.** A C4 diagram answers
exactly ONE question per level. Never mix levels in one diagram.

- **Context** (`level: context`) answers *"who uses it and what does it talk
  to?"* Allowed nodes: `person`, `system` (yours — usually exactly ONE),
  `external`. NO containers, NO stores. Persons in the top row; your system in
  the middle; externals in the outer rows/columns. 4-8 nodes total.
- **Container** (`level: container`) answers *"what are the deployable pieces
  inside the system?"* One `boundary:` (or `boundaries[]`) = the system;
  `container` nodes inside it (**every container carries `tech:`** — a
  container without a technology is a smell); `store` nodes inside; `person` +
  `external` OUTSIDE the boundary. 5-9 nodes; if you need more, you're drawing
  two systems — split the diagram.
- **Component** (`level: component`) answers *"what's inside ONE container?"*
  `component` nodes (use `family:` controller/service/repo to color-code the
  layering) + the stores/externals that container touches. Name the container
  in the `title`.
- **Every edge is a sentence.** `label` = an active verb phrase from the
  reader's perspective ("places order", "publishes events", "reads sessions");
  `tech` = the protocol/format (`JSON/HTTPS`, `gRPC`, `SQL`, `SQS`). An
  unlabeled C4 edge is unfinished. Async/eventual edges get `kind: dashed`;
  edges that must never exist get `kind: forbidden`.
- **Externals are things you don't deploy** — SaaS, partner APIs, another
  team's system. If your team owns it, it's a `container`, not an `external`.
  Externals never sit inside a boundary.
- **Direction = dependency, not data.** Draw the arrow from the thing that
  *initiates* toward the thing it calls; responses are implied. One arrow per
  relationship (don't draw the reply).
- **Descriptions earn their space**: `desc` is one clause stating
  responsibility ("Validates carts and takes payment"), not a repeat of the
  name.
- **Zooming**: one level per section — `context` first, then `container` for
  the system the doc is about; deep-dive a single container with `component`
  or hand off to `belogic`. Cross-reference instead of redrawing.

A context-level example done to these rules:
```c4
title: ClipShare — system context
level: context
nodes:
  - { id: creator, kind: person, name: Creator, desc: Uploads and shares clips. }
  - { id: viewer, kind: person, name: Viewer, desc: Watches published clips. }
  - { id: sys, kind: system, name: ClipShare, desc: "Ingests, transcodes, serves video." }
  - { id: pay, kind: external, name: Billing partner, desc: Subscriptions + invoicing. }
  - { id: idp, kind: external, name: Identity provider, desc: SSO for creators. }
edges:
  - { from: creator, to: sys, label: uploads clips, tech: HTTPS }
  - { from: viewer, to: sys, label: watches, tech: HLS }
  - { from: sys, to: pay, label: reports usage, tech: REST }
  - { from: creator, to: idp, label: signs in via, tech: OIDC }
```

#### `block` — grid architecture with optional groups
```block
title: Search platform
groups:
  - { col: 1, row: 1, cols: 1, rows: 2, label: Ingest, color: "#0e54a1" }
nodes:
  - { id: crawler, col: 1, row: 1, kind: service, name: Crawler, tech: Go }
  - { id: indexer, col: 1, row: 2, kind: service, name: Indexer }
  - { id: idx, col: 2, row: 2, kind: store, name: Inverted index }
  - { id: qapi, col: 2, row: 1, kind: gateway, name: Query API }
edges:
  - { from: crawler, to: indexer, label: pages }
  - { from: indexer, to: idx }
  - { from: qapi, to: idx, label: reads, kind: dashed }
```
Node `kind` is one of: `client · service · microservice · compute · container ·
worker · etl · data · store · db · database · bucket · blob · object · queue ·
mq · broker · stream · cache · gateway · lb · proxy · function · lambda · cdn ·
dns · waf · firewall · shield · auth · idp · iam · oauth · sso · secrets ·
vault · kms · monitor · metrics · logs · tracing · scheduler · cron · job ·
warehouse · lake · analytics · bi · search · index · ml · model · llm · agent ·
vm · server · host · user · person · browser · mobile · device · iot ·
notification · webhook · email · sms · ci · cicd · pipeline · git · repo ·
registry · config · external · producer · topic · consumer · context` — plus
vendor aliases (`postgres`/`mysql`/`mongo` → db, `s3` → bucket,
`sqs`/`rabbitmq` → queue, `kafka`/`kinesis` → stream, `redis`/`memcached` →
cache, `elasticsearch` → search). Known kinds get coloured + glyphed
automatically and pick the canonical **shape** — db kinds draw as cylinders,
queue/stream kinds as horizontal-cylinder pipes, cdn/external as clouds,
gateway/lb/proxy as hexagons, cache/redis as an instance stack. Unknown kinds
render as a neutral box.

**Quick mode.** Omit `col`/`row` on every node and the layout is computed from
the edges (left → right). The example above needs no coordinates at all:
```block
title: Search platform — quick mode
nodes:
  - { id: crawler, kind: service, name: Crawler }
  - { id: indexer, kind: service, name: Indexer }
  - { id: idx, kind: search, name: Inverted index }
  - { id: qapi, kind: gateway, name: Query API }
edges:
  - { from: crawler, to: indexer }
  - { from: indexer, to: idx }
  - { from: qapi, to: idx, label: reads, kind: dashed }
```
Use coordinates when you want a deliberate shape — and always with `groups`.

**Nested zones (AWS-style VPC / subnets).** `groups` can overlap to nest: draw
the outer zone (e.g. a VPC) as one big group, then inner zones (public / private
subnets) as smaller groups inside its cell range. The renderer paints larger
groups first, so smaller ones layer on top. Nodes still sit in grid `col`/`row`
cells; the groups just frame them.
```infra
title: VPC topology
groups:
  - { col: 2, row: 1, cols: 3, rows: 3, label: "VPC 10.0.0.0/16", color: "#0e54a1" }
  - { col: 2, row: 1, cols: 3, rows: 1, label: Public subnet, color: "#1f9747" }
  - { col: 2, row: 2, cols: 3, rows: 1, label: "Private subnet · app", color: "#1a6dbe" }
nodes:
  - { id: cf, col: 1, row: 1, kind: cdn, name: CloudFront }
  - { id: alb, col: 2, row: 1, kind: gateway, name: ALB }
  - { id: svc, col: 2, row: 2, kind: microservice, name: orders, tech: ECS }
edges:
  - { from: cf, to: alb }
  - { from: alb, to: svc }
```

#### `infra` — same engine, layered layout
```infra
title: AWS topology
systemLabel: ShopCo · us-east-1
layers:
  - { label: Edge }
  - { label: Compute }
  - { label: Data }
nodes:
  - { id: cf, layer: 0, kind: cdn, name: CloudFront }
  - { id: api, layer: 1, kind: service, name: API }
  - { id: pg, layer: 2, kind: store, name: orders-db }
```
Presence of `layers` switches `block`/`infra` to horizontal-band layout. A layer
may carry `color:` (hex) to tint its band + kicker, e.g.
`- { label: Edge, color: "#1f9747" }`.
Nodes use `layer: <index>` instead of `col`/`row`.

#### `event` — pub / sub choreography (same shape as block)
```event
title: Device telemetry
nodes:
  - { id: fleet, col: 1, row: 1, kind: producer, name: device fleet }
  - { id: bus, col: 2, row: 1, kind: topic, name: telemetry.raw }
  - { id: alerts, col: 3, row: 1, kind: consumer, name: alerting }
  - { id: lake, col: 3, row: 2, kind: consumer, name: lake sink }
edges:
  - { from: fleet, to: bus }
  - { from: bus, to: alerts }
  - { from: bus, to: lake }
```

#### `ddd` — bounded-context map (same shape as block)
```ddd
title: Bounded contexts
nodes:
  - { id: idn, col: 1, row: 1, kind: context, name: Identity }
  - { id: bill, col: 2, row: 1, kind: context, name: Billing }
  - { id: sup, col: 3, row: 1, kind: context, name: Support }
edges:
  - { from: bill, to: idn, label: customer ids, kind: dashed }
  - { from: sup, to: bill, label: reads invoices, kind: dashed }
```

#### `network` — security zones (same shape as block)
Uses the `firewall` glyph and red zone tag.

#### `cluster` — k8s-style nested boxes with services
```cluster
title: Production cluster
clusters:
  - { id: api, label: api namespace, kind: namespace }
services:
  - { id: web, cluster: api, label: web, kind: service, tech: Next.js, replicas: 3 }
  - { id: orders, cluster: api, label: orders, kind: service, tech: Go, replicas: 4 }
edges:
  - { from: web, to: orders }
```
`replicas` renders as small bars (capped at 5 + `×N` label).

#### `archmap` — target-architecture capability map
```archmap
title: Retail platform — target architecture
cols: 2
areas:
  - label: Customer channels
    accent: blue
    items: [Web storefront, { name: Mobile app, status: target }, Contact centre]
  - label: Commerce
    accent: teal
    items:
      - Catalog
      - Checkout
      - { name: Promotions, status: gap }
      - { name: Subscriptions, status: new }
  - label: Platform services
    accent: purple
    desc: Shared capabilities every domain builds on.
    items:
      - Identity
      - { name: Event bus, status: new }
      - { name: Legacy ESB, status: deprecated }
  - label: Data & analytics
    accent: amber
    items:
      - Reporting
      - { name: Customer 360, status: target }
```
The classic EA one-pager: a square mosaic of tinted domain areas, each packed
with small capability/system tiles. A plain-string item is a **current**
capability; `status` codes the rest — `target` (dashed blue, to be built) ·
`new` (green, just added) · `gap` (dashed red, missing) · `deprecated` (gray,
retiring). A legend below the mosaic shows only the statuses actually used.
`cols` sets areas per row (2-4, default 3). Use `archmap` for a capability /
landscape view — *what lives in each domain*; use `block`/`infra` when the
arrows between systems matter.

### Code-flavoured architecture

#### `felogic` / `belogic` — frontend / backend module graph
```felogic
title: Frontend logic
groups:
  - { id: app, label: App (browser), col: 1, row: 1, cols: 3, rows: 3, color: "#0e54a1" }
nodes:
  - { id: ui, col: 1, row: 1, kind: component, name: Checkout UI }
  - { id: iface, col: 2, row: 2, kind: interface, name: DiscountStrategy }
  - { id: impl, col: 1, row: 3, kind: strategy, name: PercentOff }
edges:
  - { from: ui, to: iface, kind: uses }
  - { from: impl, to: iface, kind: implements }
```
`belogic` is the same engine for the backend — use it to draw the
controller → service → repository chain (with a UML feel):
```belogic
title: Orders API — the request chain
groups:
  - { id: api, label: "orders/api", col: 1, row: 1, cols: 2, rows: 2, color: "#0e54a1" }
  - { id: io, label: Egress, col: 3, row: 1, cols: 1, rows: 2, color: "#6b7280" }
nodes:
  - { id: ctl, col: 1, row: 1, kind: controller, name: createOrder, note: "POST /orders" }
  - { id: svc, col: 2, row: 1, kind: service, name: OrderService, note: "validate + place" }
  - { id: repo, col: 1, row: 2, kind: repository, name: OrderRepo, note: persist }
  - { id: gw, col: 2, row: 2, kind: gateway, name: PaymentGateway, note: charge }
  - { id: db, col: 3, row: 1, kind: db, name: orders-db, note: Postgres }
edges:
  - { from: ctl, to: svc, kind: uses }
  - { from: svc, to: repo, kind: uses }
  - { from: svc, to: gw, kind: uses }
  - { from: repo, to: db, kind: egress }
```
Node `kind` is one of: `engine | core · interface · strategy · adapter ·
controller | handler | route · gateway · service | usecase · apiclient | client ·
repository | repo | dao · worker | consumer · middleware · model | entity ·
db | store | database · cache · queue | bus | broker · state | store_state ·
hook · external | backend | api | thirdparty`. Edge `kind` is
`uses | implements | egress | https | api | reads | dashed | async`. These kinds
render with a UML «stereotype» banner: `interface · controller · service ·
repository · adapter · gateway · strategy` — so a backend graph reads like a
stereotyped component diagram. Labels wrap to fit, so they never overflow.
`col`/`row` are optional here too — omit them everywhere (and skip `groups`)
for an auto-laid-out module graph (*quick mode*).

#### `frontend` — top-down component tree
```frontend
title: React component tree
nodes:
  - { id: app, kind: root, name: App }
  - { id: layout, parent: app, kind: layout, name: Layout }
  - { id: page, parent: layout, kind: page, name: HomePage }
  - { id: hook, parent: page, kind: hook, name: useData }
```
`kind` is `root | layout | page | component | leaf | provider | context |
hook | store | state`. Parents render above children with link paths.

#### `uml` — class diagram
```uml
classes:
  - { id: proc, col: 1, row: 1, name: PaymentProcessor, stereotype: interface, methods: ["charge(amount)"] }
  - { id: stripe, col: 1, row: 2, name: StripeProcessor, attrs: ["client: StripeClient"], methods: ["charge(amount)"] }
  - { id: checkout, col: 2, row: 1, name: Checkout, attrs: ["processor: PaymentProcessor"], methods: ["pay()"] }
rels:
  - { from: stripe, to: proc, kind: implements }
  - { from: checkout, to: proc, kind: dependency, label: uses }
```
Relation `kind` is `inheritance | extends | implementation | implements |
composition | aggregation | dependency | association` (drives the marker
shape).

#### `dag` — pipeline / DAG (reuses flow's renderer)
```dag
title: CI pipeline
nodes:
  - { id: src, col: 1, row: 1, kind: start, label: Source }
  - { id: build, col: 2, row: 1, kind: process, label: Build }
  - { id: deploy, col: 3, row: 1, kind: end, label: Deploy }
edges:
  - { from: src, to: build }
  - { from: build, to: deploy }
```

## Field semantics — clarifications

A few fields are easy to misuse. Lock these in.

- `block` / `infra` / `event` / `ddd` / `network` use **identical YAML** — the
  block type slug only changes the colored tag pill. Pick the slug that best
  signals intent to a reader, not for any structural reason.
- Diagram blocks with `layers:` set go into **horizontal-band layout**. Without
  `layers:` they use **grid layout** with `col`/`row`. Don't mix — the renderer
  uses the presence of `layers` to switch modes.
