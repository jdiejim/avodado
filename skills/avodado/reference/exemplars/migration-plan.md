```meta
title: Orders store migration
subtitle: Moving 480M orders off the monolith database, with a rollback path at every phase.
tag: Plan · Q3–Q4
```

Hollybank's `orders` table is 2.3 TB inside the monolith's shared Postgres.
Write p95 is 210 ms and climbs about 8 ms a month; autovacuum now runs
11 hours and blocks schema changes. We move orders to a dedicated cluster,
partitioned by month, behind the existing `OrdersRepo` interface — application
code does not change. Every phase is reversible until the old copy is
destroyed, and that happens no earlier than 30 days after cutover.

## Today and target

```cvt
id: ex-migration-cvt
current:
  label: Monolith DB
  items:
    - orders plus 61 other tables in one Postgres
    - "2.3 TB, 480M rows"
    - "write p95 210 ms, rising"
    - autovacuum runs 11 h and blocks DDL
target:
  label: orders-db
  items:
    - dedicated cluster, partitioned by month
    - write p95 under 40 ms
    - DDL touches one partition at a time
    - old copy kept warm for 30 days after cutover
note: OrdersRepo stays the only entry point; just its wiring changes.
```

## Cutover as a state machine

```state
id: ex-migration-state
states:
  - { id: s0, col: 1, row: 1, kind: start }
  - { id: dual, col: 2, row: 1, kind: active, name: DUAL_WRITE }
  - { id: backfill, col: 3, row: 1, kind: active, name: BACKFILL }
  - { id: shadow, col: 4, row: 1, kind: active, name: SHADOW_READ }
  - { id: readnew, col: 5, row: 1, kind: active, name: READ_NEW }
  - { id: writenew, col: 6, row: 1, kind: active, name: WRITE_NEW }
  - { id: done, col: 7, row: 1, kind: terminal, name: DONE }
transitions:
  - { from: s0, to: dual, event: flag on }
  - { from: dual, to: backfill, event: writes verified 24 h }
  - { from: backfill, to: shadow, event: history copied, guard: row counts match }
  - { from: shadow, to: readnew, event: 7 clean days, guard: "mismatch < 0.001%" }
  - { from: readnew, to: writenew, event: 7 clean days, guard: read p95 at or under old }
  - { from: writenew, to: done, event: 30 quiet days }
  - { from: shadow, to: dual, event: mismatch spike }
  - { from: readnew, to: shadow, event: read errors or drift }
  - { from: writenew, to: readnew, event: rollback flag, guard: "reverse replication lag < 60 s" }
```

The state names are literal values of the `orders_migration_phase` flag, so the
diagram, the flag, and the dashboards share one vocabulary. WRITE_NEW is not
the point of no return — the old database follows through reverse replication
and can resume as primary in minutes. The only irreversible transition is
into DONE.

## Write-cutover runbook

```steps
id: ex-migration-runbook
items:
  - title: Freeze schema changes
    body: "The freeze flag rejects DDL on orders in both stores; announce it in #eng first."
    code: hb flags set orders_ddl_freeze on
    lang: bash
  - title: Confirm reverse replication
    body: Rollback depends on it; lag must stay under 60 s before and during the flip.
    code: hb repl status orders-reverse --watch
    lang: bash
  - title: Flip the write primary
    code: hb flags set orders_migration_phase WRITE_NEW
    lang: bash
    note: The flag drains in-flight transactions for up to 5 s — expect a latency blip, not errors.
  - title: Hold the exit criteria for 30 minutes
    body: "Write p95 under 40 ms, zero dual-write mismatches, reverse lag under 60 s. On any breach, flip back to READ_NEW and debug offline — never in place."
```

## Risks

```risk
id: ex-migration-risks
items:
  - { risk: "Three cron jobs write orders with raw SQL, bypassing OrdersRepo and the dual-write layer", likelihood: high, impact: high, mitigation: "Two rewritten, one deleted; the bypass audit re-runs weekly until DONE.", owner: Monolith, status: mitigating }
  - { risk: Reverse replication breaks silently and the rollback path becomes fiction, likelihood: med, impact: high, mitigation: "Lag over 60 s pages at production severity, day and night.", owner: Storage, status: mitigating }
  - { risk: Diff sampler misses drift inside JSON columns, likelihood: low, impact: high, mitigation: Rows are canonicalized before hashing., owner: Storage, status: closed }
  - { risk: Backfill competes with month-end order load, likelihood: med, impact: med, mitigation: Copy is rate-limited and pauses itself when monolith write p95 passes 150 ms., owner: Storage, status: open }
```
