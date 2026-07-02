```meta
title: Avodado — all blocks
subtitle: A reference document showing every block type the renderer supports.
tag: DEMO · v1
```

## Welcome

The blocks below are rendered from typed YAML fences. Edit the source `.md`
file, rerun `avo html`, and the HTML updates accordingly.

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

## Architecture map

```archmap
title: Retail platform — target architecture
description: "The capability landscape by domain: white tiles are current, dashed blue are to be built, green are new, dashed red are gaps, gray are retiring."
cols: 3
areas:
  - label: Customer channels
    accent: blue
    items:
      - Web storefront
      - { name: Mobile app, status: target }
      - Contact centre
  - label: Commerce
    accent: teal
    items:
      - Catalog
      - Checkout
      - { name: Promotions, status: gap }
      - { name: Subscriptions, status: new }
  - label: Fulfilment
    accent: green
    items:
      - Warehouse mgmt
      - { name: Carrier gateway, status: target }
  - label: Data & analytics
    accent: amber
    items:
      - Reporting
      - { name: Customer 360, status: target }
      - { name: ML forecasting, status: gap }
  - label: Platform services
    accent: purple
    desc: Shared capabilities every domain builds on.
    items:
      - Identity
      - { name: Event bus, status: new }
      - { name: Legacy ESB, status: deprecated }
  - label: Integration
    accent: navy
    items:
      - API gateway
      - { name: Partner APIs, status: target }
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

## Risk register

```risk
title: Launch risks
description: Reviewed weekly until GA.
items:
  - { risk: Key dependency ships late, likelihood: high, impact: high, mitigation: Feature-flag the integration and keep the old path., owner: PM, status: open }
  - { risk: Traffic spike overwhelms the API, likelihood: med, impact: high, mitigation: Autoscaling + load-shedding at the gateway., owner: Platform, status: mitigating }
  - { risk: Docs lag the release, likelihood: med, impact: low, status: accepted }
  - { risk: Beta feedback arrives after freeze, likelihood: low, impact: low, mitigation: Weekly beta digest to the team., owner: DevRel, status: closed }
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

## Capability matrix

```matrix
title: Who can do what
corner: Role / App
cols: [Billing, Reports, Admin]
rows:
  - { label: Owner,   cells: [Full, Full, Full] }
  - { label: Manager, cells: [Full, Read, "—"] }
  - { label: Viewer,  cells: [Read, Read, "—"] }
```

## Anatomy

```anatomy
title: Anatomy of a permission
separator: ":"
parts:
  - { label: App,     value: atlas,         note: Which product. }
  - { label: Feature, value: billing,       note: The area within the app. }
  - { label: Action,  value: invoices.read, note: The specific capability. }
```

## Composition

```composition
title: How access is decided
result: May read invoices
gates:
  - { label: Identity,   desc: A valid signed-in user. }
  - { label: Scope,      desc: The request is in range. }
  - { label: Permission, desc: The action is granted. }
```

## Drivers

```drivers
title: What guided the design
items:
  - { title: Single sign-on, body: One login carries the user everywhere., tag: "HOW: token", icon: lock, accent: purple }
  - { title: Read per site, body: "Access is scoped to the user's sites.", tag: "WHERE: site group", icon: location, accent: green }
  - { title: Governed roles, body: "An IGA requests, approves, certifies.", tag: "WHO: role groups", icon: shield, accent: blue }
  - { title: Per-app permissions, body: The same role differs per app., tag: "WHAT: matrix", icon: grid, accent: amber }
```

## Options

```options
title: Approaches explored
items:
  - { kicker: Option 1, title: App-managed roles, how: Roles in our own DB., pros: [Full control], cons: ["Second source of truth"], verdict: "REJECTED", tone: rejected }
  - { kicker: Option 2, title: Global role groups, how: One global group per role., pros: [Fewest groups], cons: ["Applies at every site"], verdict: "VIABLE", tone: viable }
  - { kicker: Option 3, title: Per-site role groups, how: One group per persona per site., pros: [Least privilege], cons: [Most groups], verdict: "CHOSEN", tone: chosen }
```

## Decision scorecard

```scorecard
title: Queue technology choice
description: "Weighted 0-5 scoring across the four criteria that mattered."
criteria:
  - { label: Throughput, weight: 2 }
  - { label: Operational cost, weight: 2 }
  - { label: Team familiarity }
  - { label: Ecosystem }
options:
  - { label: Kafka, scores: [5, 2, 3, 5], note: self-hosted }
  - { label: SQS, scores: [3, 5, 4, 3], note: managed }
  - { label: RabbitMQ, scores: [3, 3, 4, 4] }
```

