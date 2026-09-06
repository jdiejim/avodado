```meta
title: Event contract — order.placed
subtitle: The async contract between checkout and the services that react to a new order.
tag: EVENTS · v2
```

`order.placed` is the one event every downstream service listens for. The card below is the contract: who emits it, who consumes it, what the channel guarantees, and the payload with its partition key.

```eventcontract
id: order-placed
name: order.placed
version: v2
channel: orders
summary: A customer completed checkout and the order is accepted for fulfilment.
producers: [checkout]
consumers: [billing, fulfilment, analytics, notifications]
delivery: at-least-once
ordering: per-key
key: order_id
retention: 7d
schema:
  - order_id uuid required — The order this event is about
  - customer_id uuid required — The buyer
  - total money required — Grand total after discounts, as a decimal string with currency
  - items Item[] required — Line items (sku, qty, unit price)
  - coupon string — Discount code applied, if any
  - placed_at timestamp required — When checkout completed (UTC, ISO 8601)
headers:
  - trace_id string required — W3C trace id for the checkout request
  - schema_version string required — Always "2"
example: |
  {
    "order_id": "ord_8f2c",
    "customer_id": "cus_19",
    "total": "42.00 EUR",
    "items": [{ "sku": "A1", "qty": 2, "unit_price": "21.00 EUR" }],
    "placed_at": "2026-09-01T10:15:00Z"
  }
errors:
  - DuplicateOrder — the same order_id was already processed; drop the event
  - UnknownCustomer — customer_id is not in the customer store; park the event and alert
note: Delivery is at-least-once, so every consumer must be idempotent on order_id.
```
