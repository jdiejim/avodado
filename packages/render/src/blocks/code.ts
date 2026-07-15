/**
 * Renders a `code` block — one or more code snippets, a unified diff, or a
 * terminal session, all on the dark editor surface (`.code-block`, macOS dots
 * included). `kind` picks the presentation:
 *
 * - default: syntax-highlighted snippets from `blocks` (each with a header
 *   showing filename / language), or the single-snippet shorthand — top-level
 *   `code` (+ optional `lang`) with no `blocks` list.
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

/** One highlighted snippet card; `paths` are the data paths of its fields. */
function snippet(
  title: string,
  lang: string,
  code: string,
  paths: { self?: string; title: string; lang: string; code: string },
): string {
  return (
    `<div class="code-block"${paths.self !== undefined ? bp(paths.self) : ''}>` +
    `<div class="code-header">` +
    `<span${bp(paths.title)}>${escapeHtml(title)}</span>` +
    `<span${bp(paths.lang)}>${escapeHtml(lang)}</span>` +
    `</div>` +
    `<pre${bp(paths.code)}>${highlightCode(code)}</pre>` +
    `</div>`
  );
}

export function renderCode(data: CodeData): string {
  if (data.kind === 'diff') return renderDiffBody(data);
  if (data.kind === 'terminal') return renderTerminalBody(data);
  // Single-snippet shorthand: top-level `code` (+ `lang`), no `blocks` list.
  // A bare `session` with no kind also reads as a terminal — the field only
  // means one thing.
  if (data.blocks === undefined) {
    if (data.code !== undefined) {
      return snippet(data.title ?? '', data.lang ?? '', data.code, {
        title: 'title',
        lang: 'lang',
        code: 'code',
      });
    }
    if (data.session !== undefined) return renderTerminalBody(data);
  }
  const blocks = data.blocks ?? [];
  const rendered = blocks
    .map((b, i) =>
      snippet(b.title ?? '', b.lang ?? '', b.code, {
        self: `blocks.${i}`,
        title: `blocks.${i}.title`,
        lang: `blocks.${i}.lang`,
        code: `blocks.${i}.code`,
      }),
    )
    .join('');
  // The snippets have no natural shared container — an unstyled div carries
  // the array path without affecting layout (block-level, margins collapse).
  return `<div${bl('blocks')}>${rendered}</div>`;
}
