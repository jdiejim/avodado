/**
 * Block registry — the architectural backbone.
 *
 * A {@link BlockDef} ties a block type to its schema and an optional reference
 * extractor. The registry itself is a mapped type over {@link BlockType}, so
 * adding a new block type without an entry is a compile error.
 *
 * Downstream rendering targets (HTML renderer, etc.) follow the same
 * `Record<BlockType, …>` pattern to inherit the same exhaustiveness guarantee.
 */

import type { BlockType } from '../types.js';
import { blockSchemas, type BlockDataMap } from './schemas.js';

/** Definition of one block type: its schema plus optional ref extraction. */
export interface BlockDef<K extends BlockType> {
  readonly type: K;
  readonly schema: (typeof blockSchemas)[K];
  /**
   * Extracts the reference strings (`doc#id` or `#id`) carried by this block's
   * data, if any. Only blocks that can reference other blocks define this.
   */
  readonly extractRefs?: (data: BlockDataMap[K]) => readonly string[];
}

/** Mapped registry type — adding a new {@link BlockType} without an entry fails tsc. */
export type BlockRegistry = { readonly [K in BlockType]: BlockDef<K> };

/** The block registry. */
export const blockRegistry: BlockRegistry = {
  meta: { type: 'meta', schema: blockSchemas.meta },
  callout: { type: 'callout', schema: blockSchemas.callout },
  table: { type: 'table', schema: blockSchemas.table },
  sequence: { type: 'sequence', schema: blockSchemas.sequence },
  erd: { type: 'erd', schema: blockSchemas.erd },
  userstory: {
    type: 'userstory',
    schema: blockSchemas.userstory,
    extractRefs: (data) => {
      const links = data.links;
      if (!Array.isArray(links)) return [];
      const refs: string[] = [];
      for (const link of links) {
        if (typeof link.ref === 'string' && link.ref.length > 0) refs.push(link.ref);
      }
      return refs;
    },
  },
  timeline: { type: 'timeline', schema: blockSchemas.timeline },
  kanban: { type: 'kanban', schema: blockSchemas.kanban },
  tracker: { type: 'tracker', schema: blockSchemas.tracker },
  prose: { type: 'prose', schema: blockSchemas.prose },
  glossary: { type: 'glossary', schema: blockSchemas.glossary },
  proscons: { type: 'proscons', schema: blockSchemas.proscons },
  cvt: { type: 'cvt', schema: blockSchemas.cvt },
  stats: { type: 'stats', schema: blockSchemas.stats },
  code: { type: 'code', schema: blockSchemas.code },
  agenda: { type: 'agenda', schema: blockSchemas.agenda },
  tree: { type: 'tree', schema: blockSchemas.tree },
  pyramid: { type: 'pyramid', schema: blockSchemas.pyramid },
  flow: { type: 'flow', schema: blockSchemas.flow },
  state: { type: 'state', schema: blockSchemas.state },
  dfd: { type: 'dfd', schema: blockSchemas.dfd },
  journey: { type: 'journey', schema: blockSchemas.journey },
  gantt: { type: 'gantt', schema: blockSchemas.gantt },
  graph: { type: 'graph', schema: blockSchemas.graph },
  quadrant: { type: 'quadrant', schema: blockSchemas.quadrant },
  swimlane: { type: 'swimlane', schema: blockSchemas.swimlane },
  c4: { type: 'c4', schema: blockSchemas.c4 },
  uml: { type: 'uml', schema: blockSchemas.uml },
  mece: { type: 'mece', schema: blockSchemas.mece },
  frontend: { type: 'frontend', schema: blockSchemas.frontend },
  cluster: { type: 'cluster', schema: blockSchemas.cluster },
  block: { type: 'block', schema: blockSchemas.block },
  infra: { type: 'infra', schema: blockSchemas.infra },
  event: { type: 'event', schema: blockSchemas.event },
  ddd: { type: 'ddd', schema: blockSchemas.ddd },
  network: { type: 'network', schema: blockSchemas.network },
  felogic: { type: 'felogic', schema: blockSchemas.felogic },
  belogic: { type: 'belogic', schema: blockSchemas.belogic },
  dag: { type: 'dag', schema: blockSchemas.dag },
  wireframe: { type: 'wireframe', schema: blockSchemas.wireframe },
  endpoint: { type: 'endpoint', schema: blockSchemas.endpoint },
  pullquote: { type: 'pullquote', schema: blockSchemas.pullquote },
  layers: { type: 'layers', schema: blockSchemas.layers },
};
