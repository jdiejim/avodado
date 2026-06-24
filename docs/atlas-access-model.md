```meta
title: Atlas Access Model
subtitle: Role-based access for Atlas in three layers — per-site role groups requested through SailPoint, provisioned into Entra, with app-owned permissions.
tag: ACCESS MODEL · PER-SITE v1.0
```

## What we need

Atlas needs role-based access across the Atlas apps, with access requested through
SailPoint. Three requirements drive everything:

- **Read access per site:** a user gets read-only access to an app, scoped to the sites they belong to — granted by a per-site group.
- **Roles as groups, handled by SailPoint:** anything beyond read is a role, modeled as a group and requested, approved, and provisioned through SailPoint — never assigned by us.
- **Permissions differ across apps:** the same role does different things in different apps, so the actual permissions are app-specific and owned by us, not the directory.

```drivers
title: Four drivers guided the Atlas RBAC architecture
items:
  - { title: "Read, per site", body: "Read-only access to each app, scoped to the sites a user belongs to.", tag: "WHERE: per-site group", icon: location, accent: green }
  - { title: SailPoint governs access, body: "SailPoint requests, approves, and provisions sites and roles; we never assign access ourselves.", tag: "WHO: role groups", icon: shield, accent: blue }
  - { title: Permissions differ per app, body: "The same role does different things in each app, so permissions are app-specific and owned by us.", tag: "WHAT: matrix in our DB", icon: grid, accent: amber }
  - { title: "Same SSO, one login", body: "One Entra sign-in carries the user into every Atlas app — no per-app accounts.", tag: "HOW IN: Entra token", icon: lock, accent: purple }
```

The one sentence any design must satisfy: *"Dana is a Cycle Manager at Plant 3 —
approved by its manager — who can also read Plant 7, and what Cycle Manager means
differs between SC and WP."*

```callout
tone: note
title: The one-line ask
body: Give us the SailPoint roles and the Entra groups behind them; we turn that into
  the right access in every app, with no custom admin tooling.
```

## Approaches explored

Four approaches were worked through end to end, ordered by how much lives in the
directory. Each is tested against the same edge case — *Cycle Manager at Site A,
read-only at Site B.*

```options
items:
  - { kicker: "Option 1", title: App-managed roles, how: "Roles assigned in our own admin panel and DB; Entra only signs in.", pros: [Full control in our hands], cons: ["SailPoint controls only SSO, not access", Second source of truth, Custom tooling to govern and audit], verdict: "REJECTED — nothing goes through SailPoint", tone: rejected }
  - { kicker: "Option 2 · Hybrid", title: "Sites via SailPoint, roles in our app", how: "Site groups via SailPoint; roles assigned per site in our admin panel.", pros: [Most scalable — only site groups in Entra, "New roles are cheap — a DB change"], cons: ["Role grants bypass SailPoint governance", Audit splits across two systems], verdict: "VIABLE — most scalable; roles ungoverned", tone: warn }
  - { kicker: "Option 3 · S+R", title: Global role groups, how: "Site groups for read; one global role group applied at every site the user can access.", pros: [Fewest groups, Scales linearly, Fully governed by SailPoint], cons: ["A role applies at every site", "No way to scope a role to one site"], verdict: "VIABLE — kept as the fallback", tone: viable }
  - { kicker: "Option 4 · S×R", title: Per-site role groups, how: "One group per persona per site; site and role bound together.", pros: [Least privilege per site, Approval matches plant accountability, Clean per-plant audit], cons: ["Least scalable — groups grow with sites × roles", Adding a role means a group at every plant], verdict: "CHOSEN — matches the constraints best", tone: chosen }
```

```callout
tone: tip
title: How to read the verdicts
body: Option 1 fails the mandate outright. The hybrid is the most scalable but leaves
  role governance outside SailPoint. Options 3 and 4 both meet the mandate; between
  them the choice is scale vs. granularity, and the granular path wins.
```

## How the chosen model works

S×R binds site and role into one group — every grant is scoped, approved, and audited
at exactly one plant. `SiteN-Users` is the read base; `SiteN-<Persona>` is minted per
plant for the personas actually staffed there. A site-role group implies site access,
so one group answers *where* and *who* together. The edge case is native: grant
`SiteA-CycleManager` plus `SiteB-Users`, and there is nothing to subtract because
nothing was over-granted.

