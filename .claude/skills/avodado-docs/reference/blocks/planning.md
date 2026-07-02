# Avodado blocks — Planning, lists & backlogs

Part of the **avodado-docs** skill (the hub is `SKILL.md`, two folders up).
Field contracts and examples for this family's blocks. The at-a-glance contract
table for all 87 blocks is `contract.md` beside this file; the block → family
map is `INDEX.md`. Schemas reject unknown fields — use exactly these.

### Planning & meta

#### `userstory` — agile story + acceptance criteria + links
```userstory
id: US-142
role: shopper
want: pay for my cart in one step
soThat: I can complete my purchase quickly
priority: High
points: 5
criteria:
  - { given: I have items, when: I submit valid payment, then: an order is created }
links:
  - { ref: orders-api#seq-place-order, mode: sequence, label: Request flow }
```
`links` may use `ref: doc#id` (a real cross-reference) or a plain label.

#### `timeline` — phases / roadmap
```timeline
items:
  - { label: P0 — Core, date: now, status: current, desc: parser + resolver }
  - { label: P1 — CLI, date: next, status: next, desc: init / check / render }
```
`status` is `done | current | next | future` (colours the dot).

#### `changelog` — release history
```changelog
title: Release history
releases:
  - version: 2.0.0
    date: 2026-06-24
    tag: breaking
    items:
      - { type: changed, text: "Config moved from .rc to avodado.config.json" }
      - { type: removed, text: Dropped Node 18 support }
  - version: 1.4.0
    date: 2026-05-12
    tag: minor
    items:
      - { type: added, text: Dark theme }
      - { type: fixed, text: Slide overflow on long tables }
```
A vertical rail with a dot per release (red for `tag: breaking`), a mono
version pill, the date, and a tag chip. Each item takes an optional
keep-a-changelog `type` (`added` green · `changed` blue · `fixed` amber ·
`removed` gray · `security` red); untyped items get no chip. Newest release
first. Use `changelog` for shipped history; use `timeline` for phases and
plans ahead.

#### `kanban` — flexible columns
```kanban
columns:
  - label: Now
    cards:
      - { title: Core parser }
      - { title: Validation, tag: priority }
  - label: Next
    cards:
      - { title: Hot reload }
```

#### `tracker` — task list with status / priority / owner / due
```tracker
items:
  - { task: First task, status: doing, priority: high, owner: alice, due: 2026-01-15 }
  - { task: Second task, status: todo, priority: med }
```
`status` is `todo | doing | done | blocked`; `priority` is `high | med | low`.

#### `risk` — a risk register
```risk
title: Launch risks
items:
  - { risk: Traffic spike overwhelms the API, likelihood: med, impact: high, mitigation: Autoscaling + load-shedding at the gateway., owner: Platform, status: mitigating }
  - { risk: Data migration misses edge cases, likelihood: low, impact: high, mitigation: Dry-run against a prod snapshot first., owner: Data, status: open }
  - { risk: Key dependency ships late, likelihood: high, impact: high, mitigation: Feature-flag the integration., owner: PM, status: open }
  - { risk: Docs lag the release, likelihood: med, impact: low, status: accepted }
```
One row-card per risk. `likelihood` and `impact` are `low | med | high`;
severity derives from their product — both high → **critical** (solid red
chip), one high → high, both low → low, everything else medium. `status` is
`open | mitigating | accepted | closed` (amber / blue / gray / green chip),
right-aligned next to the owner. Use `risk` for a risk register; use `tracker`
for task-level work and `swot` for strategic position.

#### `cvt` — current vs target (before / after)
```cvt
title: Migration plan
current:
  label: Today
  items: [Single monolith, Shared DB, Manual deploys]
target:
  label: Target
  items: [Modular services, Per-service stores, Continuous releases]
note: Migrate one service per quarter.
```

#### `proscons` — pros vs cons (two columns)
```proscons
title: Keeping checkout synchronous
pros: [One transaction, Easy to reason about]
cons: [Latency adds up per hop, Coupled failure domains]
```
Two columns weighing **one option**. To compare several options each with a
verdict, use `options`; to compare things side by side visually, use `gallery`.

#### `agenda` — meeting agenda
```agenda
items:
  - { time: "09:00", duration: 30m, title: Round-robin, owner: Host }
  - { time: "09:30", duration: 60m, title: Deep dive, desc: API team }
```

### Lists, backlogs & patterns

#### `list` — a fancy bullet list (four marker styles)
```list
title: What you get
style: accent              # accent (left bar, default) | check | icon | number
items:
  - { lead: Typed blocks, text: "87 strict schemas, validated by avo check.", accent: blue }
  - { lead: One source of truth, text: Diagrams live in the .md file., accent: green }
  - { lead: Many outputs, text: "HTML, slides, and PDF from one file.", accent: amber }
```
Each item is a bold `lead` + optional `text`. `style` picks the marker: `accent`
(coloured left bar), `check` (ticks — `done: false` shows a hollow grey dot),
`icon` (an `icon` per item, same set as `drivers`), or `number` (auto-numbered
badges). `accent` (per item or block-level) tints the marker. Use `list` for a
polished bullet list; use `tracker` when items have status/owner/due, `drivers`
for a card grid, or `steps` in a `spec` row for an inline pipeline.

