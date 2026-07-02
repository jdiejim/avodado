/**
 * `avo init` — scaffold a new Avodado project in the current directory.
 *
 * Always writes the base tree (docs sample, config, the authoring skill).
 * Editor adapters (Claude Code, Cursor, Copilot, Windsurf) and the theme file
 * are written based on the caller's selections — the interactive wizard
 * ({@link InitApp}) collects them, but they can also be passed directly.
 */

import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** AI tools `avo init` can generate config for. */
export type AiTool = 'claude' | 'cursor' | 'copilot' | 'windsurf';

/** Display metadata for each AI tool — what the wizard lists. */
export const AI_TOOLS: ReadonlyArray<{ id: AiTool; label: string; summary: string }> = [
  { id: 'claude', label: 'Claude Code', summary: 'instructions + skill + agent' },
  { id: 'cursor', label: 'Cursor', summary: 'rule + skill' },
  { id: 'copilot', label: 'GitHub Copilot', summary: 'instructions + skill + agent' },
  { id: 'windsurf', label: 'Windsurf', summary: 'rules + skill' },
];

/** The single canonical authoring skill hub (source of truth in the template tree). */
const CANONICAL_SKILL = '.avodado/skill/SKILL.md';

/**
 * The skill's on-demand reference files, in the canonical stitch order
 * (blocks index → contract → the block families → system-design → decks →
 * intake → organizing). They ship beside `SKILL.md` so agents can read them
 * progressively instead of loading one giant file.
 *
 * Keep this list in sync with `packages/mcp/scripts/embed-skill.mjs` (FILES).
 */
export const SKILL_REFERENCE_FILES: readonly string[] = [
  '.avodado/skill/reference/blocks/INDEX.md',
  '.avodado/skill/reference/blocks/contract.md',
  '.avodado/skill/reference/blocks/narrative.md',
  '.avodado/skill/reference/blocks/tables-data.md',
  '.avodado/skill/reference/blocks/api.md',
  '.avodado/skill/reference/blocks/architecture.md',
  '.avodado/skill/reference/blocks/flows.md',
  '.avodado/skill/reference/blocks/data-model.md',
  '.avodado/skill/reference/blocks/charts-overviews.md',
  '.avodado/skill/reference/blocks/planning.md',
  '.avodado/skill/reference/blocks/business.md',
  '.avodado/skill/reference/blocks/design-system.md',
  '.avodado/skill/reference/blocks/algorithms.md',
  '.avodado/skill/reference/blocks/agentic.md',
  '.avodado/skill/reference/system-design.md',
  '.avodado/skill/reference/decks.md',
  '.avodado/skill/reference/intake.md',
  '.avodado/skill/reference/organizing.md',
];

/** The complete skill folder: the hub + its reference files. */
const SKILL_FILES: readonly string[] = [CANONICAL_SKILL, ...SKILL_REFERENCE_FILES];

/** Maps the whole skill folder (hub + `reference/`) into a tool's native skill dir. */
const skillInto = (dir: string): Array<{ src: string; dest: string }> =>
  SKILL_FILES.map((f) => ({ src: f, dest: f.replace('.avodado/skill', dir) }));

/**
 * Per-tool files. Each entry copies template file `src` → repo-relative `dest`.
 * The same canonical skill folder is installed verbatim into every tool's
 * native skill location (Copilot included — Agent Skills use the same SKILL.md
 * folder format in `.github/skills/`), so all tools share one identical skill.
 * The *stitched* single-file form ({@link stitchSkill}) remains for `avo skill`
 * and the MCP embed. Agents are generated only for the tools that actually
 * have an agent format (Claude, Copilot).
 */
const TOOL_FILES: Readonly<Record<AiTool, ReadonlyArray<{ src: string; dest: string }>>> = {
  claude: [
    { src: 'CLAUDE.md', dest: 'CLAUDE.md' },
    ...skillInto('.claude/skills/avodado-docs'),
    { src: 'agents/claude-agent.md', dest: '.claude/agents/avodado-doc-writer.md' },
  ],
  cursor: [
    { src: '.cursor/rules/avodado.mdc', dest: '.cursor/rules/avodado.mdc' },
    ...skillInto('.cursor/skills/avodado-docs'),
  ],
  copilot: [
    { src: '.github/copilot-instructions.md', dest: '.github/copilot-instructions.md' },
    // Copilot supports Agent Skills (the same SKILL.md folder format) in
    // .github/skills/ — install the real skill with its reference/ spokes so
    // progressive disclosure works, instead of the old stitched prompt file.
    ...skillInto('.github/skills/avodado-docs'),
    { src: 'agents/copilot-agent.md', dest: '.github/agents/avodado-doc-writer.agent.md' },
  ],
  windsurf: [
    { src: '.windsurfrules', dest: '.windsurfrules' },
    ...skillInto('.windsurf/skills/avodado-docs'),
  ],
};

