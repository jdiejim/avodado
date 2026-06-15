```meta
title: Avodado — all blocks
subtitle: A reference document showing every block type the renderer supports.
tag: DEMO · v1
```

## Welcome

The blocks below are rendered from typed YAML fences. Edit the source `.md`
file, rerun `avo render`, and the HTML updates accordingly.

```callout
tone: tip
title: Source of truth
body: Every diagram on this page comes from a YAML block. There is no
  hand-written HTML or SVG — change the YAML to change the picture.
```

```prose
title: Structured prose
lede: When raw markdown isn't enough — for instance inside a deeply structured doc — use the prose block to express headings, paragraphs, lists, and quotes explicitly.
blocks:
  - { type: h, text: Why structured prose }
  - { type: p, text: It plays nicely with the section-head wrapper and keeps content uniform across docs. }
  - { type: ul, items: [Predictable spacing, Consistent fonts, Easier diffs] }
  - { type: quote, text: A document degrades gracefully — opens in any editor with no tooling. }
```

```glossary
title: A few terms
terms:
  - { term: Idempotent, def: A call that produces the same outcome on a replay. }
  - { term: SLO, def: A service-level objective the team commits to. }
  - { term: Saga, def: A long-running transaction split across services. }
```

```proscons
title: Sync vs async writes
prosLabel: Synchronous
consLabel: Asynchronous
pros:
  - One transaction, easy to reason about
  - Errors surface at call time
  - Latency budget is predictable
cons:
  - Caller waits for downstream
  - Failure mode is "everything stops"
  - Hard to scale horizontally
```

```cvt
title: Migration plan
current:
  label: Today (monolith)
  items: [Single deployable, Shared Postgres, Manual releases]
target:
  label: Target (services)
  items: [Per-service deploys, Per-service stores, Continuous releases]
note: Migrate one service per quarter; freeze new monolith features.
```

```stats
title: This quarter
stats:
  - { value: 12.4k, label: Active users, delta: "+18%", trend: up }
  - { value: 99.95%, label: Uptime, delta: "0", trend: flat }
  - { value: 142ms, label: p95 latency, delta: "-22ms", trend: up }
  - { value: $84k, label: MRR, delta: "+$6.1k", trend: up }
```

```code
title: Reference snippets
blocks:
  - title: order-handler.ts
    lang: TypeScript
    code: |
      export async function placeOrder(req: OrderRequest): Promise<Order> {
        const order = await db.tx(async (t) => {
          const inserted = await t.orders.insert({ ...req, status: 'PENDING' });
          await payments.authorize(inserted.id, req.token);
          return t.orders.update(inserted.id, { status: 'CONFIRMED' });
        });
        return order;
      }
  - title: schema.sql
    lang: PostgreSQL
    code: |
      CREATE TABLE orders (
        id              uuid PRIMARY KEY,
        user_id         uuid NOT NULL REFERENCES users(id),
        amount_cents    integer NOT NULL,
        status          text NOT NULL DEFAULT 'PENDING'
      );
```

```agenda
title: Tuesday standup
items:
  - { time: "09:00", duration: 5m, title: Round-robin, owner: Host }
  - { time: "09:05", duration: 20m, title: Status updates, desc: Each team for 5 minutes }
  - { time: "09:25", duration: 30m, title: Tech deep-dive, owner: API team, desc: Walk-through of the new orders service }
  - { time: "09:55", duration: 5m, title: Action items + wrap }
```

```tree
title: Repo layout
nodes:
  - { id: root, label: avodado }
  - { id: packages, parent: root, label: packages }
  - { id: core, parent: packages, label: '@avodado/core', note: pure model }
  - { id: render, parent: packages, label: '@avodado/render', note: HTML out }
  - { id: export, parent: packages, label: '@avodado/export', note: PDF/HTML }
  - { id: cli, parent: packages, label: '@avodado/cli', note: avo binary }
  - { id: resources, parent: root, label: resources, note: fixtures + reference renderer }
  - { id: playground, parent: root, label: playground, note: test docs }
```

```pyramid
title: Engineering priorities
levels:
  - { label: Vision, desc: Documentation as a navigable typed model }
  - { label: Strategy, desc: Files on disk are the source of truth }
  - { label: This quarter, desc: "37 blocks, theme support, agent skill" }
  - { label: This week, desc: Phase 2 blocks shipped }
```

