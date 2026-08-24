```meta
title: Terrastride field app
subtitle: The offline-first inspection app wind-turbine technicians run on tower phones.
tag: Frontend · SPA
```

Terrastride is a React SPA behind a service worker, not an SSR app.
Technicians spend up to 9 hours offline inside a tower, and 60% of sessions
touch the network zero times. Server rendering buys nothing when there is no
server to reach. The costs we accept: a 180 KB gzip bundle budget on first
load, and every read and write goes through IndexedDB.

## Module tree

```frontend
id: ex-frontend-arch-tree
nodes:
  - { id: app, kind: root, name: App }
  - { id: sync, parent: app, kind: provider, name: SyncProvider, note: owns the network }
  - { id: shell, parent: app, kind: layout, name: Shell }
  - { id: turbines, parent: shell, kind: page, name: TurbineListPage }
  - { id: turbine, parent: shell, kind: page, name: TurbineDetailPage }
  - { id: inspections, parent: shell, kind: page, name: InspectionListPage }
  - { id: inspection, parent: shell, kind: page, name: InspectionPage }
  - { id: syncpage, parent: shell, kind: page, name: SyncPage }
  - { id: checklist, parent: inspection, kind: component, name: ChecklistForm }
  - { id: photo, parent: inspection, kind: component, name: PhotoCapture }
  - { id: outbox, parent: sync, kind: store, name: outboxStore, note: IndexedDB queue }
  - { id: useoutbox, parent: checklist, kind: hook, name: useOutbox }
```

The rule the tree must keep: pages read IndexedDB and nothing else.
`SyncProvider` is the only module that imports the network layer, so "does
this work offline?" is answered by the import graph, not by testing every
screen.

## The inspection screen

```wireframe
id: ex-frontend-arch-screen
screens:
  - device: phone
    title: "T-114 · Gearbox"
    label: InspectionPage — offline, 4 writes queued
    elements:
      - { type: header, label: "Gearbox inspection" }
      - { type: badge, label: "offline · 4 queued", tone: muted, align: r }
      - { type: card, rows: 3 }
      - { type: input, label: Torque reading }
      - { type: button, label: Add photo }
      - { type: button, label: Complete inspection, tone: accent }
      - { type: tabs, label: "Turbines, Inspections, Sync" }
```

The queued badge is the only sync UI on this screen. Sync state stays
ambient, and the technician never leaves the checklist to check on it.

## Record lifecycle

```state
id: ex-frontend-arch-lifecycle
states:
  - { id: s0, col: 1, row: 1, kind: start }
  - { id: draft, col: 2, row: 1, kind: active, name: DRAFT }
  - { id: queued, col: 3, row: 1, kind: wait, name: QUEUED }
  - { id: syncing, col: 4, row: 1, kind: active, name: SYNCING }
  - { id: synced, col: 5, row: 1, kind: terminal, name: SYNCED }
  - { id: conflict, col: 4, row: 2, kind: wait, name: CONFLICT }
transitions:
  - { from: s0, to: draft, event: open inspection }
  - { from: draft, to: queued, event: technician taps Complete }
  - { from: queued, to: syncing, event: radio regained, guard: outbox not empty }
  - { from: syncing, to: synced, event: server ack }
  - { from: syncing, to: conflict, event: server version newer }
  - { from: conflict, to: queued, event: technician merges on SyncPage }
```

Records sit in QUEUED longest — median 3.4 hours, the rest of the tower
visit. The UI treats QUEUED as success: the badge counts quietly, and a
queued record never blocks starting the next inspection.

## Routes

```table
id: ex-frontend-arch-routes
columns: [Route, Screen, Offline behavior]
rows:
  - ["/turbines", TurbineListPage, Served from cache — never blocks on network]
  - ["/turbines/:id", TurbineDetailPage, "Cache first, silent refetch when radio returns"]
  - ["/inspections", InspectionListPage, "Local list from cache + outbox — queued records included"]
  - ["/inspections/:id", InspectionPage, All writes go to the outbox]
  - ["/sync", SyncPage, "Queue, conflicts, manual retry — the only network-aware UI"]
```
