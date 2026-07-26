# Avodado blocks — Flows, sequences & state

Part of the **avodado-docs** skill (the hub is `SKILL.md`, two folders up).
Field contracts and examples for this family's blocks. The at-a-glance contract
table for all 86 blocks is `contract.md` beside this file; the block → family
map is `INDEX.md`. Schemas reject unknown fields — use exactly these.

### Sequence & state

#### `sequence` — interaction over time (rich SVG + step list + footer)

Messages default to the terse `from -> to: label` form — `->` sync, `-->`
response, `-x->` error (`from`/`to` must match actor `id`s):
```sequence
title: Token refresh
actors:
  - { id: App, name: App }
  - { id: Auth, name: Auth service }
messages:
  - App -> Auth: POST /token/refresh
  - Auth --> App: new access token
  - Auth -x-> App: 401 invalid refresh token
```
Switch a message to the object form when it needs more than the arrow can say —
`kind: async`/`note`, a `summary` for the step list, a `code` snippet:
```sequence
id: seq-place-order
title: One transaction wraps authorize + persist.
lede: Time runs downward. Solid arrows are sync; dashed are responses.
description: Happy path shown.
endpoint: { method: POST, path: /orders }
actors:
  - { id: Client, name: Client, sub: web / mobile }
  - { id: API, name: Orders API, sub: orders handler }
  - { id: PG, name: Postgres, sub: orders }
  - { id: Payment, name: Payment GW, sub: external, external: true }
messages:
  - { from: Client, to: API, label: POST /orders, kind: sync, summary: "Place the order with cart, token, idempotency key.", code: "POST /orders\nIdempotency-Key: ..." }
  - { from: API, to: API, kind: note, label: validate token, summary: "Validate bearer, check idempotency key." }
  - { from: API, to: PG, label: INSERT order, kind: sync, summary: "Open the txn and insert in PENDING.", note: "Required index: orders(idempotency_key)." }
  - { from: PG, to: API, label: order_id, kind: response, summary: "Returns the new order_id." }
  - { from: API, to: Client, label: 201 Created, kind: response, summary: "201 with the order." }
foot:
  - { label: Target p95, value: 250ms }
  - { label: Idempotent, value: via Idempotency-Key (24h TTL) }
```
Each message: `from` + `to` (must match an actor `id`), `label`,
optional `kind` (`sync | response | async | error | note`). Terse strings and
objects mix freely in one `messages` list.
- `note` kind is a numbered annotation on one lane — no arrow.
- `summary` (long form for the step list under the SVG),
- `code` (a code snippet inside the step item),
- `note` field (italic-gray sub-note below the summary).
`endpoint.method` colours the tag pill (POST → navy, GET → green, etc.).
`foot` items render as key/value pills beneath the diagram.

#### `state` — state machine (+ transition table)
```state
title: Circuit breaker
states:
  - { id: s0, col: 1, row: 1, kind: start }
  - { id: closed, col: 2, row: 1, kind: active, name: CLOSED }
  - { id: open, col: 3, row: 1, kind: wait, name: OPEN }
  - { id: half, col: 3, row: 2, kind: active, name: HALF-OPEN }
transitions:
  - { from: s0, to: closed, event: init }
  - { from: closed, to: open, event: failure rate trips, guard: window ≥ threshold }
  - { from: open, to: half, event: cooldown elapsed }
  - { from: half, to: closed, event: probe succeeds }
  - { from: half, to: open, event: probe fails }
```
`kind` on a state is `start | terminal | active | wait`. Optional `groups`
draw dashed zone wrappers around cell ranges (same shape as on `flow`, below).

### Flow & process

#### `flow` — flowchart with decisions
```flow
title: Admission control
nodes:
  - { id: start, col: 1, row: 1, kind: start, label: Request }
  - { id: quota, col: 2, row: 1, kind: decision, label: Under quota? }
  - { id: serve, col: 3, row: 1, kind: end, label: Serve }
  - { id: shed, col: 2, row: 2, kind: end, label: 429 Too Many }
edges:
  - start -> quota
  - quota -> serve: "yes"
  - quota -x-> shed: "no"
```
`kind` is `start | end | decision | process`. Edges default to the terse
`from -> to: label` form (`-->` dashed, `-x->` error); `kind: error` edges (or
labels starting with `no/fail/error/reject`) render in red.

**Flows run across, not down.** Put the main path on `col` (1, 2, 3 …) and let
branches drop to `row: 2` — as above. A flow written down the page gets taller
than the page column and shrinks to nothing on a slide. Drop `col`/`row`
entirely and the auto-layout does it for you, left-to-right; `dir: TB` asks for
the top-to-bottom layout instead (auto-layout only — with coordinates on the
nodes, `dir` does nothing).

Optional `groups` draw dashed zone wrappers around cell ranges — one shape on
every grid diagram (`flow`, `dfd`, `state`, `c4`, `block`): `col`/`row` anchor
the top-left cell, `cols`/`rows` span (default 1), `label` sits in the corner,
optional `color` tints the outline:
```flow
title: Admission control
groups:
  - { col: 2, row: 1, cols: 2, rows: 1, label: Rate limiter }
nodes:
  - { id: start, col: 1, row: 1, kind: start, label: Request }
  - { id: quota, col: 2, row: 1, kind: decision, label: Under quota? }
  - { id: serve, col: 3, row: 1, kind: end, label: Serve }
edges:
  - start -> quota
  - quota -> serve: "yes"
```

