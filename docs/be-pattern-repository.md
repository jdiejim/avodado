```meta
title: The Repository pattern
subtitle: A backend-pattern tutorial — the card, the structure, the runtime, and a backlog to adopt it. Render as a deck with `avo slides`.
tag: BE PATTERN · TUTORIAL
logo: https://raw.githubusercontent.com/jdiejim/avodado/main/avodado_logo.png
```

## The pattern at a glance {center}

```pattern
name: Repository
category: Backend
intent: Hide persistence behind a collection-like interface so the domain never sees the database.
forces: [Swap the data store, Unit-test without a DB, Keep query details out of the domain]
solution: The service depends on a repository interface (a port); a concrete adapter implements it against the real store.
participants:
  - { name: OrderRepository, role: the port the service depends on }
  - { name: PgOrderRepository, role: Postgres adapter (implements the port) }
  - { name: OrderService, role: caller — pure domain logic }
consequences:
  pros: [Swappable storage, Testable with a fake, Clear seam between domain and I/O]
  cons: [Another layer to maintain, Risk of anemic pass-through methods]
```

## The structure

The service talks to a **port** (`OrderRepository`); a concrete **adapter**
implements it. Only the adapter knows about Postgres.

```belogic
title: Controller → service → repository → store
nodes:
  - { id: ctl, col: 1, row: 1, kind: controller, name: OrderController, note: "POST /orders" }
  - { id: svc, col: 2, row: 1, kind: service, name: OrderService, note: domain logic }
  - { id: iface, col: 2, row: 2, kind: interface, name: OrderRepository, note: the port }
  - { id: pg, col: 1, row: 2, kind: repository, name: PgOrderRepository, note: the adapter }
  - { id: db, col: 3, row: 2, kind: db, name: orders-db, note: Postgres }
edges:
  - { from: ctl, to: svc, kind: uses }
  - { from: svc, to: iface, kind: uses }
  - { from: pg, to: iface, kind: implements }
  - { from: pg, to: db, kind: egress }
```

## At runtime

The service never sees SQL — it calls `save(order)` on the interface, and the
adapter does the rest.

```sequence
id: seq-repo
title: Placing an order through the repository
actors:
  - { id: C, name: Controller }
  - { id: S, name: OrderService }
  - { id: R, name: OrderRepository }
  - { id: DB, name: Postgres, external: true }
messages:
  - { from: C, to: S, label: placeOrder(cmd), kind: sync }
  - { from: S, to: R, label: save(order), kind: sync }
  - { from: R, to: DB, label: INSERT, kind: sync }
  - { from: DB, to: R, label: row, kind: response }
  - { from: R, to: S, label: Order, kind: response }
  - { from: S, to: C, label: orderId, kind: response }
```

## When to reach for it

```list
title: Use the repository pattern when…
style: check
items:
  - { lead: You'll swap or add stores, text: "Postgres now; a cache or another DB later.", done: true }
  - { lead: You want fast unit tests, text: "Inject a fake repository — no database needed.", done: true }
  - { lead: The domain must stay pure, text: No SQL or ORM types leak into services., done: true }
  - { lead: It's a tiny CRUD app, text: The extra layer may not pay for itself., done: false }
```

## Backlog to adopt it

```stories
title: Adoption backlog
items:
  - { id: BE-1, title: Define the port, role: backend dev, want: an OrderRepository interface, soThat: services depend on an abstraction, priority: High, points: 3, open: true, criteria: [{ given: a service, when: it persists an order, then: "it calls the interface, not the DB" }], links: [{ ref: "#seq-repo", label: Runtime flow }] }
  - { id: BE-2, title: Postgres adapter, role: backend dev, want: a PgOrderRepository, soThat: orders actually persist, priority: High, points: 5 }
  - { id: BE-3, title: In-memory fake, role: backend dev, want: a fake repo for tests, soThat: tests run without a database, priority: Med, points: 2 }
```
