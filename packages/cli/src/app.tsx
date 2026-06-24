/**
 * CLI dispatcher. Parses argv via commander, runs the matching command, and
 * decides between Ink rendering, plain output, and JSON output based on
 * {@link isInteractive} and `--json` flags.
 */

import { Command } from 'commander';
import pc from 'picocolors';
import React from 'react';
import { render as inkRender, Text } from 'ink';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './io/config.js';
import { runCheck } from './commands/check.js';
import { runRender } from './commands/render.js';
import { runSingle, type SingleFormat } from './commands/single.js';
import { runDemo } from './commands/demo.js';
import { runCatalog, BLOCK_DESCRIPTIONS } from './commands/catalog.js';
import {
  DESIGN_PATTERNS,
  findPattern,
  patternDoc,
  runDesignGallery,
  type DesignCategory,
} from './commands/design.js';
import { runPreview } from './commands/preview.js';
import {
  runInit,
  installTool,
  themeFileContents,
  AI_TOOLS,
  type InitResult,
  type AiTool,
} from './commands/init.js';
import { InitApp } from './commands/InitApp.js';
import { ThemeApp } from './commands/ThemeApp.js';
import { PromptApp } from './commands/PromptApp.js';
import {
  BUILTIN_PROMPTS,
  listSavedPrompts,
  savedPromptPath,
  readSavedPrompt,
  newPromptContents,
  copyToClipboard,
  PROMPTS_DIR,
} from './commands/prompts.js';
import {
  listSavedThemes,
  savedThemePath,
  globalThemePath,
  validateThemeFile,
  activeTheme,
  THEMES_DIR,
  GLOBAL_THEMES_DIR,
  GLOBAL_ACTIVE,
} from './io/theme.js';
import { systemPrompt } from './commands/skill.js';
import { confirm } from './io/prompt.js';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { basename, resolve as resolvePath } from 'node:path';
import { runSyncOpenApi } from './commands/sync.js';
import { templateFor, writeNewDoc, DOC_TEMPLATES, isDocTemplate } from './commands/new.js';
import { DiagnosticsTable, formatDiagnosticsPlain } from './ui/DiagnosticsTable.js';
import { banner, examples, logo, actionBanner, funLine } from './ui/banner.js';
import { isInteractive } from './tty.js';

/** Prints the cfonts action banner + a fun line for a command (interactive only). */
function flourish(word: string, lineKey: string = word): void {
  if (!isInteractive) return;
  console.log(actionBanner(word));
  console.log(funLine(lineKey) + '\n');
}
import type { BlockType } from '@avodado/core';
import { BLOCK_TYPES } from '@avodado/core';

/**
 * Reads @avodado/cli's own version from the nearest package.json. Walks up from
 * this module so it works from both `dist/bin.js` and the source layout.
 */
function cliVersion(): string {
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
    /* fall through to the placeholder below */
  }
  return '0.0.0';
}

/** Prints the created/skipped files and next-step hints after `avo init`. */
function printInitSummary(result: InitResult, theme: string): void {
  for (const f of result.created) console.log(pc.green('+ ') + f);
  for (const f of result.skipped) console.log(pc.dim('  skip ') + f + pc.dim(' (exists)'));
  console.log(
    pc.bold(`\nCreated ${result.created.length} file(s), skipped ${result.skipped.length}.`) +
      pc.dim(` (theme: ${theme})`),
  );
  console.log(
    `Next: ${pc.cyan('avo check')} ${pc.dim('·')} ${pc.cyan('avo preview docs/getting-started.md')}`,
  );
}

