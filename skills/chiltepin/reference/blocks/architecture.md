# Chiltepin blocks — Architecture

Part of the **chiltepin** skill (the hub is `SKILL.md`, two folders up).
Run `chiltepin block <type>` for the fields and an example; block → family map:
`INDEX.md`. Schemas reject unknown fields.

**Shape**: Containment — boundaries and what lives inside them (`c4`,
`block` + presets, `cluster`, `archmap`) — and Network for module, class,
and actor graphs (`felogic`, `frontend`, `uml`, `usecase`, `pkg`).
**Answers**: What lives inside which boundary? What depends on what, at rest?
**Not this family**: the order of calls → `sequence` (flows.md); branching or
a lifecycle → `flow` / `state` (flows.md); data shape → `erd` (data-model.md);
tiers with no arrows → `layers`; area by number → `treemap`; a CI/CD pipeline
→ `flow` with `variant: dag`.

#### `c4` — context / container / component
Boxes with kind chips inside dashed boundaries; the frame tag shows the
level. Answers one question per level. `c4`, not `block`, when C4 levels and
system boundaries carry the message; `sequence` for the order of calls.
- `level` is required, and one diagram holds one level. Never mix levels.
- Context: who uses it and what does it talk to. `person`, `system` (usually
  one), and `external` only. 4–8 nodes.
- Container: the deployable pieces. One `boundary` (or `boundaries[]`) is the
  system; every container carries `tech`; persons and externals sit outside.
  5–9 nodes; past that, split the diagram.
- Component: inside ONE container, named in the title; `family` codes the layer.
- Every edge is a sentence: `label` an active verb phrase, `tech` the protocol.
  One arrow from the caller; the reply is implied. Async edges are `dashed`.
- Externals are things you do not deploy. If your team owns it, it is a container.
- Omit `col`/`row` on every node for auto-layout; `dir: TB` flips it.

#### `block` — grid architecture with optional groups
Boxes and arrows on a grid. Known `kind`s (db, queue, cache, gateway, cdn,
and vendor names like postgres, s3, kafka, redis) get a glyph and a shape;
an unknown kind draws a plain box. Answers: what talks to what, at rest?
`block`, not `c4`, for free kinds, nested zones, and presets.
- `gateway`, `lb`, `proxy`, and `ingress` draw as the tall vertical bar of
  system-design diagrams. It spans the rows of the services it fans out to
  on its own; set `h` to choose the span. Put the bar in its own column.
- `preset` (infra, event, ddd, network, k8s) changes only the framing: the tag,
  the eyebrow, and which kind is the accent entry. The YAML is the same.
- Omit `col`/`row` on every node for auto-layout. Use coordinates for a
  deliberate shape, and always with `groups`.
- `layers:` switches to horizontal bands; nodes then use `layer`, not
  `col`/`row`. Do not mix the two modes.
- `groups` nest by overlap (the larger paints first) or by `parent`. A child's
  cells must lie inside its parent's range (`W_GROUP_NESTING`).
- `replicas: N` (2 or more) draws a stacked card. For a database replica set
  use two nodes and a dashed `replicates` edge.
- `preset: k8s`: a namespace is a group and `ingress` is the entry; nest
  namespaces inside a cluster with `parent`.
```block
groups:
  - { id: vpc, col: 1, row: 1, cols: 2, rows: 2, label: VPC }
  - { id: pub, parent: vpc, col: 1, row: 1, cols: 2, rows: 1, label: Public subnet }
  - { id: priv, parent: vpc, col: 1, row: 2, cols: 2, rows: 1, label: Private subnet }
nodes:
  - { id: alb, col: 1, row: 1, kind: gateway, name: ALB }
  - { id: api, col: 1, row: 2, kind: service, name: orders-api, replicas: 3 }
edges:
  - alb -> api
```

#### `cluster` — k8s-style nested boxes with services
Namespace boxes holding service cards with replica bars; a single `gateway`
service takes the accent. Answers: which services run in which namespace?
`block` with `preset: k8s` for nested namespaces or a mixed cloud + cluster map.

#### `archmap` — target-architecture capability map
A mosaic of tinted domain areas packed with capability tiles. A plain string
is a current capability; `status` marks target, new, gap, or deprecated.
Answers: what lives in each domain? `block` when the arrows between systems matter.

#### `felogic` — frontend / backend module graph
Module boxes with UML stereotype banners (interface, controller, service,
repository) and typed edges. `variant: be` changes only the framing.
Answers: which module uses or implements which? Omit `col`/`row` and
`groups` for auto-layout. `felogic`, not `uml`, for a module graph.

#### `frontend` — top-down component tree
Parents above children with link paths, one `root`. Answers: how do the
components nest? `frontend`, not `tree`, for a UI component tree with kinds
(layout, page, hook, store).

#### `uml` — class diagram
Class boxes with attributes and methods; the relation `kind` drives the
arrow marker. Answers: which classes inherit, implement, or depend on which?
`uml`, not `erd`, for classes with behaviour; `erd` for tables and cardinality.
#### `usecase` — UML use-case diagram
Actors outside the `system` boundary, cases (verb phrases, ≤ 12) inside,
`links` as `actor -> case`, `relations` `kind: include | extend | generalize`. Answers: who uses it for what?
#### `pkg` — UML package diagram
Tabbed folders with `contains` members, `parent` to nest, `deps` dashed with
`kind: import | use | access | merge`. Answers: which module may depend on which?