```spec
title: Per-site role groups (S×R)
accent: green
rows:
  - { label: Groups, value: "SiteN-Users (read base) + SiteN-<Persona> per staffed plant — one group says where AND who." }
  - { label: Roles, value: "The token carries the full scope; each group reads as (site, role), so access is portable across all apps." }
  - { label: Resolution, steps: [Decode token, "Read (site, role) per group", Check permission matrix] }
  - { label: Cost, value: "Up to Sites × Roles groups; adding a new role or site multiplies them (scripted, staffed-only)." }
```

The whole platform on one page: governance and identity own *who/where*, the four
Atlas apps mount one shared middleware, and a single backbone owns *what*.

```block
title: Atlas platform landscape
description: SailPoint governs and Entra provisions; four Atlas apps consume the same token through one shared auth library; one backbone owns roles, permissions, and the group→site/role mapping.
systemLabel: ATLAS ACCESS PLATFORM
layers:
  - { label: Governance & identity }
  - { label: Atlas apps — one model }
  - { label: Shared backbone }
nodes:
  - { id: sp, layer: 0, kind: external, name: SailPoint, tech: IGA — request / approve }
  - { id: entra, layer: 0, kind: identity, name: Entra ID, tech: "groups[] on the JWT" }
  - { id: sc, layer: 1, kind: microservice, name: Scope Creator, tech: "scope:*" }
  - { id: wp, layer: 1, kind: microservice, name: Work Package, tech: "wp:*" }
  - { id: ss, layer: 1, kind: microservice, name: Smart Scheduler, tech: "schedule:*" }
  - { id: orch, layer: 1, kind: microservice, name: Orchestrator, tech: "orch:*" }
  - { id: lib, layer: 2, kind: gateway, name: rbac middleware, tech: shared L1·L2·L3 }
  - { id: db, layer: 2, kind: db, name: App DB, tech: roles · permissions · entra_site_groups }
edges:
  - { from: sp, to: entra, label: provisions groups }
  - { from: entra, to: sc, label: "JWT" }
  - { from: entra, to: wp }
  - { from: entra, to: ss }
  - { from: entra, to: orch }
  - { from: sc, to: lib }
  - { from: wp, to: lib }
  - { from: ss, to: lib }
  - { from: orch, to: lib }
  - { from: lib, to: db, label: one cached read }
```

```callout
tone: note
title: The math, with real numbers — 13 sites, 7 roles
body: "Directory ceiling: 13 site groups + up to 91 role groups (~105 total), in
  practice fewer because groups are minted staffed-only. Per user: a single-site cycle
  manager carries 1 group; a reader at three plants carries 3; the pathological
  all-roles-all-sites user carries 91 — still under the ~200-group token limit. A
  realistic multi-site user lands in the 5–15 range."
```

```callout
tone: warn
title: Trade-offs and risks
body: "Group multiplication is real directory surface — names, owners, reviews. Adding
  a new persona scales poorly: one new role means a group per plant plus SailPoint
  roles and reviewer alignment everywhere (in S+R that's one group). Held in check by
  discipline: script-only creation, staffed-only minting, and the onboarding script
  must cover add-persona as well as add-plant."
```

```callout
tone: tip
title: The fallback remains open
body: The resolver reads "role at site X = groups matching X, or global" — so if group
  growth ever outweighs the security value, a persona can collapse back to one global
  group (Option 3) with rare exceptions as DB overrides. A data change, not a rebuild.
```

## The approach — three layers

Every request runs the same three gates in order; any layer can deny independently.

```table
columns: [Layer, The question it answers, What answers it, Groups involved]
rows:
  - ["L1 — Identity (the engine)", "Are you a real, signed-in Atlas user?", "Atlas SSO on Entra, entirely from the token", "None — membership in any known group passes"]
  - ["L2 — Site (read-only)", "Which sites may you see?", "Membership in the site's group = read there, nothing more", "One per site (SiteN-Users)"]
  - ["L3 — Role (permissions)", "What may you actually do here?", "Persona groups resolved against our app-owned matrix, on top of read", "One per persona per site (SiteN-<Role>)"]
```

Access is the intersection of all three — any single layer can deny independently,
and all three must pass:

