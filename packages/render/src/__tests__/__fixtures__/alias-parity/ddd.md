```ddd
title: Bounded contexts
nodes:
  - { id: cat, col: 1, row: 1, kind: context, name: Catalog }
  - { id: order, col: 2, row: 1, kind: context, name: Orders }
  - { id: pay, col: 3, row: 1, kind: context, name: Payments }
  - { id: ship, col: 2, row: 2, kind: context, name: Shipping }
edges:
  - { from: order, to: cat, label: reads, kind: dashed }
  - { from: order, to: pay }
  - { from: order, to: ship }
```
