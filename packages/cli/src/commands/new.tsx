/**
 * `avo new` — scaffold a new doc from a block-type template.
 *
 * Interactive (Ink) when run in a TTY; non-interactive with `--type <kind>
 * --out <path>` for CI usage.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import React, { useState } from 'react';
import { Box, Text, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import { BLOCK_TYPES, type BlockType } from '@avodado/core';
import { DOC_TEMPLATES, isDocTemplate } from './docTemplates.js';

export interface NewOptions {
  readonly cwd: string;
  readonly type?: BlockType;
  readonly out?: string;
}

export const TEMPLATES: Record<BlockType, string> = {
  meta: '```meta\ntitle: New document\nsubtitle: One-line description.\ntag: DRAFT\n```\n',
  callout:
    '```callout\ntone: note\ntitle: Heads up\nbody: A short note that the reader should not miss.\n```\n',
  table: '```table\ncolumns: [Field, Description]\nrows:\n  - [name, Display name]\n  - [id, Stable identifier]\n```\n',
  sequence:
    '```sequence\nid: seq-example\nactors:\n  - { id: Client, name: Client }\n  - { id: Server, name: Server }\nmessages:\n  - { from: Client, to: Server, label: request, kind: sync }\n  - { from: Server, to: Client, label: response, kind: response }\n```\n',
  erd:
    '```erd\nid: erd-example\nentities:\n  - name: orders\n    columns:\n      - { name: id, type: uuid, pk: true }\n      - { name: user_id, type: uuid, fk: true }\nrelations: []\n```\n',
  userstory:
    '```userstory\nid: US-001\nrole: user\nwant: do the thing\nsoThat: I get the outcome\ncriteria:\n  - { given: a precondition, when: I act, then: the outcome }\n```\n',
  timeline:
    '```timeline\nitems:\n  - label: Phase 1\n    date: now\n    status: current\n    desc: What is happening now\n  - label: Phase 2\n    date: next\n    status: next\n    desc: What is next\n```\n',
  kanban:
    '```kanban\ncolumns:\n  - label: Now\n    cards:\n      - { title: Current task }\n  - label: Next\n    cards:\n      - { title: Upcoming task }\n  - label: Later\n    cards:\n      - { title: Eventually }\n```\n',
  tracker:
    '```tracker\nitems:\n  - { task: First task, status: doing, priority: high }\n  - { task: Second task, status: todo, priority: med }\n```\n',
  prose:
    '```prose\ntitle: Overview\nblocks:\n  - { type: h, text: Background }\n  - { type: p, text: A paragraph explaining the context. }\n  - { type: ul, items: [Idea one, Idea two, Idea three] }\n```\n',
  glossary:
    '```glossary\nterms:\n  - { term: Idempotency, def: Doing a thing twice has the same effect as doing it once. }\n  - { term: SLO, def: Service-level objective the team commits to. }\n```\n',
  proscons:
    '```proscons\ntitle: Synchronous vs async\nprosLabel: Synchronous\nconsLabel: Asynchronous\npros:\n  - Easy to reason about\n  - One transaction\ncons:\n  - Latency-bound\n  - Single point of failure\n```\n',
  cvt:
    '```cvt\ntitle: Migration plan\ncurrent:\n  label: Today\n  items: [Single monolith, Shared database, Manual deploys]\ntarget:\n  label: Target\n  items: [Modular services, Per-service stores, Automated deploys]\nnote: Migrate one service per quarter.\n```\n',
  stats:
    '```stats\ntitle: This quarter\nstats:\n  - { value: 12.4k, label: Active users, delta: "+18%", trend: up }\n  - { value: 99.95%, label: Uptime, delta: "0", trend: flat }\n  - { value: 142ms, label: p95 latency, delta: "-22ms", trend: up }\n```\n',
  code:
    '```code\ntitle: Reference\nblocks:\n  - title: index.ts\n    lang: TypeScript\n    code: |\n      export function add(a: number, b: number): number {\n        return a + b;\n      }\n```\n',
  agenda:
    '```agenda\nitems:\n  - { time: "09:00", duration: 30m, title: Intros, owner: Host }\n  - { time: "09:30", duration: 45m, title: Status updates, desc: Each team for 5 min }\n  - { time: "10:15", duration: 15m, title: Wrap-up }\n```\n',
  tree:
    '```tree\nnodes:\n  - { id: src, label: src }\n  - { id: components, parent: src, label: components }\n  - { id: hooks, parent: src, label: hooks }\n  - { id: index, parent: src, label: index.ts, note: entry point }\n```\n',
  pyramid:
    '```pyramid\nlevels:\n  - { label: Vision, desc: Long-term direction }\n  - { label: Strategy, desc: How we get there }\n  - { label: Tactics, desc: This quarter }\n  - { label: Tasks, desc: This week }\n```\n',
  flow:
    '```flow\ntitle: Decision flow\nnodes:\n  - { id: start, col: 1, row: 1, kind: start, label: Start }\n  - { id: check, col: 2, row: 1, kind: decision, label: Is valid? }\n  - { id: yes, col: 3, row: 1, kind: process, label: Process }\n  - { id: no, col: 2, row: 2, kind: end, label: Reject }\n  - { id: done, col: 3, row: 2, kind: end, label: Done }\nedges:\n  - { from: start, to: check }\n  - { from: check, to: yes, label: "yes" }\n  - { from: check, to: no, label: "no", kind: error }\n  - { from: yes, to: done }\n```\n',
  state:
    '```state\ntitle: Order lifecycle\nstates:\n  - { id: s0, col: 1, row: 1, kind: start }\n  - { id: pending, col: 2, row: 1, kind: wait, name: PENDING }\n  - { id: confirmed, col: 3, row: 1, kind: active, name: CONFIRMED }\n  - { id: end, col: 4, row: 1, kind: terminal }\ntransitions:\n  - { from: s0, to: pending, event: create }\n  - { from: pending, to: confirmed, event: pay }\n  - { from: confirmed, to: end, event: ship }\n```\n',
  dfd:
    '```dfd\ntitle: Data flow\nnodes:\n  - { id: ext, col: 1, row: 1, kind: external, name: Client }\n  - { id: proc, col: 2, row: 1, kind: process, name: Process, num: 1 }\n  - { id: store, col: 3, row: 1, kind: store, name: Orders }\nedges:\n  - { from: ext, to: proc, label: request }\n  - { from: proc, to: store, label: write }\n```\n',
  journey:
    '```journey\ntitle: Onboarding journey\nstages:\n  - { label: Discover }\n  - { label: Sign up }\n  - { label: Activate }\n  - { label: Pay }\nrows:\n  - { label: Touchpoint, cells: [Landing, Form, Email, Checkout] }\n  - { label: Friction, cells: [Low, Med, Low, Med] }\nemotion: [0.7, 0.4, 0.6, 0.8]\n```\n',
  gantt:
    '```gantt\ntitle: Roadmap\nperiods: [Q1, Q2, Q3, Q4]\ntasks:\n  - { label: Discovery, start: 0, span: 1, kind: done }\n  - { label: Build, start: 1, span: 2, kind: active }\n  - { label: Ship, start: 3, span: 1 }\n  - { label: GA, start: 3, span: 1, kind: milestone }\n```\n',
  graph:
    '```graph\ntitle: Dependency graph\nnodes:\n  - { id: a, col: 1, row: 1, label: Module A, group: 0 }\n  - { id: b, col: 2, row: 1, label: Module B, group: 1 }\n  - { id: c, col: 3, row: 1, label: Module C, group: 2 }\n  - { id: d, col: 2, row: 2, label: Shared, group: 3 }\nedges:\n  - { from: a, to: b }\n  - { from: b, to: c }\n  - { from: a, to: d }\n  - { from: b, to: d, dir: undirected }\n```\n',
  quadrant:
    '```quadrant\ntitle: Effort vs impact\nxAxis: { label: Effort, low: Low, high: High }\nyAxis: { label: Impact, low: Low, high: High }\nitems:\n  - { x: 0.2, y: 0.8, label: Quick win }\n  - { x: 0.8, y: 0.8, label: Big bet }\n  - { x: 0.2, y: 0.2, label: Fill-in }\n  - { x: 0.8, y: 0.2, label: Thankless }\n```\n',
  swimlane:
    '```swimlane\ntitle: Cross-functional flow\nlanes:\n  - { label: Customer }\n  - { label: Sales }\n  - { label: Ops }\nsteps:\n  - { id: req, col: 1, lane: 0, kind: start, label: Submit request }\n  - { id: qual, col: 2, lane: 1, kind: decision, label: Qualify }\n  - { id: fulfill, col: 3, lane: 2, label: Fulfill }\n  - { id: done, col: 4, lane: 0, kind: end, label: Receive }\nlinks:\n  - { from: req, to: qual }\n  - { from: qual, to: fulfill }\n  - { from: fulfill, to: done }\n```\n',
  c4:
    '```c4\ntitle: System context\nlevel: context\nnodes:\n  - { id: user, col: 1, row: 1, kind: person, name: Shopper, desc: A customer placing an order. }\n  - { id: app, col: 2, row: 1, kind: system, name: ShopCo, desc: The retail platform. }\n  - { id: pay, col: 3, row: 1, kind: external, name: Payment GW, desc: Stripe authorisation. }\nedges:\n  - { from: user, to: app, label: places order }\n  - { from: app, to: pay, label: authorises }\n```\n',
  uml:
    '```uml\ntitle: Class model\nclasses:\n  - { id: order, col: 1, row: 1, name: Order, attrs: ["id: UUID", "status: Status", "total: Money"], methods: ["place()", "cancel()"] }\n  - { id: item, col: 2, row: 1, name: OrderItem, attrs: ["id: UUID", "sku: String", "qty: int"] }\n  - { id: status, col: 1, row: 2, name: Status, stereotype: enumeration, attrs: ["PENDING", "CONFIRMED", "CANCELLED"] }\nrels:\n  - { from: order, to: item, kind: composition }\n  - { from: order, to: status, kind: association, label: has }\n```\n',
  mece:
    '```mece\ntitle: Why are conversions down?\nnodes:\n  - { id: root, label: Lower conversion }\n  - { id: traffic, parent: root, label: Traffic }\n  - { id: friction, parent: root, label: Friction }\n  - { id: t1, parent: traffic, label: Lower quality, note: paid ads }\n  - { id: t2, parent: traffic, label: Wrong audience }\n  - { id: f1, parent: friction, label: Slow checkout }\n  - { id: f2, parent: friction, label: Mobile bugs }\n```\n',
  frontend:
    '```frontend\ntitle: React component tree\nnodes:\n  - { id: app, kind: root, name: App }\n  - { id: layout, parent: app, kind: layout, name: Layout }\n  - { id: home, parent: layout, kind: page, name: Home }\n  - { id: orders, parent: layout, kind: page, name: Orders }\n  - { id: card, parent: orders, kind: component, name: OrderCard }\n  - { id: useOrder, parent: orders, kind: hook, name: useOrder }\n  - { id: store, parent: app, kind: store, name: cart, note: Zustand }\n```\n',
  cluster:
    '```cluster\ntitle: Production cluster\nclusters:\n  - { id: api, label: api namespace, kind: namespace }\n  - { id: data, label: data namespace, kind: namespace }\nservices:\n  - { id: web, cluster: api, label: web, kind: service, tech: Next.js, replicas: 3 }\n  - { id: orders, cluster: api, label: orders, kind: service, tech: Go, replicas: 4 }\n  - { id: pg, cluster: data, label: postgres, kind: store, tech: Postgres 16, replicas: 1 }\n  - { id: redis, cluster: data, label: redis, kind: cache, tech: Redis 7, replicas: 2 }\nedges:\n  - { from: web, to: orders }\n  - { from: orders, to: pg }\n  - { from: orders, to: redis }\n```\n',
  block:
    '```block\ntitle: System architecture\ngroups:\n  - { col: 1, row: 1, cols: 1, rows: 2, label: Edge, color: "#0e54a1" }\n  - { col: 2, row: 1, cols: 2, rows: 2, label: Services, color: "#1f9747" }\nnodes:\n  - { id: cdn, col: 1, row: 1, kind: cdn, name: CDN, tech: Cloudflare }\n  - { id: gw, col: 1, row: 2, kind: gateway, name: Gateway, tech: Envoy }\n  - { id: api, col: 2, row: 1, kind: service, name: API, tech: Go }\n  - { id: worker, col: 3, row: 1, kind: service, name: Worker, tech: Go }\n  - { id: pg, col: 2, row: 2, kind: store, name: Postgres, tech: "16" }\n  - { id: q, col: 3, row: 2, kind: queue, name: Events, tech: NATS }\nedges:\n  - { from: cdn, to: gw }\n  - { from: gw, to: api }\n  - { from: api, to: pg }\n  - { from: api, to: q }\n  - { from: q, to: worker, kind: dashed }\n```\n',
  infra:
    '```infra\ntitle: AWS topology\nsystemLabel: ShopCo · us-east-1\nlayers:\n  - { label: Edge }\n  - { label: Compute }\n  - { label: Data }\nnodes:\n  - { id: cf, layer: 0, kind: cdn, name: CloudFront, tech: CDN }\n  - { id: alb, layer: 0, kind: gateway, name: ALB, tech: Application LB }\n  - { id: api, layer: 1, kind: service, name: API, tech: ECS Fargate }\n  - { id: worker, layer: 1, kind: service, name: Worker, tech: ECS Fargate }\n  - { id: pg, layer: 2, kind: store, name: orders-db, tech: RDS Postgres }\n  - { id: cache, layer: 2, kind: cache, name: cache, tech: ElastiCache }\nedges:\n  - { from: cf, to: alb }\n  - { from: alb, to: api }\n  - { from: api, to: pg }\n  - { from: api, to: cache }\n  - { from: api, to: worker, kind: dashed }\n```\n',
  event:
    '```event\ntitle: Pub/sub choreography\nnodes:\n  - { id: orders, col: 1, row: 1, kind: producer, name: orders }\n  - { id: bus, col: 2, row: 1, kind: topic, name: order.events }\n  - { id: ship, col: 3, row: 1, kind: consumer, name: shipping }\n  - { id: bill, col: 3, row: 2, kind: consumer, name: billing }\nedges:\n  - { from: orders, to: bus }\n  - { from: bus, to: ship }\n  - { from: bus, to: bill }\n```\n',
  ddd:
    '```ddd\ntitle: Bounded contexts\nnodes:\n  - { id: cat, col: 1, row: 1, kind: context, name: Catalog }\n  - { id: order, col: 2, row: 1, kind: context, name: Orders }\n  - { id: pay, col: 3, row: 1, kind: context, name: Payments }\n  - { id: ship, col: 2, row: 2, kind: context, name: Shipping }\nedges:\n  - { from: order, to: cat, label: reads, kind: dashed }\n  - { from: order, to: pay }\n  - { from: order, to: ship }\n```\n',
  network:
    '```network\ntitle: Security zones\nnodes:\n  - { id: edge, col: 1, row: 1, kind: gateway, name: Edge / WAF }\n  - { id: fw, col: 2, row: 1, kind: firewall, name: Perimeter FW }\n  - { id: api, col: 3, row: 1, kind: service, name: API }\n  - { id: db, col: 3, row: 2, kind: store, name: DB (private) }\nedges:\n  - { from: edge, to: fw }\n  - { from: fw, to: api }\n  - { from: api, to: db }\n```\n',
  felogic:
    '```felogic\ntitle: Frontend modules\nnodes:\n  - { id: hook, col: 1, row: 1, kind: hook, name: useOrders }\n  - { id: svc, col: 2, row: 1, kind: service, name: ordersService }\n  - { id: iface, col: 3, row: 1, kind: interface, name: OrdersClient }\n  - { id: impl, col: 4, row: 1, kind: strategy, name: HttpOrdersClient }\n  - { id: api, col: 5, row: 1, kind: external, name: Orders API }\nedges:\n  - { from: hook, to: svc }\n  - { from: svc, to: iface, kind: uses }\n  - { from: impl, to: iface, kind: implements }\n  - { from: impl, to: api, kind: egress, label: HTTPS }\n```\n',
  belogic:
    '```belogic\ntitle: Backend modules\nnodes:\n  - { id: ctrl, col: 1, row: 1, kind: controller, name: OrdersController }\n  - { id: svc, col: 2, row: 1, kind: service, name: PlaceOrder }\n  - { id: repo, col: 3, row: 1, kind: repository, name: OrdersRepo }\n  - { id: db, col: 4, row: 1, kind: db, name: postgres }\n  - { id: pay, col: 3, row: 2, kind: external, name: Stripe }\nedges:\n  - { from: ctrl, to: svc }\n  - { from: svc, to: repo }\n  - { from: repo, to: db, kind: reads }\n  - { from: svc, to: pay, kind: egress, label: authorise }\n```\n',
  dag:
    '```dag\ntitle: Build pipeline\nnodes:\n  - { id: src, col: 1, row: 1, kind: start, label: Source }\n  - { id: lint, col: 2, row: 1, kind: process, label: Lint }\n  - { id: test, col: 3, row: 1, kind: process, label: Test }\n  - { id: build, col: 4, row: 1, kind: process, label: Build }\n  - { id: deploy, col: 5, row: 1, kind: end, label: Deploy }\nedges:\n  - { from: src, to: lint }\n  - { from: lint, to: test }\n  - { from: test, to: build }\n  - { from: build, to: deploy }\n```\n',
  wireframe:
    '```wireframe\ntitle: What the user sees\nscreens:\n  - device: browser\n    title: Dashboard\n    url: app.example.com\n    label: Desktop\n    elements:\n      - { type: nav, label: "Home, Inbox, Settings" }\n      - { type: header, label: Notifications }\n      - { type: list, rows: 4 }\n      - { type: button, label: Mark all as read }\n  - device: phone\n    title: "9:41"\n    label: iPhone\n    elements:\n      - { type: header, label: Alerts }\n      - { type: card, rows: 3 }\n      - { type: tabs, label: "Home, Search, Bell, You" }\n```\n',
  endpoint:
    '```endpoint\nmethod: POST\npath: /orders\ntitle: Create an order\ndescription: Submit a cart and create a new order.\nauth: Bearer token\nparams:\n  - { name: idempotency-key, in: header, type: string, desc: Safe-retry key }\nbody:\n  - { name: items, type: "Item[]", required: true, desc: Line items }\n  - { name: coupon, type: string, desc: Optional discount code }\nresponses:\n  - { status: 201, desc: Order created }\n  - { status: 400, desc: Invalid cart }\n  - { status: 401, desc: Missing or invalid token }\nrequest: |\n  { "items": [{ "sku": "A1", "qty": 2 }] }\nresponse: |\n  { "id": "ord_123", "status": "pending" }\n```\n',
  pullquote:
    '```pullquote\ntext: The whole design in one sentence.\nattribution: The takeaway\n```\n',
  layers:
    '```layers\ntitle: The model in three layers\nitems:\n  - { kicker: L1, title: Identity, source: JWT, question: "Are you signed in?", body: Validate the token and resolve the user. }\n  - { kicker: L2, title: Scope, source: Lookup, question: "Which sites?", body: Confirm the request is in range. }\n  - { kicker: L3, title: Permission, source: App DB, question: "May you do this?", body: Check the action against the matrix. }\n```\n',
  matrix:
    '```matrix\ntitle: Who can do what\ncorner: Role / App\ncols: [Billing, Reports, Admin]\nrows:\n  - { label: Owner, cells: [Full, Full, Full] }\n  - { label: Manager, cells: [Full, Read, "—"] }\n  - { label: Viewer, cells: [Read, Read, "—"] }\n```\n',
  anatomy:
    '```anatomy\ntitle: Anatomy of a permission\nseparator: ":"\nparts:\n  - { label: App, value: atlas, note: Which product. }\n  - { label: Feature, value: billing, note: The area within the app. }\n  - { label: Action, value: invoices.read, note: The specific capability. }\n```\n',
  composition:
    '```composition\ntitle: How access is decided\nresult: May read invoices\ngates:\n  - { label: Identity, desc: A valid signed-in user. }\n  - { label: Scope, desc: The request is in range. }\n  - { label: Permission, desc: The action is granted. }\n```\n',
  drivers:
    '```drivers\ntitle: What shaped the design\nitems:\n  - { title: Single sign-on, body: One login carries the user everywhere., tag: "HOW: token", icon: lock, accent: purple }\n  - { title: Read per site, body: Access is scoped to the sites a user belongs to., tag: "WHERE: site group", icon: location, accent: green }\n  - { title: Governed roles, body: "An external IGA requests, approves, and certifies access.", tag: "WHO: role groups", icon: shield, accent: blue }\n  - { title: Per-app permissions, body: The same role does different things in each app., tag: "WHAT: matrix", icon: grid, accent: amber }\n```\n',
  options:
    '```options\ntitle: Approaches explored\nitems:\n  - { kicker: Option 1, title: App-managed roles, how: Roles live in our own DB; SSO only handles sign-in., pros: [Full control], cons: [Second source of truth, Custom tooling to govern], verdict: "REJECTED — fails the constraint", tone: rejected }\n  - { kicker: Option 2, title: Global role groups, how: Site groups for read; one global group per role., pros: [Fewest groups, Scales linearly], cons: ["A role applies at every site"], verdict: "VIABLE — kept as fallback", tone: viable }\n  - { kicker: Option 3, title: Per-site role groups, how: One group per persona per site., pros: [Least privilege by construction, Clean per-site audit], cons: [Most groups to manage], verdict: "CHOSEN — matches the constraints", tone: chosen }\n```\n',
  spec:
    '```spec\ntitle: Per-site role groups\naccent: green\nrows:\n  - { label: Groups, value: "SiteN-Users (read) + SiteN-<Persona> per staffed plant." }\n  - { label: Roles, value: "Each group reads as (site, role); the token carries the full scope." }\n  - { label: Resolution, steps: [Decode token, "Read (site, role)", Check matrix] }\n  - { label: Cost, value: "Up to Sites x Roles groups; adding a role multiplies them." }\n```\n',
  list:
    '```list\ntitle: What you get\nstyle: accent\nitems:\n  - { lead: Typed blocks, text: "87 strict schemas, validated by avo check.", accent: blue }\n  - { lead: One source of truth, text: Diagrams live in the .md file., accent: green }\n  - { lead: Many outputs, text: "HTML, slides, and PDF from one file.", accent: amber }\n```\n',
  stories:
    '```stories\ntitle: Backlog\nitems:\n  - { id: US-1, title: One-step checkout, role: shopper, want: pay for my cart in one step, soThat: I finish faster, priority: High, points: 5, open: true, criteria: [{ given: I have items, when: I submit valid payment, then: an order is created }] }\n  - { id: US-2, title: Save payment method, role: returning shopper, want: store a card, soThat: I skip re-entry, priority: Med, points: 3 }\n```\n',
  pattern:
    '```pattern\nname: Repository\ncategory: Backend\nintent: Hide persistence behind a collection-like interface so the domain never sees the database.\nforces: [Swap the data store, Unit-test without a DB, No query leaks into the domain]\nparticipants:\n  - { name: OrderRepository, role: interface the service depends on }\n  - { name: PgOrderRepository, role: Postgres implementation }\n  - { name: OrderService, role: caller (domain logic) }\nconsequences:\n  pros: [Swappable storage, Testable with a fake, Clear seam]\n  cons: [Another layer, Risk of anemic pass-through methods]\n```\n',
  gallery:
    '```gallery\ntitle: Bug gallery\ncols: 2\ndescription: A grid of code snippets — great for a comparison or a "spot the bug" set.\nitems:\n  - title: "N+1 query"\n    lang: JavaScript\n    accent: red\n    caption: "1000 users = 1001 queries. Fix: JOIN or batch."\n    code: |\n      users.forEach(async u => {\n        await db.query("SELECT * FROM orders WHERE user_id=?", u.id);\n      });\n  - title: "Off-by-one"\n    lang: JavaScript\n    accent: amber\n    caption: "arr[arr.length] is undefined. Fix: < not <=."\n    code: |\n      for (let i = 0; i <= arr.length; i++)\n        process(arr[i]);\n  - title: "Secrets in code"\n    lang: JavaScript\n    accent: red\n    caption: "Committed to the repo. Fix: env vars + a scanner."\n    code: |\n      const API_KEY = "sk-live-abc123";\n```\n',
  chart:
    '```chart\ntitle: p95 latency by week\nkind: line\nunit: ms\nlabels: [W1, W2, W3, W4]\nseries:\n  - { label: /orders, accent: navy, values: [240, 220, 185, 150] }\n  - { label: /search, accent: teal, values: [310, 285, 260, 230] }\n```\n',
  figure:
    '```figure\nsrc: https://example.com/architecture.png\nalt: The deployment topology\ncaption: "The production topology: CDN, gateway, and two service tiers."\nwidth: 560\n```\n',
  diff:
    '```diff\ntitle: "fix: clamp retry backoff"\nlang: TypeScript\ncode: |\n  @@ -12,7 +12,7 @@\n   function backoff(attempt: number): number {\n  -  return 100 * attempt ** 2;\n  +  return Math.min(30_000, 100 * attempt ** 2);\n   }\n```\n',
  steps:
    '```steps\ntitle: Deploy a hotfix\nitems:\n  - title: Branch from main\n    body: Hotfixes always branch from the latest main.\n    code: git checkout -b hotfix/fix-retry main\n    lang: bash\n  - title: Ship the fix\n    body: Commit and push; CI runs the full suite.\n    code: git push -u origin hotfix/fix-retry\n    lang: bash\n    note: CI must be green before the next step.\n  - title: Tag and deploy\n    code: git tag v1.4.1 && git push --tags\n    lang: bash\n```\n',
  faq:
    '```faq\ntitle: Common questions\nitems:\n  - q: Where does the content live?\n    a: "In the .md files on disk — they are the single source of truth."\n    open: true\n  - q: Do diagrams need a drawing tool?\n    a: "No. Diagrams are typed YAML blocks; the renderer draws the SVG."\n  - q: How do I validate a doc?\n    a: Run avo check and fix every diagnostic it reports.\n```\n',
  envelope:
    '```envelope\ntitle: Write-path capacity\nassumptions:\n  - { label: Daily active users, value: 5M }\n  - { label: Writes / user / day, value: "4" }\nsteps:\n  - { label: Writes per day, calc: "5M × 4", result: 20M/day }\n  - { label: Write QPS, calc: "20M / 86,400 s", result: "≈ 230 rps" }\n  - { label: Peak QPS, calc: "230 × 3 (peak factor)", result: "≈ 700 rps" }\nresult: { label: Provision for, value: "~1,400 rps (2× peak headroom)" }\n```\n',
  slo:
    '```slo\ntitle: Orders API — objectives\nitems:\n  - { name: Availability, sli: Successful requests / total requests, target: 99.9%, current: 99.97%, window: 30d, budget: 0.25 }\n  - { name: Latency, sli: Requests served under 400 ms (p99), target: 99%, current: 98.9%, window: 30d, budget: 0.7 }\n```\n',
  terminal:
    '```terminal\ntitle: deploy — production\nsession: |\n  $ kubectl rollout status deploy/api\n  # wait for the rollout to settle before tagging\n  deployment "api" successfully rolled out\n  $ git tag v1.4.1 && git push --tags\n```\n',
  swot:
    '```swot\ntitle: Entering the enterprise segment\nstrengths:\n  - Fastest onboarding in the category\n  - Strong developer community\nweaknesses:\n  - No SSO / SCIM yet\n  - Small support team\nopportunities:\n  - Competitor sunsetting its legacy plan\n  - Compliance push creates demand\nthreats:\n  - Incumbent bundling a free tier\n  - Procurement cycles slow adoption\n```\n',
  funnel:
    '```funnel\ntitle: Signup → paid conversion\nunit: users\nstages:\n  - { label: Visited landing page, value: 48000 }\n  - { label: Started signup, value: 9600, desc: email + password }\n  - { label: Activated, value: 4300, desc: created a first doc }\n  - { label: Upgraded to paid, value: 860 }\n```\n',
  okr:
    '```okr\ntitle: Q3 objectives\nitems:\n  - objective: Make onboarding effortless\n    owner: Growth\n    krs:\n      - { kr: Time-to-first-doc under 5 minutes, progress: 0.7, status: on-track }\n      - { kr: Activation rate from 45% to 60%, progress: 0.4, status: at-risk }\n  - objective: Earn enterprise trust\n    owner: Platform\n    krs:\n      - { kr: Ship SSO + audit log, progress: 1, status: done }\n      - { kr: SOC 2 Type II report issued, progress: 0.2, status: off-track }\n```\n',
  persona:
    '```persona\ntitle: Who we build for\npersonas:\n  - name: Maya Chen\n    role: Staff engineer\n    quote: I want the diagram in the PR diff, not in a wiki.\n    goals: [Docs that live with the code, Reviewable architecture changes]\n    frustrations: [Stale wiki pages, Screenshots of whiteboards]\n    tools: [VS Code, GitHub]\n    accent: blue\n  - name: Priya Patel\n    role: Engineering manager\n    quote: Every reorg breaks our onboarding docs.\n    goals: [One source of truth per system]\n    frustrations: ["Docs no one owns"]\n    tools: [Linear, Notion]\n    accent: teal\n```\n',
  changelog:
    '```changelog\ntitle: Release history\nreleases:\n  - version: 2.0.0\n    date: 2026-06-24\n    tag: breaking\n    items:\n      - { type: changed, text: "Config moved from .rc to avodado.config.json" }\n      - { type: removed, text: Dropped Node 18 support }\n  - version: 1.4.0\n    date: 2026-05-12\n    tag: minor\n    items:\n      - { type: added, text: Dark theme }\n      - { type: fixed, text: Slide overflow on long tables }\n```\n',
  team:
    '```team\ntitle: Who owns what\nmembers:\n  - { name: Ana Ruiz, role: Tech lead, focus: Rendering pipeline, accent: navy }\n  - { name: Sam Okafor, role: Backend, focus: Sync + integrations, accent: teal }\n  - { name: Lena Fischer, role: Design, focus: Themes and house style, accent: purple }\n```\n',
  waterfall:
    '```waterfall\ntitle: API latency budget\nunit: ms\nbudget: 250\nitems:\n  - { label: DNS + TLS, value: 35 }\n  - { label: Gateway, value: 20, desc: auth + routing }\n  - { label: Service, value: 90 }\n  - { label: Database, value: 70 }\n```\n',
  heatmap:
    '```heatmap\ntitle: p95 latency by region\nunit: ms\nxLabels: ["00", "06", "12", "18"]\nrows:\n  - { label: us-east-1, values: [120, 135, 210, 265] }\n  - { label: eu-west-1, values: [110, 150, 240, 190] }\n  - { label: ap-south-1, values: [180, 220, 310, 280] }\n```\n',
  scorecard:
    '```scorecard\ntitle: Queue technology choice\ncriteria:\n  - { label: Throughput, weight: 2 }\n  - { label: Operational cost }\n  - { label: Team familiarity }\noptions:\n  - { label: Kafka, scores: [5, 2, 3], note: self-hosted }\n  - { label: SQS, scores: [3, 5, 4], note: managed }\n```\n',
  risk:
    '```risk\ntitle: Launch risks\nitems:\n  - { risk: Traffic spike overwhelms the API, likelihood: med, impact: high, mitigation: Autoscaling + load-shedding at the gateway., owner: Platform, status: mitigating }\n  - { risk: Data migration misses edge cases, likelihood: low, impact: high, mitigation: Dry-run against a prod snapshot., owner: Data, status: open }\n  - { risk: Docs lag the release, likelihood: med, impact: low, status: accepted }\n```\n',
  palette:
    '```palette\ntitle: Brand palette\ncols: 4\ncolors:\n  - { name: Primary, value: "#0E54A1", usage: Buttons and links }\n  - { name: Ink, value: "#1F2937", usage: Body text }\n  - { name: Surface, value: "#F6F8FB", usage: Card backgrounds }\n  - { name: Positive, value: "#1F9747", usage: Success states }\n```\n',
  typescale:
    '```typescale\ntitle: Type scale\nitems:\n  - { name: Display, size: 40, weight: 700, font: display }\n  - { name: Body, size: 15, lineHeight: 1.6 }\n  - { name: Caption, size: 12, weight: 500, note: secondary text }\n  - { name: Code, size: 13, font: mono }\n```\n',
  dodont:
    '```dodont\ntitle: Button usage\ndos:\n  - { text: Use one primary button per view }\n  - { text: Write labels as verbs, example: "Save changes" }\ndonts:\n  - { text: Stack two primary buttons side by side }\n  - { text: Disable a button without explaining why, example: "tooltip: Add a line item first" }\n```\n',
  inventory:
    '```inventory\ntitle: Component status\nitems:\n  - { name: Button, status: stable, tag: v2 }\n  - { name: Data table, status: beta, note: API may change before GA }\n  - { name: Date picker, status: experimental }\n  - { name: Modal (legacy), status: deprecated, note: Use Dialog instead }\n  - { name: Charts, status: planned }\n```\n',
  array:
    '```array\ntitle: Binary search — step 2\nitems:\n  - { value: "3", tone: visited }\n  - { value: "7", tone: visited }\n  - { value: "12", label: lo }\n  - { value: "19", tone: active, label: mid }\n  - { value: "27", tone: target }\n  - { value: "41", label: hi }\nwindow: { from: 2, to: 5, label: search space }\n```\n',
  linkedlist:
    '```linkedlist\ntitle: Reversing a list — step 2\nnodes:\n  - { value: "9", tone: visited, label: prev }\n  - { value: "4", tone: active, label: curr }\n  - { value: "7", label: next }\n  - { value: "1" }\n```\n',
  bintree:
    '```bintree\ntitle: BST search for 27\nnodes:\n  - { id: root, value: "19", tone: visited }\n  - { id: l, value: "8", parent: root, side: left }\n  - { id: r, value: "31", parent: root, side: right, tone: active }\n  - { id: rl, value: "27", parent: r, side: left, tone: target }\n  - { id: rr, value: "40", parent: r, side: right }\n```\n',
  hashmap:
    '```hashmap\ntitle: Chained hash table\nbuckets: 5\nentries:\n  - { key: apple, value: "3", bucket: 0 }\n  - { key: plum, value: "9", bucket: 2, tone: active }\n  - { key: grape, value: "1", bucket: 2 }\n  - { key: fig, value: "7", bucket: 4, tone: muted }\n```\n',
  agentloop:
    '```agentloop\ntitle: Support triage agent\nagent:\n  name: Triage agent\n  model: claude-sonnet-4-6\n  note: Routes each ticket to a fix or a human.\nenv: Customer\ntools:\n  - { name: search_kb, desc: Search help-center articles }\n  - { name: get_account, desc: Look up plan and billing state }\n  - { name: create_ticket, desc: Escalate to a human queue }\nmemory:\n  - conversation history\n  - customer profile\nstop: reply sent or ticket escalated\n```\n',
  trace:
    '```trace\ntitle: Password reset — one episode\nturns:\n  - role: user\n    text: I never get the reset email.\n  - role: assistant\n    thinking: Could be a bounce — check delivery logs before blaming spam.\n    text: Let me check our email logs.\n  - role: tool\n    tool: email_logs.search\n    args: \'{ "to": "sam@example.com", "type": "password_reset" }\'\n    result: "1 result: bounced (mailbox full)"\n  - role: assistant\n    text: Your mailbox rejected the email — free up space and I will resend it.\n```\n',
  prompt:
    '```prompt\ntitle: Support reply template\nsegments:\n  - kind: system\n    label: role + guardrails\n    text: "You are a support agent for {{product}}. Answer from the docs only."\n  - kind: user\n    text: "Customer ({{plan}} plan) asks: {{question}}"\nvars:\n  - { name: product, desc: Product name from config }\n  - { name: plan, desc: Plan tier of the signed-in customer }\n  - { name: question, desc: The inbound message }\n```\n',
  context:
    '```context\ntitle: Where the window goes\nwindow: 200000\nsegments:\n  - { label: system prompt, tokens: 6000, accent: navy }\n  - { label: tool schemas, tokens: 14000, accent: teal }\n  - { label: retrieval, tokens: 60000, accent: amber }\n  - { label: history, tokens: 70000, accent: purple }\n```\n',
  archmap:
    '```archmap\ntitle: Target platform architecture\ncols: 3\nareas:\n  - label: Customer channels\n    accent: blue\n    items:\n      - Web storefront\n      - { name: Mobile app, status: target }\n  - label: Commerce\n    accent: teal\n    items:\n      - Catalog\n      - Checkout\n      - { name: Promotions, status: gap }\n  - label: Platform services\n    accent: purple\n    desc: Shared capabilities every domain builds on.\n    items:\n      - Identity\n      - { name: Event bus, status: new }\n      - { name: Legacy ESB, status: deprecated }\n```\n',
  divider:
    '```divider\nkicker: PART 2\ntitle: What we change\nsubtitle: The three fixes, in the order we ship them.\naccent: navy\n```\n',
  bignumber:
    '```bignumber\nvalue: "-75%"\nlabel: Checkout p95 after moving capture off the request path\ncontext: "2.4s → 600ms, measured over four weeks of production traffic"\ndelta: "-1.8s"\ntrend: down\naccent: green\n```\n',
  takeaways:
    '```takeaways\ntitle: Takeaways\nitems:\n  - text: The synchronous capture call was the bottleneck\n    detail: It accounted for 71% of the 2.4s checkout p95.\n  - text: Moving it to a queue cut p95 by 75%\n  - text: Conversion recovered within two weeks\n    detail: "+0.4pp against the pre-regression baseline."\n```\n',
};

/** Returns the template string for a block type. */
export function templateFor(type: BlockType): string {
  return `\`\`\`meta\ntitle: New document\ntag: DRAFT\n\`\`\`\n\n## ${type}\n\n${TEMPLATES[type]}`;
}

