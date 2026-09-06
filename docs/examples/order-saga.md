```meta
title: Order saga
subtitle: The distributed transaction behind "place order", and what runs backwards when a step fails.
tag: FLOWS
```

Placing an order touches four services, each with its own database, so there is no single transaction to roll back. The saga below shows the forward steps, the compensation each one carries, and the path the order service takes when the shipment booking fails.

```saga
id: place-order
title: Place order
mode: orchestration
coordinator: Order service
steps:
  - reserve: Reserve stock · inventory · decrement on-hand · release stock
  - charge: Charge card · payments · authorise and capture · refund card
  - ship: Book shipment · shipping · create carrier booking · cancel shipment
  - notify: Send confirmation · notifications · email + push
failAt: ship
```
