```meta
title: Deployment topology
subtitle: One region, two zones, the subnets in each — then the same service on Kubernetes.
tag: EXAMPLE
```

Groups nest with `parent` (region → zone → subnet). A node with `replicas` draws as a stacked card with a `×N` chip. `preset: k8s` gives the Kubernetes kinds their chips and glyphs.

## Cloud topology

```block
id: cloud-topology
preset: infra
title: Orders — eu-west-1
groups:
  - { id: region, col: 2, row: 1, cols: 4, rows: 2, label: "Region · eu-west-1" }
  - { id: zone-a, parent: region, col: 2, row: 1, cols: 2, rows: 2, label: Zone A }
  - { id: zone-b, parent: region, col: 4, row: 1, cols: 2, rows: 2, label: Zone B }
  - { id: pub-a, parent: zone-a, col: 2, row: 1, cols: 2, rows: 1, label: Public subnet }
  - { id: priv-a, parent: zone-a, col: 2, row: 2, cols: 2, rows: 1, label: Private subnet }
  - { id: pub-b, parent: zone-b, col: 4, row: 1, cols: 2, rows: 1, label: Public subnet }
  - { id: priv-b, parent: zone-b, col: 4, row: 2, cols: 2, rows: 1, label: Private subnet }
nodes:
  - { id: users, col: 1, row: 1, kind: users, name: Customers }
  - { id: gw, col: 2, row: 1, kind: gateway, name: Gateway, tech: Envoy, replicas: 2 }
  - { id: nat, col: 4, row: 1, kind: proxy, name: NAT, tech: egress only }
  - { id: api, col: 2, row: 2, kind: service, name: orders-api, tech: Go, replicas: 3 }
  - { id: pg, col: 3, row: 2, kind: postgres, name: orders-db, tech: primary }
  - { id: q, col: 4, row: 2, kind: queue, name: order-events, tech: SQS }
  - { id: pg-ro, col: 5, row: 2, kind: postgres, name: orders-db, tech: read replica }
edges:
  - users -> gw
  - gw -> api
  - api -> pg: writes
  - api -> q: publishes
  - api --> pg-ro: reads
  - pg --> pg-ro: replicates
```

## The same service on Kubernetes

```block
id: k8s-topology
preset: k8s
title: Namespace orders
groups:
  - { id: ns, col: 1, row: 1, cols: 4, rows: 2, label: "namespace · orders" }
nodes:
  - { id: ingress, col: 1, row: 1, kind: ingress, name: Ingress, tech: nginx }
  - { id: svc, col: 2, row: 1, kind: service, name: orders-svc, tech: "ClusterIP :80" }
  - { id: dep, col: 3, row: 1, kind: deployment, name: orders, tech: v2.4.1 }
  - { id: pod, col: 4, row: 1, kind: pod, name: orders pod, tech: "go · 512Mi", replicas: 3 }
  - { id: cron, col: 2, row: 2, kind: cronjob, name: reconcile, tech: "*/15 * * * *" }
  - { id: cm, col: 3, row: 2, kind: configmap, name: orders-config }
  - { id: sec, col: 4, row: 2, kind: secret, name: orders-secrets }
edges:
  - ingress -> svc
  - svc -> pod
  - dep -> pod: manages
  - cron --> svc
  - cm --> pod: mounts
  - sec --> pod: env
```