// Full-document templates (adr, design-doc, deck, …) live in docTemplates.ts;
// re-exported here so `avo new` and `avo template` share one import site.
export { DOC_TEMPLATES, isDocTemplate };


/**
 * Writes a new doc to `out` from the chosen block type. Returns the absolute
 * path written. Non-interactive: requires `type` + `out`.
 */
export async function writeNewDoc(opts: { cwd: string; type: string; out: string }): Promise<string> {
  const outAbs = resolve(opts.cwd, opts.out);
  await mkdir(dirname(outAbs), { recursive: true });
  const content = isDocTemplate(opts.type)
    ? (DOC_TEMPLATES[opts.type] as string)
    : templateFor(opts.type as BlockType);
  await writeFile(outAbs, content, 'utf8');
  return outAbs;
}

interface PickerProps {
  readonly onPick: (type: BlockType) => void;
}

/** Ink picker UI for selecting a block type interactively. */
export function NewPicker({ onPick }: PickerProps): React.ReactElement {
  const items = BLOCK_TYPES.map((t) => ({ label: t, value: t }));
  return (
    <Box flexDirection="column">
      <Text bold>Pick a block type to scaffold:</Text>
      <SelectInput
        items={items}
        onSelect={(item) => onPick(item.value as BlockType)}
      />
    </Box>
  );
}

interface AppProps {
  readonly cwd: string;
  readonly out: string;
}

/** Full Ink app for interactive `avo new` — picker → write → exit. */
export function NewApp({ cwd, out }: AppProps): React.ReactElement {
  const [picked, setPicked] = useState<BlockType | null>(null);
  const [writtenPath, setWrittenPath] = useState<string | null>(null);
  const { exit } = useApp();

  const handlePick = (type: BlockType): void => {
    setPicked(type);
    void writeNewDoc({ cwd, type, out }).then((path) => {
      setWrittenPath(path);
      setTimeout(exit, 50);
    });
  };

  if (writtenPath !== null) {
    return (
      <Box>
        <Text color="green">✓</Text>
        <Text> Wrote </Text>
        <Text bold>{writtenPath}</Text>
      </Box>
    );
  }
  if (picked !== null) {
    return <Text>Writing {out}…</Text>;
  }
  return <NewPicker onPick={handlePick} />;
}
