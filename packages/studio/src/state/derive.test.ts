/**
 * Theme narrowing + the dark-surface decision that drives high-contrast
 * selection/highlight colors (regression: navy outlines were invisible on the
 * dark docskin surface).
 */

import { describe, expect, it } from 'vitest';
import { asThemeName, diskChoice, docSurface, resolveChoice, sameDiskTheme, type ThemeMeta } from './derive.js';

describe('asThemeName', () => {
  it('accepts known themes, falls back otherwise', () => {
    expect(asThemeName('dark', 'textbook')).toBe('dark');
    expect(asThemeName('nope', 'textbook')).toBe('textbook');
    expect(asThemeName(undefined, 'minimal')).toBe('minimal');
  });
});

describe('docSurface', () => {
  it('the dark theme is a dark surface; the rest are light', () => {
    expect(docSurface('dark')).toBe('dark');
    for (const t of ['textbook', 'minimal', 'teal', 'slate', 'soft']) {
      expect(docSurface(t)).toBe('light');
    }
  });

  it('a themeVars override that darkens the paper flips any theme to dark', () => {
    expect(docSurface('textbook', { '--white': '#161b26' })).toBe('dark');
    expect(docSurface('minimal', { '--white': '#000000' })).toBe('dark');
    expect(docSurface('textbook', { '--white': '#fcfbf7' })).toBe('light');
  });

  it('unparseable or irrelevant overrides stay light', () => {
    expect(docSurface('textbook', { '--white': 'papayawhip' })).toBe('light');
    expect(docSurface('textbook', { '--navy': '#000000' })).toBe('light');
  });
});

// ── Theme choice (picker value ↔ disk ↔ renderer inputs) ─────────────────────

const EMBER_VARS = { '--navy': '#ff5a1f' };
const SAVED_LIST = [{ slug: 'ember', name: 'Ember', theme: 'dark', themeVars: EMBER_VARS }];
const SAVED_META: ThemeMeta = {
  theme: 'dark',
  themeVars: EMBER_VARS,
  active: { kind: 'saved', id: 'ember', name: 'Ember' },
  savedThemes: SAVED_LIST,
};

describe('diskChoice', () => {
  it('mirrors a built-in, a saved theme, and unmatched custom overrides', () => {
    expect(diskChoice({ theme: 'teal', active: { kind: 'builtin', id: 'teal' } })).toBe('teal');
    expect(diskChoice(SAVED_META)).toBe('saved:ember');
    expect(diskChoice({ themeVars: EMBER_VARS, active: { kind: 'custom' } })).toBe('custom');
  });

  it('none / null fall back to the default theme', () => {
    expect(diskChoice({ active: { kind: 'none' } })).toBe('textbook');
    expect(diskChoice(null)).toBe('textbook');
  });

  it('an older server without `active` still applies var overrides via custom', () => {
    expect(diskChoice({ theme: 'dark', themeVars: EMBER_VARS })).toBe('custom');
    expect(diskChoice({ theme: 'dark' })).toBe('dark');
  });

  it('a saved theme missing from savedThemes degrades to custom (still renders)', () => {
    expect(diskChoice({ theme: 'dark', themeVars: EMBER_VARS, active: { kind: 'saved', id: 'gone' } })).toBe('custom');
  });
});

describe('resolveChoice', () => {
  it('resolves a saved slug to its base + vars', () => {
    expect(resolveChoice('saved:ember', SAVED_META)).toEqual({ theme: 'dark', themeVars: EMBER_VARS });
  });

  it('resolves custom to the disk resolution from meta', () => {
    expect(resolveChoice('custom', SAVED_META)).toEqual({ theme: 'dark', themeVars: EMBER_VARS });
    expect(resolveChoice('custom', null)).toEqual({ theme: 'textbook' });
  });

  it('a built-in pick is a PURE preview — no disk vars overlaid', () => {
    expect(resolveChoice('minimal', SAVED_META)).toEqual({ theme: 'minimal' });
  });

  it('a vanished saved slug falls back to the disk theme', () => {
    expect(resolveChoice('saved:gone', SAVED_META)).toEqual({ theme: 'dark', themeVars: EMBER_VARS });
  });
});

describe('sameDiskTheme', () => {
  it('equal snapshots compare equal; a base or var change does not', () => {
    expect(sameDiskTheme(SAVED_META, { ...SAVED_META })).toBe(true);
    expect(
      sameDiskTheme(SAVED_META, {
        theme: 'teal',
        active: { kind: 'builtin', id: 'teal' },
        savedThemes: SAVED_LIST,
      }),
    ).toBe(false);
    const recolored = { ...EMBER_VARS, '--navy': '#000000' };
    expect(
      sameDiskTheme(SAVED_META, {
        ...SAVED_META,
        themeVars: recolored,
        savedThemes: [{ slug: 'ember', name: 'Ember', theme: 'dark', themeVars: recolored }],
      }),
    ).toBe(false);
  });

  it('null only equals null (first meta always syncs)', () => {
    expect(sameDiskTheme(null, null)).toBe(true);
    expect(sameDiskTheme(null, SAVED_META)).toBe(false);
  });
});
