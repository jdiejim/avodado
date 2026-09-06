/**
 * Loads a project theme file (`avodado.theme.json`) and maps its friendly
 * color/font names to the CSS variables the renderer reads.
 *
 * The whole point: a user edits one small JSON file with human names
 * (`primary`, `accent`, `ink`…) and re-runs `avo render` — no rebuild, no
 * CSS knowledge. Anything omitted falls back to the built-in theme.
 *
 * Colors map onto the skin's role tokens (`--paper`, `--ink`, `--muted`,
 * `--soft`, `--rule`, `--accent`, `--link`, …) first; the legacy names
 * (`--navy`, `--charcoal`, `--highlight`, …) are emitted as aliases of those
 * roles so the renderers that have not migrated follow the same theme.
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

/** Normalizes a theme name the way `avo theme install` slugs filenames. */
export function themeSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * One friendly color name → the CSS variable it sets, plus the names that
 * derive from it. `role` is a skin role (`packages/render/DESIGN.md`) where
 * one exists, else the legacy variable itself. `aliases` are the legacy names
 * that follow the role (`--navy: var(--ink)`), so a base theme that pins a
 * legacy value (the built-in `dark` does) still yields to the user's role.
 * `derived` are tints computed from the role in CSS.
 */
interface ColorSlot {
  readonly role: string;
  readonly aliases: readonly string[];
  readonly derived?: Readonly<Record<string, string>>;
}

/** Friendly color name → skin role + derived legacy names. */
const COLOR_SLOTS: Readonly<Record<string, ColorSlot>> = {
  paper: {
    // surfaces / card fills; the diagram ground is one step darker
    role: '--paper',
    aliases: ['--white'],
    derived: { '--paper-2': 'color-mix(in srgb, var(--paper) 94%, var(--ink))' },
  },
  ink: { role: '--ink', aliases: ['--charcoal', '--navy'] }, // text, headings, primary strokes
  primary: { role: '--ink', aliases: ['--navy', '--charcoal'] }, // same role; see `colorsToVars`
  muted: { role: '--muted', aliases: ['--gray', '--slate'] }, // captions, secondary text, chips
  soft: { role: '--soft', aliases: [] }, // sublabels, legend text
  rule: { role: '--rule', aliases: [] }, // hairlines, borders, dividers
  accent: {
    // the one focal thing; legacy highlight pills, FK keys, "current" markers
    role: '--accent',
    aliases: ['--highlight'],
    derived: {
      '--accent-tint': 'color-mix(in srgb, var(--accent) 9%, transparent)',
      '--highlight-soft': 'var(--accent-tint)',
    },
  },
  link: { role: '--link', aliases: ['--blue'] }, // HTTP calls, external arrows, links
  secondary: { role: '--link', aliases: ['--blue'] }, // legacy name for `link`
  negative: {
    role: '--negative',
    aliases: [],
    derived: {
      '--negative-tint': 'color-mix(in srgb, var(--negative) 8%, transparent)',
      '--negative-soft': 'var(--negative-tint)',
    },
  },
  // Legacy-only slots: no skin role, they still reach the renderers that
  // have not migrated.
  positive: {
    role: '--positive',
    aliases: [],
    derived: { '--positive-soft': 'color-mix(in srgb, var(--positive) 9%, transparent)' },
  },
  purple: {
    role: '--purple',
    aliases: [],
    derived: { '--purple-soft': 'color-mix(in srgb, var(--purple) 9%, transparent)' },
  },
  teal: {
    role: '--teal',
    aliases: [],
    derived: { '--teal-soft': 'color-mix(in srgb, var(--teal) 9%, transparent)' },
  },
};

/**
 * Maps friendly colors to CSS variables: the skin roles first, then the
 * legacy names as aliases of those roles, then the derived tints. Unknown
 * names are ignored. `primary` and `ink` share the `--ink` role; when a file
 * sets both, `ink` owns the role and `primary` keeps its legacy meaning — the
 * heading / primary-node color (`--navy`) — as a direct value.
 */
