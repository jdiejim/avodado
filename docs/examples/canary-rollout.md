```meta
title: Checkout v2 rollout
subtitle: How the new checkout ships, stage by stage, and what stops it.
tag: ROLLOUT · EXAMPLE
```

The change goes out behind a canary. Each stage holds for a fixed time; the gate on the connector must pass before the next stage starts.

```rollout
id: checkout-v2-rollout
title: Checkout v2
strategy: canary
stages:
  - "[done] 1% · Smoke · 15m — no 5xx in 15 min"
  - "[current] 10% · Canary · 30m — error rate < 0.5%"
  - "[next] 50% · Half · 1h — p95 < 300 ms"
  - { name: Full, traffic: 100, status: next, note: Remove the old deployment after 24 h. }
rollback: Flip the checkout-v2 flag off; the old version keeps serving without a deploy.
```
