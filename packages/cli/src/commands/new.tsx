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

export interface NewOptions {
  readonly cwd: string;
  readonly type?: BlockType;
  readonly out?: string;
}

const TEMPLATES: Record<BlockType, string> = {
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
  funnel:
    '```funnel\nstages:\n  - { label: Visited, value: 10000 }\n  - { label: Signed up, value: 2400 }\n  - { label: Activated, value: 1100 }\n  - { label: Paying, value: 320 }\n```\n',
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
};

/** Returns the template string for a block type. */
export function templateFor(type: BlockType): string {
  return `\`\`\`meta\ntitle: New document\ntag: DRAFT\n\`\`\`\n\n## ${type}\n\n${TEMPLATES[type]}`;
}

/**
 * Multi-block *document* templates (as opposed to single-block scaffolds).
 * Each is a complete, `avo check`-clean starting doc for a common doc kind.
 */
const ADR_TEMPLATE = [
  '```meta',
  'title: ADR-NNN — decision title',
  'subtitle: One line on what we decided and why it matters.',
  'tag: ADR · Proposed · YYYY-MM-DD',
  '```',
  '',
  '## Status',
  '',
  '**Proposed** — YYYY-MM-DD. (Proposed → Accepted → Superseded.)',
  '',
  '## Context',
  '',
  'What forces a decision here? The constraints, requirements, and the problem',
  'being solved. Two to four sentences of plain prose — no block needed.',
  '',
  '```callout',
  'tone: note',
  'title: Decision',
  'body: "State the decision in one or two sentences — what we will do, and the single most important reason why."',
  '```',
  '',
  '## Options considered',
  '',
  '```proscons',
  'id: the-choice',
  'title: Chosen option vs the alternative',
  'prosLabel: Chosen option',
  'consLabel: The alternative',
  'pros:',
  '  - A concrete reason the chosen option wins',
  '  - Another benefit worth the trade-off',
  'cons:',
  '  - A real cost of the alternative',
  '  - Another drawback we are accepting against',
  '```',
  '',
  '## Architecture',
  '',
  '```block',
  'id: architecture',
  'title: How it fits together',
  'nodes:',
  '  - { id: client, col: 1, row: 1, kind: client, name: Client }',
  '  - { id: svc, col: 2, row: 1, kind: service, name: Service, tech: your stack }',
  '  - { id: db, col: 3, row: 1, kind: store, name: Database }',
  'edges:',
  '  - { from: client, to: svc }',
  '  - { from: svc, to: db }',
  '```',
  '',
  '## Consequences',
  '',
  '```tracker',
  'id: consequences',
  'title: Consequences & follow-ups',
  'items:',
  '  - { task: "Something that becomes easier or newly required", status: todo, priority: high }',
  '  - { task: "A migration or new responsibility this creates", status: todo, priority: med }',
  '  - { task: "A risk to watch as we roll this out", status: todo, priority: low }',
  '```',
  '',
].join('\n');

/** Full-document templates, keyed by name (`avo new --type adr`). */
export const DOC_TEMPLATES: Record<string, string> = {
  adr: ADR_TEMPLATE,
};

/** True when `name` is a full-document template rather than a block type. */
export function isDocTemplate(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(DOC_TEMPLATES, name);
}

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