```funnel
title: Onboarding funnel
stages:
  - { label: Landed, value: 10000 }
  - { label: Read docs, value: 4200 }
  - { label: Ran avo init, value: 1800 }
  - { label: Shipped a doc, value: 740 }
  - { label: Wired CI, value: 220 }
```

```flow
title: Decision flow
description: Whether to accept a payment, with the error path going to a rejection.
nodes:
  - { id: start, col: 1, row: 1, kind: start, label: Start }
  - { id: check, col: 2, row: 1, kind: decision, label: Token valid? }
  - { id: charge, col: 3, row: 1, kind: process, label: Charge card }
  - { id: reject, col: 2, row: 2, kind: end, label: Reject }
  - { id: done, col: 3, row: 2, kind: end, label: Done }
edges:
  - { from: start, to: check }
  - { from: check, to: charge, label: "yes" }
  - { from: check, to: reject, label: "no", kind: error }
  - { from: charge, to: done }
```

```state
title: Order lifecycle
description: PENDING is the only state visible inside the txn; CONFIRMED is the only post-commit state.
states:
  - { id: s0, col: 1, row: 1, kind: start }
  - { id: pending, col: 2, row: 1, kind: wait, name: PENDING }
  - { id: confirmed, col: 3, row: 1, kind: active, name: CONFIRMED }
  - { id: cancelled, col: 3, row: 2, kind: wait, name: CANCELLED }
  - { id: end, col: 4, row: 1, kind: terminal }
transitions:
  - { from: s0, to: pending, event: create }
  - { from: pending, to: confirmed, event: authorize_ok }
  - { from: pending, to: cancelled, event: authorize_fail }
  - { from: confirmed, to: end, event: ship }
```

```dfd
title: Order placement data flow
nodes:
  - { id: client, col: 1, row: 1, kind: external, name: Client }
  - { id: orders, col: 2, row: 1, kind: process, name: Place order, num: 1 }
  - { id: pay, col: 3, row: 1, kind: external, name: Payment GW }
  - { id: db, col: 2, row: 2, kind: store, name: orders }
edges:
  - { from: client, to: orders, label: POST /orders }
  - { from: orders, to: pay, label: authorize }
  - { from: orders, to: db, label: INSERT }
```

```journey
title: Onboarding journey
stages:
  - { label: Discover }
  - { label: Sign up }
  - { label: Activate }
  - { label: Pay }
rows:
  - { label: Touchpoint, cells: [Landing, Form, Email, Checkout] }
  - { label: Time, cells: [30s, 90s, 24h, 60s] }
  - { label: Friction, cells: [Low, Medium, Low, Medium] }
emotion: [0.75, 0.40, 0.60, 0.85]
```

```gantt
title: Quarterly plan
periods: [Q1, Q2, Q3, Q4]
tasks:
  - { label: Discovery, start: 0, span: 1, kind: done }
  - { label: Core build, start: 1, span: 2, kind: active }
  - { label: Beta, start: 2, span: 1 }
  - { label: GA, start: 3, span: 1, kind: milestone }
  - { label: Support hand-off, start: 3, span: 1 }
```

```graph
title: Service dependency graph
nodes:
  - { id: web, col: 1, row: 1, label: web, group: 0 }
  - { id: api, col: 2, row: 1, label: api, group: 1 }
  - { id: pay, col: 3, row: 1, label: payment, group: 2 }
  - { id: db, col: 2, row: 2, label: postgres, group: 3 }
  - { id: cache, col: 1, row: 2, label: redis, group: 4 }
edges:
  - { from: web, to: api }
  - { from: api, to: pay }
  - { from: api, to: db }
  - { from: api, to: cache, dir: undirected }
```

```quadrant
title: Effort vs impact
description: Where each candidate initiative lands; quick wins go top-left, big bets top-right.
xAxis: { label: Effort, low: Low, high: High }
yAxis: { label: Impact, low: Low, high: High }
items:
  - { x: 0.18, y: 0.82, label: Ship the skill }
  - { x: 0.80, y: 0.90, label: MCP server }
  - { x: 0.22, y: 0.30, label: README polish }
  - { x: 0.75, y: 0.22, label: VS Code ext }
  - { x: 0.55, y: 0.65, label: Hosted preview }
```