#### `stories` — a collapsible user-story backlog
```stories
title: Sprint backlog
items:
  - { id: US-1, title: One-step checkout, role: shopper, want: pay in one step, soThat: I finish faster, priority: High, points: 5, tags: [checkout], open: true, criteria: [{ given: items in cart, when: I pay, then: an order is created }], links: [{ ref: orders-api#seq-place-order, label: Request flow }] }
  - { id: US-2, title: Save card, role: returning shopper, want: store a card, soThat: I skip re-entry, priority: Med, points: 3 }
```
Renders every story as a `<details>` accordion (no JavaScript) in **one** section —
the summary shows the id, title, points, and priority; expanding reveals the
narrative, acceptance `criteria`, and `links`. `open: true` starts a story
expanded. Use `stories` for a backlog of many; use a single `userstory` block when
one story deserves its own full section. `links[].ref` is a real `doc#id`
cross-reference (checked by `avo check`).

#### `pattern` — a design-pattern reference card
```pattern
name: Repository
category: Backend
intent: Hide persistence behind a collection-like interface so the domain never sees the database.
forces: [Swap the data store, Unit-test without a DB, No query leaks into the domain]
participants:
  - { name: OrderRepository, role: interface the service depends on }
  - { name: PgOrderRepository, role: Postgres implementation }
  - { name: OrderService, role: caller (domain logic) }
consequences:
  pros: [Swappable storage, Testable with a fake]
  cons: [Another layer, Risk of anemic pass-through]
```
A GoF-style card for explaining one pattern (repository, CQRS, saga, hexagonal,
strategy…). Pair it with a `belogic` graph (the structure) and a `sequence` (the
runtime) for a complete pattern tutorial. Only `name` is required.

#### `gallery` — a responsive grid of cells

A **real grid** (2 columns by default; set `cols` to 3–4). Each cell is one of
three kinds — a plain **note**, a **code** snippet, or a **nested block** (a whole
diagram). Mix them freely. The nested block is validated against its own schema,
so a diagram-in-a-cell is checked exactly like a top-level one. Reach for
`gallery` (not a multi-block `code`) when you want cards/diagrams in a grid rather
than stacked.

**Grid with text** — `title` + `caption` cells (a comparison, a checklist of points):
```gallery
title: When to reach for it
cols: 2
items:
  - { title: Use a queue, caption: "Spiky load, slow downstream, work can be deferred.", accent: green }
  - { title: Call directly, caption: "Low latency needed and the dependency is fast + reliable.", accent: amber }
```

**Grid with code** — each cell a `code` snippet (a "bug gallery" / spot-the-bug set):
```gallery
title: Bug gallery
cols: 2
items:
  - { title: "N+1 query", lang: JavaScript, accent: red, caption: "1000 users = 1001 queries. Fix: JOIN.", code: "users.forEach(async u =>\n  await q('...WHERE user_id=?', u.id));" }
  - { title: "Off-by-one", lang: JavaScript, accent: amber, caption: "arr[len] is undefined. Fix: < not <=.", code: "for (let i=0; i<=arr.length; i++)\n  process(arr[i]);" }
```

**Grid with diagrams** — each cell a nested `block` (compare architectures side by side):
```gallery
title: Pick an approach
cols: 3
items:
  - { title: Monolith, caption: One deployable., block: { type: c4, level: container, nodes: [{ id: u, col: 1, row: 1, kind: person, name: User }, { id: app, col: 2, row: 1, kind: container, family: service, name: App }], edges: [{ from: u, to: app }] } }
  - { title: Microservices, caption: Independent services., block: { type: c4, level: container, nodes: [{ id: gw, col: 1, row: 1, kind: container, family: service, name: Gateway }, { id: a, col: 2, row: 1, kind: container, family: service, name: Orders }], edges: [{ from: gw, to: a }] } }
  - { title: Event-driven, caption: Async via a broker., block: { type: block, nodes: [{ id: p, col: 1, row: 1, kind: producer, name: Producer }, { id: bus, col: 2, row: 1, kind: topic, name: Bus }], edges: [{ from: p, to: bus }] } }
```

> **Don't hand-write a pattern from memory — grab a vetted template.** Avodado
> ships a library of 106 common patterns (system-design building blocks, AI /
> agent patterns, and the GoF code patterns): `avo design` lists the slugs,
> `avo design <slug>` prints a ready `pattern` card **plus a structure diagram**
> to adapt. The full slug list lives in `system-design.md` beside this file.

> **Comparing patterns → use a `gallery`.** When the user says "compare X vs Y"
> (e.g. "adapter vs command", "monolith vs microservices", "REST vs gRPC"), don't
> write prose or a table — put each side in a `gallery` cell as a nested block so
> they sit **side by side**. Grab each via `avo design <slug>` and nest its
> `pattern` card (or its diagram). Use `cols: 2` for two, `cols: 3` for three.

```gallery
title: Adapter vs Command
cols: 2
items:
  - { block: { type: pattern, name: Adapter, category: Structural, intent: "Convert one interface into another a client expects.", participants: [{ name: Target, role: interface the client wants }, { name: Adapter, role: translates calls }, { name: Adaptee, role: existing class }], consequences: { pros: [Reuse incompatible code], cons: [Extra indirection] } } }
  - { block: { type: pattern, name: Command, category: Behavioral, intent: "Wrap a request as an object to queue, log, and undo.", participants: [{ name: Command, role: "execute() / undo()" }, { name: Invoker, role: triggers commands }, { name: Receiver, role: does the work }], consequences: { pros: [Undo + queue + log], cons: [Many small classes] } } }
```

## Field semantics — clarifications

A few fields are easy to misuse. Lock these in.

- `userstory.links[].ref` is the only field in v1 that creates a real
  cross-document reference. Other `links` items render as plain chips.
- `userstory.id` is what other docs reference. Use a short stable id like
  `US-142`, not a sentence.
