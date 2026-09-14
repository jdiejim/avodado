```meta
title: Marram — payout engine
subtitle: How Fenwick moves seller money from captured charge to bank account.
tag: Backend · v2
```

Fenwick is a marketplace for used camera gear; buyers pay Fenwick, and Fenwick
pays its sellers once a day. Marram owns that gap. It holds seller balances
between capture and payout and splits each charge into seller net plus an 8%
platform fee. Every afternoon it executes about 38,000 SEPA transfers.

The constraint that shaped the design is auditability: a regulator can ask for
any seller's position on any past date. So every money movement is a
double-entry journal, and balances are derived, never stored.

## Boundaries

```c4
id: ex-backend-c4
level: container
boundary: { label: Marram }
nodes:
  - { id: core, kind: external, name: marketplace-core, desc: Checkout and charge capture. }
  - { id: settler, kind: container, family: service, name: settler, tech: Go, desc: Turns captures into ledger journals. }
  - { id: api, kind: container, family: service, name: payout-api, tech: Go, desc: Balances and payout status. }
  - { id: batcher, kind: container, family: service, name: batcher, tech: Go, desc: Runs the daily payout batch. }
  - { id: ledger, kind: store, name: ledger-db, tech: Postgres 16, desc: Journals and entries. }
  - { id: vaultic, kind: external, name: Vaultic, desc: Acquirer; executes SEPA transfers. }
edges:
  - { from: core, to: settler, label: publishes charge.captured, tech: Kafka, kind: dashed }
  - { from: settler, to: ledger, label: posts capture journals, tech: SQL }
  - { from: api, to: ledger, label: reads balances, tech: SQL }
  - { from: batcher, to: ledger, label: posts payout journals, tech: SQL }
  - { from: batcher, to: vaultic, label: creates transfers, tech: REST }
  - { from: vaultic, to: api, label: transfer status webhooks, tech: HTTPS, kind: dashed }
```

Charge capture stays in marketplace-core, so a Marram outage delays payouts but
never blocks checkout. Vaultic's webhooks land on payout-api, not the batcher —
a batch crash therefore never loses a settlement status.

## The ledger

```erd
id: ex-backend-erd
entities:
  - name: journals
    columns:
      - { name: id, type: uuid, pk: true }
      - { name: kind, type: text }
      - { name: created_at, type: timestamptz }
  - name: entries
    columns:
      - { name: id, type: uuid, pk: true }
      - { name: journal_id, type: uuid, fk: true }
      - { name: account, type: text }
      - { name: amount_cents, type: bigint }
  - name: transfers
    columns:
      - { name: id, type: uuid, pk: true }
      - { name: seller_id, type: uuid }
      - { name: journal_id, type: uuid, fk: true }
      - { name: status, type: text }
relations:
  - journals ||--o{ entries: contains
  - journals ||--o{ transfers: funds
```

A seller's balance is `SUM(amount_cents)` over their entries — there is no
balance column to drift. The read costs about 30 ms across the 90-day hot
partitions, and payout-api pays that price on every balance call.

## The daily payout run

```sequence
id: ex-backend-seq
endpoint: { method: POST, path: /transfers }
actors:
  - { id: Batcher, name: batcher, sub: "daily 14:00 UTC" }
  - { id: PG, name: ledger-db, sub: Postgres }
  - { id: Vaultic, name: Vaultic, sub: acquirer, external: true }
messages:
  - { from: Batcher, to: PG, label: SELECT due balances, summary: "Sellers with settled balance of 10 EUR or more; about 38k rows." }
  - { from: PG, to: Batcher, label: due sellers, kind: response }
  - { from: Batcher, to: Batcher, kind: note, label: derive transfer_id, summary: "transfer_id = date + seller_id, so every retry names the same transfer." }
  - { from: Batcher, to: Vaultic, label: POST /transfers, summary: "One transfer per seller, transfer_id as the external reference." }
  - { from: Vaultic, to: Batcher, label: 504 timeout, kind: error, summary: "On timeout the batcher retries the same transfer_id; Vaultic dedupes on it." }
  - { from: Batcher, to: Vaultic, label: retry POST /transfers }
  - { from: Vaultic, to: Batcher, label: 201 accepted, kind: response }
  - { from: Batcher, to: PG, label: post payout journal, summary: "The journal posts only after Vaultic accepts — the ledger never claims money that did not move." }
foot:
  - { label: Batch window, value: "14:00–14:40 UTC" }
  - { label: Idempotency, value: "transfer_id, replay-safe" }
```

Retries reuse the transfer_id and Vaultic deduplicates on it, so a seller
receives at most one transfer per day. A crashed batch is rerun whole, with
no reconciliation step.

## Who owns what

```table
columns: [Service, Responsibility, On-call]
rows:
  - [payout-api, "Balance reads, payout status, Vaultic webhooks", Payments Core]
  - [settler, "charge.captured events → capture journals", Payments Core]
  - [batcher, "Daily selection, transfer execution, payout journals", Money Movement]
  - [ledger-db, "Journals and entries — the source of truth", Payments Core]
```

## The invariant

```callout
tone: danger
title: Journals balance; entries never change
body: "Every journal's entries must sum to zero — a trigger rejects the whole insert otherwise. Posted entries (#ex-backend-erd) are never updated or deleted; a correction is a new reversing journal. Any code path that edits an entry in place is a bug, whatever it fixes."
```
