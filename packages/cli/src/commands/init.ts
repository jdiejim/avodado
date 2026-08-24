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
  { id: 'claude', label: 'Claude Code', summary: 'instructions + skill stub + agent + /avo command' },
  { id: 'cursor', label: 'Cursor', summary: 'rule pointer' },
  { id: 'copilot', label: 'GitHub Copilot', summary: 'instructions + skill stub + agent' },
  { id: 'windsurf', label: 'Windsurf', summary: 'rules pointer' },
];

/** The single canonical authoring skill hub (source of truth in the template tree). */
const CANONICAL_SKILL = '.avodado/skill/SKILL.md';

/**
 * The skill's on-demand reference files, in the canonical stitch order
 * (blocks index → contract → the block families → recipes → system-design →
 * decks → intake → organizing → style). They ship beside `SKILL.md` so agents
 * can read them progressively instead of loading one giant file.
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
  '.avodado/skill/reference/recipes.md',
  '.avodado/skill/reference/system-design.md',
  '.avodado/skill/reference/decks.md',
  '.avodado/skill/reference/intake.md',
  '.avodado/skill/reference/organizing.md',
  '.avodado/skill/reference/style-ste.md',
];

/**
 * The complete skill folder: the hub + its reference files, in stitch order.
 * Exemplars are deliberately NOT part of this list — they install to disk
 * (see {@link EXEMPLAR_FILES}) but never enter `stitchSkill()` or the MCP embed.
 */
const SKILL_FILES: readonly string[] = [CANONICAL_SKILL, ...SKILL_REFERENCE_FILES];

/**
 * Finished exemplar documents — dense worked examples the skill's Reference
 * step points at. Installed with the skill (every scope, every tool) but kept
 * out of the single-file stitch/embed to avoid bloat.
 */
export const EXEMPLAR_FILES: readonly string[] = [
  '.avodado/skill/reference/exemplars/backend-arch.md',
  '.avodado/skill/reference/exemplars/data-pipeline.md',
  '.avodado/skill/reference/exemplars/api-reference.md',
  '.avodado/skill/reference/exemplars/incident-postmortem.md',
  '.avodado/skill/reference/exemplars/migration-plan.md',
  '.avodado/skill/reference/exemplars/agent-system.md',
  '.avodado/skill/reference/exemplars/frontend-arch.md',
  '.avodado/skill/reference/exemplars/adr.md',
  '.avodado/skill/reference/exemplars/product-spec.md',
  '.avodado/skill/reference/exemplars/onboarding.md',
];

/** Project types `avo init` can tailor the installed skill to. */
export const SKILL_SCOPES = ['full', 'backend', 'frontend', 'product'] as const;
export type SkillScope = (typeof SKILL_SCOPES)[number];

/** Display metadata for each scope — what the wizard lists. */
export const SCOPE_CHOICES: ReadonlyArray<{ id: SkillScope; label: string }> = [
  { id: 'full', label: 'Full suite — every block family (default)' },
  { id: 'backend', label: 'Backend service — skips design-system + algorithms' },
  { id: 'frontend', label: 'Frontend app — skips api, data-model, algorithms, agentic' },
  { id: 'product', label: 'Product & planning — narrative, tables, flows, charts, planning, business' },
];

/**
 * The block-family files a scope OMITS. Scope filters only the 12
 * `reference/blocks/<family>.md` files — INDEX, contract, recipes, style,
 * intake, organizing, system-design, decks, and the exemplars always install.
 */
const SCOPE_DROPS: Readonly<Record<SkillScope, readonly string[]>> = {
  full: [],
  backend: ['design-system', 'algorithms'],
  frontend: ['api', 'data-model', 'algorithms', 'agentic'],
  product: ['api', 'architecture', 'data-model', 'design-system', 'algorithms', 'agentic'],
};

const familyPath = (family: string): string => `.avodado/skill/reference/blocks/${family}.md`;

/** The on-disk skill for a scope: filtered families + everything else + exemplars. */
export function installedSkillFiles(scope: SkillScope): readonly string[] {
  const dropped = new Set(SCOPE_DROPS[scope].map(familyPath));
  return [...SKILL_FILES.filter((f) => !dropped.has(f)), ...EXEMPLAR_FILES];
}

