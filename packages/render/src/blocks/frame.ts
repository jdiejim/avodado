/**
 * Wraps block content in doc-studio's "diagram frame" — a bordered card with
 * a header (tag pill + title + figure number) and optional description.
 *
 * Used by diagram-type blocks (sequence, erd, …) so the output matches
 * doc-studio.jsx's `DiagramFrame` component.
 */

import type { BlockType } from '@avodado/core';
import { escapeHtml } from '../escape.js';

interface FrameOptions {
  /** Tag pill text (e.g. `SEQUENCE`, `ER`, `POST`). */
  readonly tag: string;
  /** Optional CSS class added to the tag pill (e.g. `post`, `get`). */
  readonly tagClass?: string;
  /** Optional inline background color for the tag pill (used when no class). */
  readonly tagBg?: string;
  /** Title shown next to the tag (often `data.title`). Plain text. */
  readonly title?: string;
  /** Pre-rendered HTML for the title — wins over `title` if provided. */
  readonly titleHtml?: string;
  /** Optional figure number (e.g. `FIG 1.1`). */
  readonly fignum?: string;
  /** Optional description shown under the header. */
  readonly desc?: string;
  /** Optional pre-rendered HTML rendered AFTER the inner content (e.g. footers). */
  readonly footerHtml?: string;
}

/** Wraps the given inner HTML in a `.diagram` card. */
export function diagramFrame(opts: FrameOptions, inner: string): string {
  const tagClass = opts.tagClass !== undefined ? ` ${opts.tagClass}` : '';
  const tagStyle =
    opts.tagBg !== undefined && opts.tagClass === undefined
      ? ` style="background:${opts.tagBg}"`
      : '';
  const titleHtml =
    opts.titleHtml !== undefined
      ? `<span class="diagram-title">${opts.titleHtml}</span>`
      : opts.title !== undefined && opts.title.length > 0
        ? `<span class="diagram-title">${escapeHtml(opts.title)}</span>`
        : '';
  const fignumHtml =
    opts.fignum !== undefined && opts.fignum.length > 0
      ? `<span class="diagram-fignum">${escapeHtml(opts.fignum)}</span>`
      : '';
  const descHtml =
    opts.desc !== undefined && opts.desc.length > 0
      ? `<p class="diagram-desc">${escapeHtml(opts.desc)}</p>`
      : '';
  const footerHtml = opts.footerHtml ?? '';
  return (
    `<div class="diagram">` +
    `<div class="diagram-head">` +
    `<span class="diagram-tag${tagClass}"${tagStyle}>${escapeHtml(opts.tag)}</span>` +
    titleHtml +
    fignumHtml +
    `</div>` +
    descHtml +
    inner +
    footerHtml +
    `</div>`
  );
}

/**
 * Per-block-type label shown in `SECTION NN · LABEL`.
 *
 * Typed as `Record<BlockType, string>` so adding a new block type without a
 * label is a compile error — the same exhaustiveness guarantee the block
 * registry gives the renderers.
 */
export const SECTION_LABEL: Record<BlockType, string> = {
  meta: '',
  callout: 'Note',
  table: 'Comparison',
  sequence: 'Sequence',
  erd: 'Entity model',
  userstory: 'User story',
  timeline: 'Roadmap',
  kanban: 'Board',
  tracker: 'Tracker',
  prose: 'Overview',
  glossary: 'Glossary',
  proscons: 'Trade-offs',
  cvt: 'Before / after',
  stats: 'Metrics',
  code: 'Code',
  agenda: 'Agenda',
  tree: 'Hierarchy',
  pyramid: 'Pyramid',
  funnel: 'Funnel',
  flow: 'Flowchart',
  state: 'State machine',
  dfd: 'Data flow',
  journey: 'Journey',
  gantt: 'Schedule',
  graph: 'Graph',
  quadrant: 'Matrix',
  swimlane: 'Process',
  c4: 'C4 model',
  uml: 'Class model',
  mece: 'Issue tree',
  frontend: 'Component tree',
  cluster: 'Cluster',
  block: 'Architecture',
  infra: 'Deployment',
  event: 'Events',
  ddd: 'Context map',
  network: 'Security zones',
  felogic: 'Frontend logic',
  belogic: 'Backend logic',
  dag: 'DAG',
  wireframe: 'Mockup',
};