```swimlane
title: Cross-functional handoff
lanes:
  - { label: Customer }
  - { label: Sales }
  - { label: Engineering }
  - { label: Ops }
steps:
  - { id: req, col: 1, lane: 0, kind: start, label: Submit request }
  - { id: triage, col: 2, lane: 1, kind: decision, label: Qualify? }
  - { id: scope, col: 3, lane: 2, label: Scope work }
  - { id: build, col: 4, lane: 2, label: Build }
  - { id: deploy, col: 5, lane: 3, label: Deploy }
  - { id: done, col: 6, lane: 0, kind: end, label: Receive }
links:
  - { from: req, to: triage }
  - { from: triage, to: scope }
  - { from: scope, to: build }
  - { from: build, to: deploy }
  - { from: deploy, to: done }
```

```c4
title: System context
description: Who uses ShopCo and which external systems it depends on.
level: container
boundary: { label: ShopCo platform }
nodes:
  - { id: shopper, col: 1, row: 1, kind: person, name: Shopper, desc: A customer placing an order from web or mobile. }
  - { id: web, col: 2, row: 1, kind: container, family: client, name: Web app, tech: Next.js, desc: Server-rendered React. }
  - { id: api, col: 3, row: 1, kind: container, family: service, name: Orders API, tech: Go, desc: "Authorises, persists, emits events." }
  - { id: pg, col: 3, row: 2, kind: store, name: Orders DB, tech: Postgres 16, desc: Single source of truth for orders. }
  - { id: pay, col: 4, row: 1, kind: external, name: Payment GW, desc: Stripe authorisation. }
edges:
  - { from: shopper, to: web, label: places order }
  - { from: web, to: api, label: POST /orders }
  - { from: api, to: pg, label: writes }
  - { from: api, to: pay, label: authorises }
```

```uml
title: Domain classes
description: The order domain — class boxes with attributes and methods, relationships marked with UML arrows.
classes:
  - id: order
    col: 1
    row: 1
    name: Order
    attrs: ["id: UUID", "status: Status", "total: Money", "items: OrderItem[]"]
    methods: ["place()", "confirm()", "cancel()"]
  - id: item
    col: 2
    row: 1
    name: OrderItem
    attrs: ["id: UUID", "sku: String", "qty: int", "price: Money"]
  - id: status
    col: 1
    row: 2
    name: Status
    stereotype: enumeration
    attrs: ["PENDING", "CONFIRMED", "CANCELLED"]
  - id: shopper
    col: 2
    row: 2
    name: Shopper
    attrs: ["id: UUID", "email: String"]
rels:
  - { from: order, to: item, kind: composition, label: contains }
  - { from: order, to: status, kind: association, label: has }
  - { from: shopper, to: order, kind: association, label: places }
```

```mece
title: Why are conversions down?
description: An issue tree — MECE breakdown of plausible causes, leaves are testable.
nodes:
  - { id: root, label: Lower conversion this quarter }
  - { id: traffic, parent: root, label: Traffic quality }
  - { id: friction, parent: root, label: Funnel friction }
  - { id: pricing, parent: root, label: Pricing / offer }
  - { id: t1, parent: traffic, label: Wrong audience }
  - { id: t2, parent: traffic, label: Ad fatigue, note: paid creative is stale }
  - { id: f1, parent: friction, label: Slow checkout, note: p95 over 4s on mobile }
  - { id: f2, parent: friction, label: Mobile bugs }
  - { id: f3, parent: friction, label: Required signup }
  - { id: p1, parent: pricing, label: Competitor undercut }
  - { id: p2, parent: pricing, label: Shipping fee surprise }
```

