```event
title: Pub/sub choreography
nodes:
  - { id: orders, col: 1, row: 1, kind: producer, name: orders }
  - { id: bus, col: 2, row: 1, kind: topic, name: order.events }
  - { id: ship, col: 3, row: 1, kind: consumer, name: shipping }
  - { id: bill, col: 3, row: 2, kind: consumer, name: billing }
edges:
  - { from: orders, to: bus }
  - { from: bus, to: ship }
  - { from: bus, to: bill }
```
