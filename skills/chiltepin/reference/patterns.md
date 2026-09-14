# Messaging and event patterns — which blocks draw them

Part of the **chiltepin** skill (the hub is `SKILL.md`, one folder up). Read
this when the request is about events, queues, streams, fan-out, or making a
write reliable across two systems. Each pattern names the reader question,
the block stack that answers it, and the trap. Fields: `chiltepin block <type>`.

Three rules hold for every pattern here:

- Topology at rest is a `block` with `preset: event`. Producers are `kind:
  producer`, subscribers `kind: consumer`, brokers `kind: topic` (fan-out)
  or `kind: queue` (one taker), streams `kind: stream`. The single
  `producer` takes the accent; put the fan-out in one column so the topic
  reads as the hub.
- One event's contract is an `eventcontract`, never a `table` row: it
  carries producers, consumers, delivery, ordering, the partition `key`,
  and retention, which is exactly what a consumer needs to be safe.
- Time and failure are `sequence` (async arrows `-->` for the broker hop,
  an `alt` frame for the failure branch) or `flow` (retry loops, decisions).
  A `block` shows who is wired to whom; it cannot show a retry.

## Publish / subscribe (fan-out to many)

Question: when X happens, who reacts, and does the producer know them?
Stack: `block` (`preset: event`) → `eventcontract` for the event → prose on
delivery and ordering. Trap: a `sequence` with one arrow per subscriber
hides the point, which is that the publisher has no arrows to them.

```block
preset: event
groups:
  - { id: subs, col: 3, row: 1, cols: 1, rows: 3, label: Subscribers }
nodes:
  - { id: orders, col: 1, row: 2, kind: producer, name: Orders, tech: order.placed }
  - { id: t, col: 2, row: 2, kind: topic, name: order-events, tech: Kafka }
  - { id: mail, col: 3, row: 1, kind: consumer, name: Email }
  - { id: search, col: 3, row: 2, kind: consumer, name: Search index }
  - { id: audit, col: 3, row: 3, kind: consumer, name: Audit log }
edges:
  - orders -> t: publish
  - t -> mail
  - t -> search
  - t -> audit
```

## Competing consumers (one taker wins)

Question: how does work spread across N workers, and how many times is a
message handled? Stack: `block` (`preset: event`, a `queue` not a `topic`,
the workers in one group, dashed edges to the workers that did not take
the message) → `spec` for at-least-once and idempotency rules. Trap:
drawing it as pub/sub; a queue delivers each message once.

## Partitioned log and consumer group (streams)

Question: how does the stream scale, and what keeps order? Stack: `block`
(partitions as `queue` nodes inside a `Topic` group, consumers in a
`Consumer group` group, the partition key on the producer edge) → prose on
what the key is and what happens when a consumer joins or leaves. Trap: a
`sequence`; the question is placement, not time.

```block
preset: event
groups:
  - { id: t, col: 2, row: 1, cols: 1, rows: 3, label: orders topic (3 partitions) }
  - { id: cg, col: 3, row: 1, cols: 1, rows: 3, label: billing consumer group }
nodes:
  - { id: prod, col: 1, row: 2, kind: producer, name: Orders API }
  - { id: p0, col: 2, row: 1, kind: queue, name: partition 0 }
  - { id: p1, col: 2, row: 2, kind: queue, name: partition 1 }
  - { id: p2, col: 2, row: 3, kind: queue, name: partition 2 }
  - { id: c0, col: 3, row: 1, kind: consumer, name: billing-1 }
  - { id: c1, col: 3, row: 2, kind: consumer, name: billing-2 }
  - { id: c2, col: 3, row: 3, kind: consumer, name: billing-3 }
edges:
  - prod -> p0: "key = order_id"
  - prod -> p1
  - prod -> p2
  - p0 -> c0
  - p1 -> c1
  - p2 -> c2
```

## Event-driven backbone (many producers, many consumers)

Question: what is the shape of the whole event system? Stack: `block` in
`layers` mode (Producers · Backbone · Consumers) with one `topic` node in
the middle band → `table` of topics × producer × consumers × retention.
Trap: drawing every topic as a node; past four topics the table carries
it and the diagram shows the bands.

## Outbox (reliable publish after a commit)

Question: how do we never lose an event when the commit succeeds and the
publish fails? Stack: `sequence` (API → DB writes row and outbox in one
transaction; relay polls outbox → broker; `alt` for the broker being
down) → `state` for the outbox row (pending → published → failed) → `spec`
for the invariants (same transaction, at-least-once, consumer idempotent).
Trap: a `block` alone; the pattern is an ordering of writes, so it needs
time.

## Dead-letter queue and retry (poison messages)

Question: what happens to a message that keeps failing, and who looks at
it? Stack: `flow` (consume → process → ok / retry with backoff / after N
to the DLQ, `kind: error` on the DLQ edge) → `block` (`queue` → consumer
→ `DLQ` queue) → `table` of failure classes × action × owner. Trap: a
`sequence`; the loop and the threshold are decisions, not messages.

## CQRS (separate read and write models)

Question: why are reads and writes different shapes, and how does a write
reach the read side? Stack: `block` (command side → write store → events
→ projector → read store → query side, `dfd` also works) → `sequence` for
one write and the eventual read → prose on the consistency lag and what
the UI does about it. Trap: an `erd` of the read model; the reader asked
for the split, not the columns.

## Event sourcing (append-only log)

Question: where is the truth, and how is current state rebuilt? Stack:
`block` (commands → aggregate → event store, `replay` dashed back,
projections subscribing) → `eventcontract` for one event → `spec` for
replay, snapshots, and schema evolution. Trap: a `state` machine of the
aggregate; the pattern is about storage, not lifecycle.

## Saga (multi-service undo)

Question: what happens when step three of five fails after steps one and
two committed? Stack: `saga` (forward steps, compensation under each,
`failAt`) → `sequence` only if the message order between services is the
question → `table` of steps × compensation × idempotency key. Trap: a
`flow`; a saga's shape is steps with their undo, which `flow` cannot say.

## Scatter-gather

Question: how does one request fan out to N workers and come back as one
answer? Stack: `block` (coordinator → workers group → aggregator) →
`sequence` with a `par` frame for the parallel calls and the timeout
branch → `spec` for the partial-result rule. Trap: `flow`; the parallelism
is the point and `par` draws it.

## Backpressure, retry, and circuit breaker

Question: what does the system do when a downstream slows or fails?
Stack: `state` for the breaker (closed → open → half-open) or `flow` for
retry with backoff and the give-up exit → `spec` for the numbers
(timeout, attempts, backoff, jitter, trip threshold) → `sequence` only for
the one call that shows the breaker opening. Trap: prose only; the
numbers are the contract, and `spec` holds them.

## Change data capture and webhooks (events out of a store or to a partner)

Question: how do changes leave the database, or reach a partner, in
order and exactly once as far as they can tell? Stack: `dfd` (table →
log → connector → topic → consumers) or `sequence` (producer → partner
endpoint, signed, retried, `alt` for 5xx) → `eventcontract` for the
payload → `spec` for signing, retry, and replay. Trap: an `endpoint`
block for a webhook; the partner's endpoint is not ours to document.

## Idempotency

Question: what happens when the same message or request arrives twice?
Stack: `sequence` with the duplicate as a second message and an `alt`
frame (key seen → return stored result) → `spec` for the key, its scope,
and its TTL → `state` when the record itself moves (received → processed).
Trap: a `callout` only; the reader needs the exact key and window.
