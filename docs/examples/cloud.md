```meta
title: Orders service — cloud architecture
subtitle: How the orders service is deployed on AWS, and the request path through it.
tag: ARCHITECTURE · AWS
```

## What shaped it

```drivers
title: Requirements and NFRs
items:
  - { title: Elastic checkout, body: "Handle 10× spikes on launch days.", tag: "NFR: scale", icon: bolt, accent: amber }
  - { title: Durable orders, body: "No order is ever lost once accepted.", tag: "NFR: durability", icon: database, accent: green }
  - { title: Low latency, body: "Return under 800ms at p95.", tag: "NFR: latency", icon: clock, accent: blue }
```

## Context

```c4
level: context
title: Who uses the orders service
nodes:
  - { id: shopper, kind: person, name: Shopper }
  - { id: orders, kind: system, name: Orders service }
  - { id: pay, kind: external, name: Payments provider }
  - { id: bus, kind: external, name: Event bus }
edges:
  - { from: shopper, to: orders, label: places order }
  - { from: orders, to: pay, label: charges }
  - { from: orders, to: bus, label: publishes events }
```

## Topology

```infra
title: AWS deployment
systemLabel: orders · us-east-1
layers:
  - { label: Edge }
  - { label: Compute }
  - { label: Data }
nodes:
  - { id: cf, layer: 0, kind: cdn, name: CloudFront, tech: CDN }
  - { id: alb, layer: 0, kind: gateway, name: ALB, tech: Application LB }
  - { id: api, layer: 1, kind: service, name: Orders API, tech: ECS Fargate }
  - { id: worker, layer: 1, kind: service, name: Event worker, tech: ECS Fargate }
  - { id: pg, layer: 2, kind: store, name: orders-db, tech: RDS Postgres }
  - { id: cache, layer: 2, kind: cache, name: cache, tech: ElastiCache }
edges:
  - { from: cf, to: alb }
  - { from: alb, to: api }
  - { from: api, to: pg }
  - { from: api, to: cache }
  - { from: api, to: worker, kind: dashed }
```

## Key request

```sequence
id: seq-place
actors:
  - { id: c, name: Client }
  - { id: api, name: Orders API }
  - { id: db, name: orders-db }
messages:
  - { from: c, to: api, label: POST /orders, kind: sync }
  - { from: api, to: db, label: INSERT order }
  - { from: api, to: c, label: 201 Created, kind: response }
```

## Stack choices

```table
columns: [Concern, Choice, Why]
rows:
  - [Compute, ECS Fargate, "No node management; scales to zero off-peak"]
  - [Database, RDS Postgres, "Strong consistency for orders"]
  - [Events, Managed event bus, "Decouples downstream consumers"]
```

```callout
tone: warn
title: Trade-offs
body: "Fargate cold starts add ~1s on scale-out — pre-warm before known spikes. RDS is a single-writer; shard only if write volume demands it."
```
