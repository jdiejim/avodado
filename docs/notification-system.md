```meta
title: Notification system — event-driven design
subtitle: A worked high-level design — requirements, options with a recommendation, the patterns it's built from, and the end-to-end flow.
tag: SYSTEM DESIGN
```

## Requirements

```drivers
title: What it must do
items:
  - { title: Real-time fan-out, body: "One event reaches push, email, and SMS.", tag: SCALE, icon: bolt, accent: amber }
  - { title: Reliable delivery, body: "No lost notifications; retries are safe.", tag: RELIABILITY, icon: shield, accent: green }
  - { title: No duplicates, body: "A retried event sends exactly one notification.", tag: CORRECTNESS, icon: check, accent: blue }
  - { title: Decoupled producers, body: "Services emit events, unaware of channels.", tag: COUPLING, icon: link, accent: purple }
```

## Approaches

```options
title: How to deliver notifications
items:
  - { kicker: Option 1, title: Synchronous calls, how: "Producers call the notifier directly.", pros: [Simplest], cons: ["Couples producers to channels", "A slow channel blocks the request"], verdict: "REJECTED — too coupled", tone: rejected }
  - { kicker: Option 2, title: Single work queue, how: "Producers enqueue; workers send.", pros: [Decoupled, Absorbs spikes], cons: ["One consumer group; multi-channel fan-out is awkward"], verdict: "VIABLE — fallback", tone: viable }
  - { kicker: Option 3, title: Event-driven pub/sub, how: "Emit an event; each channel subscribes.", pros: [Loose coupling, Easy to add channels, Independent scaling], cons: ["Eventual consistency", "Needs idempotent consumers"], verdict: "CHOSEN", tone: chosen }
```

## The system

```infra
title: Event-driven notification system
systemLabel: notifications
layers:
  - { label: Producers }
  - { label: Backbone }
  - { label: Channels }
nodes:
  - { id: orders, layer: 0, kind: service, name: Orders svc }
  - { id: billing, layer: 0, kind: service, name: Billing svc }
  - { id: bus, layer: 1, kind: topic, name: Event bus }
  - { id: notif, layer: 1, kind: service, name: Notification svc }
  - { id: dedup, layer: 1, kind: cache, name: Dedup store }
  - { id: push, layer: 2, kind: service, name: Push }
  - { id: email, layer: 2, kind: service, name: Email }
  - { id: sms, layer: 2, kind: service, name: SMS }
edges:
  - { from: orders, to: bus }
  - { from: billing, to: bus }
  - { from: bus, to: notif, label: subscribe }
  - { from: notif, to: dedup, label: check, kind: dashed }
  - { from: notif, to: push }
  - { from: notif, to: email }
  - { from: notif, to: sms }
```

## Key flow

```sequence
id: seq-notify
title: From event to delivered notification
actors:
  - { id: Svc, name: Orders svc }
  - { id: Bus, name: Event bus }
  - { id: N, name: Notification svc }
  - { id: Ch, name: Channels, external: true }
messages:
  - { from: Svc, to: Bus, label: OrderPlaced, kind: async }
  - { from: Bus, to: N, label: deliver event, kind: async }
  - { from: N, to: N, label: dedup by event id, kind: note }
  - { from: N, to: Ch, label: send push/email/SMS, kind: sync }
  - { from: Ch, to: N, label: ack, kind: response }
```

## Built on: publish / subscribe

The fan-out backbone — grabbed from the pattern library (`avo design pub-sub`).

```pattern
name: Publish / subscribe
category: System design
intent: Broadcast events to all interested consumers without the producer knowing them.
forces: [Many reactions to one event, Producers must not depend on consumers]
participants:
  - { name: Publisher, role: emits events to a topic }
  - { name: Topic / broker, role: fans out to subscriptions }
  - { name: Subscribers, role: each receive their own copy }
consequences:
  pros: [Loose coupling, Easy to add new consumers]
  cons: [Hard to trace flows, Ordering and duplicate delivery]
```

## Built on: idempotency

How "no duplicates" is guaranteed (`avo design idempotency`).

```pattern
name: Idempotency
category: System design
intent: Let a consumer safely process a retried event by deduplicating on an event id.
forces: [At-least-once delivery, A double-send must not happen]
participants:
  - { name: Event id, role: unique per logical event }
  - { name: Dedup store, role: records processed ids (with TTL) }
  - { name: Consumer, role: skips an already-seen id }
consequences:
  pros: [Safe retries, Exactly-once effect]
  cons: [Dedup store + TTL to manage]
```

## Open questions

```tracker
items:
  - { task: Pick the broker (Kafka vs SNS/SQS), status: todo, priority: high }
  - { task: Define the event schema + versioning, status: todo, priority: high }
  - { task: Dead-letter + retry policy, status: todo, priority: med }
```
