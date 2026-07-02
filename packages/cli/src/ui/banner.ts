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

/** Navy → teal, the "professional" brand gradient for the big wordmark. */
const BRAND_GRADIENT = ['#0e54a1', '#0f766e'];

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
function renderWordmark(font: 'slick' | 'tiny'): string {
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
 * `avo init` wizard. Prefers the `slick` face; falls back to `tiny` when slick
 * renders wider than ~78 columns, and to the compact {@link banner} if cfonts
 * can't render at all. Plain (uncolored, one line) when stdout isn't a TTY or
 * `AVO_PLAIN=1`.
 */
export function wordmark(version = '0.0.2'): string {
  if (plainOutput()) return `\n${plainLine(version)}\n`;
  let art = renderWordmark('slick');
  if (art === '' || artWidth(art) > 78) {
    const tiny = renderWordmark('tiny');
    if (tiny !== '') art = tiny;
  }
  if (art === '') return banner(version);
  return `\n${art}\n  ${pc.dim(`v${version} — ${TAGLINE}`)}\n`;
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
  tour: 'A quick walk through the grove…',
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
  { header: 'AUTHOR', commands: ['init', 'check', 'block', 'template'] },
  { header: 'RENDER', commands: ['preview', 'serve', 'html', 'pdf', 'build'] },
  { header: 'PRESENT', commands: ['slides', 'demo', 'catalog', 'design'] },
  { header: 'AI', commands: ['install', 'skill', 'mcp', 'tour'] },
  { header: 'CONFIG', commands: ['theme', 'sync'] },
];

/** The grouped command epilogue, shown after top-level help. Uncolored when
 *  output must stay plain — picocolors alone would still emit ANSI on piped
 *  output whenever a `CI` env var is set (e.g. GitHub Actions). */
export function examples(): string {
  const p = plainOutput();
  const dim = (s: string): string => (p ? s : pc.dim(s));
  const cyan = (s: string): string => (p ? s : pc.cyan(s));
  const rows = HELP_GROUPS.map(
    (g) => `  ${dim(g.header.padEnd(9))}${g.commands.map((c) => cyan(c)).join(dim(' · '))}`,
  );
  return [
    '',
    ...rows,
    '',
    `  ${dim('New here?')} avo ${cyan('tour')} ${dim('· per-command help:')} avo ${cyan('<command>')} --help`,
    `  ${dim('Docs:')} https://github.com/jdiejim/avodado`,
    '',
  ].join('\n');
}