function colorsToVars(colors: Readonly<Record<string, string>>): Record<string, string> {
  const roles: Record<string, string> = {};
  const aliases: Record<string, string> = {};
  const derived: Record<string, string> = {};
  const byName = new Map<string, string>();
  for (const key of Object.keys(colors)) {
    const value = colors[key];
    if (typeof value === 'string') byName.set(key.toLowerCase(), value);
  }
  const splitPrimary = byName.has('primary') && byName.has('ink');
  for (const [name, value] of byName) {
    const slot = COLOR_SLOTS[name];
    if (slot === undefined) continue;
    if (name === 'primary' && splitPrimary) {
      aliases['--navy'] = value;
      continue;
    }
    roles[slot.role] = value;
    for (const alias of slot.aliases) {
      if (!(splitPrimary && alias === '--navy')) aliases[alias] = `var(${slot.role})`;
    }
    Object.assign(derived, slot.derived ?? {});
  }
  return { ...roles, ...aliases, ...derived };
}

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
/** A parsed theme file: its raw fields plus its own CSS-variable overrides. */
interface ParsedThemeFile {
  readonly file: ThemeFile;
  readonly vars?: Readonly<Record<string, string>>;
}

/** Reads + parses one theme file. `undefined` = absent; empty fields = malformed. */
function parseThemeFile(path: string): ParsedThemeFile | undefined {
  if (!existsSync(path)) return undefined;
  let raw: unknown;
  try {
    raw = JSON.parse(stripComments(readFileSync(path, 'utf8'))) as unknown;
  } catch {
    return { file: {} }; // malformed file → fall back to the default theme
  }
  const file = raw !== null && typeof raw === 'object' ? (raw as ThemeFile) : {};
  const vars = toVars(file);
  return { file, ...(vars !== undefined ? { vars } : {}) };
}

/** Finds a saved theme by slug or display name (project shadows global). */
export function findSavedTheme(cwd: string, ref: string): SavedTheme | undefined {
  const want = themeSlug(ref);
  if (want === '') return undefined;
  return listSavedThemes(cwd).find((s) => s.slug === want || themeSlug(s.name) === want);
}

/**
 * Resolves one parsed theme file to a base theme + CSS vars. `theme` may be a
 * built-in name, or the name/slug of a saved custom theme (`.avodado/themes`
 * or `~/.avodado/themes`): the saved theme contributes its base + vars, and
 * the referencing file's own overrides win. Resolution is one hop — a saved
 * theme's own `theme` field only counts when it names a built-in — so a
 * self-titled theme (`"theme": "sunset"` inside sunset.theme.json) means
 * "default base + these overrides" and reference cycles are impossible.
 */
function resolveThemeFile(parsed: ParsedThemeFile, cwd: string): LoadedTheme {
  const { file, vars } = parsed;
  const out: { theme?: string; themeVars?: Readonly<Record<string, string>> } = {};
  let merged: Record<string, string> = { ...(vars ?? {}) };
  const ref = typeof file.theme === 'string' ? file.theme : undefined;
  if (ref !== undefined && BASE_THEMES.has(ref)) {
    out.theme = ref;
  } else if (ref !== undefined) {
    const hit = findSavedTheme(cwd, ref);
    const refParsed = hit !== undefined ? parseThemeFile(hit.file) : undefined;
    if (refParsed !== undefined) {
      const base = refParsed.file.theme;
      if (typeof base === 'string' && BASE_THEMES.has(base)) out.theme = base;
      merged = { ...(refParsed.vars ?? {}), ...merged };
    }
    // An unresolvable name degrades to vars-only on the default base —
    // `avo theme install`/`use` validation is where a typo errors loudly.
  }
  if (Object.keys(merged).length > 0) out.themeVars = merged;
  return out;
}

/**
 * Resolves the active theme for `cwd`: the project's `avodado.theme.json` if
 * present, otherwise the global default (`~/.avodado/avodado.theme.json`) so a
 * theme set with `avo theme use <name> --global` applies everywhere.
 */
export function loadTheme(cwd: string): LoadedTheme {
  for (const name of THEME_FILES) {
    const parsed = parseThemeFile(resolve(cwd, name));
    if (parsed !== undefined) return resolveThemeFile(parsed, cwd);
  }
  const global = parseThemeFile(GLOBAL_ACTIVE);
  return global !== undefined ? resolveThemeFile(global, cwd) : {};
}

