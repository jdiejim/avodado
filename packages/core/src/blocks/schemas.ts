/**
 * Zod schemas for every Avodado block type.
 *
 * These schemas are the single source of truth for each block's shape. TS types
 * are derived via `z.infer` in {@link BlockDataMap}, so validation and types
 * cannot drift apart.
 *
 * Shapes match `resources/doc-studio.jsx` (v1 grammar). Where doc-studio
 * differed from the earlier `resources/avodado-renderer.html` reference, the
 * doc-studio shape wins.
 *
 * Note: every schema is `.strict()` so unknown fields surface as diagnostics.
 * Top-level `id` is handled separately by the parser and is intentionally NOT
 * a field of any per-type schema.
 */

import { z } from 'zod';
import type { BlockType } from '../types.js';

// ─── meta ───────────────────────────────────────────────────────────────────
export const metaSchema = z
  .object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    tag: z.string().optional(),
    // Optional brand logo shown in the document/slide cover. A URL or path
    // (use an absolute https URL so it resolves wherever the doc is rendered).
    logo: z.string().optional(),
  })
  .strict();

// ─── callout ────────────────────────────────────────────────────────────────
// doc-studio: `tone` instead of `kind`. Optional title + body.
export const calloutSchema = z
  .object({
    tone: z.enum(['note', 'tip', 'warn', 'danger', 'success']).optional(),
    title: z.string().optional(),
    body: z.string().optional(),
  })
  .strict();

// ─── table ──────────────────────────────────────────────────────────────────
// doc-studio: columns can be strings OR `{ label, align?, highlight? }`.
// Cells can be `string | number | { v, tone }`.
const tableColumnSchema = z.union([
  z.string(),
  z
    .object({
      label: z.string(),
      align: z.enum(['l', 'c', 'r']).optional(),
      highlight: z.boolean().optional(),
    })
    .strict(),
]);
const tableCellSchema = z.union([
  z.string(),
  z.number(),
  z
    .object({
      v: z.union([z.string(), z.number()]),
      tone: z.enum(['pos', 'neg', 'warn', 'muted']).optional(),
      lead: z.boolean().optional(),
      highlight: z.boolean().optional(),
    })
    .strict(),
]);
export const tableSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    columns: z.array(tableColumnSchema).optional(),
    rows: z.array(z.array(tableCellSchema)).optional(),
    note: z.string().optional(),
  })
  .strict();

// ─── sequence ───────────────────────────────────────────────────────────────
// doc-studio actors are objects (id, name, sub?, external?). Messages have
// `kind: sync | response | async | error | note`. `note` is a numbered
// inline annotation on the from-actor's lane, with no arrow.
//
// Sample-orders-api extras: per-message `summary` (longer description for the
// step list), `code` (snippet inside the step list item), `note` (italic gray
// caption below the step), plus a top-level `lede` (intro paragraph above the
// diagram), `endpoint` (method + path for the tag pill and title), and `foot`
// (key/value metadata pills below the diagram).
const sequenceActorSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    sub: z.string().optional(),
    external: z.boolean().optional(),
  })
  .strict();
const sequenceMessageSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
    kind: z.enum(['sync', 'response', 'async', 'error', 'note']).optional(),
    summary: z.string().optional(),
    code: z.string().optional(),
    note: z.string().optional(),
  })
  .strict();
const sequenceEndpointSchema = z
  .object({
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
    path: z.string(),
    status: z.string().optional(),
  })
  .strict();
const sequenceFootSchema = z
  .object({
    label: z.string(),
    value: z.string(),
  })
  .strict();
export const sequenceSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    endpoint: sequenceEndpointSchema.optional(),
    actors: z.array(sequenceActorSchema).optional(),
    messages: z.array(sequenceMessageSchema).optional(),
    foot: z.array(sequenceFootSchema).optional(),
  })
  .strict();

// ─── erd ────────────────────────────────────────────────────────────────────
// doc-studio: entities `{name, columns: [{name, type?, pk?: boolean, fk?: boolean}]}`,
// relations `{from, to, label?, card?: '1:1'|'1:N'|'N:M'}`.
const erdColumnSchema = z
  .object({
    name: z.string(),
    type: z.string().optional(),
    pk: z.boolean().optional(),
    fk: z.boolean().optional(),
  })
  .strict();
const erdEntitySchema = z
  .object({
    name: z.string(),
    columns: z.array(erdColumnSchema).optional(),
  })
  .strict();
const erdRelationSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
    card: z.enum(['1:1', '1:N', 'N:1', 'N:M']).optional(),
  })
  .strict();
export const erdSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    entities: z.array(erdEntitySchema).optional(),
    relations: z.array(erdRelationSchema).optional(),
  })
  .strict();

// ─── userstory ──────────────────────────────────────────────────────────────
// Unchanged from the previous shape (doc-studio uses the same userstory).
const criterionSchema = z
  .object({
    given: z.string().optional(),
    when: z.string().optional(),
    then: z.string().optional(),
  })
  .strict();
const linkSchema = z
  .object({
    ref: z.string().optional(),
    mode: z.string().optional(),
    label: z.string().optional(),
  })
  .strict();
export const userstorySchema = z
  .object({
    title: z.string().optional(),
    role: z.string().optional(),
    want: z.string().optional(),
    soThat: z.string().optional(),
    priority: z.string().optional(),
    points: z.number().optional(),
    tags: z.array(z.string()).optional(),
    criteria: z.array(criterionSchema).optional(),
    links: z.array(linkSchema).optional(),
  })
  .strict();

// ─── timeline ───────────────────────────────────────────────────────────────
// doc-studio: items `{label, date?, desc?, status?: 'done'|'current'|'next'|'future'}`.
const timelineItemSchema = z
  .object({
    label: z.string(),
    date: z.string().optional(),
    desc: z.string().optional(),
    status: z.enum(['done', 'current', 'next', 'future']).optional(),
  })
  .strict();
export const timelineSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    items: z.array(timelineItemSchema).optional(),
  })
  .strict();

// ─── kanban ─────────────────────────────────────────────────────────────────
// doc-studio: `columns: [{label, cards: [{title, tag?}]}]`.
const kanbanCardSchema = z
  .object({
    title: z.string(),
    tag: z.string().optional(),
  })
  .strict();
const kanbanColumnSchema = z
  .object({
    label: z.string(),
    cards: z.array(kanbanCardSchema).optional(),
  })
  .strict();
export const kanbanSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    columns: z.array(kanbanColumnSchema).optional(),
  })
  .strict();

