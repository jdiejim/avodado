```meta
title: Notifications — AWS reference architecture
subtitle: A typical VPC layout — edge (Route 53 / CloudFront), public + private subnets, microservices, RDS, cache, and S3.
tag: Infra · AWS · us-east-1
```

## Overview

A conventional AWS deployment for the notification system. Public traffic enters
through Route 53 and CloudFront, hits the load balancer in the **public subnet**,
and is routed to microservices in the **private subnets** — which alone can reach
the database, cache, and S3. Nested `groups` draw the VPC and its subnets.

```infra
id: aws-vpc
title: VPC topology
systemLabel: "AWS · us-east-1"
lede: One VPC, three subnet tiers. Only private subnets reach data; egress is via the NAT gateway.
groups:
  - { col: 2, row: 1, cols: 3, rows: 3, label: "VPC 10.0.0.0/16", color: "#0e54a1" }
  - { col: 2, row: 1, cols: 3, rows: 1, label: "Public subnet", color: "#1f9747" }
  - { col: 2, row: 2, cols: 3, rows: 1, label: "Private subnet · app", color: "#1a6dbe" }
  - { col: 2, row: 3, cols: 3, rows: 1, label: "Private subnet · data", color: "#6b21a8" }
nodes:
  - { id: u, col: 1, row: 1, kind: client, name: Users }
  - { id: r53, col: 1, row: 2, kind: external, name: Route 53, tech: DNS }
  - { id: cf, col: 1, row: 3, kind: cdn, name: CloudFront, tech: CDN }
  - { id: alb, col: 2, row: 1, kind: gateway, name: ALB, tech: L7 load balancer }
  - { id: nat, col: 4, row: 1, kind: gateway, name: NAT gateway, tech: egress }
  - { id: orders, col: 2, row: 2, kind: microservice, name: orders, tech: ECS Fargate }
  - { id: pay, col: 3, row: 2, kind: microservice, name: payments, tech: ECS Fargate }
  - { id: notif, col: 4, row: 2, kind: microservice, name: notifications, tech: ECS Fargate }
  - { id: rds, col: 2, row: 3, kind: db, name: RDS, tech: Postgres 16 }
  - { id: cache, col: 3, row: 3, kind: cache, name: ElastiCache, tech: Redis }
  - { id: s3, col: 4, row: 3, kind: bucket, name: S3, tech: assets + backups }
edges:
  - { from: u, to: r53, label: resolve, kind: dashed }
  - { from: u, to: cf }
  - { from: cf, to: s3, label: static, kind: dashed }
  - { from: cf, to: alb, label: "/api" }
  - { from: alb, to: orders }
  - { from: alb, to: pay }
  - { from: alb, to: notif }
  - { from: orders, to: rds }
  - { from: pay, to: rds }
  - { from: notif, to: rds }
  - { from: notif, to: cache, label: counts }
  - { from: orders, to: nat, label: egress, kind: dashed }
```

```callout
tone: tip
title: How the nesting works
body: "Draw the VPC as one big group, then the subnets as smaller groups inside it — the renderer paints larger groups first, so smaller ones nest on top. Nodes sit in grid cells (col / row); the groups just frame them."
```