/**
 * Annotates the installed copy of `reference/blocks/INDEX.md` for a scope: a
 * family-file cell whose file was omitted gets a pointer to the restore
 * command. Pure string transform at install time — the template is never forked.
 */
export function annotateIndex(md: string, scope: SkillScope): string {
  let out = md;
  for (const family of SCOPE_DROPS[scope]) {
    out = out.replaceAll(
      `\`${family}.md\``,
      `\`${family}.md\` (not installed — \`avo install <tool> --full\` adds it)`,
    );
  }
  return out;
}

/** One file `avo init` / `avo install` writes: a template copy or a generated stub. */
interface TemplateEntry {
  /** Template-relative source (ignored for stubs beyond locating the canonical skill). */
  readonly src: string;
  /** Repo-relative destination. */
  readonly dest: string;
  /** `stub` generates a pointer-stub SKILL.md instead of copying `src`. */
  readonly kind?: 'copy' | 'stub';
}

/**
 * Per-tool files. The full skill is written ONCE, at `.avodado/skill/` (in
 * {@link BASE_FILES}); tools with a native skill format (Claude, Copilot) get
 * a generated pointer *stub* — the canonical frontmatter verbatim (so
 * discovery/triggers stay intact) over a short "the real skill lives at
 * `.avodado/skill/`" body ({@link stubSkill}). Rule-file tools (Cursor,
 * Windsurf) get only their pointer rule. The *stitched* single-file form
 * ({@link stitchSkill}) remains for `avo skill` and the MCP embed. Agents are
 * generated only for the tools that actually have an agent format.
 */
const TOOL_FILES: Readonly<Record<AiTool, ReadonlyArray<TemplateEntry>>> = {
  claude: [
    { src: 'CLAUDE.md', dest: 'CLAUDE.md' },
    { src: CANONICAL_SKILL, dest: '.claude/skills/avodado-docs/SKILL.md', kind: 'stub' },
    { src: 'agents/claude-agent.md', dest: '.claude/agents/avodado-doc-writer.md' },
    { src: '.claude/commands/avo.md', dest: '.claude/commands/avo.md' },
  ],
  cursor: [{ src: '.cursor/rules/avodado.mdc', dest: '.cursor/rules/avodado.mdc' }],
  copilot: [
    { src: '.github/copilot-instructions.md', dest: '.github/copilot-instructions.md' },
    { src: CANONICAL_SKILL, dest: '.github/skills/avodado-docs/SKILL.md', kind: 'stub' },
    { src: 'agents/copilot-agent.md', dest: '.github/agents/avodado-doc-writer.agent.md' },
  ],
  windsurf: [{ src: '.windsurfrules', dest: '.windsurfrules' }],
};