```frontend
title: React component tree
description: Top-down hierarchy of the orders app — providers in purple, hooks in violet, store in orange.
nodes:
  - { id: app, kind: root, name: App }
  - { id: auth, parent: app, kind: provider, name: AuthProvider }
  - { id: theme, parent: app, kind: provider, name: ThemeProvider }
  - { id: layout, parent: auth, kind: layout, name: AppLayout }
  - { id: home, parent: layout, kind: page, name: Home }
  - { id: orders, parent: layout, kind: page, name: OrdersPage }
  - { id: list, parent: orders, kind: component, name: OrderList }
  - { id: card, parent: list, kind: component, name: OrderCard }
  - { id: badge, parent: card, kind: leaf, name: StatusBadge }
  - { id: hook, parent: orders, kind: hook, name: useOrders }
  - { id: cart, parent: app, kind: store, name: cartStore, note: Zustand }
```

```cluster
title: Production cluster
description: Two namespaces (api / data) with replicas, plus the cross-namespace edges from API services to their backing stores.
clusters:
  - { id: api, label: api namespace, kind: namespace }
  - { id: data, label: data namespace, kind: namespace }
services:
  - { id: web, cluster: api, label: web, kind: service, tech: Next.js, replicas: 3 }
  - { id: orders, cluster: api, label: orders, kind: service, tech: Go 1.22, replicas: 4 }
  - { id: payments, cluster: api, label: payments, kind: service, tech: Node 20, replicas: 2 }
  - { id: pg, cluster: data, label: postgres, kind: store, tech: Postgres 16, replicas: 1 }
  - { id: redis, cluster: data, label: redis, kind: cache, tech: Redis 7, replicas: 2 }
  - { id: bus, cluster: data, label: events, kind: queue, tech: NATS, replicas: 3 }
edges:
  - { from: web, to: orders }
  - { from: orders, to: pg }
  - { from: orders, to: redis }
  - { from: orders, to: bus, kind: dashed }
  - { from: payments, to: pg }
```

```block
title: Layered architecture
description: A tiered layout — clients call the gateway, which fans out to microservices, each backed by the data layer.
systemLabel: E-COMMERCE PLATFORM
layers:
  - { label: Client layer }
  - { label: API gateway }
  - { label: Microservices }
  - { label: Data layer }
nodes:
  - { id: web, layer: 0, kind: client, name: Web app, tech: React }
  - { id: mob, layer: 0, kind: client, name: Mobile, tech: iOS / Android }
  - { id: gw, layer: 1, kind: gateway, name: API Gateway, tech: Kong }
  - { id: orders, layer: 2, kind: microservice, name: Orders, tech: Go }
  - { id: catalog, layer: 2, kind: microservice, name: Catalog, tech: Node }
  - { id: payments, layer: 2, kind: microservice, name: Payments, tech: Java }
  - { id: ordersdb, layer: 3, kind: db, name: Orders DB, tech: Postgres }
  - { id: catalogdb, layer: 3, kind: db, name: Catalog DB, tech: MongoDB }
  - { id: cache, layer: 3, kind: cache, name: Cache, tech: Redis }
edges:
  - { from: web, to: gw }
  - { from: mob, to: gw }
  - { from: gw, to: orders }
  - { from: gw, to: catalog }
  - { from: gw, to: payments }
  - { from: orders, to: ordersdb }
  - { from: catalog, to: catalogdb }
  - { from: catalog, to: cache, kind: dashed }
  - { from: payments, to: ordersdb }
```

```infra
title: Cloud deployment
description: Generic cloud topology — edge → gateway → containers, backed by a database, object storage, cache and a queue worker. Two nested dashed groups show the cloud account and the private network inside it.
groups:
  - { id: cloud, label: Cloud account, col: 1, row: 1, cols: 4, rows: 2, color: "#374151" }
  - { id: net, label: Private network, col: 2, row: 1, cols: 3, rows: 2, color: "#0e54a1" }
nodes:
  - { id: cdn, col: 1, row: 1, kind: cdn, name: CDN, tech: edge cache }
  - { id: gw, col: 2, row: 1, kind: gateway, name: API Gateway, tech: load balancer }
  - { id: svc, col: 3, row: 1, kind: compute, name: API, tech: containers }
  - { id: db, col: 4, row: 1, kind: db, name: Database, tech: managed SQL }
  - { id: bucket, col: 4, row: 2, kind: bucket, name: Object storage, tech: blobs / files }
  - { id: cache, col: 3, row: 2, kind: cache, name: Cache, tech: in-memory }
  - { id: q, col: 2, row: 2, kind: queue, name: Queue, tech: messages }
  - { id: wk, col: 1, row: 2, kind: function, name: Worker, tech: async jobs }
edges:
  - { from: cdn, to: gw, label: HTTPS }
  - { from: gw, to: svc, label: routes }
  - { from: svc, to: db, label: SQL }
  - { from: svc, to: bucket, label: reads, kind: dashed }
  - { from: svc, to: cache, label: cache, kind: dashed }
  - { from: svc, to: q, label: publish, kind: dashed }
  - { from: q, to: wk, label: consume, kind: dashed }
```