// ─── tracker ────────────────────────────────────────────────────────────────
// doc-studio: items add optional `owner`, `due`.
const trackerItemSchema = z
  .object({
    task: z.string(),
    status: z.enum(['todo', 'doing', 'done', 'blocked']).optional(),
    priority: z.enum(['high', 'med', 'low']).optional(),
    owner: z.string().optional(),
    due: z.string().optional(),
  })
  .strict();
export const trackerSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    items: z.array(trackerItemSchema).optional(),
  })
  .strict();

// ─── prose ──────────────────────────────────────────────────────────────────
// Structured prose: a list of typed sub-blocks (heading / paragraph / list /
// quote). Use this when you want a section's body to be more structured than
// raw markdown allows.
const proseBlockSchema = z
  .object({
    type: z.enum(['h', 'p', 'ul', 'ol', 'quote']).optional(),
    text: z.string().optional(),
    items: z.array(z.string()).optional(),
  })
  .strict();
export const proseSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    blocks: z.array(proseBlockSchema).optional(),
  })
  .strict();

// ─── glossary ───────────────────────────────────────────────────────────────
const glossaryTermSchema = z.object({ term: z.string(), def: z.string() }).strict();
export const glossarySchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    terms: z.array(glossaryTermSchema).optional(),
  })
  .strict();

// ─── proscons ───────────────────────────────────────────────────────────────
export const prosconsSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    prosLabel: z.string().optional(),
    consLabel: z.string().optional(),
    pros: z.array(z.string()).optional(),
    cons: z.array(z.string()).optional(),
  })
  .strict();

// ─── cvt (current vs target) ────────────────────────────────────────────────
const cvtPanelSchema = z
  .object({
    label: z.string().optional(),
    items: z.array(z.string()).optional(),
  })
  .strict();
export const cvtSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    current: cvtPanelSchema.optional(),
    target: cvtPanelSchema.optional(),
    note: z.string().optional(),
  })
  .strict();

// ─── stats (KPI cards) ──────────────────────────────────────────────────────
const statSchema = z
  .object({
    value: z.union([z.string(), z.number()]),
    label: z.string(),
    delta: z.string().optional(),
    trend: z.enum(['up', 'down', 'flat']).optional(),
    accent: z.string().optional(),
  })
  .strict();
export const statsSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    stats: z.array(statSchema).optional(),
  })
  .strict();

// ─── code (one or more code blocks) ─────────────────────────────────────────
const codeEntrySchema = z
  .object({
    title: z.string().optional(),
    lang: z.string().optional(),
    code: z.string(),
  })
  .strict();
export const codeSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    blocks: z.array(codeEntrySchema).optional(),
  })
  .strict();

// ─── agenda ─────────────────────────────────────────────────────────────────
const agendaItemSchema = z
  .object({
    time: z.string().optional(),
    duration: z.string().optional(),
    title: z.string(),
    owner: z.string().optional(),
    desc: z.string().optional(),
  })
  .strict();
export const agendaSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    items: z.array(agendaItemSchema).optional(),
  })
  .strict();

// ─── tree (indented hierarchy) ──────────────────────────────────────────────
const treeNodeSchema = z
  .object({
    id: z.string(),
    parent: z.string().optional(),
    label: z.string(),
    note: z.string().optional(),
  })
  .strict();
export const treeSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    nodes: z.array(treeNodeSchema).optional(),
  })
  .strict();

// ─── pyramid ────────────────────────────────────────────────────────────────
const pyramidLevelSchema = z
  .object({ label: z.string(), desc: z.string().optional() })
  .strict();
export const pyramidSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    levels: z.array(pyramidLevelSchema).optional(),
  })
  .strict();


// ─── flow (flowchart) ───────────────────────────────────────────────────────
const flowNodeSchema = z
  .object({
    id: z.string(),
    col: z.number().optional(),
    row: z.number().optional(),
    w: z.number().optional(),
    label: z.string(),
    kind: z.enum(['start', 'end', 'decision', 'process']).optional(),
  })
  .strict();
const flowEdgeSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
    kind: z.enum(['error']).optional(),
  })
  .strict();
export const flowSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    nodes: z.array(flowNodeSchema).optional(),
    edges: z.array(flowEdgeSchema).optional(),
  })
  .strict();

// ─── state machine ──────────────────────────────────────────────────────────
const stateNodeSchema = z
  .object({
    id: z.string(),
    col: z.number().optional(),
    row: z.number().optional(),
    name: z.string().optional(),
    kind: z.enum(['start', 'terminal', 'active', 'wait']).optional(),
  })
  .strict();
const stateTransitionSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    event: z.string(),
    guard: z.string().optional(),
  })
  .strict();
export const stateSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    states: z.array(stateNodeSchema).optional(),
    transitions: z.array(stateTransitionSchema).optional(),
  })
  .strict();

// ─── dfd (data-flow diagram) ────────────────────────────────────────────────
const dfdNodeSchema = z
  .object({
    id: z.string(),
    col: z.number().optional(),
    row: z.number().optional(),
    name: z.string(),
    kind: z.enum(['process', 'external', 'store', 'datastore']).optional(),
    num: z.union([z.string(), z.number()]).optional(),
  })
  .strict();
const dfdEdgeSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
  })
  .strict();
export const dfdSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    nodes: z.array(dfdNodeSchema).optional(),
    edges: z.array(dfdEdgeSchema).optional(),
  })
  .strict();

// ─── journey map ────────────────────────────────────────────────────────────
const journeyStageSchema = z.object({ label: z.string() }).strict();
const journeyRowSchema = z
  .object({
    label: z.string(),
    cells: z.array(z.string()).optional(),
  })
  .strict();
export const journeySchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    stages: z.array(journeyStageSchema).optional(),
    rows: z.array(journeyRowSchema).optional(),
    emotion: z.array(z.number()).optional(),
  })
  .strict();

// ─── gantt ──────────────────────────────────────────────────────────────────
const ganttTaskSchema = z
  .object({
    label: z.string(),
    start: z.number().optional(),
    span: z.number().optional(),
    kind: z.enum(['done', 'active', 'current', 'milestone']).optional(),
  })
  .strict();
export const ganttSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    periods: z.array(z.string()).optional(),
    tasks: z.array(ganttTaskSchema).optional(),
  })
  .strict();

// ─── graph (node-link) ──────────────────────────────────────────────────────
// `state` colours a node for algorithm walkthroughs (BFS/DFS/Dijkstra visit
// order): visited · current · frontier · target. `weight` renders on the edge
// pill (combined with `label` as "label · w" when both are set).
const graphNodeSchema = z
  .object({
    id: z.string(),
    col: z.number().optional(),
    row: z.number().optional(),
    label: z.string(),
    group: z.number().optional(),
    state: z.enum(['visited', 'current', 'frontier', 'target']).optional(),
  })
  .strict();
const graphEdgeSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
    dir: z.enum(['directed', 'undirected']).optional(),
    weight: z.number().optional(),
  })
  .strict();
export const graphSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    nodes: z.array(graphNodeSchema).optional(),
    edges: z.array(graphEdgeSchema).optional(),
  })
  .strict();

// ─── quadrant (2x2 matrix) ──────────────────────────────────────────────────
const quadrantAxisSchema = z
  .object({
    label: z.string().optional(),
    low: z.string().optional(),
    high: z.string().optional(),
  })
  .strict();
const quadrantItemSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    label: z.string(),
  })
  .strict();
export const quadrantSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    xAxis: quadrantAxisSchema.optional(),
    yAxis: quadrantAxisSchema.optional(),
    items: z.array(quadrantItemSchema).optional(),
  })
  .strict();

// ─── swimlane (cross-functional process) ────────────────────────────────────
const swimlaneLaneSchema = z.object({ label: z.string() }).strict();
const swimlaneStepSchema = z
  .object({
    id: z.string(),
    col: z.number(),
    lane: z.number(),
    label: z.string(),
    kind: z.enum(['action', 'decision', 'start', 'end', 'wait']).optional(),
  })
  .strict();
const swimlaneLinkSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
  })
  .strict();
export const swimlaneSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    lanes: z.array(swimlaneLaneSchema).optional(),
    steps: z.array(swimlaneStepSchema).optional(),
    links: z.array(swimlaneLinkSchema).optional(),
  })
  .strict();

// ─── c4 (context / container / component) ───────────────────────────────────
const c4NodeSchema = z
  .object({
    id: z.string(),
    col: z.number().optional(),
    row: z.number().optional(),
    w: z.number().optional(),
    kind: z.enum(['person', 'system', 'external', 'store', 'container', 'component']),
    family: z.string().optional(),
    name: z.string(),
    tech: z.string().optional(),
    desc: z.string().optional(),
  })
  .strict();
const c4EdgeSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
    tech: z.string().optional(),
    kind: z.enum(['solid', 'dashed', 'forbidden', 'error']).optional(),
  })
  .strict();
const c4BoundarySchema = z.object({ label: z.string() }).strict();
// A named boundary box drawn around an explicit set of node ids — lets one
// diagram show several systems/zones, unlike the single auto-fit `boundary`.
const c4NamedBoundarySchema = z
  .object({
    label: z.string(),
    nodes: z.array(z.string()),
    color: z.string().optional(),
  })
  .strict();
export const c4Schema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    level: z.enum(['context', 'container', 'component']).optional(),
    boundary: c4BoundarySchema.optional(),
    boundaries: z.array(c4NamedBoundarySchema).optional(),
    nodes: z.array(c4NodeSchema).optional(),
    edges: z.array(c4EdgeSchema).optional(),
  })
  .strict();

// ─── uml class diagram ──────────────────────────────────────────────────────
const umlClassSchema = z
  .object({
    id: z.string(),
    col: z.number().optional(),
    row: z.number().optional(),
    name: z.string(),
    stereotype: z.string().optional(),
    attrs: z.array(z.string()).optional(),
    methods: z.array(z.string()).optional(),
  })
  .strict();
const umlRelSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
    kind: z
      .enum([
        'inheritance',
        'extends',
        'implementation',
        'implements',
        'composition',
        'aggregation',
        'dependency',
        'association',
      ])
      .optional(),
  })
  .strict();
export const umlSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    classes: z.array(umlClassSchema).optional(),
    rels: z.array(umlRelSchema).optional(),
  })
  .strict();

// ─── mece (issue tree) ──────────────────────────────────────────────────────
const meceNodeSchema = z
  .object({
    id: z.string(),
    parent: z.string().optional(),
    label: z.string(),
    note: z.string().optional(),
  })
  .strict();
export const meceSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    nodes: z.array(meceNodeSchema).optional(),
  })
  .strict();

// ─── frontend (component tree) ──────────────────────────────────────────────
const ftNodeSchema = z
  .object({
    id: z.string(),
    parent: z.string().optional(),
    name: z.string(),
    kind: z
      .enum([
        'root',
        'layout',
        'page',
        'component',
        'leaf',
        'provider',
        'context',
        'hook',
        'store',
        'state',
      ])
      .optional(),
    note: z.string().optional(),
  })
  .strict();
export const frontendSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    nodes: z.array(ftNodeSchema).optional(),
  })
  .strict();

// ─── cluster (Kubernetes-style) ─────────────────────────────────────────────
const clusterClusterSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    kind: z.string().optional(),
  })
  .strict();
const clusterServiceSchema = z
  .object({
    id: z.string(),
    cluster: z.string(),
    label: z.string(),
    kind: z.string().optional(),
    tech: z.string().optional(),
    replicas: z.number().optional(),
  })
  .strict();
const clusterEdgeSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
    kind: z.enum(['solid', 'dashed', 'forbidden', 'error']).optional(),
  })
  .strict();
export const clusterSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    clusters: z.array(clusterClusterSchema).optional(),
    services: z.array(clusterServiceSchema).optional(),
    edges: z.array(clusterEdgeSchema).optional(),
  })
  .strict();

// ─── block-graph (block / infra / event / ddd / network) ────────────────────
// Two layout modes share one schema: if `layers` is present, nodes use `layer`
// to indicate which horizontal band they belong to; otherwise the grid layout
// uses `col` + `row` (+ optional `w` span).
const blockGraphGroupSchema = z
  .object({
    id: z.string().optional(),
    col: z.number(),
    row: z.number(),
    cols: z.number().optional(),
    rows: z.number().optional(),
    label: z.string(),
    color: z.string().optional(),
  })
  .strict();
const blockGraphLayerSchema = z
  .object({ label: z.string(), color: z.string().optional() })
  .strict();
const blockGraphNodeSchema = z
  .object({
    id: z.string(),
    col: z.number().optional(),
    row: z.number().optional(),
    layer: z.number().optional(),
    w: z.number().optional(),
    kind: z.string().optional(),
    name: z.string(),
    tech: z.string().optional(),
  })
  .strict();
const blockGraphEdgeSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
    kind: z.enum(['solid', 'dashed', 'forbidden', 'error']).optional(),
  })
  .strict();
export const blockGraphSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    systemLabel: z.string().optional(),
    layers: z.array(blockGraphLayerSchema).optional(),
    groups: z.array(blockGraphGroupSchema).optional(),
    nodes: z.array(blockGraphNodeSchema).optional(),
    edges: z.array(blockGraphEdgeSchema).optional(),
  })
  .strict();

