```network
title: Security zones
nodes:
  - { id: edge, col: 1, row: 1, kind: gateway, name: Edge / WAF }
  - { id: fw, col: 2, row: 1, kind: firewall, name: Perimeter FW }
  - { id: api, col: 3, row: 1, kind: service, name: API }
  - { id: db, col: 3, row: 2, kind: store, name: DB (private) }
edges:
  - { from: edge, to: fw }
  - { from: fw, to: api }
  - { from: api, to: db }
```
