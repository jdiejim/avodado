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

/** AI tools `avo init` can generate config for. */
export type AiTool = 'claude' | 'cursor' | 'copilot' | 'windsurf';

/** Display metadata for each AI tool — what the wizard lists. */
export const AI_TOOLS: ReadonlyArray<{ id: AiTool; label: string; summary: string }> = [
  { id: 'claude', label: 'Claude Code', summary: 'instructions + skill + agent' },
  { id: 'cursor', label: 'Cursor', summary: 'rule + skill' },
  { id: 'copilot', label: 'GitHub Copilot', summary: 'instructions + prompt + agent' },
  { id: 'windsurf', label: 'Windsurf', summary: 'rules + skill' },
];

/** The single canonical authoring skill (source of truth in the template tree). */
const CANONICAL_SKILL = '.avodado/skill/SKILL.md';

/**
 * Per-tool files. Each entry copies template file `src` → repo-relative `dest`.
 * The same `CANONICAL_SKILL` is installed verbatim into every tool's native
 * skill location, so all tools share one identical skill. Agents are generated
 * only for the tools that actually have an agent format (Claude, Copilot).
 */
const TOOL_FILES: Readonly<Record<AiTool, ReadonlyArray<{ src: string; dest: string }>>> = {
  claude: [
    { src: 'CLAUDE.md', dest: 'CLAUDE.md' },
    { src: CANONICAL_SKILL, dest: '.claude/skills/avodado-docs/SKILL.md' },
    { src: 'agents/claude-agent.md', dest: '.claude/agents/avodado-doc-writer.md' },
  ],
  cursor: [
    { src: '.cursor/rules/avodado.mdc', dest: '.cursor/rules/avodado.mdc' },
    { src: CANONICAL_SKILL, dest: '.cursor/skills/avodado-docs/SKILL.md' },
  ],
  copilot: [
    { src: '.github/copilot-instructions.md', dest: '.github/copilot-instructions.md' },
    { src: CANONICAL_SKILL, dest: '.github/prompts/avodado-docs.prompt.md' },
    { src: 'agents/copilot-agent.md', dest: '.github/agents/avodado-doc-writer.agent.md' },
  ],
  windsurf: [
    { src: '.windsurfrules', dest: '.windsurfrules' },
    { src: CANONICAL_SKILL, dest: '.windsurf/skills/avodado-docs/SKILL.md' },
  ],
};

/** Files always written, regardless of selections. */
const BASE_FILES: readonly string[] = [
  'avodado.config.json',
  'docs/getting-started.md',
  CANONICAL_SKILL,
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
    '//theme-options': 'textbook (default, warm serif) | minimal (clean white) | soft (modern, white) | dark | teal | plum | slate',
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
  const copyList: ReadonlyArray<{ src: string; dest: string }> = [
    ...BASE_FILES.map((f) => ({ src: f, dest: f })),
    ...tools.flatMap((t) => TOOL_FILES[t]),
  ];

  for (const { src, dest } of copyList) {
    const dst = join(opts.cwd, dest);
    if (existsSync(dst) && opts.force !== true) {
      skipped.push(dest);
      continue;
    }
    await mkdir(dirname(dst), { recursive: true });
    await cp(resolve(srcRoot, src), dst);
    created.push(dest);
  }

  // Theme file: only when the user picked a non-default theme or asked for a
  // custom scaffold (the default `textbook` needs no file).
  const wantThemeFile = opts.customTheme === true || (opts.theme !== undefined && opts.theme !== 'textbook');
  if (wantThemeFile) {
    const rel = 'avodado.theme.json';
    const dst = join(opts.cwd, rel);
    if (existsSync(dst) && opts.force !== true) {
      skipped.push(rel);
    } else {
      await writeFile(dst, themeFileContents(opts.theme ?? 'textbook', opts.customTheme === true), 'utf8');
      created.push(rel);
    }
  }

  return { created, skipped };
}