// ─── felogic (frontend/backend module graph) ────────────────────────────────
const feLogicNodeSchema = z
  .object({
    id: z.string(),
    col: z.number().optional(),
    row: z.number().optional(),
    w: z.number().optional(),
    kind: z.string().optional(),
    name: z.string(),
    note: z.string().optional(),
  })
  .strict();
const feLogicEdgeSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
    kind: z
      .enum(['uses', 'implements', 'reads', 'egress', 'https', 'api', 'dashed', 'async'])
      .optional(),
  })
  .strict();
export const felogicSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    groups: z.array(blockGraphGroupSchema).optional(),
    nodes: z.array(feLogicNodeSchema).optional(),
    edges: z.array(feLogicEdgeSchema).optional(),
  })
  .strict();

// `dag` reuses the flow schema (same shape, different visual frame).
export const dagSchema = flowSchema;

// ─── wireframe (UI mockups: desktop / browser / phone) ──────────────────────
// A vertical stack of low-fidelity UI elements inside a device frame. Each
// screen picks a `device` frame; `elements` are laid out top-to-bottom.
const wireframeElementSchema = z
  .object({
    type: z
      .enum([
        'header',
        'subheader',
        'text',
        'button',
        'input',
        'search',
        'image',
        'avatar',
        'card',
        'list',
        'nav',
        'tabs',
        'divider',
        'badge',
        'toggle',
        'spacer',
      ])
      .optional(),
    label: z.string().optional(),
    rows: z.number().optional(),
    align: z.enum(['l', 'c', 'r']).optional(),
    tone: z.enum(['accent', 'muted', 'danger']).optional(),
  })
  .strict();
const wireframeScreenSchema = z
  .object({
    device: z.enum(['desktop', 'browser', 'phone']).optional(),
    title: z.string().optional(),
    url: z.string().optional(),
    label: z.string().optional(),
    elements: z.array(wireframeElementSchema).optional(),
  })
  .strict();
export const wireframeSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    screens: z.array(wireframeScreenSchema).optional(),
  })
  .strict();

// ─── endpoint (Swagger-style API endpoint card) ─────────────────────────────
// One HTTP operation: method + path, parameters, request body, responses, and
// optional request/response examples.
const endpointParamSchema = z
  .object({
    name: z.string(),
    in: z.enum(['path', 'query', 'header', 'cookie']).optional(),
    type: z.string().optional(),
    required: z.boolean().optional(),
    desc: z.string().optional(),
  })
  .strict();
const endpointFieldSchema = z
  .object({
    name: z.string(),
    type: z.string().optional(),
    required: z.boolean().optional(),
    desc: z.string().optional(),
  })
  .strict();
const endpointResponseSchema = z
  .object({
    status: z.union([z.string(), z.number()]),
    desc: z.string().optional(),
    example: z.string().optional(),
  })
  .strict();
export const endpointSchema = z
  .object({
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
    path: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    auth: z.string().optional(),
    params: z.array(endpointParamSchema).optional(),
    body: z.array(endpointFieldSchema).optional(),
    responses: z.array(endpointResponseSchema).optional(),
    request: z.string().optional(),
    response: z.string().optional(),
  })
  .strict();

// ─── pullquote ──────────────────────────────────────────────────────────────
// A standout pull-quote with optional attribution.
export const pullquoteSchema = z
  .object({
    text: z.string(),
    attribution: z.string().optional(),
  })
  .strict();

// ─── layers (a layered explanation: N numbered layers) ──────────────────────
const layerItemSchema = z
  .object({
    title: z.string(),
    kicker: z.string().optional(),
    source: z.string().optional(),
    question: z.string().optional(),
    body: z.string().optional(),
  })
  .strict();
export const layersSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    items: z.array(layerItemSchema).optional(),
  })
  .strict();

// ─── matrix (role × resource capability grid) ───────────────────────────────
// A grid of rows (e.g. roles) × columns (e.g. apps/resources), each cell a
// capability value ("Full", "Read", "—", "✓"). Cells are coloured by value.
const matrixRowSchema = z
  .object({
    label: z.string(),
    cells: z.array(z.string()),
  })
  .strict();
export const matrixSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    corner: z.string().optional(),
    cols: z.array(z.string()).min(1),
    rows: z.array(matrixRowSchema).min(1),
  })
  .strict();

// ─── anatomy (the parts of a structured string, e.g. a permission) ──────────
// Breaks a delimited string (e.g. `app:feature:action`) into labelled, coloured
// segments — like a Swagger-style anatomy of one identifier.
const anatomyPartSchema = z
  .object({
    label: z.string(),
    value: z.string(),
    note: z.string().optional(),
  })
  .strict();
export const anatomySchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    separator: z.string().optional(),
    parts: z.array(anatomyPartSchema).min(1),
  })
  .strict();

// ─── composition (layered gates intersected into an effective result) ───────
// Effective access = gate₁ ∩ gate₂ ∩ … — a row of gate cards joined by ∩,
// resolving to a single result.
const compositionGateSchema = z
  .object({
    label: z.string(),
    desc: z.string().optional(),
    kicker: z.string().optional(),
    source: z.string().optional(),
  })
  .strict();
export const compositionSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    result: z.string().optional(),
    gates: z.array(compositionGateSchema).min(1),
  })
  .strict();

// Shared accent palette for presentation cards.
const accentEnum = z.enum(['navy', 'blue', 'teal', 'green', 'amber', 'purple', 'red', 'gray']);

// ─── drivers (a grid of factor/driver cards with an icon + accent) ──────────
const driverItemSchema = z
  .object({
    title: z.string(),
    body: z.string().optional(),
    tag: z.string().optional(),
    icon: z.string().optional(),
    accent: accentEnum.optional(),
  })
  .strict();
export const driversSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    items: z.array(driverItemSchema).min(1),
  })
  .strict();

// ─── options (approaches/options explored: pros, cons, verdict per card) ────
const optionItemSchema = z
  .object({
    title: z.string(),
    kicker: z.string().optional(),
    how: z.string().optional(),
    pros: z.array(z.string()).optional(),
    cons: z.array(z.string()).optional(),
    verdict: z.string().optional(),
    tone: z.enum(['rejected', 'viable', 'chosen', 'warn', 'neutral']).optional(),
  })
  .strict();
export const optionsSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    items: z.array(optionItemSchema).min(1),
  })
  .strict();

// ─── spec (a labelled spec sheet; each row is a label → value or step flow) ─
const specRowSchema = z
  .object({
    label: z.string(),
    value: z.string().optional(),
    steps: z.array(z.string()).optional(),
  })
  .strict();
export const specSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    accent: accentEnum.optional(),
    rows: z.array(specRowSchema).min(1),
  })
  .strict();

