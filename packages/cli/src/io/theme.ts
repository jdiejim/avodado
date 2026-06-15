/**
 * Loads a project theme file (`avodado.theme.json`) and maps its friendly
 * color/font names to the CSS variables the renderer reads.
 *
 * The whole point: a user edits one small JSON file with human names
 * (`primary`, `accent`, `ink`…) and re-runs `avo render` — no rebuild, no
 * CSS knowledge. Anything omitted falls back to the built-in theme.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Friendly theme-file shape. Every field is optional. */
export interface ThemeFile {
  /** Optional name, for your own reference. */
  readonly name?: string;
  /** Base built-in theme: textbook | minimal | teal | plum | slate | dark | soft. */
  readonly theme?: string;
  /** Friendly color name → hex/CSS color. */
  readonly colors?: Readonly<Record<string, string>>;
  /** Friendly font slot → CSS font-family stack. */
  readonly fonts?: Readonly<Record<string, string>>;
}

/** Resolved theme: a base theme name and/or custom variable overrides. */
export interface LoadedTheme {
  readonly theme?: string;
  readonly themeVars?: Readonly<Record<string, string>>;
}

const BASE_THEMES = new Set(['textbook', 'minimal', 'teal', 'plum', 'slate', 'dark', 'soft']);

/** Friendly color name → internal CSS variable. */
const COLOR_TO_VAR: Readonly<Record<string, string>> = {
  primary: '--navy', // headings, primary nodes, links, section numbers
  secondary: '--blue', // secondary accents, CDN/consumer nodes
  accent: '--highlight', // highlight pills, FK keys, "current" markers
  positive: '--positive', // success / service nodes / done
  negative: '--negative', // errors / forbidden edges / danger
  purple: '--purple', // data / context / provider nodes
  teal: '--teal', // queues / topics / caches
  ink: '--charcoal', // body text
  muted: '--gray', // captions, dim text, external nodes
  rule: '--rule', // hairlines, borders, dividers
  paper: '--white', // surfaces / card fills
};

/** Friendly font slot → internal CSS variable. */
const FONT_TO_VAR: Readonly<Record<string, string>> = {
  display: '--font-display', // titles / headings
  body: '--font-body', // paragraphs / labels
  mono: '--font-mono', // code / technical labels
};

const THEME_FILES = ['avodado.theme.json', 'avodado.theme.jsonc'];

/**
 * Reads the project theme file (if any) and returns CSS-variable overrides
 * ready to pass to `renderDocument({ themeVars })`. Returns `undefined` when
 * there is no theme file, so the default theme is used unchanged.
 *
 * Unknown color/font names are ignored (a warning is the caller's choice) so a
 * typo never crashes a render.
 */
export function loadTheme(cwd: string): LoadedTheme {
  for (const name of THEME_FILES) {
    const path = resolve(cwd, name);
    if (!existsSync(path)) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(stripComments(readFileSync(path, 'utf8'))) as unknown;
    } catch {
      return {}; // malformed file → fall back to default theme
    }
    const file = raw !== null && typeof raw === 'object' ? (raw as ThemeFile) : {};
    const out: { theme?: string; themeVars?: Readonly<Record<string, string>> } = {};
    if (typeof file.theme === 'string' && BASE_THEMES.has(file.theme)) out.theme = file.theme;
    const vars = toVars(raw);
    if (vars !== undefined) out.themeVars = vars;
    return out;
  }
  return {};
}

/** Converts a parsed theme file into CSS-variable overrides. */
function toVars(raw: unknown): Readonly<Record<string, string>> | undefined {
  if (raw === null || typeof raw !== 'object') return undefined;
  const file = raw as ThemeFile;
  const vars: Record<string, string> = {};
  if (file.colors !== undefined) {
    for (const key of Object.keys(file.colors)) {
      const cssVar = COLOR_TO_VAR[key.toLowerCase()];
      const value = file.colors[key];
      if (cssVar !== undefined && typeof value === 'string') vars[cssVar] = value;
    }
  }
  if (file.fonts !== undefined) {
    for (const key of Object.keys(file.fonts)) {
      const cssVar = FONT_TO_VAR[key.toLowerCase()];
      const value = file.fonts[key];
      if (cssVar !== undefined && typeof value === 'string') vars[cssVar] = value;
    }
  }
  return Object.keys(vars).length > 0 ? vars : undefined;
}

/** Strips `//` line comments so `.jsonc`-style files parse. */
function stripComments(src: string): string {
  return src.replace(/^\s*\/\/.*$/gm, '');
}

/** Directory holding saved custom themes, relative to the project root. */
export const THEMES_DIR = '.avodado/themes';

/** A saved custom theme on disk. */
export interface SavedTheme {
  /** Filename stem (`sunset` for `sunset.theme.json`) — what you pass to `avo theme`. */
  readonly slug: string;
  /** Display name (the file's `name` field, falling back to the slug). */
  readonly name: string;
  /** Absolute path to the theme file. */
  readonly file: string;
}

/** Resolves the on-disk path for a saved theme by slug. */
export function savedThemePath(cwd: string, slug: string): string {
  return resolve(cwd, THEMES_DIR, `${slug}.theme.json`);
}

/**
 * Lists saved custom themes in `.avodado/themes/*.theme.json`, sorted by name.
 * Each entry's display name is the file's `name` field, or its slug otherwise.
 */
export function listSavedThemes(cwd: string): SavedTheme[] {
  const dir = resolve(cwd, THEMES_DIR);
  if (!existsSync(dir)) return [];
  const out: SavedTheme[] = [];
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith('.theme.json')) continue;
    const slug = entry.replace(/\.theme\.json$/, '');
    const file = join(dir, entry);
    let name = slug;
    try {
      const raw = JSON.parse(stripComments(readFileSync(file, 'utf8'))) as ThemeFile;
      if (typeof raw.name === 'string' && raw.name.trim() !== '') name = raw.name;
    } catch {
      /* unreadable/malformed → keep the slug as the name */
    }
    out.push({ slug, name, file });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