/** Runs the CLI for the given argv (typically `process.argv`). */
export async function main(argv: readonly string[]): Promise<number> {
  const version = cliVersion();
  const program = new Command();
  program
    .name('avo')
    .description('Author, validate, render, and export Avodado documentation.')
    .version(version)
    // Banner + workflow only on top-level help — not on every subcommand's --help.
    .addHelpText('beforeAll', (ctx) => (ctx.command.name() === 'avo' ? banner(version) : ''))
    .addHelpText('after', (ctx) => (ctx.command.name() === 'avo' ? examples() : ''))
    .exitOverride();

  let exitCode = 0;

  program
    .command('init')
    .description('Scaffold a new Avodado project in the current directory')
    .option('--force', 'overwrite existing files')
    .option('-y, --yes', 'skip the wizard — scaffold with defaults (all tools, textbook theme)')
    .action(async (opts: { force?: boolean; yes?: boolean }) => {
      const cwd = process.cwd();
      const force = opts.force === true;

      // Interactive wizard: pick AI-tool adapters + a theme, with a logo.
      if (isInteractive && opts.yes !== true) {
        console.log(logo());
        let captured: { result: InitResult; theme: string } | undefined;
        const { waitUntilExit } = inkRender(
          <InitApp
            cwd={cwd}
            {...(force ? { force: true } : {})}
            onComplete={(result, theme) => {
              captured = { result, theme };
            }}
          />,
        );
        await waitUntilExit();
        if (captured !== undefined) printInitSummary(captured.result, captured.theme);
        return;
      }

      // Non-interactive (CI) or --yes: scaffold with defaults.
      const result = await runInit({ cwd, ...(force ? { force: true } : {}) });
      printInitSummary(result, 'textbook');
    });


  program
    .command('check [globs...]')
    .description('Validate documents (default: docs/**/*.md)')
    .option('--json', 'emit machine-readable JSON')
    .action(async (globs: string[], opts: { json?: boolean }) => {
      const cwd = process.cwd();
      const config = await loadConfig(cwd);
      const patterns = globs.length > 0 ? globs : [`${config.docsDir}/**/*.md`];
      const result = await runCheck({ patterns, cwd, docsRoot: config.docsDir });
      if (opts.json === true) {
        process.stdout.write(
          JSON.stringify({ diagnostics: result.diagnostics, files: result.files }, null, 2) + '\n',
        );
      } else if (isInteractive) {
        flourish('check');
        const { waitUntilExit } = inkRender(
          <DiagnosticsTable
            diagnostics={result.diagnostics}
            fileCount={result.files.length}
            sources={result.sources}
          />,
        );
        await waitUntilExit();
      } else {
        process.stdout.write(
          formatDiagnosticsPlain(result.diagnostics, result.files.length, result.sources),
        );
      }
      exitCode = result.exitCode;
    });

  program
    .command('render <input>')
    .description('Render one document to a standalone HTML file')
    .option('-o, --output <path>', 'output file path (defaults to <input>.html)')
    .action(async (input: string, opts: { output?: string }) => {
      const cwd = process.cwd();
      flourish('render');
      const result = await runRender({
        cwd,
        input,
        ...(opts.output !== undefined ? { output: opts.output } : {}),
      });
      if (isInteractive) {
        const { waitUntilExit } = inkRender(
          <Text>
            <Text color="green">✓ </Text>Wrote <Text bold>{result.output}</Text>{' '}
            <Text dimColor>({result.bytes} bytes)</Text>
          </Text>,
        );
        await waitUntilExit();
      } else {
        console.log(`${pc.green('✓')} rendered ${result.output} ${pc.dim(`(${result.bytes} bytes)`)}`);
      }
    });


  program
    .command('preview <input>')
    .description('Render a document to a temp HTML file and open it')
    .action(async (input: string) => {
      const cwd = process.cwd();
      flourish('preview');
      const result = await runPreview({ cwd, input });
      console.log(pc.green('✓ ') + 'Opened ' + result.file);
    });

  const syncCmd = program.command('sync').description('Generate Avodado docs from external sources (OpenAPI)');
  syncCmd
    .command('openapi <spec>')
    .description('Generate (or drift-check) a doc from an OpenAPI 3.x spec')
    .option('-o, --out <path>', 'write generated markdown to this path')
    .option('--check <path>', 'compare against an existing doc and fail on drift')
    .option('--slug <slug>', 'block-id namespace (defaults to the output basename)')
    .action(
      async (
        spec: string,
        opts: { out?: string; check?: string; slug?: string },
      ) => {
        const result = await runSyncOpenApi({
          cwd: process.cwd(),
          spec,
          ...(opts.out !== undefined ? { out: opts.out } : {}),
          ...(opts.check !== undefined ? { check: opts.check } : {}),
          ...(opts.slug !== undefined ? { slug: opts.slug } : {}),
        });
        if (result.exitCode === 0) {
          console.log(pc.green('✓ ') + result.message);
        } else {
          console.error(pc.red(result.message));
          if (result.diff !== undefined) console.error(result.diff);
        }
        exitCode = result.exitCode;
      },
    );

  // Single-document shortcuts: `avo html|slides|pdf <input> [-o out] [-p]`.
  const single = (name: SingleFormat, desc: string): void => {
    program
      .command(`${name} <input>`)
      .description(desc)
      .option('-o, --output <path>', 'output file path')
      .option('-p, --preview', 'render to a temp file and open it in the browser')
      .action(async (input: string, opts: { output?: string; preview?: boolean }) => {
        const word = opts.preview === true ? 'preview' : name;
        if (isInteractive) {
          console.log(actionBanner(word));
          console.log(funLine(word) + '\n');
        }
        const result = await runSingle({
          cwd: process.cwd(),
          input,
          format: name,
          ...(opts.output !== undefined ? { output: opts.output } : {}),
          ...(opts.preview === true ? { preview: true } : {}),
        });
        const verb = result.opened ? 'Opened' : 'Wrote';
        console.log(`${pc.green(verb)} ${result.output} ${pc.dim(`(${result.bytes} bytes)`)}`);
      });
  };
  single('html', 'Render one document to a standalone HTML file');
  single('slides', 'Render one document to a self-contained slide deck');
  single('pdf', 'Render one document to a PDF (needs Chromium once)');

  // `avo demo [-s]` — render the bundled showcase doc and open it (-s = slides).
  program
    .command('demo')
    .description('Render the built-in showcase of every block and open it (-s for a slide deck)')
    .option('-s, --slides', 'render as a slide deck')
    .option('--no-open', "write the file but don't open it")
    .action(async (opts: { slides?: boolean; open?: boolean }) => {
      flourish('demo');
      const result = await runDemo({ format: opts.slides === true ? 'slides' : 'html', preview: opts.open !== false });
      const verb = result.opened ? 'Opened' : 'Wrote';
      console.log(`${pc.green(verb)} ${result.output} ${pc.dim(`(${result.bytes} bytes)`)}`);
    });

  // `avo catalog` — print the block catalog in the terminal; `-p` opens an HTML
  // gallery of live samples, `-s` a slide deck.
  program
    .command('catalog')
    .description('List every block + description in the terminal (-p opens an HTML gallery, -s a slide deck)')
    .option('-p, --preview', 'render an HTML gallery of every block and open it')
    .option('-s, --slides', 'render the gallery as a slide deck (implies -p)')
    .option('-o, --output <path>', 'write the rendered gallery to a file')
    .action(async (opts: { preview?: boolean; slides?: boolean; output?: string }) => {
      const wantRender = opts.preview === true || opts.slides === true || opts.output !== undefined;
      if (!wantRender) {
        console.log(pc.bold(`${BLOCK_TYPES.length} block types:`));
        for (const t of BLOCK_TYPES) {
          console.log(`  ${pc.cyan(t.padEnd(13))}${pc.dim(BLOCK_DESCRIPTIONS[t])}`);
        }
        console.log(pc.dim('\n-p opens an HTML gallery of live samples · -s a slide deck'));
        return;
      }
      flourish('catalog', 'demo');
      const result = await runCatalog({
        format: opts.slides === true ? 'slides' : 'html',
        ...(opts.output !== undefined ? { output: opts.output } : {}),
      });
      const verb = result.opened ? 'Opened' : 'Wrote';
      console.log(`${pc.green(verb)} ${result.output} ${pc.dim(`(${result.bytes} bytes)`)}`);
    });

  // `avo design [name]` — list patterns in the terminal, print a template
  // (<slug>), or render a gallery (`-p` HTML, `-s` slides).
  program
    .command('design [name]')
    .description('Design patterns — list (default), print a template (<slug>), or render a gallery (-p / -s)')
    .option('-o, --output <path>', 'write the template (with <slug>) or the gallery to a file')
    .option('-p, --preview', 'render an HTML gallery of the patterns and open it')
    .option('-s, --slides', 'render the gallery as a slide deck (implies -p)')
    .option('--system', 'only system-design patterns')
    .option('--ai', 'only AI / agent patterns')
    .option('--code', 'only code (GoF) design patterns')
    .action(
      async (
        name: string | undefined,
        opts: { output?: string; preview?: boolean; slides?: boolean; system?: boolean; ai?: boolean; code?: boolean },
      ) => {
        const filter =
          opts.system === true ? 'system' : opts.ai === true ? 'ai' : opts.code === true ? 'code' : undefined;

        // No slug + a render flag → render the gallery (optionally filtered).
        if (name === undefined && (opts.preview === true || opts.slides === true || opts.output !== undefined)) {
          flourish('design', 'demo');
          const result = await runDesignGallery({
            ...(filter !== undefined ? { filter } : {}),
            format: opts.slides === true ? 'slides' : 'html',
            ...(opts.output !== undefined ? { output: opts.output } : {}),
          });
          const verb = result.opened ? 'Opened' : 'Wrote';
          console.log(`${pc.green(verb)} ${result.output} ${pc.dim(`(${result.bytes} bytes)`)}`);
          return;
        }

        // `avo design <slug>` — print the ready template (or write it with -o).
        if (name !== undefined) {
          const hit = findPattern(name);
          if (hit === undefined) {
            const choices = DESIGN_PATTERNS.map((p) => p.slug).join(', ');
            console.error(pc.red(`Unknown pattern: ${name}. Try one of: ${choices}`));
            exitCode = 2;
            return;
          }
          const doc = patternDoc(hit);
          if (opts.output !== undefined) {
            await writeFile(resolvePath(process.cwd(), opts.output), doc, 'utf8');
            console.log(`${pc.green('✓')} Wrote ${opts.output} ${pc.dim(`(${hit.name})`)}`);
            return;
          }
          if (isInteractive) console.log(pc.dim(`# ${hit.name} — ${hit.category} · paste into a docs/*.md\n`));
          console.log(doc);
          if (isInteractive && copyToClipboard(doc)) console.log(pc.green('\n✓ copied to clipboard'));
          return;
        }

        // `avo design` (optionally --system/--ai/--code) — list patterns by category.
        const cats: DesignCategory[] = ['System design', 'AI / agents', 'Creational', 'Structural', 'Behavioral'];
        const gof = (c: DesignCategory): boolean =>
          c === 'Creational' || c === 'Structural' || c === 'Behavioral';
        const show = (c: DesignCategory): boolean =>
          filter === undefined
            ? true
            : filter === 'system'
              ? c === 'System design'
              : filter === 'ai'
                ? c === 'AI / agents'
                : gof(c);
        console.log(
          pc.bold('Design patterns') + pc.dim(' — avo design <slug> to grab a template, -p for the gallery'),
        );
        for (const c of cats) {
          if (!show(c)) continue;
          const items = DESIGN_PATTERNS.filter((p) => p.category === c);
          if (items.length === 0) continue;
          console.log(pc.bold(`\n${c}:`));
          for (const p of items) console.log(`  ${pc.cyan(p.slug.padEnd(24))}${pc.dim(p.summary)}`);
        }
      },
    );

  // Per-tool skill install/update: `avo claude|cursor|github|windsurf`.
  const labelOf = (t: AiTool): string => AI_TOOLS.find((x) => x.id === t)?.label ?? t;
  const installCmd = (name: string, tool: AiTool): void => {
    program
      .command(name)
      .description(`Install or update the Avodado skill + ${labelOf(tool)} adapter`)
      .action(async () => {
        flourish(name, 'install');
        const result = await installTool({ cwd: process.cwd(), tool });
        for (const f of result.created) console.log(pc.green('+ ') + f);
        console.log(pc.bold(`\n${labelOf(tool)}: skill + adapter installed/updated.`));
      });
  };
  installCmd('claude', 'claude');
  installCmd('cursor', 'cursor');
  installCmd('github', 'copilot');
  installCmd('windsurf', 'windsurf');

  // `avo skill` — emit the authoring grammar as a copy-paste system prompt for
  // any tool without a repo-file adapter (Microsoft 365 Copilot, a custom GPT,
  // ChatGPT, Gemini). Prints to stdout (so it pipes), copies to the clipboard in
  // a terminal, or writes to a file with -o.
  program
    .command('skill')
    .description('Print the Avodado authoring grammar as a copy-paste system prompt (for Copilot / custom GPTs / any AI)')
    .option('-o, --output <path>', 'write the system prompt to a file instead of printing it')
    .option('--raw', 'emit the raw skill file verbatim (with frontmatter) instead of the wrapped prompt')
    .action(async (opts: { output?: string; raw?: boolean }) => {
      const text = await systemPrompt({ ...(opts.raw === true ? { raw: true } : {}) });
      if (opts.output !== undefined) {
        await writeFile(resolvePath(process.cwd(), opts.output), text, 'utf8');
        console.log(`${pc.green('✓')} Wrote ${opts.output} ${pc.dim(`(${text.length} chars)`)}`);
        return;
      }
      if (isInteractive) {
        console.log(pc.dim('# Avodado system prompt — paste into your tool\'s system / custom-instructions box\n'));
      }
      console.log(text);
      if (isInteractive && copyToClipboard(text)) {
        console.log(pc.green('\n✓ copied to clipboard') + pc.dim(` (${text.length} chars)`));
      }
    });

  // `avo theme` — noun-scoped: list / new <name> / use <name> / <name> / picker.
  const BUILTIN_THEMES = ['textbook', 'minimal', 'soft', 'dark', 'teal', 'slate'];
  const ok = (msg: string): void => console.log(`${pc.green('✓')} ${msg}`);
  program
    .command('theme [name] [value]')
    .description(
      `Pick/list/create/install the document theme — avo theme [list | use <name> | new <name> | install <path>] (${BUILTIN_THEMES.join(' | ')} | custom | <saved>)`,
    )
    .option('--force', 'overwrite an existing saved theme (install)')
    .option('--use', 'activate the theme right after install')
    .option('--local', 'install into this project (.avodado/themes) instead of globally')
    .option('--global', 'set the active theme globally (~/.avodado), for every project')
    .action(
      async (
        nameArg: string | undefined,
        valueArg: string | undefined,
        opts: { force?: boolean; use?: boolean; local?: boolean; global?: boolean },
      ) => {
      const cwd = process.cwd();
      // Where activating a theme writes: globally (every project) with --global,
      // else the project's own avodado.theme.json.
      const active = opts.global === true ? GLOBAL_ACTIVE : `${cwd}/avodado.theme.json`;
      const activeLabel = opts.global === true ? '~/.avodado/avodado.theme.json (global)' : 'avodado.theme.json';
      const scopeWord = opts.global === true ? 'global default' : 'project default';

      // `avo theme new <name>` — scaffold a new saved custom theme to fill in.
      if (nameArg === 'new') {
        const slug = (valueArg ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (slug === '') {
          console.error(pc.red('Give the new theme a name: avo theme new <name>'));
          exitCode = 2;
          return;
        }
        const toGlobal = opts.global === true;
        const path = toGlobal ? globalThemePath(slug) : savedThemePath(cwd, slug);
        const dir = toGlobal ? GLOBAL_THEMES_DIR : `${cwd}/${THEMES_DIR}`;
        const where = toGlobal ? `~/.avodado/themes/${slug}.theme.json (global)` : `${THEMES_DIR}/${slug}.theme.json`;
        if (existsSync(path)) {
          console.error(pc.red(`A theme named "${slug}" already exists at ${where}`));
          exitCode = 2;
          return;
        }
        await mkdir(dir, { recursive: true });
        await writeFile(path, themeFileContents('textbook', true, valueArg ?? slug), 'utf8');
        ok(`created ${pc.bold(slug)} ${pc.dim(`· ${where}`)}`);
        console.log(pc.dim('  Fill in its colors/fonts, then run `avo theme use ' + slug + '` (or `avo theme`).'));
        return;
      }

      // `avo theme install <path>` — validate any theme file and copy it into
      // .avodado/themes/ so it shows up in the picker and `avo theme use`.
      if (nameArg === 'install') {
        if (valueArg === undefined) {
          console.error(pc.red('Give a path: avo theme install <path-to.theme.json>'));
          exitCode = 2;
          return;
        }
        const srcAbs = resolvePath(cwd, valueArg);
        if (!existsSync(srcAbs)) {
          console.error(pc.red(`No file at ${valueArg}`));
          exitCode = 2;
          return;
        }
        let text: string;
        try {
          text = await readFile(srcAbs, 'utf8');
        } catch (err) {
          console.error(pc.red(`Could not read ${valueArg}: ${(err as Error).message}`));
          exitCode = 2;
          return;
        }
        const check = validateThemeFile(text);
        if (!check.ok) {
          console.error(pc.red(`Invalid theme file ${valueArg}:`));
          for (const e of check.errors) console.error(pc.red(`  - ${e}`));
          exitCode = 2;
          return;
        }
        for (const w of check.warnings) console.log(pc.yellow(`  ! ${w}`));
        const stem = basename(srcAbs).replace(/\.theme\.json$/i, '').replace(/\.jsonc?$/i, '');
        const slug = stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'theme';
        // Default: install globally (~/.avodado/themes) so it's usable in every
        // project. `--local` installs into just this project (.avodado/themes).
        const toGlobal = opts.local !== true;
        const dest = toGlobal ? globalThemePath(slug) : savedThemePath(cwd, slug);
        const destDir = toGlobal ? GLOBAL_THEMES_DIR : `${cwd}/${THEMES_DIR}`;
        const where = toGlobal ? `~/.avodado/themes/${slug}.theme.json (global)` : `${THEMES_DIR}/${slug}.theme.json`;
        if (existsSync(dest) && opts.force !== true) {
          console.error(
            pc.red(`A theme "${slug}" already exists (${where}). Re-run with --force to overwrite.`),
          );
          exitCode = 2;
          return;
        }
        await mkdir(destDir, { recursive: true });
        await writeFile(dest, text, 'utf8');
        ok(`installed ${pc.bold(slug)} ${pc.dim(`· ${where}`)}`);
        // Activate it if `--use` was passed, or — in an interactive terminal — if
        // the user says yes. A global install offers a global default so it shows
        // up everywhere; a local install sets only this project.
        const target = toGlobal ? GLOBAL_ACTIVE : `${cwd}/avodado.theme.json`;
        const targetLabel = toGlobal ? 'every project (global default)' : 'the project default';
        const setDefault =
          opts.use === true ||
          (isInteractive && (await confirm(`Set ${pc.bold(slug)} as the default for ${targetLabel}?`)));
        if (setDefault) {
          await mkdir(dirname(target), { recursive: true });
          await writeFile(target, text, 'utf8');
          ok(`activated ${pc.bold(slug)} — default for ${targetLabel}`);
        } else {
          console.log(pc.dim(`  Run \`avo theme use ${slug}\`${toGlobal ? ' --global' : ''} to make it the default.`));
        }
        return;
      }

      const saved = listSavedThemes(cwd);

      // `avo theme list` — show built-ins and saved customs, marking the current.
      if (nameArg === 'list') {
        const cur = activeTheme(cwd, saved);
        const mark = (isCur: boolean): string => (isCur ? pc.green(' ✓') : '');
        console.log(pc.bold('Built-in themes:'));
        console.log(
          '  ' + BUILTIN_THEMES.map((t) => t + mark(cur.kind === 'builtin' && cur.id === t)).join('   '),
        );
        console.log(pc.bold('\nSaved custom themes:') + pc.dim(' (global: ~/.avodado/themes · project: .avodado/themes)'));
        if (saved.length === 0) {
          console.log(pc.dim('  none yet — `avo theme install <path>` (global) or `avo theme new <name>`'));
        } else {
          for (const s of saved) {
            const here = cur.kind === 'saved' && cur.id === s.slug;
            const scope = s.scope === 'global' ? pc.dim(' (global)') : pc.dim(' (project)');
            console.log(`  ${pc.cyan(s.slug.padEnd(16))}${pc.dim(s.name === s.slug ? '' : s.name)}${scope}${mark(here)}`);
          }
        }
        const label =
          cur.kind === 'builtin' || cur.kind === 'saved' ? (cur.id ?? '?') : cur.kind === 'custom' ? 'custom' : 'none (default textbook)';
        console.log(pc.dim('\nCurrent default: ') + pc.bold(label));
        return;
      }

      // Activate a theme by name (built-in, blank `custom`, or a saved slug).
      // Writes the project's avodado.theme.json, or the global default with --global.
      const setTheme = async (target: string): Promise<boolean> => {
        await mkdir(dirname(active), { recursive: true });
        if (BUILTIN_THEMES.includes(target)) {
          await writeFile(active, themeFileContents(target, false), 'utf8');
          ok(`theme set to ${pc.bold(target)} — now the ${scopeWord} ${pc.dim(`· ${activeLabel}`)}`);
          return true;
        }
        if (target === 'custom') {
          await writeFile(active, themeFileContents('textbook', true), 'utf8');
          ok(`scaffolded a blank ${pc.bold('custom')} theme ${pc.dim(`· ${activeLabel}`)}`);
          console.log(pc.dim(`  Edit ${activeLabel} to tweak colors/fonts.`));
          return true;
        }
        const hit = saved.find((s) => s.slug === target);
        if (hit !== undefined) {
          await writeFile(active, await readFile(hit.file, 'utf8'), 'utf8');
          ok(`theme set to ${pc.bold(hit.name)} — now the ${scopeWord} ${pc.dim(`· ${activeLabel}`)}`);
          return true;
        }
        const choices = [...BUILTIN_THEMES, 'custom', ...saved.map((s) => s.slug)].join(', ');
        console.error(pc.red(`Unknown theme: ${target}. Try one of: ${choices}`));
        exitCode = 2;
        return false;
      };

      // `avo theme use <name>` (explicit) and `avo theme <name>` (shorthand).
      if (nameArg === 'use') {
        if (valueArg === undefined) {
          console.error(pc.red('Name the theme to use: avo theme use <name>'));
          exitCode = 2;
          return;
        }
        await setTheme(valueArg);
        return;
      }
      if (nameArg !== undefined) {
        await setTheme(nameArg);
        return;
      }

      if (!isInteractive) {
        console.error(pc.red('In non-interactive mode: avo theme use <name> (or avo theme list)'));
        exitCode = 2;
        return;
      }
      console.log(actionBanner('theme'));
      console.log(funLine('theme') + '\n');
      let picked: { label: string; kind: 'builtin' | 'saved' | 'custom' } | undefined;
      const { waitUntilExit } = inkRender(
        <ThemeApp cwd={cwd} saved={saved} onComplete={(p) => { picked = p; }} />,
      );
      await waitUntilExit();
      if (picked !== undefined) {
        ok(`theme set to ${pc.bold(picked.label)} ${pc.dim('· avodado.theme.json')}`);
        if (picked.kind === 'custom') console.log(pc.dim('  Edit avodado.theme.json to tweak colors/fonts.'));
      }
    });

  // `avo prompt` — example prompts for authoring docs (list / new / <name> / picker).
  program
    .command('prompt [name] [value]')
    .description('Show a ready-to-paste authoring prompt — avo prompt [list | new <name> | <name>]')
    .action(async (nameArg: string | undefined, valueArg: string | undefined) => {
      const cwd = process.cwd();

      // `avo prompt new <name>` — scaffold a saved custom prompt.
      if (nameArg === 'new') {
        const slug = (valueArg ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (slug === '') {
          console.error(pc.red('Give the new prompt a name: avo prompt new <name>'));
          exitCode = 2;
          return;
        }
        const path = savedPromptPath(cwd, slug);
        if (existsSync(path)) {
          console.error(pc.red(`A prompt named "${slug}" already exists at ${PROMPTS_DIR}/${slug}.md`));
          exitCode = 2;
          return;
        }
        await mkdir(`${cwd}/${PROMPTS_DIR}`, { recursive: true });
        await writeFile(path, newPromptContents(valueArg ?? slug), 'utf8');
        ok(`created ${pc.bold(slug)} ${pc.dim(`· ${PROMPTS_DIR}/${slug}.md`)}`);
        console.log(pc.dim('  Edit it, then run `avo prompt ' + slug + '` to print it.'));
        return;
      }

      const saved = listSavedPrompts(cwd);

      // `avo prompt list` — list built-ins and saved prompts.
      if (nameArg === 'list') {
        console.log(pc.bold('Built-in prompts:'));
        for (const p of BUILTIN_PROMPTS) console.log(`  ${pc.cyan(p.slug.padEnd(14))}${pc.dim(p.label)}`);
        console.log(pc.bold('\nSaved prompts:') + pc.dim(` (${PROMPTS_DIR}/)`));
        if (saved.length === 0) console.log(pc.dim('  none yet — create one with `avo prompt new <name>`'));
        else for (const s of saved) console.log(`  ${pc.cyan(s.slug.padEnd(14))}${pc.dim(s.label)}`);
        return;
      }

      // Print the prompt (always — keeps `avo prompt adr | pbcopy` working) and,
      // in an interactive terminal, also copy it to the clipboard.
      const print = (label: string, text: string): void => {
        if (isInteractive) console.log(pc.dim(`# ${label}\n`));
        console.log(text);
        if (isInteractive && copyToClipboard(text)) console.log(pc.green('\n✓ copied to clipboard'));
      };

      // `avo prompt <name>` — print a built-in or saved prompt.
      if (nameArg !== undefined) {
        const builtin = BUILTIN_PROMPTS.find((p) => p.slug === nameArg);
        if (builtin !== undefined) {
          print(builtin.label, builtin.text);
          return;
        }
        const hit = saved.find((s) => s.slug === nameArg);
        if (hit !== undefined) {
          print(hit.label, readSavedPrompt(hit.file));
          return;
        }
        const choices = [...BUILTIN_PROMPTS.map((p) => p.slug), ...saved.map((s) => s.slug)].join(', ');
        console.error(pc.red(`Unknown prompt: ${nameArg}. Try one of: ${choices}`));
        exitCode = 2;
        return;
      }

      if (!isInteractive) {
        console.error(pc.red('In non-interactive mode: avo prompt <name> (or avo prompt list)'));
        exitCode = 2;
        return;
      }
      console.log(actionBanner('prompt'));
      let picked: { label: string; text: string } | undefined;
      const { waitUntilExit } = inkRender(
        <PromptApp saved={saved} onPick={(label, text) => { picked = { label, text }; }} />,
      );
      await waitUntilExit();
      if (picked !== undefined) {
        console.log('');
        print(picked.label, picked.text);
      }
    });

  // `avo block [name]` — list block types, or print/scaffold a block template.
  program
    .command('block [name]')
    .description('List block types (no arg), or print a block template (-o to write a file)')
    .option('-o, --output <path>', 'write the template to a file')
    .action(async (name: string | undefined, opts: { output?: string }) => {
      if (name === undefined || name === 'list') {
        console.log(pc.bold(`${BLOCK_TYPES.length} block types:`));
        console.log('  ' + BLOCK_TYPES.join('  '));
        return;
      }
      if (!BLOCK_TYPES.includes(name as BlockType)) {
        console.error(pc.red(`Unknown block: ${name}. Run \`avo block list\`.`));
        exitCode = 2;
        return;
      }
      if (opts.output !== undefined) {
        const p = await writeNewDoc({ cwd: process.cwd(), type: name, out: opts.output });
        console.log(`${pc.green('✓')} Wrote ${p}`);
      } else {
        process.stdout.write(templateFor(name as BlockType));
      }
    });

  // `avo template [name]` — list doc templates, or print/scaffold one (e.g. adr).
  program
    .command('template [name]')
    .description('List doc templates (no arg), or print one like `adr` (-o to write a file)')
    .option('-o, --output <path>', 'write the template to a file')
    .action(async (name: string | undefined, opts: { output?: string }) => {
      if (name === undefined || name === 'list') {
        console.log(pc.bold('Doc templates:'));
        console.log('  ' + Object.keys(DOC_TEMPLATES).join('  '));
        return;
      }
      if (!isDocTemplate(name)) {
        console.error(pc.red(`Unknown template: ${name}. Run \`avo template list\`.`));
        exitCode = 2;
        return;
      }
      if (opts.output !== undefined) {
        const p = await writeNewDoc({ cwd: process.cwd(), type: name, out: opts.output });
        console.log(`${pc.green('✓')} Wrote ${p}`);
      } else {
        process.stdout.write(DOC_TEMPLATES[name] ?? '');
      }
    });

  try {
    await program.parseAsync(argv as string[], { from: 'node' });
  } catch (err) {
    const e = err as Error & { code?: string; exitCode?: number };
    if (e.code === 'commander.helpDisplayed' || e.code === 'commander.version') {
      return 0;
    }
    if (e.code === 'commander.help') return 0;
    if (typeof e.exitCode === 'number' && e.code?.startsWith('commander.')) {
      return e.exitCode;
    }
    console.error(pc.red(e.message ?? String(err)));
    return 1;
  }

  return exitCode;
}

// Re-export the template helper for tests + downstream consumers.
export { templateFor };
