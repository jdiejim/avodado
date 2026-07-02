/**
 * `avo catalog [-s]` — build and render a living catalog of every block type:
 * one block per section (one per slide with `-s`), each showing its identifier
 * (the fenced type name an AI uses to "grab" the block), a one-line description
 * of what it does, and a live sample. Great as an at-a-glance reference, and as
 * a deck to paste/screenshot for teammates.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BLOCK_TYPES, type BlockType } from '@avodado/core';
import { TEMPLATES } from './new.js';
import { runSingle, type SingleFormat, type SingleResult } from './single.js';

/**
 * A block family — the same 12-way split the skill's `reference/blocks/`
 * folder uses, so `avo catalog` grouping and `avo demo <family>` line up with
 * the family reference files an agent reads.
 */
export type DemoFamily =
  | 'narrative'
  | 'tables-data'
  | 'api'
  | 'architecture'
  | 'flows'
  | 'data-model'
  | 'charts'
  | 'planning'
  | 'business'
  | 'design-system'
  | 'algorithms'
  | 'agentic';

/** The families in display order, with their human labels. */
export const DEMO_FAMILIES: ReadonlyArray<{ readonly id: DemoFamily; readonly label: string }> = [
  { id: 'narrative', label: 'Narrative & prose' },
  { id: 'tables-data', label: 'Tables & code' },
  { id: 'api', label: 'API' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'flows', label: 'Flows & state' },
  { id: 'data-model', label: 'Data model' },
  { id: 'charts', label: 'Charts & overviews' },
  { id: 'planning', label: 'Planning & backlogs' },
  { id: 'business', label: 'Business & decisions' },
  { id: 'design-system', label: 'Design system' },
  { id: 'algorithms', label: 'Algorithms' },
  { id: 'agentic', label: 'AI & agents' },
];

/** True when `value` names a demo family. */
export function isDemoFamily(value: string): value is DemoFamily {
  return DEMO_FAMILIES.some((f) => f.id === value);
}

/**
 * Which family each block belongs to — compile-time exhaustive over
 * {@link BlockType}, and mirrors `reference/blocks/INDEX.md` in the skill
 * (the `charts-overviews.md` family file is the `charts` family here).
 */
export const BLOCK_FAMILY: Record<BlockType, DemoFamily> = {
  meta: 'narrative',
  callout: 'narrative',
  prose: 'narrative',
  glossary: 'narrative',
  figure: 'narrative',
  faq: 'narrative',
  pullquote: 'api',
  table: 'tables-data',
  stats: 'tables-data',
  code: 'tables-data',
  diff: 'tables-data',
  slo: 'tables-data',
  terminal: 'tables-data',
  endpoint: 'api',
  layers: 'api',
  c4: 'architecture',
  uml: 'architecture',
  frontend: 'architecture',
  cluster: 'architecture',
  block: 'architecture',
  infra: 'architecture',
  felogic: 'architecture',
  belogic: 'architecture',
  event: 'architecture',
  ddd: 'architecture',
  network: 'architecture',
  dag: 'architecture',
  archmap: 'architecture',
  sequence: 'flows',
  flow: 'flows',
  state: 'flows',
  dfd: 'flows',
  swimlane: 'flows',
  steps: 'flows',
  erd: 'data-model',
  tree: 'charts',
  pyramid: 'charts',
  journey: 'charts',
  gantt: 'charts',
  graph: 'charts',
  quadrant: 'charts',
  mece: 'charts',
  chart: 'charts',
  waterfall: 'charts',
  heatmap: 'charts',
  userstory: 'planning',
  timeline: 'planning',
  kanban: 'planning',
  tracker: 'planning',
  proscons: 'planning',
  cvt: 'planning',
  agenda: 'planning',
  list: 'planning',
  stories: 'planning',
  pattern: 'planning',
  gallery: 'planning',
  changelog: 'planning',
  risk: 'planning',
  matrix: 'business',
  anatomy: 'business',
  composition: 'business',
  drivers: 'business',
  options: 'business',
  spec: 'business',
  envelope: 'business',
  swot: 'business',
  funnel: 'business',
  okr: 'business',
  persona: 'business',
  team: 'business',
  scorecard: 'business',
  wireframe: 'design-system',
  palette: 'design-system',
  typescale: 'design-system',
  dodont: 'design-system',
  inventory: 'design-system',
  array: 'algorithms',
  linkedlist: 'algorithms',
  bintree: 'algorithms',
  hashmap: 'algorithms',
  agentloop: 'agentic',
  trace: 'agentic',
  prompt: 'agentic',
  context: 'agentic',
  divider: 'narrative',
  bignumber: 'narrative',
  takeaways: 'narrative',
};