```composition
title: Access is L1 ∩ L2 ∩ L3
result: 200 OK · AuthorizedUser
gates:
  - { kicker: "L1 · Identity", label: Valid token, desc: "A valid JWT whose groups intersect a known, provisioned set.", source: "Source: Entra JWT" }
  - { kicker: "L2 · Access group", label: Site in range, desc: "The request's site is in the user's site set.", source: "Source: token + lookup" }
  - { kicker: "L3 · Permission", label: Feature allowed, desc: "The feature is in the resolved role matrix.", source: "Source: app DB (cached)" }
```

```flow
id: flow-three-gates
title: The three gates
description: Every request runs L1 → L2 → L3 in order. Each gate passes to the next or denies independently with its own status code.
nodes:
  - { id: req, col: 1, row: 1, kind: start, label: "Request + JWT" }
  - { id: l1, col: 2, row: 1, kind: decision, label: "L1 · valid + provisioned?" }
  - { id: l2, col: 3, row: 1, kind: decision, label: "L2 · site_id in sites?" }
  - { id: l3, col: 4, row: 1, kind: decision, label: "L3 · feature in set?" }
  - { id: ok, col: 5, row: 1, kind: end, label: "200 OK · AuthorizedUser" }
  - { id: e401, col: 2, row: 2, kind: end, label: "401 invalid" }
  - { id: e403s, col: 3, row: 2, kind: end, label: "403 site" }
  - { id: e403p, col: 4, row: 2, kind: end, label: "403 permission" }
edges:
  - { from: req, to: l1 }
  - { from: l1, to: l2, label: "pass" }
  - { from: l2, to: l3, label: "pass" }
  - { from: l3, to: ok, label: "pass" }
  - { from: l1, to: e401, label: "fail", kind: error }
  - { from: l2, to: e403s, label: "fail", kind: error }
  - { from: l3, to: e403p, label: "fail", kind: error }
```

Multi-group assignment is the norm: a user holds a site group where they only read and
a site-role group where they act. The result is simply the combination — no hierarchy,
no special cases, nothing to subtract.

## The taxonomy

Two group types carry everything. The group name has a fixed shape — `Site-Role` —
that carries its meaning: the site scopes the grant, the role names the persona, and
`-Users` is the read-only base.

```table
columns: [Group, Meaning]
rows:
  - ["SiteA-Users", "read everything at Plant A (the base)"]
  - ["SiteA-CycleManager", "cycle actions at Plant A only"]
  - ["SiteB-CycleManager", "a different grant, a different approval, a different plant"]
```

Seven personas exist today: Supervisor and Planner (WP only), Cycle Manager, Cycle
Planner, Work Control Manager, Work Week Manager (SC + SS), and Scheduler (SS only).
**Viewer is free** — the base role granted by any `SiteN-Users` membership; most users
stop there. Permissions resolve as the **union** of every held persona plus the base —
no precedence to define.

## How roles are structured

Every capability is one string with a fixed shape — `app:feature:action` — e.g.
`scope:task_move:approve`. The feature segment is where the granularity lives: a Cycle
Planner may hold `scope:task_move:review` while only a Cycle Manager holds
`scope:task_move:approve`. We add capability by adding a string, never by touching a
group.

```anatomy
title: Anatomy of a permission string
separator: ":"
parts:
  - { label: App, value: scope, note: "Which app — scope · wp · schedule · orch." }
  - { label: Feature, value: task_move, note: "The thing being acted on — where the real granularity lives." }
  - { label: Action, value: approve, note: "What's allowed on it — view · create · review · approve." }
```

What each persona can do per app is one editable matrix in our database. A capability
change is a reviewable seed-file diff, not a directory change — and the matrix is
defined once per persona, not per site: `SiteA-CycleManager` and `SiteB-CycleManager`
resolve to the same row. The group decides *where*; the matrix decides *what*.

```matrix
title: What each persona can do per app
corner: Persona / App
cols: [WP, SC, SS]
rows:
  - { label: Viewer (base), cells: [Read, Read, Read] }
  - { label: Supervisor, cells: [Full, "—", "—"] }
  - { label: Planner, cells: [Edit, "—", "—"] }
  - { label: Cycle Manager, cells: ["—", Full, Full] }
  - { label: Cycle Planner, cells: ["—", Edit, Edit] }
  - { label: Work Control Manager, cells: ["—", Manage, Manage] }
  - { label: Work Week Manager, cells: ["—", Manage, Manage] }
  - { label: Scheduler, cells: ["—", "—", Edit] }
```

```callout
tone: note
title: This view is the summary — the workbook is the detail
body: The badges are the altitude leadership signs off at; each expands into specific
  feature:action rows authored in the companion spreadsheet (one tab per app). That
  workbook is the source the seed migrations are built from.
```

