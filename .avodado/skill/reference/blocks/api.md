# Avodado blocks — API reference

Part of the **avodado-docs** skill (the hub is `SKILL.md`, two folders up).
Exact fields for every block: `contract.md` beside this file; block → family
map: `INDEX.md`. Schemas reject unknown fields — use exactly these.

**Shape**: Structure & emphasis — one contract card per operation
(`endpoint`) or per event (`eventcontract`) — plus Exchange at the byte
level (`packet`).
**Answers**: What can I call, with what, and what comes back? Who emits this
event, who consumes it, and what does the payload guarantee? What does the
wire carry, bit by bit?
**Not this family**: how calls compose over time → `sequence` (flows.md);
an error-code listing → `table` (tables-data.md); the API already has an
OpenAPI spec → generate the cards with `avo sync openapi`.

### API reference

#### `endpoint` — a Swagger-style API endpoint card
```endpoint
method: POST            # GET | POST | PUT | PATCH | DELETE | HEAD | OPTIONS
path: /orders/{cartId}
title: Create an order
description: Convert a cart into an order.
auth: Bearer <token>
params:                 # path / query / header / cookie parameters
  - { name: cartId, in: path, type: uuid, required: true, desc: Cart to convert }
  - { name: dry-run, in: query, type: boolean, desc: Validate without persisting }
body:                   # request-body fields
  - { name: items, type: "Item[]", required: true, desc: Line items }
responses:
  - { status: 201, desc: Order created }
  - { status: 400, desc: Invalid cart }
request: |             # optional example request body (verbatim)
  { "items": [{ "sku": "A1", "qty": 2 }] }
response: |            # optional example response body
  { "id": "ord_123", "status": "pending" }
```
Only `method` and `path` are required. `params[].in` is `path | query | header | cookie`. For a whole spec, generate docs with `avo sync openapi`.

#### `eventcontract` — an async event contract, the twin of endpoint

One card per event: who produces it, who consumes it, what the channel
guarantees, and the payload. Use it where `endpoint` would be wrong — the
caller never waits for a reply.
```eventcontract
name: order.placed
version: v2
channel: orders               # the topic or queue
summary: A customer completed checkout and the order is accepted.
producers: [checkout]
consumers: [billing, fulfilment, analytics]
delivery: at-least-once       # at-least-once | at-most-once | exactly-once
ordering: per-key             # none | per-key | global
key: order_id                 # the partition key — marked # in the payload
retention: 7d
schema:                       # payload fields: name type [required] — desc
  - order_id uuid required — The order this event is about
  - customer_id uuid required — The buyer
  - total money required — Grand total after discounts
  - coupon string — Discount code applied, if any
headers:                      # same shape as schema
  - trace_id string required — W3C trace id
example: |
  { "order_id": "ord_123", "customer_id": "cus_9", "total": "42.00 EUR" }
errors:                       # Name — when the consumer sees it
  - DuplicateOrder — the same order_id was already processed
note: Consumers must be idempotent on order_id.
```
Only `name` is required. The renderer draws a PRODUCERS → CONSUMERS strip of
chips, the delivery facts as word chips, and the payload table: the `key`
field's row is marked `#` and takes the card's one accent; optional fields are
marked `?`. A field is a terse string (`name type [required] — desc`) or the
object form `{ name, type, required, desc, example }`. JSON in `example` is
highlighted. The card renders on its own, like `endpoint` — no title needed.

#### `packet` — a wire format, bit by bit

The diagram an RFC draws in ASCII, as arithmetic instead: a bit ruler across
the top, then fields whose cell width IS their bit count.
```packet
title: Request header
width: 32
fields:
  - { label: Version, bits: 4, value: "1" }
  - { label: Flags, bits: 4 }
  - { label: Total length, bits: 24 }
  - { label: Request id, bits: 32, accent: teal }
```
`width` is the bits per row (32 by default). A field that doesn't fit the rest
of its row wraps and continues on the next one, marked `→` and `(cont.)` —
which is what the bytes do. The footer totals bits and bytes and says when the
last row is partial.