```event
title: Order events
description: Producers publish to topics; consumers subscribe. Solid arrows are publishes, dashed are subscriptions.
nodes:
  - { id: api, col: 1, row: 1, kind: producer, name: Orders API, tech: publishes }
  - { id: pays, col: 1, row: 2, kind: producer, name: Payments, tech: publishes }
  - { id: t1, col: 2, row: 1, kind: topic, name: order.created, tech: topic }
  - { id: t2, col: 2, row: 2, kind: topic, name: payment.captured, tech: topic }
  - { id: email, col: 3, row: 1, kind: consumer, name: Email worker, tech: subscribes }
  - { id: ship, col: 3, row: 2, kind: consumer, name: Fulfilment, tech: subscribes }
  - { id: an, col: 3, row: 3, kind: consumer, name: Analytics, tech: subscribes }
edges:
  - { from: api, to: t1, label: publish }
  - { from: pays, to: t2, label: publish }
  - { from: t1, to: email, kind: dashed }
  - { from: t1, to: ship, kind: dashed }
  - { from: t1, to: an, kind: dashed }
  - { from: t2, to: ship, kind: dashed }
```

```ddd
title: Context map
description: Bounded contexts and how they relate. Solid arrows are upstream → downstream; dashed is a shared kernel.
nodes:
  - { id: sales, col: 1, row: 1, kind: context, name: Sales, tech: core }
  - { id: billing, col: 2, row: 1, kind: context, name: Billing, tech: supporting }
  - { id: ship, col: 2, row: 2, kind: context, name: Shipping, tech: supporting }
  - { id: catalog, col: 1, row: 2, kind: context, name: Catalog, tech: generic }
edges:
  - { from: sales, to: billing, label: "U → D" }
  - { from: sales, to: ship, label: "U → D · ACL" }
  - { from: catalog, to: sales, label: shared kernel, kind: dashed }
```

```network
title: Network zones
description: Trust boundaries from edge to data. The red "no direct" edge marks a forbidden connection between the load balancer and the database.
groups:
  - { id: z1, label: DMZ, col: 1, row: 1, cols: 1, rows: 2, color: "#f7952c" }
  - { id: z2, label: Private subnet, col: 2, row: 1, cols: 1, rows: 2, color: "#0e54a1" }
  - { id: z3, label: Data subnet, col: 3, row: 1, cols: 1, rows: 2, color: "#991b1b" }
nodes:
  - { id: lb, col: 1, row: 1, kind: gateway, name: Load balancer, tech: public }
  - { id: waf, col: 1, row: 2, kind: firewall, name: Firewall, tech: WAF }
  - { id: web, col: 2, row: 1, kind: compute, name: App servers, tech: private }
  - { id: cache, col: 2, row: 2, kind: cache, name: Cache, tech: private }
  - { id: db, col: 3, row: 1, kind: db, name: Database, tech: restricted }
edges:
  - { from: lb, to: waf, label: filter }
  - { from: waf, to: web, label: "443" }
  - { from: web, to: cache, label: "6379" }
  - { from: web, to: db, label: "5432" }
  - { from: lb, to: db, label: no direct, kind: forbidden }
```

