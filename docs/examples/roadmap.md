```meta
title: Notifications platform roadmap
subtitle: From a coupled checkout to a self-serve notifications platform over three quarters.
tag: ROADMAP · FY26
```

## Targets

```stats
stats:
  - { value: "800ms", label: Checkout p95 target, delta: "-1.6s", trend: down }
  - { value: "3", label: Consumers decoupled, trend: up }
  - { value: "99.95%", label: Delivery SLO, trend: flat }
```

## Phases

```timeline
items:
  - { label: "Phase 1 — Event bus", date: Q1, status: current, desc: "Stand up the managed bus + DLQ; publish OrderPlaced; migrate billing." }
  - { label: "Phase 2 — Fan-out", date: Q2, status: next, desc: "Move shipping and analytics to subscriptions; delete the synchronous path." }
  - { label: "Phase 3 — Self-serve", date: Q3, status: future, desc: "Schema registry + a console so squads add consumers without us." }
```

```kanban
columns:
  - label: Now
    cards:
      - { title: "Bus + DLQ stood up", tag: infra }
      - { title: "Billing consumer migrated", tag: billing }
  - label: Next
    cards:
      - { title: "Shipping subscription", tag: shipping }
      - { title: "Analytics subscription", tag: analytics }
  - label: Later
    cards:
      - { title: "Schema registry + console", tag: platform }
```

```tracker
items:
  - { task: "Define delivery + retry SLOs with SRE", status: doing, priority: high, owner: SRE }
  - { task: "Publish the OrderPlaced v1 schema", status: todo, priority: high, owner: Platform }
  - { task: "Decommission the synchronous notifier", status: todo, priority: med, owner: Checkout }
```