// ─── list (a fancy bullet list: accent / check / icon / number styles) ──────
const listItemSchema = z
  .object({
    lead: z.string(),
    text: z.string().optional(),
    icon: z.string().optional(),
    accent: accentEnum.optional(),
    done: z.boolean().optional(),
  })
  .strict();
export const listSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    style: z.enum(['accent', 'check', 'icon', 'number']).optional(),
    accent: accentEnum.optional(),
    items: z.array(listItemSchema).min(1),
  })
  .strict();

// ─── stories (a collapsible backlog of user stories, one section) ────────────
const storyItemSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    role: z.string().optional(),
    want: z.string().optional(),
    soThat: z.string().optional(),
    priority: z.string().optional(),
    points: z.number().optional(),
    tags: z.array(z.string()).optional(),
    criteria: z.array(criterionSchema).optional(),
    links: z.array(linkSchema).optional(),
    open: z.boolean().optional(),
  })
  .strict();
export const storiesSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    items: z.array(storyItemSchema).min(1),
  })
  .strict();

// ─── pattern (a design-pattern card: intent · forces · participants · …) ────
const patternParticipantSchema = z
  .object({
    name: z.string(),
    role: z.string().optional(),
  })
  .strict();
export const patternSchema = z
  .object({
    name: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    intent: z.string().optional(),
    forces: z.array(z.string()).optional(),
    solution: z.string().optional(),
    structure: z.string().optional(),
    participants: z.array(patternParticipantSchema).optional(),
    consequences: z
      .object({
        pros: z.array(z.string()).optional(),
        cons: z.array(z.string()).optional(),
      })
      .strict()
      .optional(),
    note: z.string().optional(),
  })
  .strict();

// ─── gallery (a grid of cells: code, a note, or a nested diagram) ───────────
const galleryItemSchema = z
  .object({
    title: z.string().optional(),
    code: z.string().optional(),
    lang: z.string().optional(),
    caption: z.string().optional(),
    accent: accentEnum.optional(),
    // A nested block, e.g. `{ type: c4, ...c4 data }` — lets a cell hold a whole
    // diagram so you can compare architectures in a grid. Validated below.
    block: z.object({ type: z.string() }).passthrough().optional(),
  })
  .strict();
export const gallerySchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    cols: z.number().optional(),
    items: z.array(galleryItemSchema).min(1),
  })
  .strict()
  // Validate each nested `block` against its real block schema, so a diagram in a
  // cell is checked exactly like a top-level one.
  .superRefine((val, ctx) => {
    val.items.forEach((it, i) => {
      const b = it.block;
      if (b === undefined) return;
      const sub = (blockSchemas as Record<string, z.ZodTypeAny>)[b.type];
      if (sub === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', i, 'block', 'type'],
          message: `Unknown block type "${b.type}"`,
        });
        return;
      }
      const data: Record<string, unknown> = { ...b };
      delete data.type;
      const res = sub.safeParse(data);
      if (!res.success) {
        for (const issue of res.error.issues) {
          ctx.addIssue({ ...issue, path: ['items', i, 'block', ...issue.path] });
        }
      }
    });
  });

// ─── chart (declarative data chart: bar / line / area / donut) ──────────────
// `labels` + `series` drive bar / line / area; `items` drives donut. Values
// are plain numbers; `unit` is an optional display suffix (ms, %, $) and
// `max` caps the y-axis instead of auto-scaling to the data.
const chartSeriesSchema = z
  .object({
    label: z.string(),
    accent: accentEnum.optional(),
    values: z.array(z.number()),
  })
  .strict();
const chartItemSchema = z
  .object({
    label: z.string(),
    value: z.number(),
    accent: accentEnum.optional(),
  })
  .strict();
export const chartSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    lede: z.string().optional(),
    kind: z.enum(['bar', 'line', 'area', 'donut', 'radar']).optional(),
    labels: z.array(z.string()).optional(),
    series: z.array(chartSeriesSchema).optional(),
    items: z.array(chartItemSchema).optional(),
    unit: z.string().optional(),
    max: z.number().optional(),
  })
  .strict();

// ─── figure (an image with a caption) ───────────────────────────────────────
export const figureSchema = z
  .object({
    src: z.string(),
    alt: z.string().optional(),
    caption: z.string().optional(),
    width: z.number().optional(),
  })
  .strict();

// ─── diff (a unified diff on the dark editor surface) ───────────────────────
// `code` is unified-diff text: lines starting `+` are additions, `-` removals,
// `@@` hunk headers; everything else is context.
export const diffSchema = z
  .object({
    title: z.string().optional(),
    lang: z.string().optional(),
    code: z.string(),
  })
  .strict();

// ─── steps (a numbered how-to / runbook stepper) ────────────────────────────
const stepItemSchema = z
  .object({
    title: z.string(),
    body: z.string().optional(),
    code: z.string().optional(),
    lang: z.string().optional(),
    note: z.string().optional(),
  })
  .strict();
export const stepsSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    items: z.array(stepItemSchema).min(1),
  })
  .strict();

// ─── faq (Q&A accordions, native <details>) ─────────────────────────────────
const faqItemSchema = z
  .object({
    q: z.string(),
    a: z.string(),
    open: z.boolean().optional(),
  })
  .strict();
export const faqSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    items: z.array(faqItemSchema).min(1),
  })
  .strict();

// ─── envelope (back-of-envelope capacity math) ──────────────────────────────
// `assumptions` are the givens (label over value), `steps` the derivation rows
// (label · calc · result), and `result` the highlighted bottom line.
const envelopeAssumptionSchema = z
  .object({
    label: z.string(),
    value: z.string(),
  })
  .strict();
const envelopeStepSchema = z
  .object({
    label: z.string(),
    calc: z.string(),
    result: z.string(),
  })
  .strict();
const envelopeResultSchema = z
  .object({
    label: z.string(),
    value: z.string(),
  })
  .strict();
export const envelopeSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    assumptions: z.array(envelopeAssumptionSchema).min(1),
    steps: z.array(envelopeStepSchema).min(1),
    result: envelopeResultSchema.optional(),
  })
  .strict();

// ─── slo (service-level objectives with error budgets) ─────────────────────
// `budget` is the fraction of the error budget CONSUMED (0..1; values above 1
// render as exhausted). Omit it to skip the burn bar.
const sloItemSchema = z
  .object({
    name: z.string(),
    sli: z.string(),
    target: z.string(),
    current: z.string().optional(),
    window: z.string().optional(),
    budget: z.number().min(0).optional(),
  })
  .strict();
export const sloSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    items: z.array(sloItemSchema).min(1),
  })
  .strict();

// ─── terminal (a shell session on the dark surface) ─────────────────────────
// `session` is plain text, parsed per line: `$ ` prefixes a command, `# ` a
// comment; every other line is program output.
export const terminalSchema = z
  .object({
    title: z.string().optional(),
    session: z.string(),
  })
  .strict();

