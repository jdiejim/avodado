/**
 * Loads a project theme file (`avodado.theme.json`) and maps its friendly
 * color/font names to the CSS variables the renderer reads.
 *
 * The whole point: a user edits one small JSON file with human names
 * (`primary`, `accent`, `ink`…) and re-runs `avo render` — no rebuild, no
 * CSS knowledge. Anything omitted falls back to the built-in theme.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

/** Friendly theme-file shape. Every field is optional. */
export interface ThemeFile {
  /** Optional name, for your own reference. */
  readonly name?: string;
  /** Base built-in theme: textbook | minimal | teal | slate | dark | soft. */
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

const BASE_THEMES = new Set(['textbook', 'minimal', 'teal', 'slate', 'dark', 'soft']);

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
/** Parses one theme file into CSS-variable overrides, or `undefined` if absent. */
function loadThemeFile(path: string): LoadedTheme | undefined {
  if (!existsSync(path)) return undefined;
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

/**
 * Resolves the active theme for `cwd`: the project's `avodado.theme.json` if
 * present, otherwise the global default (`~/.avodado/avodado.theme.json`) so a
 * theme set with `avo theme use <name> --global` applies everywhere.
 */
export function loadTheme(cwd: string): LoadedTheme {
  for (const name of THEME_FILES) {
    const r = loadThemeFile(resolve(cwd, name));
    if (r !== undefined) return r;
  }
  return loadThemeFile(GLOBAL_ACTIVE) ?? {};
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

/** Result of validating a theme file's contents. */
export interface ThemeValidation {
  readonly ok: boolean;
  readonly errors: readonly string[];
  /** Non-fatal issues (e.g. unknown keys that will be ignored). */
  readonly warnings: readonly string[];
  /** The file's `name` field, if present. */
  readonly name?: string;
}

/**
 * Validates the text of a theme file: must be a JSON object with a valid base
 * `theme` and/or at least one recognized `colors`/`fonts` entry. Unknown
 * color/font keys are warnings (they're silently ignored at render time).
 */
export function validateThemeFile(text: string): ThemeValidation {
  let raw: unknown;
  try {
    raw = JSON.parse(stripComments(text));
  } catch (err) {
    return { ok: false, errors: [`not valid JSON — ${(err as Error).message}`], warnings: [] };
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['must be a JSON object'], warnings: [] };
  }
  const file = raw as ThemeFile;
  const errors: string[] = [];
  const warnings: string[] = [];
  let recognized = 0;

  if (file.theme !== undefined) {
    if (typeof file.theme !== 'string' || !BASE_THEMES.has(file.theme)) {
      errors.push(`"theme" must be one of: ${[...BASE_THEMES].join(', ')}`);
    } else {
      recognized += 1;
    }
  }
  const checkSlots = (
    slots: Readonly<Record<string, string>> | undefined,
    field: 'colors' | 'fonts',
    known: Readonly<Record<string, string>>,
  ): void => {
    if (slots === undefined) return;
    if (typeof slots !== 'object' || slots === null) {
      errors.push(`"${field}" must be an object`);
      return;
    }
    for (const key of Object.keys(slots)) {
      if (known[key.toLowerCase()] === undefined) warnings.push(`unknown ${field.slice(0, -1)} "${key}" (ignored)`);
      else recognized += 1;
    }
  };
  checkSlots(file.colors, 'colors', COLOR_TO_VAR);
  checkSlots(file.fonts, 'fonts', FONT_TO_VAR);

  if (errors.length === 0 && recognized === 0) {
    errors.push('no recognized theme fields — need a base "theme" or known "colors"/"fonts"');
  }
  const name = typeof file.name === 'string' && file.name.trim() !== '' ? file.name : undefined;
  return { ok: errors.length === 0, errors, warnings, ...(name !== undefined ? { name } : {}) };
}

/** Directory holding a project's saved themes, relative to the project root. */
export const THEMES_DIR = '.avodado/themes';

/** Absolute directory holding global themes, shared across every project. */
export const GLOBAL_THEMES_DIR = join(homedir(), '.avodado', 'themes');

/** The global default theme file, applied when a project has none of its own. */
export const GLOBAL_ACTIVE = join(homedir(), '.avodado', 'avodado.theme.json');

/** A saved custom theme on disk. */
export interface SavedTheme {
  /** Filename stem (`sunset` for `sunset.theme.json`) — what you pass to `avo theme`. */
  readonly slug: string;
  /** Display name (the file's `name` field, falling back to the slug). */
  readonly name: string;
  /** Absolute path to the theme file. */
  readonly file: string;
  /** Where it lives: `global` (~/.avodado/themes) or `project` (.avodado/themes). */
  readonly scope: 'global' | 'project';
}

/** Resolves the on-disk path for a project-saved theme by slug. */
export function savedThemePath(cwd: string, slug: string): string {
  return resolve(cwd, THEMES_DIR, `${slug}.theme.json`);
}

/** Resolves the on-disk path for a globally-saved theme by slug. */
export function globalThemePath(slug: string): string {
  return join(GLOBAL_THEMES_DIR, `${slug}.theme.json`);
}

/** Reads every `*.theme.json` in one directory into {@link SavedTheme}s. */
function readThemeDir(dir: string, scope: 'global' | 'project'): SavedTheme[] {
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
    out.push({ slug, name, file, scope });
  }
  return out;
}

/**
 * Lists saved custom themes — global ones (in `~/.avodado/themes`, shared across
 * every project) plus this project's (`.avodado/themes`). A project theme shadows
 * a global one with the same slug. Sorted by name.
 */
export function listSavedThemes(cwd: string): SavedTheme[] {
  const bySlug = new Map<string, SavedTheme>();
  for (const t of readThemeDir(GLOBAL_THEMES_DIR, 'global')) bySlug.set(t.slug, t);
  for (const t of readThemeDir(resolve(cwd, THEMES_DIR), 'project')) bySlug.set(t.slug, t);
  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** What `avodado.theme.json` currently resolves to. */
export interface ActiveTheme {
  /** `builtin` (a base theme), `saved` (a saved custom), `custom` (unmatched overrides), or `none`. */
  readonly kind: 'builtin' | 'saved' | 'custom' | 'none';
  /** Built-in name or saved slug, when known. */
  readonly id?: string;
}

/** Normalizes a theme file's text for content comparison. */
function normalizeTheme(text: string): string {
  try {
    return JSON.stringify(JSON.parse(stripComments(text)));
  } catch {
    return text;
  }
}

/**
 * Figures out which theme the active `avodado.theme.json` represents: a plain
 * built-in (no color/font overrides), a saved custom (content matches a file in
 * `.avodado/themes/`), an unmatched custom, or none (no active file).
 */
export function activeTheme(cwd: string, saved: ReadonlyArray<SavedTheme>): ActiveTheme {
  let path = resolve(cwd, 'avodado.theme.json');
  if (!existsSync(path)) path = GLOBAL_ACTIVE; // fall back to the global default
  if (!existsSync(path)) return { kind: 'none' };
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return { kind: 'none' };
  }
  let parsed: ThemeFile;
  try {
    parsed = JSON.parse(stripComments(text)) as ThemeFile;
  } catch {
    return { kind: 'none' };
  }
  const hasColors = parsed.colors !== undefined && Object.keys(parsed.colors).length > 0;
  const hasFonts = parsed.fonts !== undefined && Object.keys(parsed.fonts).length > 0;
  if (!hasColors && !hasFonts) {
    const base = typeof parsed.theme === 'string' && BASE_THEMES.has(parsed.theme) ? parsed.theme : 'textbook';
    return { kind: 'builtin', id: base };
  }
  const activeNorm = normalizeTheme(text);
  for (const s of saved) {
    try {
      if (normalizeTheme(readFileSync(s.file, 'utf8')) === activeNorm) return { kind: 'saved', id: s.slug };
    } catch {
      /* skip unreadable */
    }
  }
  return { kind: 'custom' };
}
