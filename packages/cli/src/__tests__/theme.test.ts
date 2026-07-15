/**
 * Theme resolution + validation: custom themes are first-class — a theme file
 * may reference an installed theme by name (or itself), `loadTheme` resolves
 * the reference to a base + vars, and `studioThemeInfo` describes it all for
 * the studio's `/api/meta`.
 */

import { describe, expect, it } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import {
  activeTheme,
  findSavedTheme,
  listSavedThemes,
  loadTheme,
  studioThemeInfo,
  themeSlug,
  validateThemeFile,
} from '../io/theme.js';

// Slugs are prefixed so a developer machine's real ~/.avodado/themes (which
// listSavedThemes also reads) can never collide with these fixtures.
const EMBER = { name: 'Avo Test Ember', theme: 'dark', colors: { primary: '#ff5a1f', paper: '#1a1412' } };
const EMBER_SLUG = 'avo-test-ember';
const SUNSET = { name: 'Avo Test Sunset', theme: 'avo-test-sunset', colors: { primary: '#e11d48' } };
const SUNSET_SLUG = 'avo-test-sunset';

async function tempProject(): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const root = join(tmpdir(), `avo-theme-${randomBytes(6).toString('hex')}`);
  await mkdir(join(root, '.avodado', 'themes'), { recursive: true });
  await writeFile(join(root, '.avodado', 'themes', `${EMBER_SLUG}.theme.json`), JSON.stringify(EMBER));
  await writeFile(join(root, '.avodado', 'themes', `${SUNSET_SLUG}.theme.json`), JSON.stringify(SUNSET));
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
}

const active = (root: string, body: unknown): Promise<void> =>
  writeFile(join(root, 'avodado.theme.json'), JSON.stringify(body));

describe('themeSlug', () => {
  it('normalizes names the way `avo theme install` slugs filenames', () => {
    expect(themeSlug('Avo Test Ember')).toBe('avo-test-ember');
    expect(themeSlug('  Sunset!  ')).toBe('sunset');
    expect(themeSlug('---')).toBe('');
  });
});

describe('loadTheme (custom-name resolution)', () => {
  it('resolves a saved-theme reference to its base + vars', async () => {
    const { root, cleanup } = await tempProject();
    try {
      await active(root, { theme: EMBER_SLUG });
      const t = loadTheme(root);
      expect(t.theme).toBe('dark');
      expect(t.themeVars).toMatchObject({ '--navy': '#ff5a1f', '--white': '#1a1412' });
    } finally {
      await cleanup();
    }
  });

  it('resolves a reference by display name too', async () => {
    const { root, cleanup } = await tempProject();
    try {
      await active(root, { theme: 'Avo Test Ember' });
      expect(loadTheme(root).theme).toBe('dark');
    } finally {
      await cleanup();
    }
  });

  it("the referencing file's own overrides win over the saved theme's", async () => {
    const { root, cleanup } = await tempProject();
    try {
      await active(root, { theme: EMBER_SLUG, colors: { primary: '#000000' } });
      const t = loadTheme(root);
      expect(t.theme).toBe('dark');
      expect(t.themeVars?.['--navy']).toBe('#000000'); // override wins
      expect(t.themeVars?.['--white']).toBe('#1a1412'); // rest inherited
    } finally {
      await cleanup();
    }
  });

  it('a self-titled saved theme means "default base + its overrides" (one hop, no cycle)', async () => {
    const { root, cleanup } = await tempProject();
    try {
      await active(root, SUNSET); // theme: 'avo-test-sunset' inside the sunset file itself
      const t = loadTheme(root);
      expect(t.theme).toBeUndefined(); // default base downstream
      expect(t.themeVars).toMatchObject({ '--navy': '#e11d48' });
    } finally {
      await cleanup();
    }
  });

  it('an unresolvable name degrades to vars-only instead of crashing', async () => {
    const { root, cleanup } = await tempProject();
    try {
      await active(root, { theme: 'no-such-theme-xyz', colors: { primary: '#123456' } });
      const t = loadTheme(root);
      expect(t.theme).toBeUndefined();
      expect(t.themeVars).toMatchObject({ '--navy': '#123456' });
    } finally {
      await cleanup();
    }
  });

  it('built-in names keep working unchanged', async () => {
    const { root, cleanup } = await tempProject();
    try {
      await active(root, { theme: 'teal' });
      expect(loadTheme(root)).toEqual({ theme: 'teal' });
    } finally {
      await cleanup();
    }
  });
});