```felogic
title: Frontend logic — strategy + engine
description: The checkout UI drives a pricing engine that selects a DiscountStrategy implementation; the API client then egresses (HTTPS) to the backend.
groups:
  - { id: app, label: App (browser), col: 1, row: 1, cols: 3, rows: 3, color: "#0e54a1" }
  - { id: net, label: Egress · network, col: 4, row: 1, cols: 1, rows: 1, color: "#6b7280" }
nodes:
  - { id: ui, col: 1, row: 1, kind: component, name: Checkout UI, note: renders form }
  - { id: engine, col: 2, row: 1, kind: engine, name: PricingEngine, note: computes total }
  - { id: api, col: 3, row: 1, kind: service, name: ApiClient, note: fetch wrapper }
  - { id: backend, col: 4, row: 1, kind: external, name: Orders API, note: REST /orders }
  - { id: cart, col: 1, row: 2, kind: hook, name: useCart(), note: state }
  - { id: iface, col: 2, row: 2, kind: interface, name: DiscountStrategy, note: calculate() }
  - { id: s1, col: 1, row: 3, kind: strategy, name: PercentOff, note: "% off" }
  - { id: s2, col: 2, row: 3, kind: strategy, name: BuyXGetY, note: bundle }
  - { id: s3, col: 3, row: 3, kind: strategy, name: NoDiscount, note: default }
edges:
  - { from: ui, to: engine, label: uses, kind: uses }
  - { from: ui, to: cart, label: reads, kind: reads }
  - { from: engine, to: iface, label: selects, kind: uses }
  - { from: s1, to: iface, kind: implements }
  - { from: s2, to: iface, kind: implements }
  - { from: s3, to: iface, kind: implements }
  - { from: engine, to: api, label: calls, kind: uses }
  - { from: api, to: backend, label: HTTPS, kind: egress }
```

```belogic
title: Backend logic — gateway + repository
description: A controller calls OrderService, which loads via an OrderRepository, charges through a PaymentGateway interface (Stripe/Adyen adapters), and egresses to Postgres, the event bus, and external gateways.
groups:
  - { id: svc, label: Service boundary, col: 1, row: 1, cols: 3, rows: 3, color: "#0e54a1" }
  - { id: infra, label: Infrastructure · egress, col: 4, row: 1, cols: 1, rows: 3, color: "#6b7280" }
nodes:
  - { id: ctrl, col: 1, row: 1, kind: controller, name: OrdersController, note: HTTP /orders }
  - { id: service, col: 2, row: 1, kind: service, name: OrderService, note: use case }
  - { id: stripe, col: 3, row: 1, kind: adapter, name: StripeAdapter, note: implements }
  - { id: queue, col: 4, row: 1, kind: queue, name: EventBus, note: order.created }
  - { id: repo, col: 1, row: 2, kind: repository, name: OrderRepository, note: data access }
  - { id: iface, col: 2, row: 2, kind: interface, name: PaymentGateway, note: charge() }
  - { id: adyen, col: 3, row: 2, kind: adapter, name: AdyenAdapter, note: implements }
  - { id: db, col: 4, row: 2, kind: db, name: postgres, note: orders table }
  - { id: model, col: 1, row: 3, kind: model, name: Order, note: entity }
  - { id: ext1, col: 4, row: 3, kind: external, name: Stripe API, note: HTTPS }
edges:
  - { from: ctrl, to: service, label: handles, kind: uses }
  - { from: service, to: repo, label: loads, kind: uses }
  - { from: repo, to: model, label: reads, kind: reads }
  - { from: repo, to: db, label: SQL, kind: egress }
  - { from: service, to: iface, label: charges, kind: uses }
  - { from: stripe, to: iface, kind: implements }
  - { from: adyen, to: iface, kind: implements }
  - { from: stripe, to: ext1, label: HTTPS, kind: egress }
  - { from: service, to: queue, label: publishes, kind: uses }
```

```dag
title: Build pipeline
description: "CI stages fan out and back in. The w: 2 spans make Checkout, Build, and Deploy cover two columns."
nodes:
  - { id: src, col: 1, row: 1, w: 2, kind: start, label: Checkout }
  - { id: lint, col: 1, row: 2, kind: process, label: Lint }
  - { id: test, col: 2, row: 2, kind: process, label: Unit tests }
  - { id: build, col: 1, row: 3, w: 2, kind: process, label: Build }
  - { id: deploy, col: 1, row: 4, w: 2, kind: end, label: Deploy }
edges:
  - { from: src, to: lint }
  - { from: src, to: test }
  - { from: lint, to: build }
  - { from: test, to: build }
  - { from: build, to: deploy }
```

## Table

