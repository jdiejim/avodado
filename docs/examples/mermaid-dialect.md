```meta
title: Mermaid input dialect
subtitle: Five Mermaid grammars that parse into typed Avodado blocks.
tag: Example
```

A ` ```mermaid ` fence whose first line is `sequenceDiagram`, `flowchart`, `erDiagram`, `stateDiagram-v2`, or `pie` parses into the matching typed block. The renderer draws it exactly like a YAML block; an edit writes it back as YAML. The subset is in `reference/mermaid.md`.

## Sequence

A checkout request with one failure branch. The `alt` frame is dropped; its messages stay.

```mermaid
sequenceDiagram
    autonumber
    actor U as Shopper
    participant Web
    participant API as Orders API
    U->>Web: Click "Pay"
    Web->>+API: POST /orders
    API-)Bus: OrderPlaced
    alt card declined
        API--xWeb: 402 declined
    else ok
        API-->>-Web: 201 created
    end
    Note over Web,API: Idempotency key in the header
    Web-->U: Receipt
```

## Flowchart

The stadium node with no incoming edge becomes `start`; the one with no outgoing edge becomes `end`. The renderer places the nodes.

```mermaid
flowchart TD
    S([Start]) --> A[Load cart]
    A --> B{Cart empty?}
    B -->|yes| N[Show the empty cart]
    B -- no --> C[/Collect payment/]
    C -.-> D[(Orders DB)]
    C --x F["Payment failed"]
    F --> C
    D & N --> E([Done])
```

## Entity model

Crow's-foot ends set the cardinality; `PK` and `FK` flags carry over.

```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ "ORDER LINE" : contains
    PRODUCT }o..o{ "ORDER LINE" : "appears in"
    CUSTOMER {
        uuid id PK
        string email UK "unique"
        string name
    }
    ORDER {
        uuid id PK
        uuid customer_id FK
        int total
    }
```

## State machine

`[*]` becomes a start or terminal pseudo-state. The composite `Approved` is flattened; its inner `[*]` gets its own start dot.

```mermaid
stateDiagram-v2
    direction LR
    [*] --> Draft
    Draft --> Review : submit
    Review --> Draft : reject
    Review --> Approved : approve
    state "Published live" as Live
    Approved --> Live : publish
    Live --> [*]
    state Approved {
        [*] --> Queued
        Queued --> Sent : dispatch
    }
    note right of Draft : Editable by the author
```

## Pie

A pie becomes a `chart` with `kind: donut`.

```mermaid
pie showData
    title Traffic by source
    "Search" : 52
    "Direct" : 30.5
    "Referral" : 17.5
```
