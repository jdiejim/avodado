```meta
title: Trips pipeline
subtitle: How 2.1 billion daily tracker pings become the trips Loxley bills and scores.
tag: Data · v3
```

Loxley sells fleet telematics: 140,000 delivery vehicles carry a tracker that
reports position and speed every few seconds. Trackers buffer offline — tunnels,
depots, dead zones — so pings arrive up to 48 hours late. The pipeline therefore
streams with a 48-hour dedupe window keyed on `(vehicle_id, recorded_at)`.
Staleness has a user-facing price: fleet managers review yesterday's trips at
07:00 local, and per-mile invoices draw on the same rows.

## From pings to trips

```dfd
id: ex-pipeline-dfd
nodes:
  - { id: fleet, col: 1, row: 1, kind: external, name: Tracker fleet }
  - { id: ingest, col: 2, row: 1, kind: process, name: Ingest gateway, num: 1 }
  - { id: raw, col: 3, row: 1, kind: store, name: pings.raw · Kafka }
  - { id: dlq, col: 2, row: 2, kind: store, name: pings.dlq }
  - { id: dedupe, col: 4, row: 1, kind: process, name: Deduper, num: 2 }
  - { id: sess, col: 5, row: 1, kind: process, name: Sessionizer, num: 3 }
  - { id: trips, col: 6, row: 1, kind: store, name: trips-db · Postgres }
edges:
  - { from: fleet, to: ingest, label: pings }
  - { from: ingest, to: raw }
  - { from: ingest, to: dlq, label: malformed }
  - { from: raw, to: dedupe }
  - { from: dedupe, to: sess, label: unique pings }
  - { from: sess, to: trips, label: closed trips }
```

The sessionizer is the lossy stage by design: it closes a trip after five idle
minutes. That collapses 2.1 billion pings into about 9.4 million trips a day. Raw
pings expire after 30 days; safety scores, invoices, and dashboards all read
trips, never pings.

## Trips at rest

```erd
id: ex-pipeline-erd
entities:
  - name: vehicles
    columns:
      - { name: id, type: uuid, pk: true }
      - { name: fleet_id, type: uuid }
      - { name: tracker_serial, type: text }
  - name: trips
    columns:
      - { name: id, type: uuid, pk: true }
      - { name: vehicle_id, type: uuid, fk: true }
      - { name: started_at, type: timestamptz }
      - { name: ended_at, type: timestamptz }
      - { name: distance_m, type: int }
  - name: trip_points
    columns:
      - { name: trip_id, type: uuid, fk: true }
      - { name: recorded_at, type: timestamptz }
      - { name: speed_kph, type: smallint }
relations:
  - vehicles ||--o{ trips: drives
  - trips ||--o{ trip_points: samples
```

`distance_m` is computed once, when the trip closes, and never recomputed — an
invoice printed in March must match the trip row it was billed from.

## Replaying a gap

```steps
id: ex-pipeline-replay
items:
  - title: Size the gap
    body: Compare the ingest tally against the deduper's output for the affected hours.
    code: lox lag --topic pings.raw --by hour
    lang: bash
  - title: Replay inside the window
    body: The deduper drops every ping it has already seen, so a bounded replay is safe.
    code: lox replay --topic pings.raw --from 2026-08-21T06:00Z --to 2026-08-21T09:00Z
    lang: bash
    note: Give both bounds; the tool refuses an unbounded replay.
  - title: Verify counts
    body: Close the incident only when trip counts match the ingest tally within 0.01%.
    code: lox verify trips --day 2026-08-21
    lang: bash
```

```callout
tone: danger
title: Never replay past 48 hours
body: "Beyond the dedupe window the deduper has forgotten the pings, so a replay re-creates trips that invoices already used — miles get billed twice. For older gaps run `lox rebuild --day`, which deletes and re-sessionizes whole days atomically."
```

## Freshness commitments

```slo
id: ex-pipeline-slo
items:
  - { name: Freshness, sli: Ping visible as trip data within 15 min, target: 99%, current: 99.4%, window: 30d, budget: 0.6 }
  - { name: Completeness, sli: Trip closed within 48 h of its last ping, target: 99.9%, current: 99.95%, window: 30d, budget: 0.5 }
  - { name: Scoring latency, sli: Safety score updated within 24 h of trip close, target: 99.5%, current: 99.1%, window: 7d, budget: 1.8 }
```

The scoring objective is breached at 1.8× budget: the scorer re-shards this
week, and feature work on it stays frozen until the budget recovers.