/** Files always written, regardless of selections (skill filtered by scope). */
const baseFiles = (scope: SkillScope): readonly string[] => [
  'avodado.config.json',
  'docs/getting-started.md',
  'docs/tutorial.md',
  ...installedSkillFiles(scope),
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
  /**
   * Project type to tailor the installed skill to. Filters only the 12 block
   * family files; recorded in `avodado.config.json` as `skillScope` when it is
   * not `full`. Default: `full`.
   */
  readonly scope?: SkillScope;
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

/**
 * The pointer body under the canonical frontmatter in per-tool skill stubs —
 * five lines that send the agent to the single on-disk skill.
 */
const STUB_BODY = [
  '# Avodado authoring skill — pointer',
  '',
  'The full skill lives at `.avodado/skill/SKILL.md` — read it there, and load its',
  '`reference/` files on demand (`reference/blocks/contract.md` + the family files).',
  'This stub only carries the frontmatter so your tool discovers the skill. Do not',
  'author from it alone, and never edit it by hand — `.avodado/skill/` is the single',
  'source of truth; `avo install <tool>` refreshes both it and this stub.',
].join('\n');

/**
 * Generates a per-tool skill *stub*: the canonical skill's YAML frontmatter
 * verbatim (discovery/triggers intact) + the 5-line pointer body. Written to
 * each native skill location instead of a full copy, so the skill exists once
 * on disk (`.avodado/skill/`).
 */
export async function stubSkill(srcRoot: string = templatesDir()): Promise<string> {
  const canonical = await readFile(resolve(srcRoot, CANONICAL_SKILL), 'utf8');
  const fm = /^---\n[\s\S]*?\n---\n/.exec(canonical);
  if (fm === null) throw new Error(`Canonical skill at ${CANONICAL_SKILL} has no YAML frontmatter`);
  return `${fm[0]}\n${STUB_BODY}\n`;
}

/** Writes one entry to `dst`: a stub, a version-stamped skill file, or a copy. */
async function writeTemplate(
  srcRoot: string,
  entry: TemplateEntry,
  dst: string,
  version: string,
  scope: SkillScope = 'full',
): Promise<void> {
  await mkdir(dirname(dst), { recursive: true });
  if (entry.kind === 'stub') {
    await writeFile(dst, stampSkillVersion(await stubSkill(srcRoot), version), 'utf8');
  } else if (isSkillDest(dst)) {
    const content = stampSkillVersion(await readFile(resolve(srcRoot, entry.src), 'utf8'), version);
    await writeFile(dst, content, 'utf8');
  } else if (scope !== 'full' && entry.dest.endsWith('reference/blocks/INDEX.md')) {
    // The installed INDEX marks the family files this scope omitted.
    const content = annotateIndex(await readFile(resolve(srcRoot, entry.src), 'utf8'), scope);
    await writeFile(dst, content, 'utf8');
  } else {
    await cp(resolve(srcRoot, entry.src), dst);
  }
}

/**
 * Reads the scope recorded in the project's `avodado.config.json`
 * (`"skillScope"`). Missing file, non-JSON config, or an unknown value all
 * mean `full` — scope tailoring is opt-in.
 */
export function recordedSkillScope(cwd: string): SkillScope {
  try {
    const raw = JSON.parse(readFileSync(join(cwd, 'avodado.config.json'), 'utf8')) as {
      skillScope?: unknown;
    };
    const s = raw.skillScope;
    if (s === 'backend' || s === 'frontend' || s === 'product') return s;
  } catch {
    /* no JSON config → full */
  }
  return 'full';
}

/**
 * Records (or clears, for `full`) the chosen scope in `avodado.config.json` so
 * `avo install <tool>` updates with the same subset. No-op when the project
 * has no JSON config.
 */
async function recordSkillScope(cwd: string, scope: SkillScope): Promise<void> {
  const path = join(cwd, 'avodado.config.json');
  if (!existsSync(path)) return;
  const config = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
  if (scope === 'full') {
    if (!('skillScope' in config)) return;
    delete config['skillScope'];
  } else {
    config['skillScope'] = scope;
  }
  await writeFile(path, JSON.stringify(config, null, 2) + '\n', 'utf8');
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
  /** Install the full skill (every family) and clear a recorded project scope. */
  readonly full?: boolean;
}): Promise<InitResult> {
  const srcRoot = templatesDir();
  const version = readCliVersion();
  const created: string[] = [];
  const skipped: string[] = [];
  // The update path honours the scope `avo init` recorded; --full overrides it.
  const scope: SkillScope = opts.full === true ? 'full' : recordedSkillScope(opts.cwd);
  const files: ReadonlyArray<TemplateEntry> = [
    ...installedSkillFiles(scope).map((f) => ({ src: f, dest: f })),
    ...TOOL_FILES[opts.tool],
  ];
  for (const entry of files) {
    const dst = join(opts.cwd, entry.dest);
    if (existsSync(dst) && opts.force === false) {
      skipped.push(entry.dest);
      continue;
    }
    await writeTemplate(srcRoot, entry, dst, version, scope);
    created.push(entry.dest);
  }
  if (opts.full === true) await recordSkillScope(opts.cwd, 'full');
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

  const scope = opts.scope ?? 'full';
  const tools = opts.tools ?? AI_TOOLS.map((t) => t.id);
  const copyList: ReadonlyArray<TemplateEntry> = [
    ...baseFiles(scope).map((f) => ({ src: f, dest: f })),
    ...tools.flatMap((t) => TOOL_FILES[t]),
  ];

  for (const entry of copyList) {
    const dst = join(opts.cwd, entry.dest);
    if (existsSync(dst) && opts.force !== true) {
      skipped.push(entry.dest);
      continue;
    }
    await writeTemplate(srcRoot, entry, dst, version, scope);
    created.push(entry.dest);
  }

  // Record an explicit choice (backend/frontend/product sets `skillScope`,
  // an explicit full clears one) so `avo install <tool>` reuses it.
  if (opts.scope !== undefined) await recordSkillScope(opts.cwd, opts.scope);

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