/** Files always written, regardless of selections. */
const BASE_FILES: readonly string[] = [
  'avodado.config.json',
  'docs/getting-started.md',
  'docs/tutorial.md',
  ...SKILL_FILES,
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
export function templatesDir(): string {
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
export function themeFileContents(theme: string, custom: boolean, name = 'My theme'): string {
  const base: Record<string, unknown> = {
    name,
    '//': '1) Pick a base theme. 2) Optionally override colors/fonts. Re-run `avo render` — no rebuild.',
    theme,
    '//theme-options': 'textbook (default, warm serif) | minimal (clean white) | soft (modern, white) | dark | teal | slate',
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

/** Reads @avodado/cli's own version (stamped into installed skills). */
function readCliVersion(): string {
  try {
    let dir = dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < 6; i++) {
      const p = join(dir, 'package.json');
      if (existsSync(p)) {
        const j = JSON.parse(readFileSync(p, 'utf8')) as { name?: string; version?: string };
        if (j.name === '@avodado/cli' && typeof j.version === 'string') return j.version;
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    /* ignore */
  }
  return '0.0.0';
}

const isSkillDest = (dest: string): boolean => dest.endsWith('SKILL.md');

/** Adds/refreshes a `version:` line in a skill's YAML frontmatter. */
function stampSkillVersion(md: string, version: string): string {
  if (/^version:/m.test(md)) return md.replace(/^version:.*$/m, `version: ${version}`);
  return md.replace(/^(name:.*)$/m, `$1\nversion: ${version}`);
}

/**
 * Stitches the skill hub + every reference file (in {@link SKILL_REFERENCE_FILES}
 * order) into one self-contained markdown document, for consumers with no
 * filesystem beside the skill: the Copilot prompt file, `avo skill`, and the
 * MCP server's embed. The hub's "live beside this file" pointer language is
 * rewritten since the references follow inline.
 */
export async function stitchSkill(srcRoot: string = templatesDir()): Promise<string> {
  const parts = await Promise.all(SKILL_FILES.map((f) => readFile(resolve(srcRoot, f), 'utf8')));
  return (
    parts.map((p) => p.trimEnd()).join('\n\n---\n\n') +
    '\n'
  ).replaceAll(
    'live beside this file — read them on demand',
    'are included in full below — read them on demand',
  );
}

/** Copies one template file to `dst`, stamping the version into skill files. */
async function writeTemplate(srcRoot: string, src: string, dst: string, version: string): Promise<void> {
  await mkdir(dirname(dst), { recursive: true });
  if (dst.endsWith('.prompt.md')) {
    await writeFile(dst, stampSkillVersion(await stitchSkill(srcRoot), version), 'utf8');
  } else if (isSkillDest(dst)) {
    const content = stampSkillVersion(await readFile(resolve(srcRoot, src), 'utf8'), version);
    await writeFile(dst, content, 'utf8');
  } else {
    await cp(resolve(srcRoot, src), dst);
  }
}

/**
 * Installs (or updates) just one AI tool's adapter + the shared skill, stamped
 * with the current CLI version. Overwrites by default (this is the update path).
 * Backs `avo claude` / `avo cursor` / `avo github` / `avo windsurf`.
 */
export async function installTool(opts: {
  readonly cwd: string;
  readonly tool: AiTool;
  readonly force?: boolean;
}): Promise<InitResult> {
  const srcRoot = templatesDir();
  const version = readCliVersion();
  const created: string[] = [];
  const skipped: string[] = [];
  const files = [...SKILL_FILES.map((f) => ({ src: f, dest: f })), ...TOOL_FILES[opts.tool]];
  for (const { src, dest } of files) {
    const dst = join(opts.cwd, dest);
    if (existsSync(dst) && opts.force === false) {
      skipped.push(dest);
      continue;
    }
    await writeTemplate(srcRoot, src, dst, version);
    created.push(dest);
  }
  return { created, skipped };
}

/**
 * Scaffolds an Avodado project into `cwd`. Writes the base tree, the adapters
 * for the selected `tools` (defaults to all), and — when a non-default or custom
 * theme is chosen — an `avodado.theme.json`. Existing files are skipped unless
 * `force: true`. Returns the created/skipped relative paths for reporting.
 */
export async function runInit(opts: InitOptions): Promise<InitResult> {
  const srcRoot = templatesDir();
  const version = readCliVersion();
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
    await writeTemplate(srcRoot, src, dst, version);
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
