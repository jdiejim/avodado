```meta
title: Cutting checkout latency
subtitle: How a slow, coupled checkout became a fast one — situation, complication, resolution.
tag: WRITE-UP
```

## Situation

Checkout p95 had crept to 2.4s. Each order did three synchronous downstream calls
before returning, so the slowest dependency set the floor for everyone.

```drivers
title: What was pushing on the design
items:
  - { title: Latency budget, body: "Checkout must return under 800ms at p95.", tag: "GOAL: speed", icon: clock, accent: green }
  - { title: Independent failure, body: "A downstream outage must not fail checkout.", tag: "GOAL: resilience", icon: shield, accent: blue }
  - { title: Team autonomy, body: "Squads must deploy consumers on their own cadence.", tag: "GOAL: decoupling", icon: user, accent: purple }
```

```callout
tone: warn
title: Complication
body: "Shipping, billing, and analytics were called inline and serially, so checkout latency was the sum of all three — and any one failing failed the order."
```

## Approaches

```options
title: Approaches explored
items:
  - { kicker: A, title: Parallelize the calls, how: "Fan the three calls out concurrently.", pros: [Small change], cons: ["Still coupled to the slowest", "Still fails together"], verdict: "REJECTED", tone: rejected }
  - { kicker: B, title: Publish events, how: "Return after publishing; consumers react async.", pros: [Checkout no longer waits, Independent failure], cons: ["Eventual consistency"], verdict: "CHOSEN", tone: chosen }
```

```spec
title: The chosen approach
accent: green
rows:
  - { label: Boundary, value: "Checkout commits the order, publishes OrderPlaced, and returns." }
  - { label: Consumers, value: "Shipping, billing, and analytics subscribe and react on their own." }
  - { label: Flow, steps: [Commit order, Publish event, Return 201, Consumers react] }
```

## How it works

```sequence
id: seq-checkout
actors:
  - { id: client, name: Client }
  - { id: api, name: Checkout API }
  - { id: bus, name: Event bus }
messages:
  - { from: client, to: api, label: POST /orders, kind: sync }
  - { from: api, to: bus, label: publish OrderPlaced, kind: async }
  - { from: api, to: client, label: 201 Created, kind: response }
```
