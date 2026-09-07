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

/** Directories under `src` the sweep skips: tests are not renderers. */
const SKIP_DIRS = new Set(['__tests__', '__fixtures__']);

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
 * The two files that may carry a hex value, each for a stated reason. Remove
 * an entry when the reason goes away; the test then enforces the rule on it.
 *
 * - `svg/dsTone.ts` — not restyled yet: still the pre-skin hex palette.
 * - `brand.ts` — the Avodado mark (favicon / logo artwork), not a renderer.
 *   Its colours are the brand's, fixed in both themes, and no role token
 *   names them.
 *
 * `css.ts` is not here: it is where the tokens are defined, and its own test
 * below confines its hex to the token blocks.
 */
const LEGACY_HEX_ALLOWLIST = new Set(['svg/dsTone.ts', 'brand.ts']);

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

/**
 * Drops block comments and whole-line `//` comments. A hex inside a comment
 * paints nothing — it documents an example value (`--accent:#0f766e`) — and a
 * whole-line match cannot be the tail of a URL in a string.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

function hexLiterals(rel: string): string[] {
  const src = stripComments(readFileSync(resolve(SRC, rel), 'utf8')).replace(/url\(#[A-Za-z0-9_-]+\)/g, '');
  return src.match(new RegExp(HEX_RE.source, 'g')) ?? [];
}

/** Every `.ts` under `src`, at any depth, except the test tree. */
function listSources(dir = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(resolve(SRC, dir), { withFileTypes: true })) {
    const rel = dir === '' ? entry.name : `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...listSources(rel));
    } else if (entry.name.endsWith('.ts')) out.push(rel);
  }
  return out.sort();
}

describe('no hex colours in skinned renderers', () => {
  for (const rel of SKINNED) {
    it(`${rel} names roles, never values`, () => {
      expect(hexLiterals(rel)).toEqual([]);
    });
  }

  it('every source under src is hex-free or allowlisted — the whole package, not just blocks/ and svg/', () => {
    const files = listSources().filter((rel) => rel !== 'css.ts');
    // The sweep must actually reach the top level (deck.ts, document.ts, …).
    expect(files).toContain('deck.ts');
    expect(files).toContain('blocks/spans.ts');
    const offenders = files.filter((rel) => !LEGACY_HEX_ALLOWLIST.has(rel) && hexLiterals(rel).length > 0);
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