/** The block types of one family, in {@link BLOCK_TYPES} (registry) order. */
export function familyBlocks(family: DemoFamily): readonly BlockType[] {
  return BLOCK_TYPES.filter((t) => BLOCK_FAMILY[t] === family);
}

/** One-line "what it's for" per block, keyed exhaustively by {@link BlockType}. */
export const BLOCK_DESCRIPTIONS: Record<BlockType, string> = {
  meta: 'Document cover — title, subtitle, tag, and an optional logo.',
  callout: 'A single aside — note, tip, warning, or danger.',
  table: 'Genuinely tabular data; cells can carry a tone.',
  sequence: 'Messages between actors over time (lifelines + returns).',
  erd: 'Entities, columns, keys, and crow’s-foot relationships.',
  userstory: 'One agile story — role / want / soThat + acceptance criteria + links.',
  timeline: 'Phases in order with status dots (done / current / next / future).',
  kanban: 'Flexible named columns of cards (Now / Next / Later).',
  tracker: 'A task list with status / priority / owner / due.',
  prose: 'Structured prose (headings, paragraphs, lists, quotes) as data.',
  glossary: 'Term → definition rows.',
  proscons: 'Two columns weighed against each other — pros vs cons.',
  cvt: 'Current → target, before / after panels.',
  stats: 'KPI cards with a delta and an up / down / flat trend.',
  code: 'One or more syntax-highlighted code snippets.',
  agenda: 'A meeting agenda — time, duration, owner, topic per row.',
  tree: 'An indented file / folder hierarchy.',
  pyramid: 'A layered pyramid, widening top → bottom.',
  flow: 'A decision flowchart with branches and error exits.',
  state: 'A state machine — states + event transitions.',
  dfd: 'Data-flow — processes, external entities, and datastores.',
  journey: 'A user journey across stages, with an emotion curve.',
  gantt: 'A schedule — task bars across date columns.',
  graph: 'A generic node-link graph with colour-cycled groups.',
  quadrant: 'A 2×2 matrix (e.g. effort vs impact) with plotted items.',
  swimlane: 'A cross-functional process, one horizontal lane per role.',
  c4: 'C4 model — context / container / component.',
  uml: 'A class diagram — attributes, methods, UML relationships.',
  mece: 'A MECE issue tree — one problem split into exclusive branches.',
  frontend: 'A top-down component tree (root / layout / page / hook / store).',
  cluster: 'Kubernetes-style namespaces holding services, with replicas.',
  block: 'Generic boxes-and-arrows architecture (grid or layered bands).',
  infra: 'Cloud topology (same engine as block) — CDN / gateway / compute / DB.',
  felogic: 'Frontend module graph — components, hooks, interfaces, strategies.',
  belogic: 'Backend module graph — controller / service / repository / adapter.',
  event: 'Pub/sub topology — producers → topics → consumers.',
  ddd: 'A DDD bounded-context map.',
  network: 'Security zones with trust boundaries (supports forbidden edges).',
  dag: 'A pipeline / DAG (CI-CD-flavoured flow).',
  wireframe: 'Low-fi UI mockups inside device frames (desktop / browser / phone).',
  endpoint: 'A Swagger-style API endpoint card.',
  pullquote: 'A standout pull-quote with optional attribution.',
  layers: 'N numbered layers, each answering one question (L1 / L2 / L3).',
  matrix: 'A role × resource capability grid; cells tint by permission level.',
  anatomy: 'The labelled parts of a delimited string (app:feature:action).',
  composition: 'Effective access as intersected gates (A ∩ B ∩ C = result).',
  drivers: 'A grid of factor cards — the forces that shaped a design.',
  options: 'Approaches explored — pros / cons / verdict; the chosen one highlighted.',
  spec: 'A labelled spec sheet — label → value rows (a value can be a step-flow).',
  list: 'A fancy bullet list — accent / check / icon / number marker styles.',
  stories: 'A collapsible backlog of user stories (accordions) in one section.',
  pattern: 'A design-pattern card — intent · forces · participants · consequences.',
  gallery: 'A responsive grid of cards — code snippets or notes (e.g. a bug gallery or comparison).',
  chart: 'A data chart — bar / line / area / donut / radar, pure SVG, series coloured by accent.',
  figure: 'An image with a caption in a bordered card (optional pixel width cap).',
  diff: 'A unified diff on the dark editor surface — added / removed / hunk lines.',
  steps: 'A numbered how-to / runbook stepper — title, body, command, note per step.',
  faq: 'Q&A accordions — native details/summary, no JavaScript.',
  envelope: 'Back-of-envelope capacity math — assumptions, derivation rows, a highlighted bottom line.',
  slo: 'Service-level objectives — SLI, target vs current, and an error-budget burn bar.',
  terminal: 'A shell session on the dark surface — $ commands, # comments, and output lines.',
  swot: 'A classic SWOT 2×2 — strengths, weaknesses, opportunities, threats as tinted quadrant cards.',
  funnel: 'A conversion funnel — stacked bands proportional to value, with stage-to-stage conversion chips.',
  okr: 'Objectives and key results — one card per objective, a status-coloured progress bar per KR.',
  persona: 'User persona cards — avatar, role, quote, goals, frustrations, and tools.',
  changelog: 'Release history on a vertical rail — version pills, dates, and typed change chips.',
  team: 'Compact people cards — initials avatar, name, role, and focus area.',
  waterfall: 'A budget cascade — bars start where the previous total ended, with an optional dashed budget cap.',
  heatmap: 'A numeric grid with an intensity ramp — rows × columns of tiles tinted by value.',
  scorecard: 'A weighted decision matrix — criteria rows × option columns, totals footer, winner highlighted.',
  risk: 'A risk register — severity derived from likelihood × impact, with mitigation, owner, and status.',
  palette: 'Color-token swatches on a card grid — hex value, name, and usage per color.',
  typescale:
    'A live type specimen — one row per style, the sample rendered at its real size, weight, and font.',
  dodont: 'Do / don’t guideline cards — a green DO and a red DON’T column, with optional mono examples.',
  inventory:
    'A component / feature status board — compact rows with a color-coded stable / beta / experimental / deprecated / planned chip.',
  array:
    'Array cells for algorithm walkthroughs — tones, pointer labels below cells, and a dashed index-window highlight.',
  linkedlist:
    'A pointer-chain diagram (singly or doubly) — boxed nodes, next/prev arrows, node markers, and a ∅ terminator.',
  bintree:
    'A binary tree — nodes placed by parent + side, tinted to show search paths, traversals, and heap shapes.',
  hashmap:
    'Hash buckets with chained entries — collision chains read left → right as key/value pills; tones highlight probes.',
  agentloop:
    'The canonical LLM agent loop — environment → agent (model chip) → tools, with memory and a stop condition.',
  trace:
    'An agent execution transcript — user / assistant / tool / system turns, with thinking and tool args → result.',
  prompt:
    'Prompt anatomy — stacked role segments (system / user / assistant / tool) with highlighted {{variable}} chips and a legend.',
  context:
    'A context-window token budget — one stacked bar sized against the window, with free space and over-budget overflow.',
  archmap:
    'A target-architecture capability map — tinted domain areas packed with small status-coded capability tiles (current / target / new / gap / deprecated).',
  divider:
    'A full-width section break — kicker, display title, optional subtitle on an accent-washed band; a clean interstitial slide in decks.',
  bignumber:
    'One hero metric at presentation scale — a display-size value with an optional delta + trend arrow, a one-line claim, and a context line.',
  takeaways:
    'The 2-6 things to remember — numbered rows at presentation scale, each a bold one-liner with an optional detail; a deck’s closing slide.',
};

