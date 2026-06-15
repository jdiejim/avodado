```meta
title: ADR-007 — Event-driven order notifications
subtitle: Why we chose an event bus over synchronous calls to notify downstream services.
tag: ADR-007
```

## Context

When an order is placed, shipping, billing, and analytics all need to know. Calling
each one synchronously couples checkout to three downstreams — and they fail together.

```options
title: Options considered
items:
  - { kicker: Option 1, title: Synchronous calls, how: "Order service calls each downstream inline.", pros: [Easy to trace], cons: ["Tight coupling", "One slow consumer blocks checkout"], verdict: "REJECTED — couples checkout to downstreams", tone: rejected }
  - { kicker: Option 2, title: Outbox + polling, how: "Downstreams poll an outbox table.", pros: [No new infra], cons: ["Polling lag", "The DB becomes a queue"], verdict: "VIABLE — kept as fallback", tone: viable }
  - { kicker: Option 3, title: Event bus, how: "Publish OrderPlaced; consumers subscribe independently.", pros: [Decoupled deploys, Independent scaling, Replayable], cons: ["New infra to operate"], verdict: "CHOSEN", tone: chosen }
```

```callout
tone: success
title: Decision
body: Publish domain events to a managed event bus; downstream services subscribe independently.
```

```proscons
title: Consequences
prosLabel: We gain
consLabel: We accept
pros: [Decoupled deploys, Replay for recovery, Independent scaling]
cons: ["Eventual consistency between services", "The bus is now critical infrastructure"]
```

```tracker
items:
  - { task: "Stand up the managed event bus with a dead-letter queue", status: doing, priority: high }
  - { task: "Define the OrderPlaced schema and a versioning policy", status: todo, priority: high }
  - { task: "Migrate the billing consumer first as the reference", status: todo, priority: med }
```