## Spec

```spec
title: Per-site role groups
accent: green
rows:
  - { label: Groups, value: "SiteN-Users (read) + SiteN-<Persona> per staffed plant." }
  - { label: Roles, value: "Each group reads as (site, role); the token carries the scope." }
  - { label: Resolution, steps: [Decode token, "Read (site, role)", Check matrix] }
```

## Fancy list

```list
title: Why documentation-as-code
style: accent
items:
  - { lead: Typed blocks, text: "52 strict schemas, validated by avo check.", accent: blue }
  - { lead: One source of truth, text: Diagrams live in the .md file., accent: green }
  - { lead: Many outputs, text: "HTML, slides, and PDF from one file.", accent: amber }
```

## Story backlog

```stories
title: Sprint backlog
items:
  - { id: US-1, title: One-step checkout, role: shopper, want: pay in one step, soThat: I finish faster, priority: High, points: 5, tags: [checkout], open: true, criteria: [{ given: items in cart, when: I pay, then: an order is created }] }
  - { id: US-2, title: Save payment method, role: returning shopper, want: store a card, soThat: I skip re-entry, priority: Med, points: 3 }
```

## Design pattern

```pattern
name: Repository
category: Backend
intent: Hide persistence behind a collection-like interface so the domain never sees the database.
forces: [Swap the data store, Unit-test without a DB, No query leaks into the domain]
participants:
  - { name: OrderRepository, role: interface the service depends on }
  - { name: PgOrderRepository, role: Postgres implementation }
  - { name: OrderService, role: caller (domain logic) }
consequences:
  pros: [Swappable storage, Testable with a fake]
  cons: [Another layer, Risk of anemic pass-through]
```

## Gallery

```gallery
title: Bug gallery
cols: 2
items:
  - { title: "N+1 query", lang: JavaScript, accent: red, caption: "1000 users = 1001 queries.", code: "users.forEach(async u =>\n  await q('...user_id=?', u.id));" }
  - { title: "Off-by-one", lang: JavaScript, accent: amber, caption: "arr[len] is undefined.", code: "for (let i=0; i<=arr.length; i++)\n  process(arr[i]);" }
  - { title: "Open redirect", lang: JavaScript, accent: red, caption: "Allowlist destinations.", code: "res.redirect(req.query.url);" }
  - { title: "Secrets in code", lang: JavaScript, accent: red, caption: "Use env vars + a scanner.", code: "const KEY = 'sk-live-abc123';" }
```

## Gallery — diagram comparison

```gallery
title: Compare architectures
cols: 3
items:
  - title: Monolith
    caption: One deployable unit.
    block:
      type: c4
      level: container
      nodes:
        - { id: u, col: 1, row: 1, kind: person, name: User }
        - { id: app, col: 2, row: 1, kind: container, family: service, name: App }
        - { id: db, col: 2, row: 2, kind: store, name: DB }
      edges:
        - { from: u, to: app }
        - { from: app, to: db }
  - title: Microservices
    caption: Independent services.
    block:
      type: c4
      level: container
      nodes:
        - { id: gw, col: 1, row: 1, kind: container, family: service, name: Gateway }
        - { id: a, col: 2, row: 1, kind: container, family: service, name: Orders }
        - { id: b, col: 2, row: 2, kind: container, family: service, name: Billing }
      edges:
        - { from: gw, to: a }
        - { from: gw, to: b }
  - title: Event-driven
    caption: Async via a broker.
    block:
      type: block
      nodes:
        - { id: p, col: 1, row: 1, kind: producer, name: Producer }
        - { id: bus, col: 2, row: 1, kind: topic, name: Bus }
        - { id: c, col: 3, row: 1, kind: consumer, name: Consumer }
      edges:
        - { from: p, to: bus }
        - { from: bus, to: c }
```

## Data charts

```chart
title: p95 latency by week
kind: line
unit: ms
labels: [W1, W2, W3, W4, W5, W6]
series:
  - { label: /orders, accent: navy, values: [240, 226, 215, 188, 164, 150] }
  - { label: /search, accent: teal, values: [310, 295, 288, 262, 246, 231] }
```

```chart
title: Monthly cost by service
kind: bar
unit: k
labels: [API, Workers, Postgres, Cache]
series:
  - { label: March, accent: navy, values: [8.2, 4.6, 3.1, 1.2] }
  - { label: April, accent: amber, values: [7.4, 5.1, 3.3, 1.1] }
```

```chart
title: Traffic by client
kind: donut
unit: "%"
items:
  - { label: Web, value: 62, accent: navy }
  - { label: iOS, value: 23, accent: teal }
  - { label: Android, value: 15, accent: amber }
```

