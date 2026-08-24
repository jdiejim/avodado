/**
 * CLI dispatcher. Parses argv via commander, runs the matching command, and
 * decides between Ink rendering, plain output, and JSON output based on
 * {@link isInteractive} and `--json` flags.
 */

import { Command } from 'commander';
import pc from 'picocolors';
import React from 'react';
import { render as inkRender } from 'ink';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { findConfig, loadConfig } from './io/config.js';
import { cliVersion } from './io/version.js';
import { runCheck } from './commands/check.js';
import { runSingle, type SingleFormat } from './commands/single.js';
import { runDemo } from './commands/demo.js';
import { runCompare } from './commands/compare.js';
import {
  runCatalog,
  BLOCK_DESCRIPTIONS,
  DEMO_FAMILIES,
  familyBlocks,
  isDemoFamily,
  type DemoFamily,
} from './commands/catalog.js';
import { DemoApp, type DemoPick } from './commands/DemoApp.js';
import { ExploreApp, EXPLORE_ENTRIES, type ExplorePick } from './commands/ExploreApp.js';
import { TourApp, staticTour } from './commands/TourApp.js';
import {
  DESIGN_PATTERNS,
  findPattern,
  patternDoc,
  runDesignGallery,
  type DesignCategory,
} from './commands/design.js';
import { runBuild } from './commands/build.js';
import { runServe } from './commands/serve.js';
import { runStudio } from './commands/studio.js';
import {
  runInit,
  installTool,
  themeFileContents,
  AI_TOOLS,
  SKILL_SCOPES,
  type InitResult,
  type AiTool,
  type SkillScope,
} from './commands/init.js';
import { InitApp } from './commands/InitApp.js';
import { ThemeApp } from './commands/ThemeApp.js';
import { copyToClipboard } from './io/clipboard.js';
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
import { mcpInstructions, runMcpStdio } from './commands/mcp.js';
import { confirm } from './io/prompt.js';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { basename, resolve as resolvePath } from 'node:path';
import { runSyncCsv, runSyncOpenApi, type CsvBlockKind } from './commands/sync.js';
import {
  templateFor,
  writeNewDoc,
  NewPickerApp,
  DOC_TEMPLATES,
  DOC_TEMPLATE_INFO,
  isDocTemplate,
} from './commands/new.js';
import { projectStatus, formatStatus } from './commands/status.js';
import { runAudit, formatAudit } from './commands/audit/run.js';
import { DiagnosticsTable, formatDiagnosticsPlain } from './ui/DiagnosticsTable.js';
import { banner, examples, commandExamples, wordmark, actionBanner, funLine } from './ui/banner.js';
import { isInteractive } from './tty.js';

/** Prints the cfonts action banner + a fun line for a command (interactive only). */
function flourish(word: string, lineKey: string = word): void {
  if (!isInteractive) return;
  console.log(actionBanner(word));
  console.log(funLine(lineKey) + '\n');
}
import type { BlockType } from '@avodado/core';
import { BLOCK_TYPES, BLOCK_ALIASES } from '@avodado/core';

/** Prints the created/skipped files and next-step hints after `avo init`. */
function printInitSummary(result: InitResult, theme: string): void {
  for (const f of result.created) console.log(pc.green('+ ') + f);
  for (const f of result.skipped) console.log(pc.dim('  skip ') + f + pc.dim(' (exists)'));
  console.log(
    pc.bold(`\nCreated ${result.created.length} file(s), skipped ${result.skipped.length}.`) +
      pc.dim(` (theme: ${theme})`),
  );
  console.log(
    pc.dim('Layout: docs/<area>/<doc>.md, kebab-case names · output goes to dist/ — do not commit it.'),
  );
  console.log(
    `Next: ${pc.cyan('avo check')} ${pc.dim('·')} ${pc.cyan('avo docs/getting-started.md')} ${pc.dim('(render + open)')} ${pc.dim('·')} ${pc.cyan('avo explore tour')} ${pc.dim('(guided walkthrough)')}`,
  );
}

