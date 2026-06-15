/**
 * A small colored brand banner for the CLI — an avocado half (green rind, amber
 * pit) next to the wordmark. Shown on `avo` / `avo --help` and `avo init`.
 */

import pc from 'picocolors';
import cfonts from 'cfonts'; // CJS module — default import, then `.render`

/**
 * The big avocado-green "avodado" wordmark (via cfonts), shown at the top of the
 * interactive `avo init` wizard. Falls back to the compact {@link banner} if
 * cfonts can't render (e.g. an unusual terminal).
 */
export function logo(): string {
  let art = '';
  try {
    const out = cfonts.render('avodado', {
      font: 'block',
      gradient: ['#a5d76e', '#2e7d32'], // avocado: light rind → dark skin
      transitionGradient: true,
      space: false,
      env: 'node',
    });
    if (out !== false && typeof out === 'object') art = out.string ?? '';
  } catch {
    /* fall through to the compact banner */
  }
  if (art === '') return banner();
  return `\n${art}\n  ${pc.dim('Documentation-as-code — Markdown with typed, fenced YAML blocks.')}\n`;
}

/**
 * A fun per-command header: the action word rendered big in avocado-green via
 * cfonts (e.g. "slides", "preview", "export").
 */
export function actionBanner(word: string): string {
  try {
    const out = cfonts.render(word, {
      font: 'tiny',
      gradient: ['#a5d76e', '#2e7d32'],
      transitionGradient: true,
      space: false,
      env: 'node',
    });
    if (out !== false && typeof out === 'object' && out.string !== undefined) {
      return `\n${out.string}\n`;
    }
  } catch {
    /* fall back to a plain bold word */
  }
  return `\n  ${pc.green(pc.bold(word))}\n`;
}

const FUN_LINES: Readonly<Record<string, string>> = {
  html: 'Mashing your doc into smooth HTML…',
  slides: 'Slicing the avocado into slides…',
  pdf: 'Pressing one ripe PDF…',
  preview: 'Previewing the avocado…',
  export: 'Guac-ing up your docs…',
  theme: 'Picking a perfectly ripe theme…',
  render: 'Rendering a ripe page…',
  check: 'Checking for bad avocados…',
  new: 'Planting a fresh doc…',
  install: 'Planting the Avodado skill…',
  demo: 'Serving up the avocado demo…',
};

/** A fun, action-themed avocado status line. */
export function funLine(action: string): string {
  return pc.dim(`  ${FUN_LINES[action] ?? `${action}…`}`);
}

export function banner(version = '0.0.2'): string {
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