## How the API works

Everything arrives on the token: site and role groups ride the `groups` claim, so L1
and L2 are token-only (~0 ms) and L3 is the only data lookup — cached, at most one DB
read per minute per user. The app only ever reads; SailPoint and Entra remain the
single source of truth.

On the backend the three gates are just composable `Depends()` — each one a small
function, the last one the only thing that touches data:

```belogic
title: Backend — the Depends() chain
description: A route handler stacks three dependencies; get_current_user runs L1, require_site_access runs L2, require_permission runs L3 against a cached single-table resolution.
groups:
  - { id: svc, label: "app/core/rbac — auth chain", col: 1, row: 1, cols: 3, rows: 3, color: "#0e54a1" }
  - { id: io, label: "Egress · data", col: 4, row: 1, cols: 1, rows: 3, color: "#6b7280" }
nodes:
  - { id: route, col: 1, row: 1, kind: controller, name: Route handler, note: "POST /sites/{id}/scopes" }
  - { id: cur, col: 2, row: 1, kind: service, name: get_current_user, note: "L1 identity + provisioning" }
  - { id: site, col: 1, row: 2, kind: service, name: require_site_access, note: "L2 — site_id in sites" }
  - { id: perm, col: 2, row: 2, kind: service, name: require_permission, note: "L3 — feature in set" }
  - { id: resolver, col: 2, row: 3, kind: service, name: resolve_permissions, note: "union(roles) + base" }
  - { id: token, col: 1, row: 3, kind: external, name: JWT, note: "groups[] claim" }
  - { id: cache, col: 4, row: 1, kind: cache, name: Cache, note: "rbac:{oid} · TTL 60s" }
  - { id: db, col: 4, row: 2, kind: db, name: App DB, note: "role_permissions" }
edges:
  - { from: route, to: cur, label: depends, kind: uses }
  - { from: cur, to: site, label: then, kind: uses }
  - { from: site, to: perm, label: then, kind: uses }
  - { from: cur, to: token, label: reads groups, kind: reads }
  - { from: perm, to: resolver, label: needs, kind: uses }
  - { from: resolver, to: cache, label: hit, kind: reads }
  - { from: resolver, to: db, label: miss · SQL, kind: egress }
```

The frontend never decides anything — it loads the same `permissions[]` once and
mirrors it, hiding controls the API would 403 anyway:

```felogic
title: Frontend — gate every control from one context
description: AuthGuard ensures sign-in, UserProvider loads /user/user-info once into context, usePermission reads it, and components show or hide; the API is still the wall.
groups:
  - { id: app, label: "React app (browser)", col: 1, row: 1, cols: 3, rows: 2, color: "#0e54a1" }
  - { id: net, label: "Egress · network", col: 4, row: 1, cols: 1, rows: 1, color: "#6b7280" }
nodes:
  - { id: guard, col: 1, row: 1, kind: component, name: "<AuthGuard>", note: "MSAL sign-in" }
  - { id: provider, col: 2, row: 1, kind: provider, name: "<UserProvider>", note: "GET /user/user-info" }
  - { id: ctx, col: 3, row: 1, kind: context, name: UserContext, note: "permissions[]" }
  - { id: comp, col: 1, row: 2, kind: component, name: "<CreateButton>", note: "hidden = denied" }
  - { id: hook, col: 2, row: 2, kind: hook, name: usePermission(f), note: "→ boolean" }
  - { id: api, col: 3, row: 2, kind: service, name: apiClient, note: "Bearer JWT" }
  - { id: backend, col: 4, row: 1, kind: external, name: Atlas API, note: "same L1·L2·L3 gates" }
edges:
  - { from: guard, to: provider, label: wraps, kind: uses }
  - { from: provider, to: ctx, label: loads once, kind: uses }
  - { from: hook, to: ctx, label: reads, kind: reads }
  - { from: comp, to: hook, label: asks, kind: uses }
  - { from: comp, to: api, label: on click, kind: uses }
  - { from: api, to: backend, label: HTTPS, kind: egress }
```

The whole journey, request to gated app:

