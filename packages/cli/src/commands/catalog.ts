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