/** Runs the CLI for the given argv (typically `process.argv`). */
export async function main(argv: readonly string[]): Promise<number> {
  // Both spellings work: commander allows one short flag per option, so a
  // lone -V normalizes to --version before parsing.
  argv = argv.map((a) => (a === '-V' ? '--version' : a));
  const version = cliVersion();
  const program = new Command();
  program
    .name('avo')
    .description('Author, validate, render, and export Avodado documentation.')
    // Lowercase -v is what fingers type; commander's default is -V only, so
    // register the flag string explicitly and alias -V below.
    .version(version, '-v, --version', 'print the version')
    // Banner + workflow only on top-level help — not on every subcommand's --help.
    .addHelpText('beforeAll', (ctx) => (ctx.command.name() === 'avo' ? banner(version) : ''))
    .addHelpText('after', (ctx) => (ctx.command.name() === 'avo' ? examples() : ''))
    .exitOverride();

  let exitCode = 0;

  // Smart bare `avo` + the `avo <file.md>` shortcut. A bare .md argument is
  // the most natural gesture, so it becomes the shortest command: render +
  // open (today's preview). Bare `avo` in a TTY shows a mini project status
  // (or an init hint outside a project); non-TTY keeps the help output.
  program
    .argument('[file]', 'a .md file to render + open in the browser (same as `avo html <file> -p`)')
    .action(async (file: string | undefined) => {
      const cwd = process.cwd();
      if (file !== undefined) {
        if (!/\.md$/i.test(file)) {
          // Keep the unknown-command contract for non-.md strays (`avo claude`).
          console.error(`error: unknown command '${file}'`);
          exitCode = 1;
          return;
        }
        flourish('preview');
        const result = await runSingle({
          cwd,
          input: file,
          format: 'html',
          preview: true,
          open: isInteractive, // script-safe: piped output renders but doesn't open
        });
        const verb = result.opened ? 'Opened' : 'Wrote';
        console.log(`${pc.green(verb)} ${result.output} ${pc.dim(`(${result.bytes} bytes)`)}`);
        return;
      }

      // Non-TTY / AVO_PLAIN: stay script-safe — print the regular help.
      if (!isInteractive) {
        program.outputHelp();
        return;
      }

      console.log(banner(version));
      if (findConfig(cwd) === undefined) {
        console.log(`  Not an Avodado project yet — run ${pc.cyan('avo init')} to scaffold one.`);
        console.log(
          `  ${pc.dim('Curious first?')} ${pc.cyan('avo explore')} ${pc.dim('— demos, the block catalog, a guided tour.')}`,
        );
        console.log('');
        return;
      }
      const status = await projectStatus(cwd);
      console.log(formatStatus(status));
    });

  program
    .command('init')
    .description('Scaffold a new Avodado project in the current directory')
    .option('--force', 'overwrite existing files')
    .option('-y, --yes', 'skip the wizard — scaffold with defaults (all tools, full suite, textbook theme)')
    .option(
      '--scope <type>',
      `tailor the installed skill to a project type (${SKILL_SCOPES.join(' | ')})`,
    )
    .action(async (opts: { force?: boolean; yes?: boolean; scope?: string }) => {
      const cwd = process.cwd();
      const force = opts.force === true;

      let scope: SkillScope | undefined;
      if (opts.scope !== undefined) {
        if (!(SKILL_SCOPES as readonly string[]).includes(opts.scope)) {
          console.error(pc.red(`Unknown scope: ${opts.scope}. Try one of: ${SKILL_SCOPES.join(' | ')}`));
          exitCode = 2;
          return;
        }
        scope = opts.scope as SkillScope;
      }

      // Interactive wizard: pick AI-tool adapters, a project type, + a theme.
      if (isInteractive && opts.yes !== true) {
        console.log(wordmark(version));
        let captured: { result: InitResult; theme: string } | undefined;
        const { waitUntilExit } = inkRender(
          <InitApp
            cwd={cwd}
            {...(force ? { force: true } : {})}
            {...(scope !== undefined ? { scope } : {})}
            onComplete={(result, theme) => {
              captured = { result, theme };
            }}
          />,
        );
        await waitUntilExit();
        if (captured !== undefined) printInitSummary(captured.result, captured.theme);
        return;
      }

      // Non-interactive (CI) or --yes: scaffold with defaults (full suite
      // unless --scope says otherwise).
      const result = await runInit({
        cwd,
        ...(force ? { force: true } : {}),
        ...(scope !== undefined ? { scope } : {}),
      });
      printInitSummary(result, 'textbook');
    });


  program
    .command('check [globs...]')
    .description('Validate documents (default: docs/**/*.md)')
    .option('--json', 'emit machine-readable JSON')
    .option('--strict-prose', 'treat prose-lint warnings (W_PROSE_*) as errors')
    .action(async (globs: string[], opts: { json?: boolean; strictProse?: boolean }) => {
      const cwd = process.cwd();
      const config = await loadConfig(cwd);
      const patterns = globs.length > 0 ? globs : [`${config.docsDir}/**/*.md`];
      const result = await runCheck({
        patterns,
        cwd,
        docsRoot: config.docsDir,
        ...(opts.strictProse === true ? { strictProse: true } : {}),
      });
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

  // `avo audit [path]` — evidence report + rule-derived doc recommendations.
  // Informational: exits 0 whenever the path is usable, 2 when it is not.
  program
    .command('audit [path]')
    .description('Audit a codebase and recommend which Avodado docs to write (evidence-cited)')
    .option('--json', 'emit machine-readable JSON (schema version 1)')
    .action(async (pathArg: string | undefined, opts: { json?: boolean }) => {
      const result = await runAudit({
        cwd: process.cwd(),
        ...(pathArg !== undefined ? { path: pathArg } : {}),
      });
      if (!result.ok) {
        console.error(pc.red(result.error));
        exitCode = 2;
        return;
      }
      if (opts.json === true) {
        process.stdout.write(JSON.stringify(result.report, null, 2) + '\n');
        return;
      }
      if (isInteractive) {
        flourish('audit');
        console.log(formatAudit(result.report, false));
      } else {
        process.stdout.write(formatAudit(result.report, true) + '\n');
      }
    });

  // Hidden compat: `avo preview` ≡ `avo <file.md>` ≡ `avo html <file> -p`.
  program
    .command('preview <input>', { hidden: true })
    .description('Render a document to a temp HTML file and open it (same as `avo <file.md>`)')
    .action(async (input: string) => {
      flourish('preview');
      const result = await runSingle({
        cwd: process.cwd(),
        input,
        format: 'html',
        preview: true,
        open: isInteractive,
      });
      const verb = result.opened ? 'Opened' : 'Wrote';
      console.log(`${pc.green(verb)} ${result.output} ${pc.dim(`(${result.bytes} bytes)`)}`);
    });

  // `avo new [name]` — one verb for "make something": doc templates (adr,
  // runbook, …) AND single-block scaffolds (sequence, erd, …), resolved by
  // name (alias spellings like `waterfall` resolve to their canonical block).
  // Bare + TTY → two-section Ink picker; bare + non-TTY → list the names.
  program
    .command('new [name]')
    .description('Create from a template — a full doc (adr, runbook, …) or a single block (sequence, erd, …)')
    .option('-o, --output <path>', 'write to a file instead of printing to stdout')
    .action(async (nameArg: string | undefined, opts: { output?: string }) => {
      const cwd = process.cwd();

      // Resolve a name: doc template → block type → permanent alias.
      const resolveName = (n: string): { type: string; note?: string } | undefined => {
        if (isDocTemplate(n) || BLOCK_TYPES.includes(n as BlockType)) return { type: n };
        const alias = BLOCK_ALIASES[n];
        if (alias !== undefined) {
          const patch = Object.entries(alias.patch ?? {})
            .map(([k, v]) => `${k}: ${String(v)}`)
            .join(', ');
          return {
            type: alias.type,
            note: `\`${n}\` now lives in \`${alias.type}\`${patch === '' ? '' : ` (${patch})`} — both spellings work; no change needed.`,
          };
        }
        return undefined;
      };

      const emit = async (type: string): Promise<void> => {
        if (opts.output !== undefined) {
          const p = await writeNewDoc({ cwd, type, out: opts.output });
          console.log(`${pc.green('✓')} Wrote ${p}`);
          return;
        }
        const content = isDocTemplate(type) ? (DOC_TEMPLATES[type] as string) : templateFor(type as BlockType);
        if (isInteractive) console.log(pc.dim(`# ${type} — paste into a docs/*.md (or re-run with -o <path>)\n`));
        process.stdout.write(content);
        if (isInteractive && copyToClipboard(content)) console.log(pc.green('\n✓ copied to clipboard'));
      };

      if (nameArg !== undefined) {
        const hit = resolveName(nameArg);
        if (hit === undefined) {
          console.error(pc.red(`Unknown template or block: ${nameArg}. Run \`avo new\` to list them.`));
          exitCode = 2;
          return;
        }
        // The alias note rides stderr so piped stdout stays a clean template.
        if (hit.note !== undefined) console.error(pc.yellow(hit.note));
        await emit(hit.type);
        return;
      }

      // Bare `avo new`, non-TTY: list every name (script-safe).
      if (!isInteractive) {
        console.log('Doc templates:');
        for (const [name, info] of Object.entries(DOC_TEMPLATE_INFO)) {
          console.log(`  ${name.padEnd(14)}${info.description}`);
        }
        console.log('\nBlocks:');
        for (const fam of DEMO_FAMILIES) {
          console.log(`  ${fam.label}: ${familyBlocks(fam.id).join('  ')}`);
        }
        console.log('\nUsage: avo new <name> [-o <path>]');
        return;
      }

      // Bare `avo new`, TTY: two-section picker (Doc templates | Blocks by family).
      flourish('new');
      let picked: string | undefined;
      const { waitUntilExit } = inkRender(<NewPickerApp onPick={(n) => { picked = n; }} />);
      await waitUntilExit();
      if (picked === undefined) return; // cancelled with q / escape
      await emit(picked);
    });

  // `avo build` — render every doc into a static HTML site under outDir.
  program
    .command('build')
    .description('Build a static HTML site from all docs — index, sidebar nav, cross-doc links')
    .option('--out <dir>', 'output directory (default: config outDir, "dist")')
    .option('--rich-index', 'build the rich index page — project TLDR, doc map by tag, cross-reference graph')
    .action(async (opts: { out?: string; richIndex?: boolean }) => {
      flourish('build');
      const result = await runBuild({
        cwd: process.cwd(),
        ...(opts.out !== undefined ? { out: opts.out } : {}),
        ...(opts.richIndex !== undefined ? { richIndex: opts.richIndex } : {}),
      });
      // Diagnostics are warnings here — `avo check` stays the gate.
      if (result.diagnostics.length > 0) {
        for (const d of result.diagnostics) {
          const loc = d.line !== undefined ? `${d.file}:${d.line}` : d.file;
          console.error(pc.yellow(`warn  ${loc}  ${d.code}  ${d.message}`));
        }
        console.error(
          pc.yellow(`${result.diagnostics.length} warning(s) — run \`avo check\` for details`),
        );
      }
      const bytes = result.pages.reduce((sum, p) => sum + p.bytes, 0);
      // Decks are companion views, not documents — report them separately so
      // "page(s)" keeps meaning index + one per doc.
      const decks = result.pages.filter((p) => p.path.endsWith('.slides.html')).length;
      const deckPart = decks > 0 ? ` + ${decks} deck(s)` : '';
      console.log(
        `${pc.green('✓')} ${result.pages.length - decks} page(s)${deckPart} → ${result.outDirRel}/ ${pc.dim(`(${bytes} bytes)`)}`,
      );
      exitCode = result.exitCode;
    });

  // Hidden compat: `avo serve` still works, but `avo studio` (Site mode) is
  // the one local surface — it mounts the same live-reloading site at /site/.
  program
    .command('serve', { hidden: true })
    .description('Serve the docs site locally with live reload (compat — `avo studio` includes this as Site mode)')
    .option('--port <n>', 'port to listen on (0 = pick a free port)', '4173')
    .option('--no-open', "don't open the browser")
    .option('--rich-index', 'serve the rich index page — project TLDR, doc map by tag, cross-reference graph')
    .action(async (opts: { port: string; open: boolean; richIndex?: boolean }) => {
      flourish('serve');
      const parsed = Number.parseInt(opts.port, 10);
      await runServe({
        cwd: process.cwd(),
        port: Number.isNaN(parsed) ? 4173 : parsed,
        open: opts.open,
        ...(opts.richIndex !== undefined ? { richIndex: opts.richIndex } : {}),
      });
    });

  // `avo studio` — THE local surface: visual editor over a file-bridge API
  // (files stay canonical) with Edit | Site | Present modes in one server.
  program
    .command('studio')
    .description('open the local studio — a Home page of your docs, edit in place, present as slides; the built site is one click away; files stay the source of truth')
    .option('--port <n>', 'port to listen on (0 = pick a free port)', '4174')
    .option('--no-open', "don't open the browser")
    .action(async (opts: { port: string; open: boolean }) => {
      flourish('studio');
      const parsed = Number.parseInt(opts.port, 10);
      await runStudio({
        cwd: process.cwd(),
        port: Number.isNaN(parsed) ? 4174 : parsed,
        open: opts.open,
      });
    });

  const syncCmd = program.command('sync').description('Generate Avodado docs from external sources (OpenAPI, CSV)');
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
  syncCmd
    .command('csv <file>')
    .description('Turn a CSV into a table/statustable/chart block (stdout), or a whole doc (--out)')
    .option('-o, --out <path>', 'write a minimal doc (meta + block) to this path and validate it')
    .option('--block <type>', 'target block: table | statustable | chart (default: auto-suggest)')
    .option('--title <title>', 'doc title with --out (default: prettified file name)')
    .option('--delimiter <d>', 'field delimiter: "," ";" or "tab" (default: auto-detect)')
    .action(
      async (
        file: string,
        opts: { out?: string; block?: string; title?: string; delimiter?: string },
      ) => {
        if (
          opts.block !== undefined &&
          opts.block !== 'table' &&
          opts.block !== 'statustable' &&
          opts.block !== 'chart'
        ) {
          console.error(pc.red(`Unknown block: ${opts.block}. Use table | statustable | chart.`));
          exitCode = 2;
          return;
        }
        const result = await runSyncCsv({
          cwd: process.cwd(),
          file,
          ...(opts.out !== undefined ? { out: opts.out } : {}),
          ...(opts.block !== undefined ? { block: opts.block as CsvBlockKind } : {}),
          ...(opts.title !== undefined ? { title: opts.title } : {}),
          ...(opts.delimiter !== undefined ? { delimiter: opts.delimiter } : {}),
        });
        // Auto-picked block: say why, on stderr so piped stdout stays a clean fence.
        if (result.reason !== undefined) {
          console.error(pc.dim(`→ ${result.block}: ${result.reason}`));
        }
        for (const w of result.warnings) console.error(pc.yellow(`warn  ${w}`));
        if (result.message !== undefined) {
          console.error(pc.red(result.message));
          exitCode = result.exitCode;
          return;
        }
        if (result.fence !== undefined) {
          process.stdout.write(result.fence);
          if (isInteractive && copyToClipboard(result.fence)) {
            console.log(pc.green('\n✓ copied to clipboard'));
          }
        }
        if (result.outPath !== undefined) {
          console.log(`${pc.green('✓')} Wrote ${result.outPath} ${pc.dim(`(${result.block})`)}`);
          const diags = result.check?.diagnostics ?? [];
          if (diags.length === 0) {
            console.log(`${pc.green('✓')} avo check: clean`);
          } else {
            for (const d of diags) {
              const loc = d.line !== undefined ? `${d.file}:${d.line}` : d.file;
              const paint = d.level === 'error' ? pc.red : pc.yellow;
              console.error(paint(`${d.level}  ${loc}  ${d.code}  ${d.message}`));
            }
            console.error(pc.dim(`avo check: ${diags.length} diagnostic(s)`));
          }
        }
        exitCode = result.exitCode;
      },
    );

  // Single-document shortcuts: `avo html|slides|pdf <input> [-o out] [-p]`.
  const single = (name: SingleFormat, desc: string): void => {
    const cmd = program
      .command(`${name} <input>`)
      .description(desc)
      .option('-o, --output <path>', 'output file path')
      .option('-p, --preview', 'render to a temp file and open it in the browser');
    if (name === 'pptx') {
      cmd.option(
        '-e, --editable',
        'native PowerPoint text/tables/charts (editable); diagrams stay images',
      );
    }
    cmd.action(
      async (input: string, opts: { output?: string; preview?: boolean; editable?: boolean }) => {
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
          ...(opts.editable === true ? { editable: true } : {}),
        });
        const verb = result.opened ? 'Opened' : 'Wrote';
        console.log(`${pc.green(verb)} ${result.output} ${pc.dim(`(${result.bytes} bytes)`)}`);
      });
  };
  single('html', 'Render one document to a standalone HTML file');
  single('slides', 'Render one document to a self-contained slide deck');
  single('pdf', 'Render one document to a PDF (needs Chromium once)');
  single('pptx', 'Render one document to a PowerPoint deck (needs Chromium once)');

  // ——— Discover: demo · catalog · design · tour ———————————————————————————
  // One action per discovery flow, registered twice: as a visible subcommand
  // of `avo explore` and as a hidden-but-working top-level compat command.

  // `demo [family] [-s]` — render the bundled showcase doc (all blocks, or
  // one family) and open it (-s = slides). Bare TTY invocation shows a picker.
  const demoAction = async (familyArg: string | undefined, opts: { slides?: boolean; open?: boolean; output?: string }): Promise<void> => {
      let family: DemoFamily | undefined;
      if (familyArg !== undefined) {
        if (!isDemoFamily(familyArg)) {
          const choices = DEMO_FAMILIES.map((f) => f.id).join(' | ');
          console.error(pc.red(`Unknown family: ${familyArg}. Try one of: ${choices}`));
          exitCode = 2;
          return;
        }
        family = familyArg;
      } else if (isInteractive) {
        // Bare `avo demo` in a TTY: pick a family (or everything) interactively.
        let picked: DemoPick | undefined;
        const { waitUntilExit } = inkRender(<DemoApp onPick={(p) => { picked = p; }} />);
        await waitUntilExit();
        if (picked === undefined) return; // cancelled with q / escape
        family = picked.family;
      }
      flourish('demo');
      const result = await runDemo({
        format: opts.slides === true ? 'slides' : 'html',
        ...(family !== undefined ? { family } : {}),
        ...(opts.output !== undefined
          ? { output: resolvePath(process.cwd(), opts.output) }
          : { preview: opts.open !== false }),
      });
      const verb = result.opened ? 'Opened' : 'Wrote';
      console.log(`${pc.green(verb)} ${result.output} ${pc.dim(`(${result.bytes} bytes)`)}`);
    };
  const registerDemo = (parent: Command, hidden: boolean): void => {
    parent
      .command('demo [family]', hidden ? { hidden: true } : {})
      .description(
        `Render the built-in showcase and open it — all blocks or one family (${DEMO_FAMILIES.map((f) => f.id).join(' | ')}); -s for a slide deck`,
      )
      .option('-s, --slides', 'render as a slide deck')
      .option('-o, --output <path>', 'write the rendered file to a path (implies --no-open)')
      .option('--no-open', "write the file but don't open it")
      .action(demoAction);
  };

  // `catalog` — print the block catalog in the terminal; `-p` opens an HTML
  // gallery of live samples, `-s` a slide deck.
  const catalogAction = async (opts: { preview?: boolean; slides?: boolean; output?: string }): Promise<void> => {
      const wantRender = opts.preview === true || opts.slides === true || opts.output !== undefined;
      if (!wantRender) {
        console.log(pc.bold(`${BLOCK_TYPES.length} block types in ${DEMO_FAMILIES.length} families:`));
        for (const fam of DEMO_FAMILIES) {
          const types = familyBlocks(fam.id);
          console.log('\n' + pc.bold(`${fam.label} (${types.length})`) + pc.dim(` · avo demo ${fam.id}`));
          for (const t of types) {
            console.log(`  ${pc.cyan(t.padEnd(13))}${pc.dim(BLOCK_DESCRIPTIONS[t])}`);
          }
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
    };
  const registerCatalog = (parent: Command, hidden: boolean): void => {
    parent
      .command('catalog', hidden ? { hidden: true } : {})
      .description('List every block + description in the terminal (-p opens an HTML gallery, -s a slide deck)')
      .option('-p, --preview', 'render an HTML gallery of every block and open it')
      .option('-s, --slides', 'render the gallery as a slide deck (implies -p)')
      .option('-o, --output <path>', 'write the rendered gallery to a file')
      .action(catalogAction);
  };

  // `compare [family]` — every block rendered doc-mode AND slide-mode side by
  // side (with a Doc / Slide / Both toggle), from the showcase examples.
  const compareAction = async (
    familyArg: string | undefined,
    opts: { output?: string; open?: boolean },
  ): Promise<void> => {
    let family: DemoFamily | undefined;
    if (familyArg !== undefined) {
      if (!isDemoFamily(familyArg)) {
        const choices = DEMO_FAMILIES.map((f) => f.id).join(' | ');
        console.error(pc.red(`Unknown family: ${familyArg}. Try one of: ${choices}`));
        exitCode = 2;
        return;
      }
      family = familyArg;
    }
    flourish('compare', 'demo');
    const result = await runCompare({
      ...(family !== undefined ? { family } : {}),
      ...(opts.output !== undefined
        ? { output: resolvePath(process.cwd(), opts.output) }
        : { preview: opts.open !== false }),
    });
    const verb = result.opened ? 'Opened' : 'Wrote';
    console.log(`${pc.green(verb)} ${result.output} ${pc.dim(`(${result.bytes} bytes)`)}`);
  };
  const registerCompare = (parent: Command, hidden: boolean): void => {
    parent
      .command('compare [family]', hidden ? { hidden: true } : {})
      .description('See every block in DOC and SLIDE mode side by side (all blocks or one family)')
      .option('-o, --output <path>', "write the page to a path (implies --no-open)")
      .option('--no-open', "write the file but don't open it")
      .action(compareAction);
  };

  // `design [name]` — list patterns in the terminal, print a template
  // (<slug>), or render a gallery (`-p` HTML, `-s` slides).
  const designAction = async (
    name: string | undefined,
    opts: { output?: string; preview?: boolean; slides?: boolean; system?: boolean; ai?: boolean; code?: boolean },
  ): Promise<void> => {
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
        const cats: DesignCategory[] = ['System design', 'AI / agents', 'Creational', 'Structural', 'Behavioral', 'Architecture'];
        const code = (c: DesignCategory): boolean =>
          c === 'Creational' || c === 'Structural' || c === 'Behavioral' || c === 'Architecture';
        const show = (c: DesignCategory): boolean =>
          filter === undefined
            ? true
            : filter === 'system'
              ? c === 'System design'
              : filter === 'ai'
                ? c === 'AI / agents'
                : code(c);
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
      };
  const registerDesign = (parent: Command, hidden: boolean): void => {
    parent
      .command('design [name]', hidden ? { hidden: true } : {})
      .description('Design patterns — list (default), print a template (<slug>), or render a gallery (-p / -s)')
      .option('-o, --output <path>', 'write the template (with <slug>) or the gallery to a file')
      .option('-p, --preview', 'render an HTML gallery of the patterns and open it')
      .option('-s, --slides', 'render the gallery as a slide deck (implies -p)')
      .option('--system', 'only system-design patterns')
      .option('--ai', 'only AI / agent patterns')
      .option('--code', 'only code (GoF + architecture) design patterns')
      .action(designAction);
  };

  // `tour` — a chaptered, hands-on onboarding walkthrough (Ink) in a scratch
  // playground. Non-TTY / AVO_PLAIN prints a static text version (script-safe).
  const tourAction = async (opts: { open: boolean }): Promise<void> => {
    if (!isInteractive) {
      process.stdout.write(staticTour());
      return;
    }
    console.log(wordmark(version));
    const { waitUntilExit } = inkRender(<TourApp open={opts.open} />);
    await waitUntilExit();
  };
  const registerTour = (parent: Command, hidden: boolean): void => {
    parent
      .command('tour', hidden ? { hidden: true } : {})
      .description('Take a guided, hands-on tour — blocks, validation, previews, decks (7 short chapters)')
      .option('--no-open', "don't open the browser during the tour")
      .action(tourAction);
  };

  // `avo explore [demo|catalog|design|tour]` — the one visible discovery
  // command. Subcommands forward to the flows above (flags preserved); bare
  // TTY invocation shows a picker, bare non-TTY prints the static list.
  const exploreCmd = program
    .command('explore')
    .description('Discover Avodado — the demo showcase, block catalog, design patterns, and guided tour');
  registerDemo(exploreCmd, false);
  registerCatalog(exploreCmd, false);
  registerCompare(exploreCmd, false);
  registerDesign(exploreCmd, false);
  registerTour(exploreCmd, false);
  exploreCmd.action(async () => {
    if (!isInteractive) {
      console.log('Explore Avodado — avo explore <what>:');
      for (const e of EXPLORE_ENTRIES) console.log(`  ${e.id.padEnd(9)}${e.blurb}`);
      return;
    }
    let picked: ExplorePick | undefined;
    const { waitUntilExit } = inkRender(<ExploreApp onPick={(p) => { picked = p; }} />);
    await waitUntilExit();
    if (picked === undefined) return; // cancelled with q / escape
    if (picked === 'demo') await demoAction(undefined, {});
    else if (picked === 'catalog') await catalogAction({});
    else if (picked === 'compare') await compareAction(undefined, { open: true });
    else if (picked === 'design') await designAction(undefined, {});
    else await tourAction({ open: true });
  });

  // Hidden-but-working top-level compat spellings (pre-`explore` era).
  registerDemo(program, true);
  registerCatalog(program, true);
  registerCompare(program, true);
  registerDesign(program, true);
  registerTour(program, true);

  // `avo install <tool>` — install/update the skill + one AI-tool adapter.
  const labelOf = (t: AiTool): string => AI_TOOLS.find((x) => x.id === t)?.label ?? t;
  const runInstall = async (tool: AiTool, full?: boolean): Promise<void> => {
    flourish('install');
    const result = await installTool({
      cwd: process.cwd(),
      tool,
      ...(full === true ? { full: true } : {}),
    });
    for (const f of result.created) console.log(pc.green('+ ') + f);
    console.log(pc.bold(`\n${labelOf(tool)}: skill + adapter installed/updated.`));
  };
  program
    .command('install <tool>')
    .description('Install/update the Avodado skill + an AI-tool adapter (claude | cursor | copilot | windsurf)')
    .option('--full', 'install every block-family reference and clear a recorded project scope')
    .action(async (toolArg: string, opts: { full?: boolean }) => {
      // `github` kept as a back-compat spelling for the Copilot adapter.
      const normalized = toolArg === 'github' ? 'copilot' : toolArg;
      const hit = AI_TOOLS.find((t) => t.id === normalized);
      if (hit === undefined) {
        const choices = AI_TOOLS.map((t) => t.id).join(' | ');
        console.error(pc.red(`Unknown tool: ${toolArg}. Try one of: ${choices}`));
        exitCode = 2;
        return;
      }
      await runInstall(hit.id, opts.full);
    });

  // `avo skill` — emit the authoring grammar as a copy-paste system prompt for
  // any tool without a repo-file adapter (Microsoft 365 Copilot, a custom GPT,
  // ChatGPT, Gemini). Prints to stdout (so it pipes), copies to the clipboard in
  // a terminal, or writes to a file with -o.
  program
    .command('skill', { hidden: true })
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

  // `avo mcp` — MCP client setup snippets; `--stdio` spawns the @avodado/mcp
  // server (local install if resolvable, else npx). No output on --stdio:
  // stdout is the MCP protocol channel.
  program
    .command('mcp')
    .description('Show MCP client setup for the Avodado server, or run it (--stdio)')
    .option('--stdio', 'start the MCP server on stdio (spawns @avodado/mcp)')
    .action(async (opts: { stdio?: boolean }) => {
      if (opts.stdio === true) {
        exitCode = await runMcpStdio(process.cwd());
        return;
      }
      console.log(mcpInstructions());
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
        const stem = basename(srcAbs).replace(/\.theme\.json$/i, '').replace(/\.jsonc?$/i, '');
        const slug = stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'theme';
        // `theme` may name a built-in, an already-installed theme, or this
        // very file (by its filename slug or its `name`) — a self-titled
        // custom theme is the common way theme files are authored.
        const known = [...listSavedThemes(cwd).map((s) => s.slug), slug];
        const check = validateThemeFile(text, known);
        if (!check.ok) {
          console.error(pc.red(`Invalid theme file ${valueArg}:`));
          for (const e of check.errors) console.error(pc.red(`  - ${e}`));
          exitCode = 2;
          return;
        }
        for (const w of check.warnings) console.log(pc.yellow(`  ! ${w}`));
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

  // Hidden compat: `avo block` / `avo template` — both fronted by `avo new`.
  program
    .command('block [name]', { hidden: true })
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

  program
    .command('template [name]', { hidden: true })
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

  // Per-command EXAMPLES epilogue — one data table in banner.ts drives them.
  for (const cmd of program.commands) {
    const name = cmd.name();
    if (commandExamples(name) !== '') {
      cmd.addHelpText('after', () => commandExamples(name));
    }
  }

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