```sequence
id: seq-request-flow
actors:
  - { id: dana, name: Dana }
  - { id: sp, name: SailPoint }
  - { id: entra, name: Entra }
  - { id: token, name: Token }
  - { id: app, name: App }
messages:
  - { from: dana, to: sp, label: "request: Plant 3 — Cycle Manager" }
  - { from: sp, to: sp, label: "plant manager approves" }
  - { from: sp, to: entra, label: "+ Site3-CycleManager" }
  - { from: entra, to: token, label: "groups: [guid-s3-cyclemgr]" }
  - { from: token, to: app, label: "every request carries the claim" }
  - { from: app, to: dana, label: "cycle powers at Plant 3 only", kind: response }
```

Removal is the same picture run backwards: expiry, certification, or the leaver
process takes the group away, the next token drops it, and the same gates start
denying. Immediate kill switch when needed: `users.status = "inactive"` plus cache
revoke.

```callout
tone: tip
title: Why this matters to architects
body: Authorization is fast and self-contained — two of three layers need nothing but
  the token, and the third is a cached single-table resolution. No runtime dependency
  on the IGA stack.
```

## Phasing

We ship the code once and turn capabilities on as configuration. The riskiest artifact
— code — is validated earliest in one app; every later phase is reversible
configuration.

```timeline
items:
  - { label: "Phase 1 — Today", date: Now, status: current, desc: "Full three-gate pipeline ships in Scope Creator against today's single group; site checks pass trivially, roles bridged in our DB. Full structural build — later phases are data + config only." }
  - { label: "Phase 2 — Admin group live", date: Next, status: next, desc: "Admin group + the pilot plant's site-role groups created via the onboarding script; two flags flip (admin gating strict, roles from the token). No deployment." }
  - { label: "Phase 3 — Per-site groups", date: Later, status: future, desc: "Remaining plants onboarded — the script creates each plant's group set and SailPoint roles in one run; site enforcement becomes real and self-service opens." }
```

## Decisions we need

Three decisions unlock delivery — everything else is engineering we already own.
Delivery is gated on the first.

```tracker
items:
  - { task: "Sign off the role matrix — one workshop per app PM replaces every TBD (owner: product)", status: todo, priority: high }
  - { task: "Confirm the SailPoint flow — role→group mapping, per-plant reviewers, certification cadence (owner: IT/IGA)", status: todo, priority: high }
  - { task: "Ratify the granular path + guardrails — naming, ownership, staffed-only minting, script-only creation (owner: architects + IT)", status: todo, priority: med }
```

## Stories & the additive rule

```callout
tone: tip
title: Read this before the stories
body: Once the pattern is in place, no feature is done until its access is defined.
  Every story that adds a new action must add its permission string, place it in the
  matrix via a seed migration, and gate both API and UI — in the same story, not a
  follow-up. RBAC stops being a project and becomes part of the definition of done.
```

```userstory
id: US-SC-01
role: Scope Creator squad
want: consume groups and roles from the token as the reference implementation
soThat: every other app squad adopts a proven pattern instead of inventing one
priority: High
points: 8
criteria:
  - { given: a user holds Site3-CycleManager, when: they call any SC endpoint at Plant 3, then: L1–L3 pass and cycle permissions apply }
  - { given: the same user targets Plant 1, when: they call any endpoint there, then: L2 denies with 403 before roles are considered }
  - { given: a permission is missing from their union, when: they invoke that action, then: the API returns 403 and the UI never showed the control }
links:
  - { mode: flow, label: The three gates }
  - { mode: sequence, label: Request flow }
  - { mode: table, label: Role matrix }
```

```kanban
columns:
  - label: Now
    cards:
      - { title: "PLAT-01 · Plant-onboarding script + pilot plant groups + SailPoint flow" }
      - { title: "SC-01 · Reference implementation in Scope Creator" }
  - label: Next
    cards:
      - { title: "WP-01 · Seed wp:* and adopt the pattern in Work Package" }
      - { title: "SS-01 · Seed schedule:* and adopt the pattern in Smart Scheduler" }
  - label: Later
    cards:
      - { title: "ORCH-01 · Orchestrator namespace — same story shape, scheduled later" }
```

The AC template every action-adding story carries:

```table
columns: [Checklist item, Required]
rows:
  - ["Permission string named and added to the canonical list (app:feature:action)", "✓"]
  - ["Matrix row filled and applied via seed migration (reviewed diff)", "✓"]
  - ["API route gated by the permission", "✓"]
  - ["UI gated by the same permission (hidden = denied)", "✓"]
  - ["Denial test: a user without it is blocked and sees nothing", "✓"]
```