// ─── swot (classic strengths / weaknesses / opportunities / threats 2×2) ────
// Four plain string lists — one per quadrant. Omit a quadrant you have no
// content for; the grid always draws all four so the shape reads as a SWOT.
export const swotSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    strengths: z.array(z.string()).optional(),
    weaknesses: z.array(z.string()).optional(),
    opportunities: z.array(z.string()).optional(),
    threats: z.array(z.string()).optional(),
  })
  .strict();

// ─── funnel (conversion funnel) ─────────────────────────────────────────────
// Vertically stacked bands, each width proportional to `value`; a conversion
// chip between bands shows stage-to-stage retention. `unit` suffixes values.
const funnelStageSchema = z
  .object({
    label: z.string(),
    value: z.number(),
    desc: z.string().optional(),
  })
  .strict();
export const funnelSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    stages: z.array(funnelStageSchema).min(1),
    unit: z.string().optional(),
  })
  .strict();

// ─── okr (objectives + key results) ─────────────────────────────────────────
// One card per objective; each key result carries a 0..1 `progress` and an
// optional status that colours its progress bar.
const okrKrSchema = z
  .object({
    kr: z.string(),
    progress: z.number(),
    status: z.enum(['on-track', 'at-risk', 'off-track', 'done']).optional(),
  })
  .strict();
const okrItemSchema = z
  .object({
    objective: z.string(),
    owner: z.string().optional(),
    krs: z.array(okrKrSchema).min(1),
  })
  .strict();
export const okrSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    items: z.array(okrItemSchema).min(1),
  })
  .strict();

// ─── persona (user persona cards) ───────────────────────────────────────────
const personaItemSchema = z
  .object({
    name: z.string(),
    role: z.string().optional(),
    quote: z.string().optional(),
    goals: z.array(z.string()).optional(),
    frustrations: z.array(z.string()).optional(),
    tools: z.array(z.string()).optional(),
    accent: accentEnum.optional(),
  })
  .strict();
export const personaSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    personas: z.array(personaItemSchema).min(1),
  })
  .strict();

// ─── changelog (release history) ────────────────────────────────────────────
// A vertical rail of releases; each item can carry a keep-a-changelog-style
// type chip (added / changed / fixed / removed / security).
const changelogItemSchema = z
  .object({
    type: z.enum(['added', 'changed', 'fixed', 'removed', 'security']).optional(),
    text: z.string(),
  })
  .strict();
const changelogReleaseSchema = z
  .object({
    version: z.string(),
    date: z.string().optional(),
    tag: z.enum(['major', 'minor', 'patch', 'breaking']).optional(),
    items: z.array(changelogItemSchema),
  })
  .strict();
export const changelogSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    releases: z.array(changelogReleaseSchema).min(1),
  })
  .strict();

// ─── team (people cards) ────────────────────────────────────────────────────
const teamMemberSchema = z
  .object({
    name: z.string(),
    role: z.string().optional(),
    focus: z.string().optional(),
    initials: z.string().optional(),
    accent: accentEnum.optional(),
  })
  .strict();
export const teamSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    members: z.array(teamMemberSchema).min(1),
  })
  .strict();

// ─── waterfall (budget cascade) ─────────────────────────────────────────────
// Horizontal cascading bars: each item starts where the previous total ended
// and spans its `value`; a final TOTAL bar spans the whole run. An optional
// `budget` draws a dashed cap line — anything past it tints negative.
const waterfallItemSchema = z
  .object({
    label: z.string(),
    value: z.number(),
    desc: z.string().optional(),
  })
  .strict();
export const waterfallSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    unit: z.string().optional(),
    budget: z.number().optional(),
    items: z.array(waterfallItemSchema).min(1),
  })
  .strict();

// ─── heatmap (numeric grid with an intensity ramp) ──────────────────────────
// `xLabels` name the columns; each row carries one value per column. Tiles
// tint on a single-hue ramp between the data min and max (or the explicit
// `min`/`max` bounds). Short rows pad missing cells as blank tiles.
const heatmapRowSchema = z
  .object({
    label: z.string(),
    values: z.array(z.number()),
  })
  .strict();
export const heatmapSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    xLabels: z.array(z.string()).min(1),
    rows: z.array(heatmapRowSchema).min(1),
    unit: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .strict();

// ─── scorecard (weighted decision matrix) ───────────────────────────────────
// Criteria as rows (each with an optional weight, default 1), one column per
// option; each option carries one score per criterion (0-5 scale expected).
// The footer shows the weighted total per option; the winner is highlighted.
const scorecardCriterionSchema = z
  .object({
    label: z.string(),
    weight: z.number().optional(),
  })
  .strict();
const scorecardOptionSchema = z
  .object({
    label: z.string(),
    scores: z.array(z.number()),
    note: z.string().optional(),
  })
  .strict();
export const scorecardSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    criteria: z.array(scorecardCriterionSchema).min(1),
    options: z.array(scorecardOptionSchema).min(1),
  })
  .strict();

// ─── risk (risk register) ───────────────────────────────────────────────────
// One row-card per risk. Severity derives from likelihood × impact — both
// high → critical, one high → high, both low → low, everything else medium.
const riskItemSchema = z
  .object({
    risk: z.string(),
    likelihood: z.enum(['low', 'med', 'high']),
    impact: z.enum(['low', 'med', 'high']),
    mitigation: z.string().optional(),
    owner: z.string().optional(),
    status: z.enum(['open', 'mitigating', 'accepted', 'closed']).optional(),
  })
  .strict();
export const riskSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    items: z.array(riskItemSchema).min(1),
  })
  .strict();

// ─── palette (colour-token swatches) ────────────────────────────────────────
// A responsive card grid of colour swatches. `value` is a hex string (quote it
// in YAML — `#` starts a comment); `on` optionally overrides the label colour
// shown inside the swatch (otherwise it auto-contrasts from the hex).
const paletteColorSchema = z
  .object({
    name: z.string(),
    value: z.string(),
    on: z.string().optional(),
    usage: z.string().optional(),
  })
  .strict();
export const paletteSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    cols: z.number().optional(),
    colors: z.array(paletteColorSchema).min(1),
  })
  .strict();

// ─── typescale (live type specimen) ─────────────────────────────────────────
// One row per style: a meta column (name, size / weight, note) and the sample
// text rendered live at the row's size, weight, line-height, and font family.
const typescaleItemSchema = z
  .object({
    name: z.string(),
    size: z.number(),
    weight: z.number().optional(),
    lineHeight: z.number().optional(),
    font: z.enum(['display', 'body', 'mono']).optional(),
    note: z.string().optional(),
  })
  .strict();