```chart
title: Queue vendors at a glance
kind: radar
labels: [Throughput, Latency, Cost, Ops burden, Ecosystem]
series:
  - { label: Kafka, accent: navy, values: [5, 4, 2, 2, 5] }
  - { label: SQS, accent: amber, values: [3, 3, 5, 5, 3] }
```

## Latency budget

```waterfall
title: Checkout API latency budget
description: Where the 250 ms budget goes, hop by hop.
unit: ms
budget: 250
items:
  - { label: DNS + TLS, value: 35 }
  - { label: Gateway, value: 20, desc: auth + routing }
  - { label: Orders service, value: 90 }
  - { label: Database, value: 70 }
  - { label: Serialization, value: 15 }
```

## Heatmap

```heatmap
title: p95 latency by region × hour
description: UTC hours, last 7 days.
unit: ms
xLabels: ["00", "04", "08", "12", "16", "20"]
rows:
  - { label: us-east-1, values: [122, 118, 145, 210, 265, 190] }
  - { label: eu-west-1, values: [110, 105, 168, 240, 195, 150] }
  - { label: ap-south-1, values: [180, 210, 310, 285, 240, 205] }
```

## Figure

```figure
src: https://avodado.dev/logo.png
alt: The Avodado logo
caption: "A figure block: an image in a bordered card, with an optional caption and width cap."
width: 420
```

## Unified diff

```diff
title: "fix: clamp retry backoff"
lang: TypeScript
code: |
  @@ -12,7 +12,7 @@
   function backoff(attempt: number): number {
  -  return 100 * attempt ** 2;
  +  return Math.min(30_000, 100 * attempt ** 2);
   }
```

## Runbook steps

```steps
title: Deploy a hotfix
description: The fast path for a production fix — branch, ship, tag.
items:
  - title: Branch from main
    body: Hotfixes always branch from the latest main.
    code: git checkout -b hotfix/fix-retry main
    lang: bash
  - title: Ship the fix
    body: Commit and push; CI runs the full suite.
    code: git push -u origin hotfix/fix-retry
    lang: bash
    note: CI must be green before the next step.
  - title: Tag and deploy
    code: git tag v1.4.1 && git push --tags
    lang: bash
```

## FAQ

```faq
title: Common questions
items:
  - q: Where does the content live?
    a: "In the .md files on disk — they are the single source of truth. Every diagram on this page is a typed YAML block."
    open: true
  - q: Do diagrams need a drawing tool?
    a: "No. Change the YAML and rerun avo html — the SVG updates."
  - q: How do I validate a doc?
    a: Run avo check and fix every diagnostic it reports.
```

## Capacity math

```envelope
title: Order-write capacity
description: The estimate that sizes the write path.
assumptions:
  - { label: Daily active users, value: 2M }
  - { label: Orders / user / day, value: "0.5" }
  - { label: Payload per order, value: 2 KB }
  - { label: Retention, value: 5 years }
steps:
  - { label: Orders per day, calc: "2M × 0.5", result: 1M/day }
  - { label: Write QPS, calc: "1M / 86,400 s", result: "≈ 12 rps" }
  - { label: Peak QPS, calc: "12 × 3 (peak factor)", result: "≈ 36 rps" }
  - { label: Storage per year, calc: "1M × 2 KB × 365", result: "≈ 730 GB/yr" }
result: { label: Provision for, value: "~75 rps write peak · ~4 TB over retention" }
```

## Service objectives

```slo
title: Orders API — SLOs
items:
  - { name: Availability, sli: Successful requests / total requests, target: 99.9%, current: 99.98%, window: 30d, budget: 0.15 }
  - { name: Latency, sli: Requests served under 400 ms (p99), target: 99%, current: 98.8%, window: 30d, budget: 0.6 }
  - { name: Freshness, sli: Order events indexed within 60 s, target: 99.5%, current: 97.9%, window: 7d, budget: 1.0 }
```

## Terminal session

```terminal
title: deploy — production
session: |
  $ kubectl rollout status deploy/orders-api
  # wait for the rollout to settle before tagging
  Waiting for deployment "orders-api" rollout to finish: 2 of 4 updated replicas are available...
  deployment "orders-api" successfully rolled out
  $ kubectl get pods -l app=orders-api
  NAME                          READY   STATUS    RESTARTS   AGE
  orders-api-7d4b9c6f5d-2xkqp   1/1     Running   0          52s
  orders-api-7d4b9c6f5d-9mwlt   1/1     Running   0          48s
  $ git tag v2.3.0 && git push --tags
```

