```meta
title: ShopCo — Order placement (POST /orders)
subtitle: How a single request authorizes payment and persists an order atomically. One synchronous transaction, idempotent retries, observable outcomes.
tag: API · v1
```

## Overview

The order is written `PENDING`, payment is authorized synchronously, and the row
is flipped to `CONFIRMED` before commit. A declined authorization rolls the
whole transaction back so the order never exists half-paid.

- Idempotent on the `Idempotency-Key` header
- Emits an `order.created` event after commit
- Target p95 under 250ms

```callout
tone: warn
title: Idempotency is required
body: Clients must send an Idempotency-Key header. A replay with the same key
  returns the original order instead of creating a duplicate, so retries are safe.
```

## Place-order sequence

```sequence
id: seq-place-order
title: One transaction wraps authorize + persist.
lede: Time runs downward. Solid arrows are synchronous requests; dashed are responses. The order row exists as PENDING only inside the transaction — it is CONFIRMED before commit, or rolled back to CANCELLED on decline.
description: Happy path shown. A declined authorization (step 6) rolls the transaction back and returns 402; the idempotency key makes a client retry safe.
endpoint:
  method: POST
  path: /orders
actors:
  - { id: Client, name: Client, sub: web / mobile }
  - { id: API, name: Orders API, sub: orders handler }
  - { id: PG, name: Postgres, sub: orders }
  - { id: Payment, name: Payment GW, sub: external, external: true }
messages:
  - from: Client
    to: API
    label: POST /orders
    kind: sync
    summary: Place the order with cart, a one-time payment token, and an idempotency key.
    code: |
      POST /orders
      Idempotency-Key: 7f3a9c1e-...
      { "items": [...], "payment_token": "tok_live_..." }
  - from: API
    to: API
    kind: note
    label: validate token · idempotency key
    summary: Validate the bearer token, then check the idempotency key — a replay returns the prior result instead of charging twice.
  - from: API
    to: PG
    label: BEGIN; INSERT order (PENDING)
    kind: sync
    summary: Open the transaction and insert the order in PENDING.
    code: |
      BEGIN;
      INSERT INTO orders (id, user_id, amount_cents, status, idempotency_key)
      VALUES (gen_random_uuid(), $1, $2, 'PENDING', $3)
      RETURNING id;
    note: "Required index: orders(idempotency_key) unique."
  - from: PG
    to: API
    label: order_id
    kind: response
    summary: Returns the new order_id. The row is invisible to readers until commit.
  - from: API
    to: Payment
    label: authorize(amount, token)
    kind: sync
    summary: Authorize the amount against the token (synchronous, latency-bound).
  - from: Payment
    to: API
    label: 402 declined
    kind: error
    summary: 402 path — ROLLBACK (order becomes CANCELLED on a re-insert), return 402 payment_required. The idempotency key keeps a retry safe.
  - from: Payment
    to: API
    label: authorized · auth_id
    kind: response
    summary: Authorized — returns auth_id for capture later.
  - from: API
    to: PG
    label: UPDATE → CONFIRMED; COMMIT
    kind: sync
    summary: Flip to CONFIRMED and commit — same transaction, so the order never exists half-paid.
    code: |
      UPDATE orders SET status = 'CONFIRMED', auth_id = $1 WHERE id = $2;
      COMMIT;
  - from: PG
    to: API
    label: committed
    kind: response
    summary: Transaction committed; OrderConfirmed event is published after commit (fire-and-forget).
  - from: API
    to: Client
    label: 201 Created { order_id }
    kind: response
    summary: 201 Created with the order. OrderConfirmed is published after commit (fire-and-forget).
foot:
  - { label: Target p95, value: 250ms }
  - { label: Idempotent, value: via Idempotency-Key (24h TTL) }
  - { label: Required index, value: orders(idempotency_key) }
```

## Data model

```erd
id: erd-orders
title: Tables & relationships.
description: One-to-many between orders and order_items. The order owns its line items.
entities:
  - name: orders
    columns:
      - { name: id,      type: uuid,    pk: true }
      - { name: user_id, type: uuid,    fk: true }
      - { name: total,   type: numeric }
      - { name: status,  type: text }
  - name: order_items
    columns:
      - { name: id,       type: uuid, pk: true }
      - { name: order_id, type: uuid, fk: true }
      - { name: sku,      type: text }
      - { name: qty,      type: int }
relations:
  - { from: orders, to: order_items, card: 1:N }
```

## Status codes

```table
columns: [Code, Meaning, When]
rows:
  - [201, Created, Order was persisted]
  - [400, Bad Request, Validation failed]
  - [402, Payment Required, Authorization declined]
  - [409, Conflict, Idempotency key reused with a different body]
```

## The story behind it

```userstory
id: US-142
role: shopper
want: pay for my cart in one step
soThat: I can complete my purchase quickly
priority: High
points: 5
criteria:
  - { given: I have items in my cart, when: I submit valid payment, then: an order is created and I see a confirmation }
  - { given: my card is declined, when: I submit payment, then: I see a clear error and my cart is preserved }
links:
  - { ref: "orders-api#seq-place-order", mode: sequence, label: Request flow }
  - { ref: "orders-api#erd-orders", mode: erd, label: Data model }
```