**`variant: dag`** frames the same block as a pipeline / DAG (CI/CD-flavoured).
The old `dag` type is its permanent alias:
```flow
variant: dag
title: CI pipeline
nodes:
  - { id: src, col: 1, row: 1, kind: start, label: Source }
  - { id: build, col: 2, row: 1, kind: process, label: Build }
  - { id: deploy, col: 3, row: 1, kind: end, label: Deploy }
edges:
  - src -> build
  - build -> deploy
```

#### `dfd` — data-flow diagram
```dfd
nodes:
  - { id: app, col: 1, row: 1, kind: external, name: Mobile app }
  - { id: ingest, col: 2, row: 1, kind: process, name: Ingest events, num: 1 }
  - { id: enrich, col: 3, row: 1, kind: process, name: Enrich, num: 2 }
  - { id: wh, col: 4, row: 1, kind: store, name: warehouse }
edges:
  - { from: app, to: ingest, label: clicks }
  - { from: ingest, to: enrich }
  - { from: enrich, to: wh }
```
`kind` is `process | external | store | datastore`. Optional `num` on
processes. Optional `groups` draw dashed zone wrappers around cell ranges
(same shape as on `flow`).

#### `gitgraph` — the branching and release model

The picture every branching-policy doc draws by hand. Commits are a plain
sequence, so the YAML reads in the order the history happened:
```gitgraph
title: Release model
branches:
  - { name: main, accent: navy }
  - { name: release, accent: teal }
commits:
  - { label: baseline }
  - { branch: release, label: cut 1.2 }
  - { branch: release, label: rc fixes }
  - { merge: release, label: ship, tag: v1.2.0, kind: release }
```
The first commit on a branch nobody has seen yet OPENS its lane, forking from
`from` (or from the lane above it); `merge: <branch>` closes that branch back
into the branch the commit is on. `tag` draws a release marker above the dot,
and `kind` is `normal | release | hotfix | revert` (a hotfix dot is ringed, a
revert dot hollow). Declare `branches` to fix the lane order and colours.

#### `swimlane` — cross-functional process
```swimlane
lanes:
  - { label: On-call }
  - { label: Platform team }
steps:
  - { id: page, col: 1, lane: 0, kind: start, label: Paged }
  - { id: triage, col: 2, lane: 0, kind: decision, label: Known cause? }
  - { id: fix, col: 3, lane: 0, label: Apply runbook }
  - { id: esc, col: 3, lane: 1, label: Escalate }
links:
  - { from: page, to: triage }
  - { from: triage, to: fix, label: "yes" }
  - { from: triage, to: esc, label: "no" }
```
Step `kind` is `action | decision | start | end | wait`.

#### `steps` — a numbered how-to / runbook stepper
```steps
title: Deploy a hotfix
items:
  - title: Branch from main
    body: Hotfixes always branch from the latest main.
    code: git checkout -b hotfix/fix-retry main
    lang: bash
  - title: Ship the fix
    body: Commit and push; CI runs the full suite.
    code: git push -u origin hotfix/fix-retry
    lang: bash
    note: CI must be green before the next step.
  - title: Tag and deploy
    code: git tag v1.4.1 && git push --tags
    lang: bash
```
A vertical stepper — numbered circles joined by a rule; each step has a bold
`title`, an optional `body`, an optional `code` command (rendered on the dark
code surface, with `lang` as its header), and an italic `note`. Use `steps` for
*linear* procedures a human executes in order; use `flow`/`swimlane` when the
procedure branches, and `statustable` when items have status/owner rather than
order.

#### `cycle` — a closed loop of stages arranged in a circle
```cycle
title: Build–measure–learn
steps:
  - { label: Build, desc: Ship the smallest testable change }
  - { label: Measure, desc: Watch the one metric the change should move }
  - { label: Learn, desc: Keep the change or roll it back }
center: every release
```
Stages render clockwise from 12 o'clock, numbered, with the last stage feeding
the first — build–measure–learn, PDCA, an incident loop. 2-8 `steps`; each is
a bare string (the label) or `{ label, desc }` — descriptions move to the
numbered legend under the diagram. Optional `center` is a hub label inside the
ring. Use `cycle` when the process *repeats*; use `flow` when it branches and
ends, and `steps` for a linear one-shot procedure.

## Field semantics — clarifications

A few fields are easy to misuse. Lock these in.

- `sequence.actors[].sub` is the **subtitle** under the actor's name on the
  lane head (e.g. `sub: web / mobile`, `sub: orders handler`). Keep it short —
  2-4 words.
- `sequence.actors[].external: true` darkens the lane (slate instead of navy),
  signaling the actor lives outside your service boundary.
- `sequence.messages[].kind: note` is **not a message** — it's a numbered
  annotation on the from-actor's lane, with no arrow. Use it for things like
  "validate token" that don't cross a boundary.
- `sequence.messages[].summary` is the longer text shown in the step-by-step
  list **below** the SVG. Keep `label` short (the SVG arrow) and put detail in
  `summary`. `code:` adds a `<pre>` snippet inside the step item.
