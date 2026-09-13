/**
 * Renders a `code` block — one or more code snippets, a unified diff, or a
 * terminal session, all on the dark editor surface (`.code-block`, macOS dots
 * included). `kind` picks the presentation:
 *
 * - default: syntax-highlighted snippets from `blocks` (each with a header
 *   showing filename / language), or the single-snippet shorthand — top-level
 *   `code` (+ optional `lang`) with no `blocks` list. Every snippet is split
 *   into line spans so `highlight` (1-based ranges, `"3-5, 8"`) can band the
 *   named lines with the accent, `lines` can number them from `start`, and
 *   `wrap` can soft-wrap them. `cols` lays `blocks` out as a grid (1–3).
 * - `compare`: the `cols: 2` grid with a BEFORE / AFTER eyebrow on the first
 *   two entries (an entry's own `title` wins when set).
 * - `diff` (the former `diff` type): unified-diff text in `code` — lines
 *   starting `+` are additions (green), `-` removals (red), `@@` hunk headers
 *   (dim italic); everything else is context. No highlighting — every line is
 *   escaped verbatim.
 * - `terminal` (the former `terminal` type): a shell session in `session` —
 *   `$ ` prefixes a command (green prompt glyph + bold command), `# ` a dim
 *   italic comment; every other line is program output. Escaped verbatim.
 *
 * Ported from doc-studio.jsx `CodeBlock` (iterated for multiple snippets).
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { highlightCode } from '../highlight.js';
import { bl, bp } from '../paths.js';

type CodeData = BlockDataMap['code'];

// ─── kind: diff (the former `diff` type) ─────────────────────────────────────

function diffLineClass(line: string): string {
  if (line.startsWith('+')) return 'df-add';
  if (line.startsWith('-')) return 'df-del';
  if (line.startsWith('@@')) return 'df-hunk';
  return 'df-ctx';
}

function renderDiffBody(data: CodeData): string {
  const lines = (data.code ?? '')
    .split('\n')
    .map(
      (line) =>
        `<span class="df-line ${diffLineClass(line)}">${escapeHtml(line === '' ? ' ' : line)}</span>`,
    )
    .join('');
  return (
    `<div class="code-block diff-block">` +
    `<div class="code-header">` +
    `<span>${escapeHtml(data.title ?? '')}</span>` +
    `<span${bp('lang')}>${escapeHtml(data.lang ?? 'diff')}</span>` +
    `</div>` +
    `<pre class="diff-pre"${bp('code')}>${lines}</pre>` +
    `</div>`
  );
}

// ─── kind: terminal (the former `terminal` type) ─────────────────────────────

function terminalLine(line: string): string {
  if (line.startsWith('$ ')) {
    return (
      `<span class="tm-line tm-cmd">` +
      `<span class="tm-prompt">$</span> ` +
      `<span class="tm-cmd-text">${escapeHtml(line.slice(2))}</span>` +
      `</span>`
    );
  }
  if (line.startsWith('# ')) {
    return `<span class="tm-line tm-comment">${escapeHtml(line)}</span>`;
  }
  return `<span class="tm-line tm-out">${escapeHtml(line === '' ? ' ' : line)}</span>`;
}

function renderTerminalBody(data: CodeData): string {
  const lines = (data.session ?? '')
    .replace(/\n$/, '')
    .split('\n')
    .map(terminalLine)
    .join('');
  return (
    `<div class="code-block terminal-block">` +
    `<div class="code-header">` +
    `<span>${escapeHtml(data.title ?? 'terminal')}</span>` +
    `<span>shell</span>` +
    `</div>` +
    `<pre class="tm-pre"${bp('session')}>${lines}</pre>` +
    `</div>`
  );
}

// ─── default: highlighted snippets ───────────────────────────────────────────

/**
 * Parses a `highlight` string (`"3-5, 8"`) into the set of 1-based line
 * numbers it names. Tokens that are not `n` or `a-b` (with a ≤ b, both ≥ 1)
 * are ignored; core checks the type only, so a typo highlights nothing rather
 * than failing the doc.
 */
export function parseHighlight(spec: string | undefined): Set<number> {
  const out = new Set<number>();
  if (spec === undefined) return out;
  for (const raw of spec.split(',')) {
    const token = raw.trim();
    const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(token);
    if (m === null) continue;
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : Number(m[2]);
    if (a < 1 || b < a) continue;
    for (let n = a; n <= b; n++) out.add(n);
  }
  return out;
}

/**
 * Splits highlighter output on `\n` into per-line HTML. The tokenizer emits
 * flat spans, but a block comment or a template literal can run across a
 * newline — a span open at the end of one line is closed there and reopened
 * on the next, so every line is self-contained markup.
 */
