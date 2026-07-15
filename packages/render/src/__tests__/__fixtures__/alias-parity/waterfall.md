```waterfall
title: API latency budget
unit: ms
budget: 250
items:
  - { label: DNS + TLS, value: 35 }
  - { label: Gateway, value: 20, desc: auth + routing }
  - { label: Service, value: 90 }
  - { label: Database, value: 70 }
```
