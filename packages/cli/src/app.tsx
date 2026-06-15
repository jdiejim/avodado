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
import { runPreview } from './commands/preview.js';
import { runInit, type InitResult } from './commands/init.js';
import { InitApp } from './commands/InitApp.js';
import { runSyncOpenApi } from './commands/sync.js';
import { NewApp, templateFor, writeNewDoc, DOC_TEMPLATES, isDocTemplate } from './commands/new.js';
import { DiagnosticsTable, formatDiagnosticsPlain } from './ui/DiagnosticsTable.js';
import { banner, examples, logo } from './ui/banner.js';
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
    .option('-y, --yes', 'skip the wizard — scaffold with defaults (all adapters, minimal theme)')
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
      printInitSummary(result, 'minimal');
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
    .option('--format <list>', 'comma-separated formats: html,pdf', 'html')
    .option('--out <dir>', 'output directory (defaults to config outDir or dist)')
    .action(async (globs: string[], opts: { format: string; out?: string }) => {
      const cwd = process.cwd();
      const config = await loadConfig(cwd);
      const patterns = globs.length > 0 ? globs : [`${config.docsDir}/**/*.md`];
      const formats = opts.format
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((s): s is ExportFormat => s === 'html' || s === 'pdf');
      if (formats.length === 0) {
        console.error(pc.red('No valid --format specified (expected html, pdf, or both).'));
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