## SWOT

```swot
title: Taking Avodado to the enterprise
description: Where we stand before the enterprise push.
strengths:
  - Docs-as-code fits existing review workflows
  - 75 typed blocks cover most technical stories
  - Renders to HTML, slides, and PDF from one file
weaknesses:
  - No SSO / SCIM integration yet
  - Small team — support hours are limited
opportunities:
  - Compliance push makes auditable docs attractive
  - AI agents author blocks natively via the skill
threats:
  - Incumbent wikis bundle "good enough" diagrams
  - Long procurement cycles slow adoption
```

## Conversion funnel

```funnel
title: Signup → paid conversion
description: Last 90 days, all channels.
unit: users
stages:
  - { label: Visited landing page, value: 48000 }
  - { label: Started signup, value: 9600, desc: email + password }
  - { label: Activated, value: 4300, desc: created a first doc }
  - { label: Upgraded to paid, value: 860 }
```

## OKRs

```okr
title: Q3 objectives
description: Two objectives, reviewed monthly.
items:
  - objective: Make onboarding effortless
    owner: Growth
    krs:
      - { kr: Time-to-first-doc under 5 minutes, progress: 0.7, status: on-track }
      - { kr: Activation rate from 45% to 60%, progress: 0.4, status: at-risk }
      - { kr: Ship 10 quick-start templates, progress: 1, status: done }
  - objective: Earn enterprise trust
    owner: Platform
    krs:
      - { kr: Ship SSO + audit log, progress: 0.85, status: on-track }
      - { kr: SOC 2 Type II report issued, progress: 0.2, status: off-track }
```

## Personas

```persona
title: Who we build for
personas:
  - name: Maya Chen
    role: Staff engineer
    quote: I want the diagram in the PR diff, not in a wiki.
    goals: [Docs that live with the code, Reviewable architecture changes]
    frustrations: [Stale wiki pages, Screenshots of whiteboards]
    tools: [VS Code, GitHub, Mermaid]
    accent: blue
  - name: Priya Patel
    role: Engineering manager
    quote: Every reorg breaks our onboarding docs.
    goals: [One source of truth per system, New joiners productive in week one]
    frustrations: ["Docs no one owns", Tribal knowledge in DMs]
    tools: [Linear, Notion, Slack]
    accent: teal
```

## Changelog

```changelog
title: Release history
releases:
  - version: 2.0.0
    date: 2026-06-24
    tag: breaking
    items:
      - { type: changed, text: "Config moved from .avodadorc to avodado.config.json" }
      - { type: removed, text: Dropped Node 18 support }
      - { type: security, text: Bumped yaml to patch CVE-2026-1234 }
  - version: 1.4.0
    date: 2026-05-12
    tag: minor
    items:
      - { type: added, text: Dark theme + custom theme files }
      - { type: fixed, text: Slide overflow on long tables }
  - version: 1.3.2
    date: 2026-04-03
    tag: patch
    items:
      - { type: fixed, text: Windows path handling in avo check }
```

## Team

```team
title: Who owns what
members:
  - { name: Ana Ruiz, role: Tech lead, focus: Rendering pipeline, accent: navy }
  - { name: Sam Okafor, role: Backend, focus: Sync + integrations, accent: teal }
  - { name: Lena Fischer, role: Design, focus: Themes and house style, accent: purple }
  - { name: Tom Alvarez, role: CLI, focus: avo commands and DX, accent: green }
  - { name: DevRel, initials: DR, role: Advocacy, focus: Docs and community, accent: amber }
```

## Design tokens

```palette
title: Brand palette
description: Core color tokens — reference by name, never by raw hex.
cols: 4
colors:
  - { name: Primary, value: "#0E54A1", usage: "Buttons, links, focus rings" }
  - { name: Ink, value: "#1F2937", usage: Body text and headings }
  - { name: Surface, value: "#F6F8FB", usage: Card and panel backgrounds }
  - { name: Positive, value: "#1F9747", usage: Success states }
  - { name: Warning, value: "#B45309", usage: Caution banners }
  - { name: Negative, value: "#B3261E", usage: Errors and destructive actions }
  - { name: Accent, value: "#5B4A8A", usage: Charts and highlights }
  - { name: Muted, value: "#8A8475", usage: Secondary text }
```

## Type scale

```typescale
title: Type scale
description: The ramp from display headings down to code.
items:
  - { name: Display, size: 40, weight: 700, font: display, lineHeight: 1.1, note: hero headings }
  - { name: H1, size: 28, weight: 700, font: display, lineHeight: 1.2 }
  - { name: Body, size: 15, lineHeight: 1.6 }
  - { name: Caption, size: 12, weight: 500, note: secondary text }
  - { name: Code, size: 13, font: mono }
```

