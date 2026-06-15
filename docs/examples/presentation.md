```meta
title: Decoupling checkout
subtitle: One idea per slide — why and how we moved order notifications to events.
tag: DECK
```

## Why now

```drivers
title: Three forces
items:
  - { title: Slow checkout, body: "p95 hit 2.4s — three inline calls.", tag: "PAIN", icon: clock, accent: amber }
  - { title: Fails together, body: "One downstream down failed the order.", tag: "RISK", icon: shield, accent: red }
  - { title: Blocked squads, body: "Every change shipped through us.", tag: "DRAG", icon: user, accent: purple }
```

## The numbers

```stats
stats:
  - { value: "2.4s", label: Checkout p95 before, delta: "+1.6s", trend: down }
  - { value: "800ms", label: Target after, trend: flat }
  - { value: "3", label: Consumers decoupled, trend: up }
```

## The shape of the fix

```pyramid
levels:
  - { label: Publish OrderPlaced, desc: "Checkout returns the moment the event is out" }
  - { label: Subscribe independently, desc: "Each consumer reacts on its own" }
  - { label: Replay on failure, desc: "The bus is the recovery log" }
```

## Where to invest

```quadrant
xAxis: { label: Effort, low: Low, high: High }
yAxis: { label: Impact, low: Low, high: High }
items:
  - { x: 0.25, y: 0.85, label: Event bus + DLQ }
  - { x: 0.4, y: 0.7, label: Billing consumer }
  - { x: 0.8, y: 0.5, label: Self-serve console }
  - { x: 0.2, y: 0.25, label: Dashboards }
```

## The plan

```timeline
items:
  - { label: "Q1 — Bus live", date: Q1, status: current }
  - { label: "Q2 — Fan-out", date: Q2, status: next }
  - { label: "Q3 — Self-serve", date: Q3, status: future }
```
