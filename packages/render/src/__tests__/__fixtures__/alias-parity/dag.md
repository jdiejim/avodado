```dag
title: Build pipeline
nodes:
  - { id: src, col: 1, row: 1, kind: start, label: Source }
  - { id: lint, col: 2, row: 1, kind: process, label: Lint }
  - { id: test, col: 3, row: 1, kind: process, label: Test }
  - { id: build, col: 4, row: 1, kind: process, label: Build }
  - { id: deploy, col: 5, row: 1, kind: end, label: Deploy }
edges:
  - { from: src, to: lint }
  - { from: lint, to: test }
  - { from: test, to: build }
  - { from: build, to: deploy }
```
