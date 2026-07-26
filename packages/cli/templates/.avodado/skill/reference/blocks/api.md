# Avodado blocks — API reference

Part of the **avodado-docs** skill (the hub is `SKILL.md`, two folders up).
Field contracts and examples for this family's blocks. The at-a-glance contract
table for all 79 blocks is `contract.md` beside this file; the block → family
map is `INDEX.md`. Schemas reject unknown fields — use exactly these.

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

