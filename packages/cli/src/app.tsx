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
import { runExport, type ExportFormat } from './commands/export.js';
import { runSingle, type SingleFormat } from './commands/single.js';
import { runDemo } from './commands/demo.js';
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
import { listSavedThemes, savedThemePath, validateThemeFile, THEMES_DIR } from './io/theme.js';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { basename, resolve as resolvePath } from 'node:path';
import { runSyncOpenApi } from './commands/sync.js';
import { NewApp, templateFor, writeNewDoc, DOC_TEMPLATES, isDocTemplate } from './commands/new.js';
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
    .command('new')
    .description('Scaffold a new doc from a block template')
    .option(
      '--type <kind>',
      'doc template (' + Object.keys(DOC_TEMPLATES).join(', ') + ') or block type (' + BLOCK_TYPES.join(', ') + ')',
    )
    .option('--out <path>', 'output file path')
    .action(async (opts: { type?: string; out?: string }) => {
      const cwd = process.cwd();
      flourish('new');
      const type = opts.type;
      if (type !== undefined && !BLOCK_TYPES.includes(type as BlockType) && !isDocTemplate(type)) {
        console.error(pc.red(`Unknown type: ${opts.type ?? ''}`));
        exitCode = 2;
        return;
      }
      if (!isInteractive) {
        if (type === undefined || opts.out === undefined) {
          console.error(pc.red('In non-interactive mode, both --type and --out are required.'));
          exitCode = 2;
          return;
        }
        const path = await writeNewDoc({ cwd, type, out: opts.out });
        console.log(pc.green('✓ ') + 'Wrote ' + path);
        return;
      }
      if (type !== undefined && opts.out !== undefined) {
        const path = await writeNewDoc({ cwd, type, out: opts.out });
        console.log(pc.green('✓ ') + 'Wrote ' + path);
        return;
      }
      const out = opts.out ?? './docs/new-doc.md';
      const { waitUntilExit } = inkRender(<NewApp cwd={cwd} out={out} />);
      await waitUntilExit();
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
    .command('export [globs...]')
    .description('Batch-export documents to HTML and/or PDF')
    .option('--format <list>', 'comma-separated formats: html, slides, pdf', 'html')
    .option('--out <dir>', 'output directory (defaults to config outDir or dist)')
    .action(async (globs: string[], opts: { format: string; out?: string }) => {
      const cwd = process.cwd();
      flourish('export');
      const config = await loadConfig(cwd);
      const patterns = globs.length > 0 ? globs : [`${config.docsDir}/**/*.md`];
      const formats = opts.format
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((s): s is ExportFormat => s === 'html' || s === 'pdf' || s === 'slides');
      if (formats.length === 0) {
        console.error(pc.red('No valid --format specified (expected html, slides, pdf).'));
        exitCode = 2;
        return;
      }
      const result = await runExport({
        cwd,
        patterns,
        docsRoot: config.docsDir,
        outDir: opts.out ?? config.outDir,
        formats,
      });
      for (const item of result.items) {
        for (const o of item.outputs) {
          console.log(`${pc.green('✓')} ${o.path} ${pc.dim(`(${o.bytes} bytes)`)}`);
        }
      }
      console.log(pc.bold(`\n${result.items.length} document(s) exported.`));
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

  // `avo demo [format]` — render the bundled showcase doc and open it.
  program
    .command('demo [format]')
    .description('Render the built-in showcase (every block) and open it — format: html | slides | pdf')
    .option('--no-open', "write the file but don't open it")
    .action(async (formatArg: string | undefined, opts: { open?: boolean }) => {
      const format = (formatArg ?? 'html').toLowerCase();
      if (format !== 'html' && format !== 'slides' && format !== 'pdf') {
        console.error(pc.red(`Unknown format: ${format}. Try one of: html, slides, pdf`));
        exitCode = 2;
        return;
      }
      flourish('demo');
      const result = await runDemo({ format, preview: opts.open !== false });
      const verb = result.opened ? 'Opened' : 'Wrote';
      console.log(`${pc.green(verb)} ${result.output} ${pc.dim(`(${result.bytes} bytes)`)}`);
    });

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
    .action(async (nameArg: string | undefined, valueArg: string | undefined, opts: { force?: boolean; use?: boolean }) => {
      const cwd = process.cwd();
      const active = `${cwd}/avodado.theme.json`;

      // `avo theme new <name>` — scaffold a new saved custom theme to fill in.
      if (nameArg === 'new') {
        const slug = (valueArg ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (slug === '') {
          console.error(pc.red('Give the new theme a name: avo theme new <name>'));
          exitCode = 2;
          return;
        }
        const path = savedThemePath(cwd, slug);
        if (existsSync(path)) {
          console.error(pc.red(`A theme named "${slug}" already exists at ${THEMES_DIR}/${slug}.theme.json`));
          exitCode = 2;
          return;
        }
        await mkdir(`${cwd}/${THEMES_DIR}`, { recursive: true });
        await writeFile(path, themeFileContents('textbook', true, valueArg ?? slug), 'utf8');
        ok(`created ${pc.bold(slug)} ${pc.dim(`· ${THEMES_DIR}/${slug}.theme.json`)}`);
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
        const dest = savedThemePath(cwd, slug);
        if (existsSync(dest) && opts.force !== true) {
          console.error(
            pc.red(`A theme "${slug}" already exists (${THEMES_DIR}/${slug}.theme.json). Re-run with --force to overwrite.`),
          );
          exitCode = 2;
          return;
        }
        await mkdir(`${cwd}/${THEMES_DIR}`, { recursive: true });
        await writeFile(dest, text, 'utf8');
        ok(`installed ${pc.bold(slug)} ${pc.dim(`· ${THEMES_DIR}/${slug}.theme.json`)}`);
        if (opts.use === true) {
          await writeFile(active, text, 'utf8');
          ok(`activated ${pc.bold(slug)} — now the project default ${pc.dim('· avodado.theme.json')}`);
        } else {
          console.log(pc.dim(`  Run \`avo theme use ${slug}\` to make it the default.`));
        }
        return;
      }

      const saved = listSavedThemes(cwd);

      // `avo theme list` — show built-ins and saved customs.
      if (nameArg === 'list') {
        console.log(pc.bold('Built-in themes:'));
        console.log('  ' + BUILTIN_THEMES.join('  '));
        console.log(pc.bold('\nSaved custom themes:') + pc.dim(` (${THEMES_DIR}/)`));
        if (saved.length === 0) {
          console.log(pc.dim('  none yet — create one with `avo theme new <name>`'));
        } else {
          for (const s of saved) {
            console.log(`  ${pc.cyan(s.slug.padEnd(16))}${pc.dim(s.name === s.slug ? '' : s.name)}`);
          }
        }
        return;
      }

      // Activate a theme by name (built-in, blank `custom`, or a saved slug).
      const setTheme = async (target: string): Promise<boolean> => {
        if (BUILTIN_THEMES.includes(target)) {
          await writeFile(active, themeFileContents(target, false), 'utf8');
          ok(`theme set to ${pc.bold(target)} — now the project default ${pc.dim('· avodado.theme.json')}`);
          return true;
        }
        if (target === 'custom') {
          await writeFile(active, themeFileContents('textbook', true), 'utf8');
          ok(`scaffolded a blank ${pc.bold('custom')} theme ${pc.dim('· avodado.theme.json')}`);
          console.log(pc.dim('  Edit avodado.theme.json to tweak colors/fonts.'));
          return true;
        }
        const hit = saved.find((s) => s.slug === target);
        if (hit !== undefined) {
          await writeFile(active, await readFile(hit.file, 'utf8'), 'utf8');
          ok(`theme set to ${pc.bold(hit.name)} — now the project default ${pc.dim('· avodado.theme.json')}`);
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