describe('validateThemeFile (custom names)', () => {
  it('accepts a self-titled theme (theme === its own name)', () => {
    const v = validateThemeFile(JSON.stringify(SUNSET));
    expect(v.ok).toBe(true);
    expect(v.errors).toEqual([]);
  });

  it('accepts a name from knownNames (installed themes), slug-insensitively', () => {
    const v = validateThemeFile(JSON.stringify({ theme: 'Avo Test Ember' }), [EMBER_SLUG]);
    expect(v.ok).toBe(true);
  });

  it('rejects a genuinely unknown name, listing built-ins and installed themes', () => {
    const v = validateThemeFile(JSON.stringify({ theme: 'nope' }), [EMBER_SLUG]);
    expect(v.ok).toBe(false);
    expect(v.errors[0]).toContain('textbook');
    expect(v.errors[0]).toContain(EMBER_SLUG);
  });

  it('still rejects unknown names when nothing is installed, pointing at `avo theme install`', () => {
    const v = validateThemeFile(JSON.stringify({ theme: 'nope' }));
    expect(v.ok).toBe(false);
    expect(v.errors[0]).toContain('avo theme install');
  });
});

describe('activeTheme (identity)', () => {
  it('a name reference is the saved theme, with its display name', async () => {
    const { root, cleanup } = await tempProject();
    try {
      await active(root, { theme: EMBER_SLUG });
      const a = activeTheme(root, listSavedThemes(root));
      expect(a).toEqual({ kind: 'saved', id: EMBER_SLUG, name: 'Avo Test Ember' });
    } finally {
      await cleanup();
    }
  });

  it('a full copy of a saved theme still matches by content', async () => {
    const { root, cleanup } = await tempProject();
    try {
      await active(root, EMBER); // what `avo theme use` writes
      const a = activeTheme(root, listSavedThemes(root));
      expect(a).toMatchObject({ kind: 'saved', id: EMBER_SLUG, name: 'Avo Test Ember' });
    } finally {
      await cleanup();
    }
  });

  it('unmatched overrides are custom, carrying the file name when present', async () => {
    const { root, cleanup } = await tempProject();
    try {
      await active(root, { name: 'One-off', colors: { primary: '#111111' } });
      const a = activeTheme(root, listSavedThemes(root));
      expect(a).toEqual({ kind: 'custom', name: 'One-off' });
    } finally {
      await cleanup();
    }
  });
});

describe('findSavedTheme', () => {
  it('finds by slug and by display name; misses return undefined', async () => {
    const { root, cleanup } = await tempProject();
    try {
      expect(findSavedTheme(root, EMBER_SLUG)?.slug).toBe(EMBER_SLUG);
      expect(findSavedTheme(root, 'Avo Test Ember')?.slug).toBe(EMBER_SLUG);
      expect(findSavedTheme(root, 'definitely-not-installed-xyz')).toBeUndefined();
    } finally {
      await cleanup();
    }
  });
});

describe('studioThemeInfo', () => {
  it('bundles the resolved active theme, its identity, and resolved saved themes', async () => {
    const { root, cleanup } = await tempProject();
    try {
      await active(root, { theme: EMBER_SLUG });
      const info = studioThemeInfo(root);
      expect(info.theme).toBe('dark');
      expect(info.themeVars).toMatchObject({ '--navy': '#ff5a1f' });
      expect(info.active).toEqual({ kind: 'saved', id: EMBER_SLUG, name: 'Avo Test Ember' });
      const ember = info.savedThemes.find((t) => t.slug === EMBER_SLUG);
      expect(ember).toMatchObject({ name: 'Avo Test Ember', scope: 'project', theme: 'dark' });
      expect(ember?.themeVars).toMatchObject({ '--navy': '#ff5a1f' });
      // The self-titled theme resolves to default base + its own vars.
      const sunset = info.savedThemes.find((t) => t.slug === SUNSET_SLUG);
      expect(sunset?.theme).toBeUndefined();
      expect(sunset?.themeVars).toMatchObject({ '--navy': '#e11d48' });
    } finally {
      await cleanup();
    }
  });
});