export const typescaleSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    sample: z.string().optional(),
    items: z.array(typescaleItemSchema).min(1),
  })
  .strict();

// ─── dodont (do / don't guideline cards) ────────────────────────────────────
// Two cards side by side: DO (green) and DON'T (red). Each item is a guideline
// with an optional mono `example` chip rendered beneath it.
const dodontItemSchema = z
  .object({
    text: z.string(),
    example: z.string().optional(),
  })
  .strict();
export const dodontSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    dos: z.array(dodontItemSchema).min(1),
    donts: z.array(dodontItemSchema).min(1),
  })
  .strict();

// ─── inventory (component / feature status board) ───────────────────────────
// Compact hairline-separated rows: name (+ optional mono tag chip), a note,
// and a right-aligned colour-coded status chip.
const inventoryItemSchema = z
  .object({
    name: z.string(),
    status: z.enum(['stable', 'beta', 'experimental', 'deprecated', 'planned']),
    tag: z.string().optional(),
    note: z.string().optional(),
  })
  .strict();
export const inventorySchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    items: z.array(inventoryItemSchema).min(1),
  })
  .strict();

// Shared tone enum for the algorithms & data-structures family. Tints one
// cell / node / entry so a walkthrough step reads at a glance: `active` is the
// element being examined, `visited` has been processed, `target` is the goal,
// `muted` is out of play.
const dsToneEnum = z.enum(['active', 'visited', 'target', 'muted']);

// ─── array (array cells for algorithm walkthroughs) ─────────────────────────
// `items[].value` is a string — quote numbers. `label` renders a pointer
// marker BELOW the cell (e.g. "i", "mid"); `window` highlights a 0-based
// inclusive index range (out-of-bounds values clamp).
const arrayItemSchema = z
  .object({
    value: z.string(),
    tone: dsToneEnum.optional(),
    label: z.string().optional(),
  })
  .strict();
const arrayWindowSchema = z
  .object({
    from: z.number(),
    to: z.number(),
    label: z.string().optional(),
  })
  .strict();
export const arraySchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    items: z.array(arrayItemSchema).optional(),
    window: arrayWindowSchema.optional(),
    showIndex: z.boolean().optional(),
  })
  .strict();

// ─── linkedlist (pointer-chain diagram) ─────────────────────────────────────
// `label` renders a marker ABOVE the node (e.g. "head", "curr"). `kind:
// doubly` adds back-arrows; `nullEnd` (default true) draws the ∅ terminator.
const linkedlistNodeSchema = z
  .object({
    value: z.string(),
    tone: dsToneEnum.optional(),
    label: z.string().optional(),
  })
  .strict();
export const linkedlistSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    kind: z.enum(['singly', 'doubly']).optional(),
    nodes: z.array(linkedlistNodeSchema).optional(),
    nullEnd: z.boolean().optional(),
  })
  .strict();

// ─── bintree (binary tree) ──────────────────────────────────────────────────
// Nodes reference their `parent` by id and MUST say which `side` (left/right)
// they occupy — validated below. Nodes without a parent are roots (multiple
// roots lay out side by side).
const bintreeNodeSchema = z
  .object({
    id: z.string(),
    value: z.string(),
    parent: z.string().optional(),
    side: z.enum(['left', 'right']).optional(),
    tone: dsToneEnum.optional(),
  })
  .strict();
export const bintreeSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    nodes: z.array(bintreeNodeSchema).optional(),
  })
  .strict()
  // A child must say which slot it fills, and a parent can hold at most one
  // child per side — both are authoring errors worth catching early.
  .superRefine((val, ctx) => {
    const seen = new Set<string>();
    (val.nodes ?? []).forEach((n, i) => {
      if (n.parent !== undefined && n.side === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nodes', i, 'side'],
          message: `Node "${n.id}" has a parent but no side — set side: left or side: right`,
        });
        return;
      }
      if (n.parent === undefined) return;
      const slot = `${n.parent}::${n.side ?? ''}`;
      if (seen.has(slot)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nodes', i, 'side'],
          message: `Parent "${n.parent}" already has a ${n.side ?? ''} child`,
        });
        return;
      }
      seen.add(slot);
    });
  });

// ─── hashmap (buckets + chained entries) ────────────────────────────────────
// `buckets` is the bucket count (slots render 0..N-1, capped at 12 with a
// "+N more" note). Entries whose `bucket` falls outside 0..N-1 are skipped.
const hashmapEntrySchema = z
  .object({
    key: z.string(),
    value: z.string().optional(),
    bucket: z.number(),
    tone: dsToneEnum.optional(),
  })
  .strict();
export const hashmapSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    buckets: z.number(),
    entries: z.array(hashmapEntrySchema).optional(),
  })
  .strict();

// ─── agentloop (the canonical agent-loop diagram) ───────────────────────────
// One agent card in the middle, the environment (user) on the left, a column
// of tools on the right, and a memory cylinder beneath — joined by the
// numbered loop: ① prompt → ② tool call → ③ result → ④ response. `stop` is
// the loop's termination condition, rendered as a foot pill.
const agentloopAgentSchema = z
  .object({
    name: z.string(),
    model: z.string().optional(),
    note: z.string().optional(),
  })
  .strict();
const agentloopToolSchema = z
  .object({
    name: z.string(),
    desc: z.string().optional(),
  })
  .strict();
export const agentloopSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    agent: agentloopAgentSchema,
    tools: z.array(agentloopToolSchema).optional(),
    memory: z.array(z.string()).optional(),
    env: z.string().optional(),
    stop: z.string().optional(),
  })
  .strict();

// ─── trace (agent / session execution transcript) ───────────────────────────
// A vertical transcript, one entry per turn. `thinking` renders before `text`
// on assistant turns; tool turns carry `tool` (the tool name) plus `args` and
// `result` as mono lines. Multi-line strings preserve their line breaks.
const traceTurnSchema = z
  .object({
    role: z.enum(['user', 'assistant', 'tool', 'system']),
    text: z.string().optional(),
    thinking: z.string().optional(),
    tool: z.string().optional(),
    args: z.string().optional(),
    result: z.string().optional(),
  })
  .strict();
export const traceSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    turns: z.array(traceTurnSchema).min(1),
  })
  .strict();

// ─── prompt (prompt anatomy with variable highlighting) ─────────────────────
// Stacked cards, one per segment (system / user / assistant / tool). Any
// `{{variable}}` token inside `text` renders as a highlighted chip; `vars`
// documents those variables in a legend beneath. Quote text containing
// `{{ }}` in YAML — flow-style braces otherwise parse as a map.
const promptSegmentSchema = z
  .object({
    kind: z.enum(['system', 'user', 'assistant', 'tool']),
    label: z.string().optional(),
    text: z.string(),
  })
  .strict();
