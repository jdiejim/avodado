# Avodado blocks — Business, decisions & access

Part of the **avodado-docs** skill (the hub is `SKILL.md`, two folders up).
Field contracts and examples for this family's blocks. The at-a-glance contract
table for all 87 blocks is `contract.md` beside this file; the block → family
map is `INDEX.md`. Schemas reject unknown fields — use exactly these.

### Access control / RBAC

#### `matrix` — a role × resource capability grid
```matrix
title: Who can do what
corner: Role / App          # optional top-left cell label
cols: [Billing, Reports, Admin]
rows:
  - { label: Owner,   cells: [Full, Full, Full] }
  - { label: Manager, cells: [Full, Read, "—"] }
  - { label: Viewer,  cells: [Read, Read, "—"] }
```
`cells` is positional — one value per `cols` entry, in order. Cells tint by meaning:
`Full`/`Admin`/`Write`/`✓` → green, `—`/`None`/`✗` → muted, anything else → amber.
Use `matrix` (not `table`) for a capability grid where the columns are resources and
each cell is a permission level.

#### `anatomy` — the parts of a structured string (e.g. a permission)
```anatomy
title: Anatomy of a permission
separator: ":"              # optional, defaults to ":"
parts:
  - { label: App,     value: atlas,         note: Which product. }
  - { label: Feature, value: billing,       note: The area within the app. }
  - { label: Action,  value: invoices.read, note: The specific capability. }
```
Renders the full string (`atlas:billing:invoices.read`) with each segment coloured,
then a labelled card per segment. Use it to explain one identifier's shape — a
permission string, a resource URN, a topic name.

#### `composition` — effective access as intersected gates
```composition
title: How access is decided
result: May read invoices   # optional effective-result card
gates:
  - { label: Identity,   desc: A valid signed-in user. }
  - { label: Scope,      desc: The request is in range. }
  - { label: Permission, desc: The action is granted. }
```
Renders `gate₁ ∩ gate₂ ∩ … = result`. Use it when access is the AND of several
independent checks (authn ∩ scope ∩ permission), not a sequence of steps (use
`flow`/`sequence` for ordered steps).

### Presentation cards

#### `drivers` — the forces that shaped a design
```drivers
title: What guided the architecture
items:
  - { title: Single sign-on, body: One login carries the user everywhere., tag: "HOW: token", icon: lock, accent: purple }
  - { title: Read per site, body: "Access is scoped to the user's sites.", tag: "WHERE: site group", icon: location, accent: green }
  - { title: Governed roles, body: "An IGA requests, approves, certifies.", tag: "WHO: role groups", icon: shield, accent: blue }
  - { title: Per-app permissions, body: The same role differs per app., tag: "WHAT: matrix", icon: grid, accent: amber }
```
A grid of "the N drivers/requirements behind this." `icon` is one of a fixed set
(location · shield · grid · lock · key · user · clock · check · database · bolt ·
flag · doc · link · eye · server · layers); `accent` colours the top edge + icon.

#### `team` — people cards (who owns what)
```team
title: Who owns what
members:
  - { name: Ana Ruiz, role: Tech lead, focus: Rendering pipeline, accent: navy }
  - { name: Sam Okafor, role: Backend, focus: Sync + integrations, accent: teal }
  - { name: Lena Fischer, role: Design, focus: Themes and house style, accent: purple }
  - { name: DevRel, initials: DR, role: Advocacy, focus: Docs and community, accent: green }
```
Compact cards on a 3-column grid — initials avatar, name, uppercase role, and a
one-line `focus`. Initials derive from `name`; set `initials` to override (e.g.
for a team rather than a person). Use `team` for ownership/contact overviews;
use `persona` for user archetypes with goals and frustrations.

#### `options` — approaches explored, with a verdict
```options
title: Approaches explored
items:
  - { kicker: Option 1, title: App-managed roles, how: Roles in our own DB., pros: [Full control], cons: ["Second source of truth"], verdict: "REJECTED — fails the constraint", tone: rejected }
  - { kicker: Option 2, title: Global role groups, how: One global group per role., pros: [Fewest groups], cons: ["A role applies at every site"], verdict: "VIABLE — fallback", tone: viable }
  - { kicker: Option 3, title: Per-site role groups, how: One group per persona per site., pros: [Least privilege], cons: [Most groups], verdict: "CHOSEN", tone: chosen }
```
Use when you weighed several approaches. Each card is one option; `tone: chosen`
highlights the winner. For one option's trade-offs alone, use `proscons`.

#### `scorecard` — a weighted decision matrix
```scorecard
title: Queue technology choice
criteria:
  - { label: Throughput, weight: 2 }
  - { label: Operational cost, weight: 2 }
  - { label: Team familiarity }
  - { label: Ecosystem }
options:
  - { label: Kafka, scores: [5, 2, 3, 5], note: self-hosted }
  - { label: SQS, scores: [3, 5, 4, 3], note: managed }
  - { label: RabbitMQ, scores: [3, 3, 4, 4] }
```
Criteria are rows (an `×N` chip marks weights other than 1), options are
columns, and the footer TOTAL row carries the weighted sum per option — the
winner's header and total are highlighted with a WINNER chip (ties highlight
all). Scores are plain numbers, 0-5 by convention. Use `scorecard` when the
decision was *scored*; use `options` for qualitative pros / cons / verdict
cards and `table` for plain data.

