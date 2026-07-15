```infra
title: AWS topology
systemLabel: ShopCo · us-east-1
layers:
  - { label: Edge }
  - { label: Compute }
  - { label: Data }
nodes:
  - { id: cf, layer: 0, kind: cdn, name: CloudFront, tech: CDN }
  - { id: alb, layer: 0, kind: gateway, name: ALB, tech: Application LB }
  - { id: api, layer: 1, kind: service, name: API, tech: ECS Fargate }
  - { id: worker, layer: 1, kind: service, name: Worker, tech: ECS Fargate }
  - { id: pg, layer: 2, kind: store, name: orders-db, tech: RDS Postgres }
  - { id: cache, layer: 2, kind: cache, name: cache, tech: ElastiCache }
edges:
  - { from: cf, to: alb }
  - { from: alb, to: api }
  - { from: api, to: pg }
  - { from: api, to: cache }
  - { from: api, to: worker, kind: dashed }
```
