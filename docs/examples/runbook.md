```meta
title: Runbook — order events lagging
subtitle: Diagnose and clear a backlog on the OrderPlaced consumer.
tag: RUNBOOK · ON-CALL
```

```callout
tone: warn
title: When to use this
body: "Use when the OrderPlaced consumer lag alarm fires (lag > 5 min) or downstreams report stale orders."
```

## Procedure

```flow
id: flow-lag
title: Triage the lag
nodes:
  - { id: start, kind: start, label: "Lag alarm" }
  - { id: dlq, kind: decision, label: "DLQ filling?" }
  - { id: poison, kind: process, label: "Inspect + replay DLQ" }
  - { id: scale, kind: decision, label: "CPU pinned?" }
  - { id: up, kind: process, label: "Scale consumers up" }
  - { id: page, kind: end, label: "Escalate to owning squad" }
  - { id: done, kind: end, label: "Lag clears" }
edges:
  - { from: start, to: dlq }
  - { from: dlq, to: poison, label: "yes" }
  - { from: dlq, to: scale, label: "no" }
  - { from: poison, to: done }
  - { from: scale, to: up, label: "yes" }
  - { from: scale, to: page, label: "no" }
  - { from: up, to: done }
```

## Commands

```code
blocks:
  - title: Check consumer lag
    lang: bash
    code: |
      aws cloudwatch get-metric-statistics --namespace Orders \
        --metric-name ConsumerLag --period 60 --statistics Maximum
  - title: Scale the consumer service
    lang: bash
    code: |
      aws ecs update-service --cluster orders --service event-worker --desired-count 6
```

## Symptom → action

```table
columns: [Symptom, Likely cause, Action]
rows:
  - ["DLQ growing", "Poison message", "Inspect, fix or skip, then replay the DLQ"]
  - ["CPU pinned", "Under-provisioned", "Scale consumers up; right-size after"]
  - ["No throughput", "Bus outage", "Escalate to platform on-call"]
```
