```meta
title: SEV-1 · 2026-07-14 — duplicate campaign sends
subtitle: A 60-second visibility timeout met a 90-second batch job; 1.9M subscribers got the same email twice.
tag: Postmortem · SEV-1
```

Quillfeed sends about 62 million campaign emails a day through workers that
consume send-batch jobs from a queue. On 14 July a config refactor silently
dropped the send queue's visibility-timeout override, and the broker began
redelivering jobs that were still in flight. All times are UTC.

## Timeline

```timeline
id: ex-incident-timeline
items:
  - "14:12 · Deploy ships · The queue-defaults refactor drops the send queue's 15-minute visibility override to the new 60 s default"
  - "14:22 · First duplicates · The broker redelivers in-flight batch jobs; second workers re-send them"
  - "14:26 · Support signal · Duplicate-email tickets spike; no alert has fired"
  - "14:29 · Pager · The esp-accept-rate anomaly alert fires at 2.3× forecast"
  - "14:37 · Mitigation · On-call correlates with the 14:12 deploy and pauses all send queues"
  - "14:41 · Rollback · Config revert restores the 15-minute timeout"
  - "14:52 · Resume · Sends restart after in-flight jobs are checked against the send ledger"
  - "15:03 · Resolved · Send rate returns to forecast; SEV closed"
```

Detection was the slow half: eleven minutes passed between the first customer
ticket and the queue pause, because no dashboard tied send-rate anomalies to
deploys. Support saw the incident three minutes before the pager did.

## The mechanism

```sequence
id: ex-incident-seq
actors:
  - { id: Broker, name: Broker, sub: send queue }
  - { id: A, name: Worker A }
  - { id: B, name: Worker B }
  - { id: ESP, name: ESP, sub: email provider, external: true }
messages:
  - { from: Broker, to: A, label: deliver batch 4411, summary: "500 recipients; a batch takes about 90 seconds end to end." }
  - { from: A, to: A, kind: note, label: ledger check passes, summary: "None of the 500 recipients has a send record yet." }
  - { from: A, to: ESP, label: send 500 emails }
  - { from: Broker, to: B, label: redeliver 4411, kind: error, summary: "No ack after 60 seconds — the new default timeout — so the broker assumes Worker A died." }
  - { from: B, to: B, kind: note, label: ledger check passes again, summary: "Worker A records sends only after the ESP accepts, so the ledger still shows nothing." }
  - { from: B, to: ESP, label: send the same 500 }
  - { from: A, to: Broker, label: ack — 30 s late, kind: response }
foot:
  - { label: Root cause, value: timeout 60 s < batch 90 s }
  - { label: Amplifier, value: ledger written after the send }
```

The ledger made sends look idempotent without making them idempotent. Workers
checked it before the send but wrote it only after the ESP accepted — a
90-second window in which the check lies. The timeout change did not create
that window; it built a machine that hit it on every batch.

## Impact

```stats
id: ex-incident-impact
stats:
  - { value: 1.9M, label: Duplicate emails, delta: "3.1% of daily volume" }
  - { value: 41 min, label: Impact to resolution, delta: "detection took 7 of them" }
  - { value: "214", label: Campaigns affected }
  - { value: 3.1×, label: Unsubscribe rate on affected campaigns, trend: up, delta: vs. baseline }
```

## Remediation

```statustable
id: ex-incident-remediation
columns: [Action, Owner, Done / due]
statuses:
  - { label: shipped, color: success }
  - { label: scheduled, color: neutral }
rows:
  - { cells: ["Send ledger written before the ESP call; failed writes reconciled hourly", Delivery, 2026-07-16], status: shipped }
  - { cells: ["Visibility timeouts pinned per queue by a config test that fails on defaults", Platform, 2026-07-21], status: shipped }
  - { cells: [Deploy markers on every send-rate dashboard, Observability, 2026-08-01], status: in progress }
  - { cells: ["Duplicate-send canary — pages when the duplicate rate passes 0.1%", Delivery, 2026-08-15], status: scheduled }
```

## Takeaways

```takeaways
id: ex-incident-takeaways
items:
  - Record intent before the side effect — a ledger written after the send is a race, not a guarantee.
  - Defaults are code — the 15-minute override lived in config nobody tested, and a refactor deleted it silently.
  - text: Users out-detect dashboards on duplicates
    detail: Support tickets led the pager by three minutes; a duplicate-rate canary closes that gap.
```
