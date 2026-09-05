/**
 * The skin rule (`DESIGN.md`): no renderer carries a hex colour — every
 * colour is a role token (`var(--ink)`). This asserts it for the migrated
 * renderers and the SVG helpers they draw with, and keeps an explicit
 * allowlist of the files that have not migrated yet. The rollout shrinks the
 * allowlist; a file that is neither hex-free nor listed fails.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(import.meta.dirname, '..');

/** The pilot: these files (and the helpers below) must be hex-free. */
const SKINNED = [
  'blocks/sequence.ts',
  'blocks/flow.ts',
  'blocks/blockGraph.ts', // the `block` renderer (+ infra / event / ddd / network presets)
  'blocks/erd.ts',
  'blocks/frame.ts',
  'blocks/autoLayout.ts',
  'svg/blockStyle.ts',
  'svg/defs.ts',
  'svg/edgePill.ts',
  'svg/edgeSteps.ts',
  'svg/gridGroups.ts',
  'svg/gridMeta.ts',
  'svg/legend.ts',
  'svg/ortho.ts',
  'svg/shapes.ts',
  'svg/wrapText.ts',
];

/**
 * Not restyled yet — still carry the pre-skin hex palette. Remove an entry
 * when its renderer moves to the skin; the test then enforces it.
 */
const LEGACY_HEX_ALLOWLIST = new Set([
  'blocks/agentloop.ts',
  'blocks/array.ts',
  'blocks/bintree.ts',
  'blocks/c4.ts',
  'blocks/chart.ts',
  'blocks/cluster.ts',
  'blocks/context.ts',
  'blocks/cycle.ts',
  'blocks/dfd.ts',
  'blocks/felogic.ts',
  'blocks/fishbone.ts',
  'blocks/frontend.ts',
  'blocks/gantt.ts',
  'blocks/gitgraph.ts',
  'blocks/graph.ts',
  'blocks/hashmap.ts',
  'blocks/heatmap.ts',
  'blocks/journey.ts',
  'blocks/linkedlist.ts',
  'blocks/packet.ts',
  'blocks/palette.ts',
  'blocks/quadrant.ts',
  'blocks/sankey.ts',
  'blocks/slopegraph.ts',
  'blocks/state.ts',
  'blocks/stats.ts',
  'blocks/storymap.ts',
  'blocks/swimlane.ts',
  'blocks/tree.ts',
  'blocks/treemap.ts',
  'blocks/uml.ts',
  'blocks/venn.ts',
  'blocks/wardley.ts',
  'blocks/wireframe.ts',
  'svg/dsTone.ts',
  'svg/legacyPalette.ts',
]);

/** A hex colour literal; `url(#id)` marker references are stripped first. */
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/;

function hexLiterals(rel: string): string[] {
  const src = readFileSync(resolve(SRC, rel), 'utf8').replace(/url\(#[A-Za-z0-9_-]+\)/g, '');
  return src.match(new RegExp(HEX_RE.source, 'g')) ?? [];
}

function listSources(dir: string): string[] {
  return readdirSync(resolve(SRC, dir))
    .filter((f) => f.endsWith('.ts'))
    .map((f) => `${dir}/${f}`);
}

describe('no hex colours in skinned renderers', () => {
  for (const rel of SKINNED) {
    it(`${rel} names roles, never values`, () => {
      expect(hexLiterals(rel)).toEqual([]);
    });
  }

  it('every block / svg source is either hex-free or on the legacy allowlist', () => {
    const offenders = [...listSources('blocks'), ...listSources('svg')].filter(
      (rel) => !LEGACY_HEX_ALLOWLIST.has(rel) && hexLiterals(rel).length > 0,
    );
    expect(offenders).toEqual([]);
  });

  it('the legacy allowlist carries no file that is already hex-free', () => {
    const stale = [...LEGACY_HEX_ALLOWLIST].filter((rel) => hexLiterals(rel).length === 0);
    expect(stale).toEqual([]);
  });
});