/** Converts a parsed theme file into CSS-variable overrides. */
function toVars(raw: unknown): Readonly<Record<string, string>> | undefined {
  if (raw === null || typeof raw !== 'object') return undefined;
  const file = raw as ThemeFile;
  const vars: Record<string, string> =
    file.colors !== undefined && file.colors !== null && typeof file.colors === 'object'
      ? colorsToVars(file.colors)
      : {};
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
 * Validates the text of a theme file: must be a JSON object with a valid
 * `theme` and/or at least one recognized `colors`/`fonts` entry. Unknown
 * color/font keys are warnings (they're silently ignored at render time).
 *
 * `theme` may be a built-in, any name in `knownNames` (installed/saved
 * themes), or the file's own `name` — a self-titled theme resolves to
 * "default base + these overrides". Names compare slug-insensitively.
 */
export function validateThemeFile(text: string, knownNames: readonly string[] = []): ThemeValidation {
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
    // Self-titled themes are always valid: `"theme": "sunset"` inside a file
    // named "Sunset" just means "default base + this file's overrides".
    const selfNames = typeof file.name === 'string' ? [file.name] : [];
    const known = new Set([...knownNames, ...selfNames].map(themeSlug).filter((s) => s !== ''));
    if (
      typeof file.theme !== 'string' ||
      (!BASE_THEMES.has(file.theme) && !known.has(themeSlug(file.theme)))
    ) {
      const installed = [...new Set(knownNames)];
      errors.push(
        `"theme" must be a built-in (${[...BASE_THEMES].join(', ')})` +
          (installed.length > 0
            ? ` or an installed theme (${installed.join(', ')})`
            : ' or an installed theme (none installed yet — `avo theme install <path>`)'),
      );
    } else {
      recognized += 1;
    }
  }
  const checkSlots = (
    slots: Readonly<Record<string, string>> | undefined,
    field: 'colors' | 'fonts',
    known: Readonly<Record<string, unknown>>,
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
  checkSlots(file.colors, 'colors', COLOR_SLOTS);
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
  /** Display name for a saved/custom theme (the file's `name`), when known. */
  readonly name?: string;
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
  // A `theme` that names a saved theme (by slug or display name) IS that
  // saved theme, whether or not the file also carries local overrides.
  if (typeof parsed.theme === 'string' && !BASE_THEMES.has(parsed.theme)) {
    const want = themeSlug(parsed.theme);
    const hit = saved.find((s) => s.slug === want || themeSlug(s.name) === want);
    if (hit !== undefined) return { kind: 'saved', id: hit.slug, name: hit.name };
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
      if (normalizeTheme(readFileSync(s.file, 'utf8')) === activeNorm) {
        return { kind: 'saved', id: s.slug, name: s.name };
      }
    } catch {
      /* skip unreadable */
    }
  }
  const name = typeof parsed.name === 'string' && parsed.name.trim() !== '' ? parsed.name : undefined;
  return { kind: 'custom', ...(name !== undefined ? { name } : {}) };
}

/** One saved theme as `/api/meta` reports it: identity + resolved base/vars. */
export interface StudioSavedTheme {
  readonly slug: string;
  readonly name: string;
  readonly scope: 'global' | 'project';
  /** Resolved base built-in, when the saved file names one. */
  readonly theme?: string;
  readonly themeVars?: Readonly<Record<string, string>>;
}

/**
 * Everything the studio needs to know about themes, in one reload-per-request
 * snapshot: the resolved active theme (base + vars, as `loadTheme` returns),
 * WHAT that active theme is (built-in / saved / custom, with its name), and
 * every saved theme with its own resolved base + vars so the picker can list
 * and preview them.
 */
export interface StudioThemeInfo {
  readonly theme?: string;
  readonly themeVars?: Readonly<Record<string, string>>;
  readonly active: ActiveTheme;
  readonly savedThemes: readonly StudioSavedTheme[];
}

/** Builds the theme portion of the studio's `/api/meta` response. */
export function studioThemeInfo(cwd: string): StudioThemeInfo {
  const saved = listSavedThemes(cwd);
  const { theme, themeVars } = loadTheme(cwd);
  const active = activeTheme(cwd, saved);
  const savedThemes = saved.map((s): StudioSavedTheme => {
    const parsed = parseThemeFile(s.file);
    const resolved = parsed !== undefined ? resolveThemeFile(parsed, cwd) : {};
    return {
      slug: s.slug,
      name: s.name,
      scope: s.scope,
      ...(resolved.theme !== undefined ? { theme: resolved.theme } : {}),
      ...(resolved.themeVars !== undefined ? { themeVars: resolved.themeVars } : {}),
    };
  });
  return {
    ...(theme !== undefined ? { theme } : {}),
    ...(themeVars !== undefined ? { themeVars } : {}),
    active,
    savedThemes,
  };
}
