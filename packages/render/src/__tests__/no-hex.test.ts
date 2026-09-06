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
  'blocks/eventcontract.ts',
  'blocks/saga.ts',
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
const LEGACY_HEX_ALLOWLIST = new Set(['svg/dsTone.ts']);

/**
 * The stylesheet is where the tokens are DEFINED, so it may carry hex — but
 * only inside the token blocks: `:root{…}`, the `[data-theme="dark"]` block,
 * and the `prefers-color-scheme: dark` media block. Every rule after them
 * names a role (`var(--ink)`), never a value.
 */
const TOKEN_BLOCKS = [
  /^:root\{[\s\S]*?^\}/m,
  /^:root\[data-theme="dark"\][^\n]*\{[\s\S]*?^\}/m,
  /^@media \(prefers-color-scheme: dark\)\{[\s\S]*?^\}/m,
];

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

  it('css.ts carries hex only inside the :root / dark token blocks', () => {
    let src = readFileSync(resolve(SRC, 'css.ts'), 'utf8');
    for (const block of TOKEN_BLOCKS) {
      expect(src).toMatch(block);
      src = src.replace(block, '');
    }
    const offenders = (src.match(new RegExp(HEX_RE.source, 'g')) ?? []).map((hex) => {
      const at = src.indexOf(hex);
      const lineStart = src.lastIndexOf('\n', at) + 1;
      const lineEnd = src.indexOf('\n', at);
      return src.slice(lineStart, lineEnd < 0 ? undefined : lineEnd).trim().slice(0, 80);
    });
    expect(offenders).toEqual([]);
  });
});
