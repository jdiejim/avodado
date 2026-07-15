/**
 * The CLI's brand marks — a big cfonts wordmark for the `avo init` wizard and a
 * compact one-line banner for `avo` / `avo --help` — plus the per-command
 * action banners and the grouped help epilogue.
 *
 * Both marks respect non-TTY stdout and `AVO_PLAIN=1`: piped output gets one
 * plain, uncolored line (no ANSI escapes, no cfonts art).
 */

import pc from 'picocolors';
import cfonts from 'cfonts'; // CJS module — default import, then `.render`

const TAGLINE = 'Documentation-as-code — Markdown with typed, fenced YAML blocks.';

/** Avocado green — the same flesh→skin gradient the per-command action
 *  banners (studio, theme, check, …) use, so all cfonts art matches. */
const BRAND_GRADIENT = ['#a5d76e', '#2e7d32'];

/** True when output must stay plain: piped/redirected stdout or AVO_PLAIN=1. */
const plainOutput = (): boolean =>
  process.stdout.isTTY !== true || process.env['AVO_PLAIN'] === '1';

/** The one-line plain (uncolored) banner used whenever ANSI isn't welcome. */
const plainLine = (version: string): string => `avodado v${version} — ${TAGLINE}`;

/** Strips ANSI escapes so rendered art can be measured in visible columns. */
const stripAnsi = (s: string): string =>
  // eslint-disable-next-line no-control-regex
  s.replace(/\u001b\[[0-9;]*m/g, '');

/** Widest visible line of a rendered block of art. */
const artWidth = (art: string): number =>
  Math.max(0, ...stripAnsi(art).split('\n').map((l) => l.length));

/** Renders "avodado" via cfonts in `font`, or `''` if cfonts can't. */
function renderWordmark(font: 'block' | 'tiny'): string {
  try {
    const out = cfonts.render('avodado', {
      font,
      gradient: BRAND_GRADIENT,
      independentGradient: false,
      transitionGradient: true,
      letterSpacing: 1,
      space: false,
      env: 'node',
    });
    if (out !== false && typeof out === 'object') return out.string ?? '';
  } catch {
    /* fall through */
  }
  return '';
}

/**
 * The big "avodado" wordmark (via cfonts), shown at the top of the interactive
 * `avo init` wizard. Uses the chunky `block` face (Minecraft-style) in the
 * avocado gradient; falls back to `tiny` when it renders wider than ~78
 * columns, and to the compact {@link banner} if cfonts can't render at all.
 * Plain (uncolored, one line) when stdout isn't a TTY or `AVO_PLAIN=1`.
 */
export function wordmark(version = '0.0.2'): string {
  if (plainOutput()) return `\n${plainLine(version)}\n`;
  let art = renderWordmark('block');
  if (art === '' || artWidth(art) > 78) {
    const tiny = renderWordmark('tiny');
    if (tiny !== '') art = tiny;
  }
  if (art === '') return banner(version);
  return `\n${art}\n  ${pc.green(pc.bold(`v${version}`))} ${pc.dim(`— ${TAGLINE}`)}\n`;
}

/**
 * A fun per-command header: the action word rendered big in avocado-green via
 * cfonts (e.g. "slides", "preview", "check").
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
  theme: 'Picking a perfectly ripe theme…',
  check: 'Checking for bad avocados…',
  new: 'Planting a fresh doc…',
  install: 'Planting the Avodado skill…',
  demo: 'Serving up the avocado demo…',
  build: 'Pressing the whole grove into a site…',
  serve: 'Serving fresh docs — reloads on save…',
  studio: 'Opening the studio — the grove goes visual…',
  tour: 'A quick walk through the grove…',
  explore: 'Wandering the grove…',
};

/** A fun, action-themed avocado status line. */
export function funLine(action: string): string {
  return pc.dim(`  ${FUN_LINES[action] ?? `${action}…`}`);
}

/**
 * The compact banner shown on `avo` / `avo --help`: a single line — green
 * avocado glyph, bold wordmark, dim version + tagline. Plain and uncolored
 * when stdout isn't a TTY or `AVO_PLAIN=1`.
 */
export function banner(version = '0.0.2'): string {
  if (plainOutput()) return `\n${plainLine(version)}\n`;
  const glyph = pc.green('◖');
  const name = pc.bold(pc.green('avodado'));
  return `\n  ${glyph} ${name} ${pc.dim(`v${version} — ${TAGLINE}`)}\n`;
}

/** The command groups shown after top-level help, in display order. */
const HELP_GROUPS: ReadonlyArray<{ readonly header: string; readonly commands: readonly string[] }> = [
  { header: 'WORK', commands: ['init', 'new', 'check', 'studio'] },
  { header: 'OUTPUT', commands: ['html', 'slides', 'pdf', 'build'] },
  { header: 'DISCOVER', commands: ['explore'] },
  { header: 'SETUP', commands: ['install', 'theme', 'mcp', 'sync'] },
];

/** The grouped command epilogue, shown after top-level help. Uncolored when
 *  output must stay plain — picocolors alone would still emit ANSI on piped
 *  output whenever a `CI` env var is set (e.g. GitHub Actions). */
export function examples(): string {
  const p = plainOutput();
  const dim = (s: string): string => (p ? s : pc.dim(s));
  const cyan = (s: string): string => (p ? s : pc.cyan(s));
  const rows = HELP_GROUPS.map(
    (g) => `  ${dim(g.header.padEnd(10))}${g.commands.map((c) => cyan(c)).join(dim(' · '))}`,
  );
  return [
    '',
    ...rows,
    '',
    `  ${cyan('avo <file.md>')} ${dim('renders + opens a doc — the fastest preview')}`,
    `  ${dim('New here?')} avo ${cyan('explore tour')} ${dim('· docs:')} https://github.com/jdiejim/avodado`,
    '',
  ].join('\n');
}

/**
 * Real usage examples per visible command — one data table drives every
 * command's `--help` EXAMPLES epilogue ({@link commandExamples}).
 */
const COMMAND_EXAMPLES: Readonly<Record<string, ReadonlyArray<readonly [cmd: string, note: string]>>> = {
  init: [
    ['avo init', 'scaffold a project (interactive wizard)'],
    ['avo init -y', 'skip the wizard — defaults: all tools, textbook theme'],
  ],
  new: [
    ['avo new', 'pick a doc template or block scaffold interactively'],
    ['avo new adr -o docs/decisions/001-queue.md', 'scaffold an ADR into a file'],
    ['avo new sequence', 'print a sequence-block scaffold to paste'],
  ],
  check: [
    ['avo check', 'validate every doc under docs/'],
    ['avo check docs/api.md', 'validate one file'],
    ['avo check --json', 'machine-readable diagnostics (CI)'],
  ],
  studio: [
    ['avo studio', 'open the studio — Edit · Site · Present, files stay the source of truth'],
    ['avo studio --port 5000 --no-open', 'pick the port, skip the browser'],
  ],
  html: [
    ['avo html docs/design.md', 'write docs/design.html next to the source'],
    ['avo html docs/design.md -p', 'render to a temp file and open it'],
  ],
  slides: [
    ['avo slides docs/roadmap.md -p', 'open the doc as a slide deck'],
    ['avo slides docs/roadmap.md -o deck.html', 'write the deck to a file'],
  ],
  pdf: [
    ['avo pdf docs/design.md', 'write docs/design.pdf (downloads Chromium once)'],
    ['avo pdf docs/design.md -o out/design.pdf', 'choose the output path'],
  ],
  build: [
    ['avo build', 'build the whole site into dist/'],
    ['avo build --out site', 'build into a different directory'],
  ],
  explore: [
    ['avo explore', 'pick interactively — demo · catalog · design · tour'],
    ['avo explore tour', 'the guided, hands-on walkthrough'],
    ['avo explore demo charts', 'showcase one block family'],
  ],
  install: [
    ['avo install claude', 'install/refresh the skill + Claude Code adapter'],
    ['avo install cursor', 'install/refresh the skill + Cursor rule'],
  ],
  theme: [
    ['avo theme', 'pick a theme interactively'],
    ['avo theme use dark', 'set the project theme'],
    ['avo theme new sunset', 'scaffold a custom theme to fill in'],
  ],
  mcp: [
    ['avo mcp', 'print MCP client setup snippets'],
    ['avo mcp --stdio', 'run the Avodado MCP server on stdio'],
  ],
  sync: [
    ['avo sync openapi api.yaml -o docs/api.md', 'generate a doc from an OpenAPI spec'],
    ['avo sync openapi api.yaml --check docs/api.md', 'fail on drift (CI)'],
    ['avo sync csv sales.csv', 'print a ready-to-paste block (auto-picks table/statustable/chart)'],
    ['avo sync csv sales.csv -o docs/sales.md', 'wrap the block in a doc, write it, and validate'],
    ['avo sync csv sales.csv --block chart', 'force the target block type'],
  ],
};

/**
 * The EXAMPLES epilogue for one command's `--help`, or `''` when the command
 * has no examples (hidden compat commands). Plain-aware like {@link examples}.
 */
export function commandExamples(name: string): string {
  const rows = COMMAND_EXAMPLES[name];
  if (rows === undefined) return '';
  const p = plainOutput();
  const dim = (s: string): string => (p ? s : pc.dim(s));
  const cyan = (s: string): string => (p ? s : pc.cyan(s));
  const width = Math.max(...rows.map(([cmd]) => cmd.length));
  return [
    '',
    'Examples:',
    ...rows.map(([cmd, note]) => `  ${cyan('$ ' + cmd.padEnd(width))}  ${dim(note)}`),
    '',
  ].join('\n');
}