/**
 * Builds the catalog document: a `meta` cover, then one section per block type
 * (skipping `meta`, which is the cover). Each section's heading is the block
 * identifier, so as slides every block lands on its own titled slide.
 */
export function buildCatalogDoc(): string {
  const cover =
    '```meta\n' +
    'title: Avodado block catalog\n' +
    'subtitle: A sample of every block — the identifier to use and what it is for.\n' +
    `tag: CATALOG · ${BLOCK_TYPES.length} BLOCKS\n` +
    '```\n';
  const sections = BLOCK_TYPES.filter((t) => t !== 'meta').map(
    (t) => `## ${t}\n\n**\`${t}\`** — ${BLOCK_DESCRIPTIONS[t]}\n\n${TEMPLATES[t]}`,
  );
  return `${cover}\n${sections.join('\n')}`;
}

/**
 * Renders the catalog to `format` (html by default; slides shows one block per
 * slide) and either opens a temp preview or writes to `output`.
 */
export async function runCatalog(opts: {
  readonly format?: SingleFormat;
  readonly output?: string;
  readonly preview?: boolean;
}): Promise<SingleResult> {
  const format = opts.format ?? 'html';
  const dir = join(tmpdir(), 'avodado-catalog');
  await mkdir(dir, { recursive: true });
  const input = join(dir, 'catalog.md');
  await writeFile(input, buildCatalogDoc(), 'utf8');
  return runSingle({
    cwd: dir,
    input,
    format,
    ...(opts.output !== undefined ? { output: opts.output } : { preview: opts.preview ?? true }),
  });
}
