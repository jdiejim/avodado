/**
 * `avo init` — scaffold a new Avodado project in the current directory.
 *
 * Always writes the base tree (docs sample, config, the authoring skill).
 * Editor adapters (Claude Code, Cursor, Copilot, Windsurf) and the theme file
 * are written based on the caller's selections — the interactive wizard
 * ({@link InitApp}) collects them, but they can also be passed directly.
 */

import { cp, mkdir, writeFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** AI tools `avo init` can generate an adapter file for. */
export type AiTool = 'claude' | 'cursor' | 'copilot' | 'windsurf';

/** Display metadata + target path for each AI-tool adapter. */
export const AI_TOOLS: ReadonlyArray<{ id: AiTool; label: string; file: string }> = [
  { id: 'claude', label: 'Claude Code', file: 'CLAUDE.md' },
  { id: 'cursor', label: 'Cursor', file: '.cursor/rules/avodado.mdc' },
  { id: 'copilot', label: 'GitHub Copilot', file: '.github/copilot-instructions.md' },
  { id: 'windsurf', label: 'Windsurf', file: '.windsurfrules' },
];

const ADAPTER_FILE: Readonly<Record<AiTool, string>> = {
  claude: 'CLAUDE.md',
  cursor: '.cursor/rules/avodado.mdc',
  copilot: '.github/copilot-instructions.md',
  windsurf: '.windsurfrules',
};

/** Files always written, regardless of selections. */
const BASE_FILES: readonly string[] = [
  'avodado.config.json',
  'docs/getting-started.md',
  '.avodado/skill/SKILL.md',
];

export interface InitOptions {
  readonly cwd: string;
  /** Overwrite files that already exist. Default: false (skip with a notice). */
  readonly force?: boolean;
  /** Which AI-tool adapters to generate. Default: all of them. */
  readonly tools?: readonly AiTool[];
  /** Built-in theme name to record in `avodado.theme.json`. */
  readonly theme?: string;
  /**
   * Scaffold a full `avodado.theme.json` with friendly color/font slots to edit.
   * When false, a theme file is only written if `theme` is a non-default theme.
   */
  readonly customTheme?: boolean;
}

export interface InitResult {
  readonly created: readonly string[];
  readonly skipped: readonly string[];
}

/**
 * Resolves the templates directory packaged with the CLI.
 *
 * Walks up from this module's location looking for a `templates` sibling.
 * Works for both `dist/bin.js` (one level up) and source layout
 * (`src/commands/init.ts`, two levels up).
 */
function templatesDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'templates');
    if (existsSync(candidate) && statSync(candidate).isDirectory()) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`Could not locate avodado/cli templates directory near ${import.meta.url}`);
}

/** Builds the `avodado.theme.json` contents for a chosen base theme. */
function themeFileContents(theme: string, custom: boolean): string {
  const base: Record<string, unknown> = {
    name: 'My theme',
    '//': '1) Pick a base theme. 2) Optionally override colors/fonts. Re-run `avo render` — no rebuild.',
    theme,
    '//theme-options': 'minimal (default, clean white) | soft (modern, white) | dark | teal | plum | slate',
  };
  if (custom) {
    base['//colors'] =
      'Optional overrides on top of the base theme. Any of: primary, secondary, accent, positive, negative, purple, teal, ink, muted, rule, paper. Values are any CSS color.';
    base['colors'] = {};
    base['//fonts'] = 'Optional. display | body | mono. Use single quotes inside font names.';
    base['fonts'] = {};
  }
  return JSON.stringify(base, null, 2) + '\n';
}

/**
 * Scaffolds an Avodado project into `cwd`. Writes the base tree, the adapters
 * for the selected `tools` (defaults to all), and — when a non-default or custom
 * theme is chosen — an `avodado.theme.json`. Existing files are skipped unless
 * `force: true`. Returns the created/skipped relative paths for reporting.
 */
export async function runInit(opts: InitOptions): Promise<InitResult> {
  const srcRoot = templatesDir();
  const created: string[] = [];
  const skipped: string[] = [];

  const tools = opts.tools ?? AI_TOOLS.map((t) => t.id);
  const copyList = [...BASE_FILES, ...tools.map((t) => ADAPTER_FILE[t])];

  for (const rel of copyList) {
    const dst = join(opts.cwd, rel);
    if (existsSync(dst) && opts.force !== true) {
      skipped.push(rel);
      continue;
    }
    await mkdir(dirname(dst), { recursive: true });
    await cp(resolve(srcRoot, rel), dst);
    created.push(rel);
  }

  // Theme file: only when the user picked a non-default theme or asked for a
  // custom scaffold (the default `minimal` needs no file).
  const wantThemeFile = opts.customTheme === true || (opts.theme !== undefined && opts.theme !== 'minimal');
  if (wantThemeFile) {
    const rel = 'avodado.theme.json';
    const dst = join(opts.cwd, rel);
    if (existsSync(dst) && opts.force !== true) {
      skipped.push(rel);
    } else {
      await writeFile(dst, themeFileContents(opts.theme ?? 'minimal', opts.customTheme === true), 'utf8');
      created.push(rel);
    }
  }

  return { created, skipped };
}
