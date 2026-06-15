/**
 * A small colored brand banner for the CLI — an avocado half (green rind, amber
 * pit) next to the wordmark. Shown on `avo` / `avo --help` and `avo init`.
 */

import pc from 'picocolors';

export function banner(version = '0.0.1'): string {
  const g = pc.green;
  const pit = pc.yellow('●');
  const name = pc.green(pc.bold('avodado'));
  const ver = pc.dim(`v${version}`);
  const tag = pc.dim('Documentation-as-code — Markdown with typed, fenced YAML blocks.');
  return [
    '',
    `  ${g('╭───────╮')}`,
    `  ${g('│  ')}${pit}${g('  ')}${pit}${g('  │')}   ${name} ${ver}`,
    `  ${g('│   ')}${pc.yellow('◡')}${g('   │')}   ${tag}`,
    `  ${g('╰───────╯')}`,
    '',
  ].join('\n');
}

/** The "what do I actually do" workflow, shown after top-level help. */
export function examples(): string {
  const step = (n: string, cmd: string, note: string): string =>
    `  ${pc.dim(n)}  ${pc.cyan(cmd.padEnd(26))}${pc.dim(note)}`;
  return [
    '',
    pc.bold('Workflow:'),
    step('1', 'avo init', 'scaffold docs/, config, and the agent skill'),
    step('2', 'edit docs/*.md', 'prose + typed blocks (grammar in .avodado/skill)'),
    step('3', 'avo check', 'validate — exits non-zero on errors (use in CI)'),
    step('4', 'avo preview docs/x.md', 'render and open it in your browser'),
    '',
    `  ${pc.dim('Per-command help:')} avo ${pc.cyan('<command>')} --help`,
    `  ${pc.dim('Docs:')} https://github.com/jdiejim/avodado`,
    '',
  ].join('\n');
}