#### `spec` — a labelled spec sheet
```spec
title: Per-site role groups
accent: green
rows:
  - { label: Groups, value: "SiteN-Users (read) + SiteN-<Persona> per staffed plant." }
  - { label: Roles, value: "Each group reads as (site, role); the token carries the scope." }
  - { label: Resolution, steps: [Decode token, "Read (site, role)", Check matrix] }
  - { label: Cost, value: "Up to Sites × Roles groups; a new role multiplies them." }
```
A compact "fact sheet" for one approach/component. A row with `steps:` renders as
an arrow-joined pill flow (great for a short resolution pipeline).

#### `envelope` — back-of-envelope capacity math
```envelope
title: Write-path capacity
assumptions:
  - { label: Daily active users, value: 5M }
  - { label: Writes / user / day, value: "4" }
steps:
  - { label: Writes per day, calc: "5M × 4", result: 20M/day }
  - { label: Write QPS, calc: "20M / 86,400 s", result: "≈ 230 rps" }
  - { label: Peak QPS, calc: "230 × 3 (peak factor)", result: "≈ 700 rps" }
result: { label: Provision for, value: "~1,400 rps (2× peak headroom)" }
```
The system-design "step 2" block: `assumptions` are the givens, each `steps` row
is one derivation (`label` · `calc` · `result`), and the optional `result` is the
highlighted bottom line. Every value is a **string** — write units and `≈`/`×`
freely, and quote anything containing `,` `:` or `#`. Use `envelope` for the
estimate that *justifies* a design; use `stats` for measured KPIs.

### Business & strategy

#### `swot` — strengths / weaknesses / opportunities / threats
```swot
title: Entering the enterprise segment
strengths:
  - Fastest onboarding in the category
  - Strong developer community
weaknesses:
  - No SSO / SCIM yet
  - Small support team
opportunities:
  - Competitor sunsetting its legacy plan
  - Compliance push creates demand
threats:
  - Incumbent bundling a free tier
  - Procurement cycles slow adoption
```
Four plain string lists — the classic 2×2 draws itself (S green · W red ·
O blue · T amber). Omit a quadrant you have nothing for; it still draws so the
shape reads as a SWOT. Use `swot` for a strategic position; use `proscons` for
one option's trade-offs and `quadrant` to *plot items* on two axes.

#### `funnel` — conversion funnel
```funnel
title: Signup → paid conversion
unit: users
stages:
  - { label: Visited landing page, value: 48000 }
  - { label: Started signup, value: 9600, desc: email + password }
  - { label: Activated, value: 4300, desc: created a first doc }
  - { label: Upgraded to paid, value: 860 }
```
Stacked centered bands, each width proportional to `value` (with a floor so
labels fit); a mono `↓ NN%` chip between bands shows stage-to-stage conversion.
`value` is a plain **number** (no separators — the renderer formats it);
`unit` suffixes the value. Use `funnel` when the story is *drop-off between
ordered stages*; use `journey` for the qualitative experience across stages.

#### `okr` — objectives + key results
```okr
title: Q3 objectives
items:
  - objective: Make onboarding effortless
    owner: Growth
    krs:
      - { kr: Time-to-first-doc under 5 minutes, progress: 0.7, status: on-track }
      - { kr: Activation rate from 45% to 60%, progress: 0.4, status: at-risk }
  - objective: Earn enterprise trust
    owner: Platform
    krs:
      - { kr: Ship SSO + audit log, progress: 1, status: done }
      - { kr: SOC 2 Type II report issued, progress: 0.2, status: off-track }
```
One card per objective; each key result renders a progress bar (`progress` is a
plain number 0..1) coloured by `status` — done / on-track green, at-risk amber,
off-track red, no status navy. Use `okr` for goal tracking; use `slo` for
reliability targets and `tracker` for task-level work.

#### `persona` — user persona cards
```persona
title: Who we build for
personas:
  - name: Maya Chen
    role: Staff engineer
    quote: I want the diagram in the PR diff, not in a wiki.
    goals: [Docs that live with the code, Reviewable architecture changes]
    frustrations: [Stale wiki pages, Screenshots of whiteboards]
    tools: [VS Code, GitHub]
    accent: blue
  - name: Priya Patel
    role: Engineering manager
    quote: Every reorg breaks our onboarding docs.
    goals: [One source of truth per system]
    frustrations: ["Docs no one owns"]
    tools: [Linear, Notion]
    accent: teal
```
A 2-column grid of cards — initials avatar (from `name`), role, an italic
`quote` with an accent bar, then GOALS / FRUSTRATIONS lists and TOOLS chips
(sections with no data are omitted). Use `persona` for user archetypes; use
`team` for real people and ownership.
