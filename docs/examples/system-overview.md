```meta
title: Orders system overview
subtitle: How the orders system fits together — context, landscape, one module, one flow.
tag: OVERVIEW
```

## Context

```c4
level: context
title: The orders system in its world
nodes:
  - { id: shopper, kind: person, name: Shopper }
  - { id: orders, kind: system, name: Orders system }
  - { id: pay, kind: external, name: Payments }
  - { id: ship, kind: external, name: Shipping }
edges:
  - { from: shopper, to: orders, label: places orders }
  - { from: orders, to: pay, label: charges }
  - { from: orders, to: ship, label: notifies }
```

## Landscape

```block
title: Services and backbone
systemLabel: ORDERS PLATFORM
layers:
  - { label: Apps }
  - { label: Backbone }
nodes:
  - { id: web, layer: 0, kind: client, name: Storefront, tech: Next.js }
  - { id: api, layer: 0, kind: service, name: Orders API, tech: Fargate }
  - { id: bus, layer: 1, kind: queue, name: Event bus, tech: managed }
  - { id: db, layer: 1, kind: store, name: orders-db, tech: Postgres }
edges:
  - { from: web, to: api }
  - { from: api, to: db }
  - { from: api, to: bus }
```

## One module — the API internals

```belogic
title: Orders API — the request chain
groups:
  - { id: svc, label: "orders/api", col: 1, row: 1, cols: 2, rows: 2, color: "#0e54a1" }
  - { id: io, label: "Egress", col: 3, row: 1, cols: 1, rows: 2, color: "#6b7280" }
nodes:
  - { id: route, col: 1, row: 1, kind: controller, name: createOrder, note: "POST /orders" }
  - { id: svc1, col: 2, row: 1, kind: service, name: OrderService, note: "validate + place" }
  - { id: repo, col: 1, row: 2, kind: repository, name: OrderRepo, note: "persist" }
  - { id: gw, col: 2, row: 2, kind: gateway, name: PaymentGateway, note: "charge" }
  - { id: db, col: 3, row: 1, kind: db, name: orders-db, note: Postgres }
  - { id: pay, col: 3, row: 2, kind: external, name: Payments, note: third-party }
edges:
  - { from: route, to: svc1, label: calls, kind: uses }
  - { from: svc1, to: repo, label: saves, kind: uses }
  - { from: svc1, to: gw, label: charges, kind: uses }
  - { from: repo, to: db, label: SQL, kind: egress }
  - { from: gw, to: pay, label: HTTPS, kind: egress }
```

## One flow

```sequence
id: seq-overview
actors:
  - { id: c, name: Client }
  - { id: api, name: Orders API }
  - { id: pay, name: Payments }
messages:
  - { from: c, to: api, label: POST /orders, kind: sync }
  - { from: api, to: pay, label: charge }
  - { from: pay, to: api, label: ok, kind: response }
  - { from: api, to: c, label: 201 Created, kind: response }
```
