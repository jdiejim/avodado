```meta
title: Request trace — GET /orders/{id}
subtitle: Where 120 ms goes when the storefront asks for one order.
tag: TRACE · EXAMPLE
```

One request fans out to four services. The waterfall shows each span in its service lane on one time axis, so the reader sees which hop the response waited on.

```spans
id: orders-get-trace
title: GET /orders/{id}
description: Sampled from production, 2026-08-30. The payments call timed out once and was retried.
unit: ms
spans:
  - { id: get, service: api, name: "GET /orders/{id}", start: 0, duration: 120, kind: server }
  - api/auth: verify token · 4 · 10 · get
  - db/q1: SELECT orders WHERE id = $1 · 18 · 40 · get
  - { id: cache, service: cache, name: "GET order:42:lines", start: 62, duration: 3, parent: get, kind: cache }
  - { id: pay, service: payments, name: GET /payments/42, start: 68, duration: 46, parent: get, kind: client, error: true, attrs: { http.status: 502, retries: 1 }, note: First attempt timed out after 20 ms. }
  - { id: pq, service: db, name: SELECT payment, start: 70, duration: 30, parent: pay, kind: db }
  - { id: ship, service: shipping, name: publish order.viewed, start: 116, duration: 2, parent: get, kind: queue }
```
