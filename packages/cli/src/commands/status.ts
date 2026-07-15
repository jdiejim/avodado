/**
 * Smart bare `avo` — the mini project status shown when `avo` is run with no
 * arguments inside an Avodado project (TTY only). Answers "where am I and
 * what next?" without picking through 14 commands: doc count, a quick
 * validate summary (parse + validate via core — no rendering), the active
 * theme, and the 4-5 next actions.
 */

import pc from 'picocolors';
import { loadConfig } from '../io/config.js';
import { activeTheme, listSavedThemes } from '../io/theme.js';
import { runCheck } from './check.js';

/** The data behind the bare-`avo` status panel. */
export interface ProjectStatus {
  /** How many docs matched `<docsDir>/**\/*.md`. */
  readonly docCount: number;
  /** Error-level diagnostics from a quick validate (no render). */
  readonly errors: number;
  /** Warning-level diagnostics from the same pass. */
  readonly warnings: number;
  /** The configured docs directory. */
  readonly docsDir: string;
  /** The active theme name (built-in, saved slug, or `custom`). */
  readonly theme: string;
}

/** Gathers the status: doc count + quick validate + active theme. */
export async function projectStatus(cwd: string): Promise<ProjectStatus> {
  const config = await loadConfig(cwd);
  const result = await runCheck({
    patterns: [`${config.docsDir}/**/*.md`],
    cwd,
    docsRoot: config.docsDir,
  });
  const errors = result.diagnostics.filter((d) => d.level === 'error').length;
  const cur = activeTheme(cwd, listSavedThemes(cwd));
  const theme =
    cur.kind === 'custom' ? 'custom' : cur.kind === 'none' ? 'textbook (default)' : (cur.id ?? 'textbook');
  return {
    docCount: result.files.length,
    errors,
    warnings: result.diagnostics.length - errors,
    docsDir: config.docsDir,
    theme,
  };
}

/** The next actions listed under the status, with one-liners. */
const NEXT_ACTIONS: ReadonlyArray<readonly [cmd: string, note: string]> = [
  ['avo check', 'validate every doc'],
  ['avo <file.md>', 'render + open one doc in the browser'],
  ['avo studio', 'edit visually · Site mode previews the docs site live'],
  ['avo build', 'build the static docs site'],
  ['avo explore', 'demos · block catalog · design patterns · guided tour'],
];

/**
 * Formats the status panel. `plain` drops color (also exercised by tests);
 * the caller prints the banner line above it.
 */
export function formatStatus(status: ProjectStatus, plain = false): string {
  const dim = (s: string): string => (plain ? s : pc.dim(s));
  const cyan = (s: string): string => (plain ? s : pc.cyan(s));
  const bold = (s: string): string => (plain ? s : pc.bold(s));
  const checkLine =
    status.errors > 0
      ? (plain ? '' : pc.red('✗ ')) +
        `${status.errors} error(s)` +
        (status.warnings > 0 ? ` · ${status.warnings} warning(s)` : '') +
        dim(' — run avo check')
      : (plain ? '' : pc.green('✓ ')) +
        'clean' +
        (status.warnings > 0 ? dim(` (${status.warnings} warning(s))`) : '');
  const width = Math.max(...NEXT_ACTIONS.map(([cmd]) => cmd.length));
  return [
    `  ${dim('docs'.padEnd(8))}${status.docCount} document(s) ${dim(`in ${status.docsDir}/`)}`,
    `  ${dim('check'.padEnd(8))}${checkLine}`,
    `  ${dim('theme'.padEnd(8))}${status.theme}`,
    '',
    `  ${bold('Next:')}`,
    ...NEXT_ACTIONS.map(([cmd, note]) => `    ${cyan(cmd.padEnd(width))}  ${dim(note)}`),
    '',
  ].join('\n');
}