const promptVarSchema = z
  .object({
    name: z.string(),
    desc: z.string().optional(),
  })
  .strict();
export const promptSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    segments: z.array(promptSegmentSchema).min(1),
    vars: z.array(promptVarSchema).optional(),
  })
  .strict();

// ─── context (context-window token budget) ──────────────────────────────────
// One horizontal stacked bar sized against `window` (the total budget).
// Remaining space renders as a dim "free" segment; when the segments sum past
// the window, the overflow tints negative past a marked boundary. Zero-token
// segments are skipped.
const contextSegmentSchema = z
  .object({
    label: z.string(),
    tokens: z.number(),
    accent: accentEnum.optional(),
    desc: z.string().optional(),
  })
  .strict();
export const contextSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    window: z.number(),
    unit: z.string().optional(),
    segments: z.array(contextSegmentSchema),
  })
  .strict();

// ─── archmap (target-architecture capability map) ───────────────────────────
// The classic enterprise-architecture one-pager: a square mosaic of tinted
// domain areas, each packed with small capability/system tiles. A plain-string
// item is a current/steady capability; an object item can carry a status —
// target (to be built), new (just added), gap (missing), deprecated (retiring).
// `cols` sets areas per row (default 3, clamped 2-4 at render time).
const archmapTileSchema = z
  .object({
    name: z.string(),
    status: z.enum(['target', 'new', 'gap', 'deprecated']).optional(),
  })
  .strict();
const archmapAreaSchema = z
  .object({
    label: z.string(),
    accent: accentEnum.optional(),
    desc: z.string().optional(),
    items: z.array(z.union([z.string(), archmapTileSchema])).optional(),
  })
  .strict();
export const archmapSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    cols: z.number().optional(),
    areas: z.array(archmapAreaSchema).min(1),
  })
  .strict();

// ─── divider (a full-width section-break band) ──────────────────────────────
// The interstitial slide of a deck ("PART 2 — The fix") or a visual chapter
// break in a long document: an optional mono kicker, a display title, and an
// optional subtitle, centered on a subtle accent-washed band.
export const dividerSchema = z
  .object({
    kicker: z.string().optional(),
    title: z.string(),
    subtitle: z.string().optional(),
    accent: accentEnum.optional(),
  })
  .strict();

// ─── bignumber (one hero metric at presentation scale) ──────────────────────
// A single number big enough to carry a slide: the value, a one-line claim
// (`label`), an optional smaller `context` line, and an optional delta with an
// up/down/flat trend arrow (arrow is neutral gray — "down" is often good).
export const bignumberSchema = z
  .object({
    value: z.string(),
    label: z.string(),
    context: z.string().optional(),
    delta: z.string().optional(),
    trend: z.enum(['up', 'down', 'flat']).optional(),
    accent: accentEnum.optional(),
  })
  .strict();

// ─── takeaways (the 2-6 things to remember) ─────────────────────────────────
// The closing slide of a good deck: numbered rows at presentation scale, each
// a bold one-liner with an optional smaller detail line beneath.
const takeawayItemSchema = z
  .object({
    text: z.string(),
    detail: z.string().optional(),
  })
  .strict();
export const takeawaysSchema = z
  .object({
    title: z.string().optional(),
    items: z.array(takeawayItemSchema).min(2).max(6),
    accent: accentEnum.optional(),
  })
  .strict();

// ─── registry source-of-truth ───────────────────────────────────────────────
/**
 * The schema map. `as const satisfies Record<BlockType, ...>` enforces that
 * every {@link BlockType} has an entry — omitting one is a compile error.
 */
export const blockSchemas = {
  meta: metaSchema,
  callout: calloutSchema,
  table: tableSchema,
  sequence: sequenceSchema,
  erd: erdSchema,
  userstory: userstorySchema,
  timeline: timelineSchema,
  kanban: kanbanSchema,
  tracker: trackerSchema,
  prose: proseSchema,
  glossary: glossarySchema,
  proscons: prosconsSchema,
  cvt: cvtSchema,
  stats: statsSchema,
  code: codeSchema,
  agenda: agendaSchema,
  tree: treeSchema,
  pyramid: pyramidSchema,
  flow: flowSchema,
  state: stateSchema,
  dfd: dfdSchema,
  journey: journeySchema,
  gantt: ganttSchema,
  graph: graphSchema,
  quadrant: quadrantSchema,
  swimlane: swimlaneSchema,
  c4: c4Schema,
  uml: umlSchema,
  mece: meceSchema,
  frontend: frontendSchema,
  cluster: clusterSchema,
  block: blockGraphSchema,
  infra: blockGraphSchema,
  event: blockGraphSchema,
  ddd: blockGraphSchema,
  network: blockGraphSchema,
  felogic: felogicSchema,
  belogic: felogicSchema,
  dag: dagSchema,
  wireframe: wireframeSchema,
  endpoint: endpointSchema,
  pullquote: pullquoteSchema,
  layers: layersSchema,
  matrix: matrixSchema,
  anatomy: anatomySchema,
  composition: compositionSchema,
  drivers: driversSchema,
  options: optionsSchema,
  spec: specSchema,
  list: listSchema,
  stories: storiesSchema,
  pattern: patternSchema,
  gallery: gallerySchema,
  chart: chartSchema,
  figure: figureSchema,
  diff: diffSchema,
  steps: stepsSchema,
  faq: faqSchema,
  envelope: envelopeSchema,
  slo: sloSchema,
  terminal: terminalSchema,
  swot: swotSchema,
  funnel: funnelSchema,
  okr: okrSchema,
  persona: personaSchema,
  changelog: changelogSchema,
  team: teamSchema,
  waterfall: waterfallSchema,
  heatmap: heatmapSchema,
  scorecard: scorecardSchema,
  risk: riskSchema,
  palette: paletteSchema,
  typescale: typescaleSchema,
  dodont: dodontSchema,
  inventory: inventorySchema,
  array: arraySchema,
  linkedlist: linkedlistSchema,
  bintree: bintreeSchema,
  hashmap: hashmapSchema,
  agentloop: agentloopSchema,
  trace: traceSchema,
  prompt: promptSchema,
  context: contextSchema,
  archmap: archmapSchema,
  divider: dividerSchema,
  bignumber: bignumberSchema,
  takeaways: takeawaysSchema,
} as const satisfies Record<BlockType, z.ZodTypeAny>;

/** Per-block data types, derived from the schemas above. */
export type BlockDataMap = {
  [K in BlockType]: z.infer<(typeof blockSchemas)[K]>;
};