## Usage guidelines

```dodont
title: Button usage
description: How to place and label buttons.
dos:
  - { text: Use one primary button per view }
  - { text: Write labels as verbs, example: "Save changes" }
  - { text: Pair a destructive action with a confirm step }
donts:
  - { text: Stack two primary buttons side by side }
  - { text: Disable a button without explaining why, example: "tooltip: Add a line item first" }
```

## Component inventory

```inventory
title: Component status
description: Maturity of the shared component library.
items:
  - { name: Button, status: stable, tag: v2 }
  - { name: Data table, status: beta, note: Column-resize API may change before GA }
  - { name: Date picker, status: experimental }
  - { name: Modal (legacy), status: deprecated, note: Use Dialog instead }
  - { name: Charts, status: planned, note: Targeted for next quarter }
```

## Array walkthrough

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

## Linked list

```linkedlist
title: Reversing a list — step 2
description: prev trails curr; each step flips one next pointer.
nodes:
  - { value: "9", tone: visited, label: prev }
  - { value: "4", tone: active, label: curr }
  - { value: "7", label: next }
  - { value: "1" }
```

## Binary tree

```bintree
title: BST search for 27
description: The tinted chain is the comparison path down to the target.
nodes:
  - { id: root, value: "19", tone: visited }
  - { id: l, value: "8", parent: root, side: left }
  - { id: ll, value: "4", parent: l, side: left }
  - { id: lr, value: "12", parent: l, side: right }
  - { id: r, value: "31", parent: root, side: right, tone: active }
  - { id: rl, value: "27", parent: r, side: left, tone: target }
  - { id: rr, value: "40", parent: r, side: right }
```

## Hash table

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

## Agent loop

```agentloop
title: Support triage agent
description: One loop turn — the agent reads the ticket, calls tools, and replies or escalates.
agent:
  name: Triage agent
  model: claude-sonnet-4-6
  note: Routes each ticket to a fix or a human.
env: Customer
tools:
  - { name: search_kb, desc: Search help-center articles }
  - { name: get_account, desc: Look up plan and billing state }
  - { name: create_ticket, desc: Escalate to a human queue }
memory:
  - conversation history
  - customer profile
stop: reply sent or ticket escalated
```

## Execution trace

```trace
title: Password reset — one episode
description: What the triage agent actually did, turn by turn.
turns:
  - role: user
    text: I never get the reset email.
  - role: assistant
    thinking: Could be a bounce — check delivery logs before blaming spam.
    text: Let me check our email logs.
  - role: tool
    tool: email_logs.search
    args: '{ "to": "sam@example.com", "type": "password_reset" }'
    result: "1 result: bounced (mailbox full)"
  - role: assistant
    text: Your mailbox rejected the email — free up space and I will resend it.
```

## Prompt anatomy

```prompt
title: Support reply template
description: The system + user template behind every triage turn.
segments:
  - kind: system
    label: role + guardrails
    text: "You are a support agent for {{product}}. Answer from the docs only."
  - kind: user
    text: "Customer ({{plan}} plan) asks: {{question}}"
vars:
  - { name: product, desc: Product name from config }
  - { name: plan, desc: Plan tier of the signed-in customer }
  - { name: question, desc: The inbound message }
```

## Context budget

```context
title: Where the 200k window goes
description: Steady-state budget for one triage turn.
window: 200000
segments:
  - { label: system prompt, tokens: 6000, accent: navy }
  - { label: tool schemas, tokens: 14000, accent: teal }
  - { label: retrieval, tokens: 60000, accent: amber, desc: top-8 chunks }
  - { label: history, tokens: 70000, accent: purple }
```

## Section divider

```divider
kicker: PART 2
title: What we change
subtitle: The three fixes, in the order we ship them.
accent: navy
```

## Big number

```bignumber
value: "-75%"
label: Checkout p95 after moving capture off the request path
context: "2.4s → 600ms, measured over four weeks of production traffic"
delta: "-1.8s"
trend: down
accent: green
```

## Takeaways

```takeaways
title: Takeaways
items:
  - text: The synchronous capture call was the bottleneck
    detail: It accounted for 71% of the 2.4s checkout p95.
  - text: Moving it to a queue cut p95 by 75%
    detail: No other change shipped in the window.
  - text: Conversion recovered within two weeks
    detail: "+0.4pp against the pre-regression baseline."
  - text: The pattern generalises
    detail: Audit every synchronous third-party call on the hot path.
```
