```meta
title: A city in motion
subtitle: From a transport platform's system boundary to the network its route planner traverses.
tag: TRANSPORT · EXAMPLE
```

Riders need a route that reflects current service conditions. Operators publish disruptions so the route planner can exclude unavailable connections.
The platform and travel times below are illustrative.

```c4
id: transport-platform-context
title: The transport platform in its world
level: context
nodes:
  - { id: rider, kind: person, name: Rider, col: 1, row: 1, desc: "Plans a journey across the city." }
  - { id: operator, kind: person, name: Operator, col: 1, row: 2, desc: "Publishes service disruptions." }
  - { id: platform, kind: system, name: Mobility platform, col: 2, row: 1, desc: "Combines routes and live service status." }
  - { id: maps, kind: external, name: Map service, col: 3, row: 1, desc: "Street and walking connections." }
  - { id: fleet, kind: external, name: Fleet telemetry, col: 3, row: 2, desc: "Vehicle locations and arrival updates." }
edges:
  - rider -> platform: plans a journey
  - operator -> platform: reports disruptions
  - platform -> maps: requests walking routes
  - fleet --> platform: streams arrival updates
```

Each edge carries a travel time in minutes. A route planner combines these connections to find a path to the selected destination.

```graph
id: transport-route-graph
title: Six stops. More than one way there.
description: "Illustrative travel times in minutes. Airport is the selected destination."
nodes:
  - { id: central, label: Central, col: 1, row: 1 }
  - { id: museum, label: Museum, col: 2, row: 1 }
  - { id: airport, label: Airport, col: 3, row: 1, state: target }
  - { id: depot, label: Depot, col: 1, row: 2 }
  - { id: campus, label: Campus, col: 2, row: 2 }
  - { id: harbor, label: Harbor, col: 3, row: 2 }
edges:
  - { from: central, to: museum, dir: undirected, weight: 4 }
  - { from: museum, to: airport, dir: undirected, weight: 12 }
  - { from: central, to: depot, dir: undirected, weight: 3 }
  - { from: depot, to: campus, dir: undirected, weight: 5 }
  - { from: museum, to: campus, dir: undirected, weight: 2 }
  - { from: campus, to: harbor, dir: undirected, weight: 4 }
  - { from: harbor, to: airport, dir: undirected, weight: 6 }
```
