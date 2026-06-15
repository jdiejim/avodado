/**
 * Loads a project theme file (`avodado.theme.json`) and maps its friendly
 * color/font names to the CSS variables the renderer reads.
 *
 * The whole point: a user edits one small JSON file with human names
 * (`primary`, `accent`, `ink`…) and re-runs `avo render` — no rebuild, no
 * CSS knowledge. Anything omitted falls back to the built-in theme.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