export function splitHighlightedLines(html: string): string[] {
  const lines = html.split('\n');
  const out: string[] = [];
  let open: string | undefined;
  for (const line of lines) {
    let cur = open === undefined ? line : `<span class="${open}">${line}`;
    const tags = /<span class="([a-z]+)">|<\/span>/g;
    let m: RegExpExecArray | null;
    while ((m = tags.exec(line)) !== null) open = m[1] === undefined ? undefined : m[1];
    if (open !== undefined) cur += '</span>';
    out.push(cur);
  }
  return out;
}

interface SnippetOpts {
  readonly highlight?: string | undefined;
  readonly caption?: string | undefined;
  readonly lines: boolean;
  readonly start: number;
  readonly wrap: boolean;
  /** Header eyebrow (`compare`); shown when the entry has no title. */
  readonly eyebrow?: string | undefined;
}

/** One highlighted snippet card; `paths` are the data paths of its fields. */
function snippet(
  title: string,
  lang: string,
  code: string,
  paths: { self?: string; title: string; lang: string; code: string; caption?: string },
  opts: SnippetOpts,
): string {
  const marked = parseHighlight(opts.highlight);
  const body = splitHighlightedLines(highlightCode(code.replace(/\n$/, ''), lang));
  const lines = body
    .map((line, i) => {
      const hl = marked.has(i + 1) ? ' cl-hl' : '';
      return `<span class="cl${hl}">${line}\n</span>`;
    })
    .join('');
  const classes = ['code-block', 'cb'];
  if (opts.lines) classes.push('cb-lines');
  if (opts.wrap) classes.push('cb-wrap');
  const last = opts.start + body.length - 1;
  const gutter = opts.lines
    ? ` style="--code-start:${opts.start - 1};--code-gutter:${String(last).length}ch"`
    : '';
  const head =
    opts.eyebrow !== undefined && title === ''
      ? `<span class="code-eyebrow"${bp(paths.title)}>${escapeHtml(opts.eyebrow)}</span>`
      : `<span${bp(paths.title)}>${escapeHtml(title)}</span>`;
  const caption =
    opts.caption !== undefined
      ? `<div class="code-cap"${paths.caption !== undefined ? bp(paths.caption) : ''}>${escapeHtml(opts.caption)}</div>`
      : '';
  return (
    `<div class="${classes.join(' ')}"${paths.self !== undefined ? bp(paths.self) : ''}${gutter}>` +
    `<div class="code-header">` +
    head +
    `<span${bp(paths.lang)}>${escapeHtml(lang)}</span>` +
    `</div>` +
    `<pre${bp(paths.code)}>${lines}</pre>` +
    caption +
    `</div>`
  );
}

const EYEBROWS = ['BEFORE', 'AFTER'] as const;

export function renderCode(data: CodeData): string {
  if (data.kind === 'diff') return renderDiffBody(data);
  if (data.kind === 'terminal') return renderTerminalBody(data);
  const base = {
    lines: data.lines ?? false,
    start: data.start ?? 1,
    wrap: data.wrap ?? false,
  };
  // Single-snippet shorthand: top-level `code` (+ `lang`), no `blocks` list.
  // A bare `session` with no kind also reads as a terminal — the field only
  // means one thing.
  if (data.blocks === undefined) {
    if (data.code !== undefined) {
      return snippet(
        data.title ?? '',
        data.lang ?? '',
        data.code,
        { title: 'title', lang: 'lang', code: 'code', caption: 'caption' },
        { ...base, highlight: data.highlight, caption: data.caption },
      );
    }
    if (data.session !== undefined) return renderTerminalBody(data);
  }
  const blocks = data.blocks ?? [];
  const compare = data.kind === 'compare';
  const cols = compare ? 2 : (data.cols ?? 1);
  const rendered = blocks
    .map((b, i) =>
      snippet(
        b.title ?? '',
        b.lang ?? '',
        b.code,
        {
          self: `blocks.${i}`,
          title: `blocks.${i}.title`,
          lang: `blocks.${i}.lang`,
          code: `blocks.${i}.code`,
          caption: `blocks.${i}.caption`,
        },
        {
          ...base,
          highlight: b.highlight,
          caption: b.caption,
          eyebrow: compare ? (EYEBROWS[i] ?? `#${i + 1}`) : undefined,
        },
      ),
    )
    .join('');
  const caption =
    data.caption !== undefined
      ? `<div class="code-cap code-cap-group"${bp('caption')}>${escapeHtml(data.caption)}</div>`
      : '';
  // The grid carries the array path; at one column it is a plain stack.
  const grid = cols > 1 ? ` class="code-grid" style="--code-cols:${cols}"` : '';
  return `<div${bl('blocks')}${grid}>${rendered}</div>${caption}`;
}
