# Avodado blocks — Flows, sequences & state

Part of the **avodado-docs** skill (the hub is `SKILL.md`, two folders up).
Field contracts and examples for this family's blocks. The at-a-glance contract
table for all 87 blocks is `contract.md` beside this file; the block → family
map is `INDEX.md`. Schemas reject unknown fields — use exactly these.

### Sequence & state

#### `sequence` — interaction over time (rich SVG + step list + footer)
```sequence
id: seq-place-order
title: One transaction wraps authorize + persist.
lede: Time runs downward. Solid arrows are sync; dashed are responses.
description: Happy path shown.
endpoint: { method: POST, path: /orders }
actors:
  - { id: Client, name: Client, sub: web / mobile }
  - { id: API, name: Orders API, sub: orders handler }
  - { id: PG, name: Postgres, sub: orders }
  - { id: Payment, name: Payment GW, sub: external, external: true }
messages:
  - { from: Client, to: API, label: POST /orders, kind: sync, summary: "Place the order with cart, token, idempotency key.", code: "POST /orders\nIdempotency-Key: ..." }
  - { from: API, to: API, kind: note, label: validate token, summary: "Validate bearer, check idempotency key." }
  - { from: API, to: PG, label: INSERT order, kind: sync, summary: "Open the txn and insert in PENDING.", note: "Required index: orders(idempotency_key)." }
  - { from: PG, to: API, label: order_id, kind: response, summary: "Returns the new order_id." }
  - { from: API, to: Client, label: 201 Created, kind: response, summary: "201 with the order." }
foot:
  - { label: Target p95, value: 250ms }
  - { label: Idempotent, value: via Idempotency-Key (24h TTL) }
```
Each message: `from` + `to` (must match an actor `id`), `label`,
optional `kind` (`sync | response | async | error | note`).
- `note` kind is a numbered annotation on one lane — no arrow.
- `summary` (long form for the step list under the SVG),
- `code` (a code snippet inside the step item),
- `note` field (italic-gray sub-note below the summary).
`endpoint.method` colours the tag pill (POST → navy, GET → green, etc.).
`foot` items render as key/value pills beneath the diagram.

#### `state` — state machine (+ transition table)
```state
title: Circuit breaker
states:
  - { id: s0, col: 1, row: 1, kind: start }
  - { id: closed, col: 2, row: 1, kind: active, name: CLOSED }
  - { id: open, col: 3, row: 1, kind: wait, name: OPEN }
  - { id: half, col: 3, row: 2, kind: active, name: HALF-OPEN }
transitions:
  - { from: s0, to: closed, event: init }
  - { from: closed, to: open, event: failure rate trips, guard: window ≥ threshold }
  - { from: open, to: half, event: cooldown elapsed }
  - { from: half, to: closed, event: probe succeeds }
  - { from: half, to: open, event: probe fails }
```
`kind` on a state is `start | terminal | active | wait`.

### Flow & process

#### `flow` — flowchart with decisions
```flow
title: Admission control
nodes:
  - { id: start, col: 1, row: 1, kind: start, label: Request }
  - { id: quota, col: 2, row: 1, kind: decision, label: Under quota? }
  - { id: serve, col: 3, row: 1, kind: end, label: Serve }
  - { id: shed, col: 2, row: 2, kind: end, label: 429 Too Many }
edges:
  - { from: start, to: quota }
  - { from: quota, to: serve, label: "yes" }
  - { from: quota, to: shed, label: "no", kind: error }
```
`kind` is `start | end | decision | process`. Edge `kind: error` (or labels
starting with `no/fail/error/reject`) render in red.

#### `dfd` — data-flow diagram
```dfd
nodes:
  - { id: app, col: 1, row: 1, kind: external, name: Mobile app }
  - { id: ingest, col: 2, row: 1, kind: process, name: Ingest events, num: 1 }
  - { id: enrich, col: 3, row: 1, kind: process, name: Enrich, num: 2 }
  - { id: wh, col: 4, row: 1, kind: store, name: warehouse }
edges:
  - { from: app, to: ingest, label: clicks }
  - { from: ingest, to: enrich }
  - { from: enrich, to: wh }
```
`kind` is `process | external | store | datastore`. Optional `num` on
processes.

#### `swimlane` — cross-functional process
```swimlane
lanes:
  - { label: On-call }
  - { label: Platform team }
steps:
  - { id: page, col: 1, lane: 0, kind: start, label: Paged }
  - { id: triage, col: 2, lane: 0, kind: decision, label: Known cause? }
  - { id: fix, col: 3, lane: 0, label: Apply runbook }
  - { id: esc, col: 3, lane: 1, label: Escalate }
links:
  - { from: page, to: triage }
  - { from: triage, to: fix, label: "yes" }
  - { from: triage, to: esc, label: "no" }
```
Step `kind` is `action | decision | start | end | wait`.

#### `steps` — a numbered how-to / runbook stepper
```steps
title: Deploy a hotfix
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
A vertical stepper — numbered circles joined by a rule; each step has a bold
`title`, an optional `body`, an optional `code` command (rendered on the dark
code surface, with `lang` as its header), and an italic `note`. Use `steps` for
*linear* procedures a human executes in order; use `flow`/`swimlane` when the
procedure branches, and `tracker` when items have status/owner rather than order.

## Field semantics — clarifications

A few fields are easy to misuse. Lock these in.

- `sequence.actors[].sub` is the **subtitle** under the actor's name on the
  lane head (e.g. `sub: web / mobile`, `sub: orders handler`). Keep it short —
  2-4 words.
- `sequence.actors[].external: true` darkens the lane (slate instead of navy),
  signaling the actor lives outside your service boundary.
- `sequence.messages[].kind: note` is **not a message** — it's a numbered
  annotation on the from-actor's lane, with no arrow. Use it for things like
  "validate token" that don't cross a boundary.
- `sequence.messages[].summary` is the longer text shown in the step-by-step
  list **below** the SVG. Keep `label` short (the SVG arrow) and put detail in
  `summary`. `code:` adds a `<pre>` snippet inside the step item.
