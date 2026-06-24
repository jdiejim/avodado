/**
 * HTML renderer registry — mirrors the core block registry's exhaustiveness.
 *
 * Each block type maps to a function that takes its typed data and returns an
 * HTML string. The mapped type `{ [K in BlockType]: ... }` ensures omitting a
 * block type is a compile error — adding a new BlockType in core fails tsc here
 * until the renderer is added.
 */

import type { BlockDataMap, BlockType } from '@avodado/core';

import { renderCallout } from './blocks/callout.js';
import { renderErd } from './blocks/erd.js';
import { renderKanban } from './blocks/kanban.js';
import { renderMetaBlock } from './blocks/meta.js';
import { renderSequence } from './blocks/sequence.js';
import { renderTable } from './blocks/table.js';
import { renderTimeline } from './blocks/timeline.js';
import { renderTracker } from './blocks/tracker.js';
import { renderUserStory } from './blocks/userstory.js';
import { renderProseBlock } from './blocks/prose.js';
import { renderGlossary } from './blocks/glossary.js';
import { renderProsCons } from './blocks/proscons.js';
import { renderCvt } from './blocks/cvt.js';
import { renderStats } from './blocks/stats.js';
import { renderCode } from './blocks/code.js';
import { renderAgenda } from './blocks/agenda.js';
import { renderTree } from './blocks/tree.js';
import { renderPyramid } from './blocks/pyramid.js';
import { renderFlow } from './blocks/flow.js';
import { renderState } from './blocks/state.js';
import { renderDfd } from './blocks/dfd.js';
import { renderJourney } from './blocks/journey.js';
import { renderGantt } from './blocks/gantt.js';
import { renderGraph } from './blocks/graph.js';
import { renderQuadrant } from './blocks/quadrant.js';
import { renderSwimlane } from './blocks/swimlane.js';
import { renderC4 } from './blocks/c4.js';
import { renderUml } from './blocks/uml.js';
import { renderMece } from './blocks/mece.js';
import { renderFrontend } from './blocks/frontend.js';
import { renderCluster } from './blocks/cluster.js';
import {
  renderBlock,
  renderInfra,
  renderEvent,
  renderDdd,
  renderNetwork,
} from './blocks/blockGraph.js';
import { renderFelogic, renderBelogic } from './blocks/felogic.js';
import { renderDag } from './blocks/flow.js';
import { renderWireframe } from './blocks/wireframe.js';
import { renderEndpoint } from './blocks/endpoint.js';
import { renderPullquote } from './blocks/pullquote.js';
import { renderLayers } from './blocks/layers.js';
import { renderMatrix } from './blocks/matrix.js';
import { renderAnatomy } from './blocks/anatomy.js';
import { renderComposition } from './blocks/composition.js';
import { renderDrivers } from './blocks/drivers.js';
import { renderOptions } from './blocks/options.js';
import { renderSpec } from './blocks/spec.js';
import { renderList } from './blocks/list.js';
import { renderStories } from './blocks/stories.js';
import { renderPattern } from './blocks/pattern.js';

/** Per-block HTML renderer signature. */
export type HtmlRenderer<K extends BlockType> = (data: BlockDataMap[K]) => string;

/** Mapped type — adding a {@link BlockType} without an entry fails tsc. */
export type HtmlRendererRegistry = { readonly [K in BlockType]: HtmlRenderer<K> };

/** The HTML renderer registry. `meta` is intentionally a no-op (cover is rendered separately). */
export const htmlRenderers: HtmlRendererRegistry = {
  meta: renderMetaBlock,
  callout: renderCallout,
  table: renderTable,
  sequence: renderSequence,
  erd: renderErd,
  userstory: renderUserStory,
  timeline: renderTimeline,
  kanban: renderKanban,
  tracker: renderTracker,
  prose: renderProseBlock,
  glossary: renderGlossary,
  proscons: renderProsCons,
  cvt: renderCvt,
  stats: renderStats,
  code: renderCode,
  agenda: renderAgenda,
  tree: renderTree,
  pyramid: renderPyramid,
  flow: renderFlow,
  state: renderState,
  dfd: renderDfd,
  journey: renderJourney,
  gantt: renderGantt,
  graph: renderGraph,
  quadrant: renderQuadrant,
  swimlane: renderSwimlane,
  c4: renderC4,
  uml: renderUml,
  mece: renderMece,
  frontend: renderFrontend,
  cluster: renderCluster,
  block: renderBlock,
  infra: renderInfra,
  event: renderEvent,
  ddd: renderDdd,
  network: renderNetwork,
  felogic: renderFelogic,
  belogic: renderBelogic,
  dag: renderDag,
  wireframe: renderWireframe,
  endpoint: renderEndpoint,
  pullquote: renderPullquote,
  layers: renderLayers,
  matrix: renderMatrix,
  anatomy: renderAnatomy,
  composition: renderComposition,
  drivers: renderDrivers,
  options: renderOptions,
  spec: renderSpec,
  list: renderList,
  stories: renderStories,
  pattern: renderPattern,
};
