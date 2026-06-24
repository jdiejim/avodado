```meta
title: RFC — Idempotent order creation
subtitle: A proposal to make POST /orders safe to retry under network failure.
tag: RFC-012
```

## Problem

Clients retry POST /orders on timeouts, occasionally creating duplicate orders. We
need creation to be safe to retry without double-charging.

```mece
title: Why duplicates happen
nodes:
  - { id: root, label: Duplicate orders }
  - { id: net, parent: root, label: Network retries }
  - { id: timeout, parent: net, label: Client timeout then retry }
  - { id: lb, parent: net, label: LB re-dispatch }
  - { id: usr, parent: root, label: User double-submit }
  - { id: dbl, parent: usr, label: Double-click }
```

## Alternatives

```options
title: Alternatives
items:
  - { kicker: A, title: Dedup by cart hash, how: "Reject if an identical cart exists recently.", pros: [No client change], cons: ["False positives on real re-orders"], verdict: "REJECTED", tone: rejected }
  - { kicker: B, title: Idempotency key, how: "Client sends a key; server stores the first result.", pros: [Exactly-once semantics, Standard pattern], cons: ["Clients must send a key"], verdict: "CHOSEN", tone: chosen }
```

## Proposed design

```block
title: Idempotency layer
systemLabel: ORDERS API
layers:
  - { label: Edge }
  - { label: Service }
  - { label: Data }
nodes:
  - { id: api, layer: 0, kind: gateway, name: API handler, tech: reads Idempotency-Key }
  - { id: store, layer: 1, kind: service, name: Idempotency store, tech: key → response }
  - { id: orders, layer: 1, kind: service, name: Order service, tech: creates order }
  - { id: db, layer: 2, kind: store, name: orders-db, tech: Postgres }
edges:
  - { from: api, to: store, label: lookup key }
  - { from: store, to: orders, label: miss → create }
  - { from: orders, to: db }
```

## Behavior

```flow
id: flow-idem
title: First call vs. retry
nodes:
  - { id: in, kind: start, label: "POST + key" }
  - { id: seen, kind: decision, label: "key seen?" }
  - { id: create, kind: process, label: "create + store result" }
  - { id: replay, kind: process, label: "return stored result" }
  - { id: out, kind: end, label: "201" }
edges:
  - { from: in, to: seen }
  - { from: seen, to: create, label: "no" }
  - { from: seen, to: replay, label: "yes" }
  - { from: create, to: out }
  - { from: replay, to: out }
```

```tracker
items:
  - { task: "Agree the Idempotency-Key header contract with clients", status: todo, priority: high }
  - { task: "Pick the store TTL (24h?) and eviction policy", status: todo, priority: med }
```
