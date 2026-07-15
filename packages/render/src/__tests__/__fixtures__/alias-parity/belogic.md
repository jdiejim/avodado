```belogic
title: Backend modules
nodes:
  - { id: ctrl, col: 1, row: 1, kind: controller, name: OrdersController }
  - { id: svc, col: 2, row: 1, kind: service, name: PlaceOrder }
  - { id: repo, col: 3, row: 1, kind: repository, name: OrdersRepo }
  - { id: db, col: 4, row: 1, kind: db, name: postgres }
  - { id: pay, col: 3, row: 2, kind: external, name: Stripe }
edges:
  - { from: ctrl, to: svc }
  - { from: svc, to: repo }
  - { from: repo, to: db, kind: reads }
  - { from: svc, to: pay, kind: egress, label: authorise }
```
