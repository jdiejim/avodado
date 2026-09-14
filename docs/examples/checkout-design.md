```meta
title: Checkout, from request to rollout
subtitle: A worked architecture review. System boundaries, payment failures, stored data, and the plan to ship.
tag: ARCHITECTURE REVIEW · EXAMPLE
```

Keep payment confirmation on the request path. Publish order events from a transactional outbox so a broker outage cannot lose a confirmed order.
This example describes a proposed system; the rollout stages are illustrative.

## The system at a glance

```block
id: checkout-design-system
preset: infra
title: One request path. Durable events.
systemLabel: Checkout platform
groups:
  - { col: 2, row: 1, cols: 2, rows: 2, label: Checkout boundary }
nodes:
  - { id: web, col: 1, row: 1, kind: browser, name: Storefront, tech: Web client }
  - { id: api, col: 2, row: 1, kind: service, name: Checkout API, tech: TypeScript }
  - { id: pay, col: 4, row: 1, kind: external, name: Payments, tech: Idempotent charges }
  - { id: db, col: 2, row: 2, kind: postgres, name: Orders + outbox, tech: PostgreSQL }
  - { id: relay, col: 3, row: 2, kind: service, name: Outbox relay, tech: Retry until acknowledged }
  - { id: events, col: 4, row: 2, kind: queue, name: Order events, tech: At-least-once delivery }
edges:
  - web -> api: place order
  - api -> pay: charge
  - api -> db: commit order + event
  - db --> relay: read outbox
  - relay --> events: publish
```

## A decline is part of the contract

The client sends a stable idempotency key on every retry. The payment provider deduplicates charges with that key.
After a capture, the API commits the order and its outbox event together before returning success.
If the commit fails, a retry reuses the payment result and attempts the transaction again.

```sequence
id: checkout-design-payment
title: Place an order
actors:
  - { id: Client, name: Storefront }
  - { id: API, name: Checkout API }
  - { id: PSP, name: Payments, external: true }
messages:
  - Client -> API: POST /orders
  - API -> PSP: charge with idempotency key
  - alt: approved
  - PSP --> API: captured
  - { from: API, to: API, kind: note, label: "Commit order + outbox event" }
  - API --> Client: 201 Created
  - else: declined
  - PSP --> API: declined
  - API --> Client: 402 PAYMENT_FAILED
  - end
```

## Store the order and the event together

The unique idempotency key prevents duplicate orders. The relay marks an outbox event as published only after the broker acknowledges it.
Consumers deduplicate by event ID because a relay retry can publish the same event again.

```erd
id: checkout-design-data
title: Orders and the transactional outbox
entities:
  - name: orders
    columns:
      - id uuid pk
      - idempotency_key text unique !null
      - payment_id text !null
      - total_cents integer !null
      - created_at timestamptz !null
  - name: outbox
    columns:
      - id uuid pk
      - order_id uuid fk -> orders.id
      - event_type text !null
      - payload jsonb !null
      - { name: published_at, type: timestamptz, nullable: true }
relations:
  - { from: orders, to: outbox, fromCol: id, toCol: order_id, card: "1:N", label: emits }
```

## Ship behind a canary

Stop the rollout when a gate fails. Keep the previous deployment available until the new version completes a full day at 100% traffic.

```rollout
id: checkout-design-release
title: Checkout v2
strategy: canary
stages:
  - "[done] 1% · Smoke · 15m — no 5xx"
  - "[current] 10% · Canary · 30m — error rate < 0.5%"
  - "[next] 50% · Half · 1h — p95 < 300 ms"
  - "[next] 100% · Full · 24h"
rollback: "Disable the checkout-v2 flag. Route new requests to the previous deployment."
```