```table
title: Plan comparison
columns:
  - { label: Plan }
  - { label: Price, align: r }
  - { label: Seats, align: r, highlight: true }
rows:
  - [ Free, "$0", "1" ]
  - [ Pro, "$20", "10" ]
  - [ Team, { v: "$80", tone: pos }, "50" ]
```

## Sequence

```sequence
id: sw-seq-checkout
title: Place order
endpoint: { method: POST, path: /orders }
actors:
  - { id: client, name: Client }
  - { id: api, name: Orders API }
  - { id: db, name: Postgres, external: true }
messages:
  - { from: client, to: api, label: POST /orders, kind: sync }
  - { from: api, to: db, label: INSERT order, kind: async }
  - { from: api, to: client, label: 201 Created, kind: response }
```

## ERD

```erd
title: Shop schema
entities:
  - name: users
    columns:
      - { name: id, type: uuid, pk: true }
      - { name: email, type: text }
  - name: orders
    columns:
      - { name: id, type: uuid, pk: true }
      - { name: user_id, type: uuid, fk: true }
      - { name: total, type: numeric }
relations:
  - { from: orders, to: users, card: 'N:1', label: placed by }
```

## User story

```userstory
id: sw-us-1
role: shopper
want: pay in one step
soThat: I can check out quickly
priority: High
points: 3
criteria:
  - { given: a saved card, when: I confirm, then: the order is placed }
links:
  - { ref: '#sw-seq-checkout', label: Checkout flow }
```

## Timeline

```timeline
title: Roadmap
items:
  - { label: MVP, date: Q1, status: done }
  - { label: Beta, date: Q2, status: current }
  - { label: GA, date: Q3, status: next }
```

## Kanban

```kanban
title: Sprint board
columns:
  - { label: To do, cards: [ { title: Auth, tag: backend }, { title: Login UI } ] }
  - { label: Doing, cards: [ { title: Checkout, tag: api } ] }
  - { label: Done, cards: [ { title: DB schema } ] }
```

## Tracker

```tracker
title: Tasks
items:
  - { task: Set up CI, status: done, priority: high, owner: Ana }
  - { task: Payment flow, status: doing, priority: high, owner: Lee, due: Fri }
  - { task: Write docs, status: todo, priority: med }
  - { task: Rate limiting, status: blocked, priority: low }
```

## Wireframe

```wireframe
title: Checkout screen
screens:
  - device: phone
    title: Checkout
    elements:
      - { type: header, label: Checkout }
      - { type: input, label: Card number }
      - { type: input, label: Expiry }
      - { type: button, label: Pay now, tone: accent }
      - { type: text, label: Secure payment, align: c, tone: muted }
```

## API endpoint

```endpoint
method: POST
path: /orders/{cartId}
title: Create an order
description: Convert a cart into an order and start fulfilment.
auth: Bearer <token>
params:
  - { name: cartId, in: path, type: uuid, required: true, desc: Cart to convert }
  - { name: dry-run, in: query, type: boolean, desc: Validate without persisting }
body:
  - { name: items, type: "Item[]", required: true, desc: Line items }
  - { name: coupon, type: string, desc: Optional discount code }
responses:
  - { status: 201, desc: Order created }
  - { status: 400, desc: Invalid cart }
  - { status: 401, desc: Missing or invalid token }
request: |
  { "items": [{ "sku": "A1", "qty": 2 }], "coupon": "SAVE10" }
response: |
  { "id": "ord_123", "status": "pending", "total": 42.00 }
```

## Pull quote

```pullquote
text: Site group = read at that plant. Role group = extra actions on top.
attribution: The taxonomy in one line
```

## Layers

```layers
title: Access in three layers
items:
  - { kicker: L1, title: Identity, source: Entra JWT, question: "Are you a signed-in user?", body: Validate the token and resolve groups. }
  - { kicker: L2, title: Site scope, source: JWT + lookup, question: "Which sites may you see?", body: Confirm the site is in the user's set. }
  - { kicker: L3, title: Permission, source: App DB, question: "What may you do here?", body: Resolve persona permissions from the matrix. }
```

## Success callout

```callout
tone: success
title: Why this scales
body: Site and role are separate group types, so they grow on independent axes.
```
