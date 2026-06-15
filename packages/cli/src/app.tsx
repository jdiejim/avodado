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
import { writeFile } from 'node:fs/promises';
import { runSyncOpenApi } from './commands/sync.js';
import { NewApp, templateFor, writeNewDoc, DOC_TEMPLATES, isDocTemplate } from './commands/new.js';
import { DiagnosticsTable, formatDiagnosticsPlain } from './ui/DiagnosticsTable.js';
import { banner, examples, logo, actionBanner, funLine } from './ui/banner.js';
import { isInteractive } from './tty.js';
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
        const verb = result.opened ? '🥑 Opened' : '🥑 Wrote';
        console.log(`${pc.green(verb)} ${result.output} ${pc.dim(`(${result.bytes} bytes)`)}`);
      });
  };
  single('html', 'Render one document to a standalone HTML file');
  single('slides', 'Render one document to a self-contained slide deck');
  single('pdf', 'Render one document to a PDF (needs Chromium once)');

  // Per-tool skill install/update: `avo claude|cursor|github|windsurf`.
  const labelOf = (t: AiTool): string => AI_TOOLS.find((x) => x.id === t)?.label ?? t;
  const installCmd = (name: string, tool: AiTool): void => {
    program
      .command(name)
      .description(`Install or update the Avodado skill + ${labelOf(tool)} adapter`)
      .action(async () => {
        const result = await installTool({ cwd: process.cwd(), tool });
        for (const f of result.created) console.log(pc.green('+ ') + f);
        console.log(pc.bold(`\n${labelOf(tool)}: skill + adapter installed/updated.`));
      });
  };
  installCmd('claude', 'claude');
  installCmd('cursor', 'cursor');
  installCmd('github', 'copilot');
  installCmd('windsurf', 'windsurf');

  // `avo theme [name]` — pick a theme (interactive) or set one directly.
  const THEME_NAMES = ['textbook', 'minimal', 'soft', 'dark', 'teal', 'plum', 'slate', 'custom'];
  program
    .command('theme [name]')
    .description(`Set the document theme — writes avodado.theme.json (${THEME_NAMES.join(' | ')})`)
    .action(async (nameArg: string | undefined) => {
      const cwd = process.cwd();
      if (nameArg !== undefined) {
        if (!THEME_NAMES.includes(nameArg)) {
          console.error(pc.red(`Unknown theme: ${nameArg}. Try one of: ${THEME_NAMES.join(', ')}`));
          exitCode = 2;
          return;
        }
        const custom = nameArg === 'custom';
        const theme = custom ? 'textbook' : nameArg;
        await writeFile(`${cwd}/avodado.theme.json`, themeFileContents(theme, custom), 'utf8');
        console.log(`${pc.green('✓')} theme set to ${pc.bold(custom ? 'custom' : theme)} ${pc.dim('· avodado.theme.json')}`);
        return;
      }
      if (!isInteractive) {
        console.error(pc.red('In non-interactive mode, pass a theme name: avo theme <name>'));
        exitCode = 2;
        return;
      }
      console.log(actionBanner('theme'));
      console.log(funLine('theme') + '\n');
      let picked: { theme: string; custom: boolean } | undefined;
      const { waitUntilExit } = inkRender(
        <ThemeApp cwd={cwd} onComplete={(theme, custom) => { picked = { theme, custom }; }} />,
      );
      await waitUntilExit();
      if (picked !== undefined) {
        console.log(
          `${pc.green('✓')} theme set to ${pc.bold(picked.custom ? 'custom' : picked.theme)} ${pc.dim('· avodado.theme.json')}` +
            (picked.custom ? pc.dim('\n  Edit avodado.theme.json to tweak colors/fonts.') : ''),
        );
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
