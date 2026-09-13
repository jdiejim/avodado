```meta
title: ADR-014 — Sync engine for co-writing
subtitle: Why Plotline replaced last-writer-wins with CRDT sync, and what it measurably changed.
tag: ADR · Accepted
```

In March, 23% of active manuscripts had two or more writers in the same
hour, and last-writer-wins overwrote 31 reported edits that month.
"Lost my changes" became the top support tag. A ghostwriter and an editor
routinely work the same scene at the same time, so the fix had to allow
concurrent edits — not serialize them.

## Options

```options
id: ex-adr-options
items:
  - kicker: Option 1
    title: Section locking
    how: One writer holds a scene at a time; others wait or fork.
    pros: [No merge logic at all, Ships in two weeks]
    cons: ["Blocks the ghostwriter + editor pair — our core workflow", Stale locks need a timeout policy]
    verdict: "REJECTED — solves the symptom by forbidding the use case"
    tone: rejected
  - kicker: Option 2
    title: OT server
    how: A central server transforms and orders every operation.
    pros: [Proven at scale by Google Docs, Server log makes debugging linear]
    cons: [Every keystroke round-trips — offline writing stops working, The sequencer is a single point of failure]
    verdict: "VIABLE — fallback if CRDT storage costs blow up"
    tone: viable
  - kicker: Option 3
    title: CRDT (Yjs)
    how: Every client merges; the server only relays and persists updates.
    pros: [Offline edits merge on reconnect, "80 ms p50 merge in the prototype", Relay server is stateless]
    cons: ["Stored docs grow ~1.6× from tombstones", Merge output is harder to debug than a server log]
    verdict: "CHOSEN"
    tone: chosen
```

## Decision

```callout
id: ex-adr-decision
tone: note
title: Decision
body: "Plotline syncs manuscripts with Yjs CRDTs. The server relays and persists updates; it never resolves them."
```

## What we accepted

```proscons
id: ex-adr-consequences
pros:
  - Concurrent edits merge without a lock or a round-trip
  - Writers keep working through the full offline flight test
  - Relay servers scale horizontally — no sequencer to shard
cons:
  - "Stored manuscript grows ~1.6× — tombstones never leave the doc"
  - Deletion GC needs a weekly compaction job we now own
  - A bad merge has no single log to replay
```

The trade we made explicit: 83 KB more per manuscript is about 10 GB across
Plotline's 120,000 manuscripts — under $1 a month at $0.02/GB. Each
lost-edit ticket cost a churn-risk conversation. We bought
reliability with pennies of disk.

## Measured outcome

```benchmark
id: ex-adr-outcome
metricLabel: Metric
subjects:
  - { label: Before, sub: last-writer-wins, tone: muted }
  - { label: After, sub: Yjs rollout, featured: true }
rows:
  - { label: Lost-edit tickets / month, better: low, cells: ["31", "2"] }
  - { label: Sync latency p50, better: low, cells: ["140 ms", "80 ms"] }
  - { label: Doc load p95, better: low, cells: ["410 ms", "460 ms"] }
  - { label: Storage per manuscript (median), better: low, cells: ["148 KB", "231 KB"] }
note: "Four weeks either side of the 100% rollout, June; same manuscript cohort."
```

Load p95 and storage went the wrong way, as the options card predicted. Both
stayed inside the budget we set before rollout (500 ms, 300 KB), so the
decision stands without amendment.
