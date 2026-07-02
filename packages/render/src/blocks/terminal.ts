/**
 * Renders a `terminal` block — a shell session on the same dark editor
 * surface as `code`/`diff` (macOS dots included). The session is parsed per
 * line: `$ ` prefixes a command (green prompt glyph + bold command), `# ` a
 * dim italic comment; every other line is program output. No highlighting —
 * every line is escaped verbatim.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

function renderLine(line: string): string {
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

export function renderTerminal(data: BlockDataMap['terminal']): string {
  const lines = data.session
    .replace(/\n$/, '')
    .split('\n')
    .map(renderLine)
    .join('');
  return (
    `<div class="code-block terminal-block">` +
    `<div class="code-header">` +
    `<span>${escapeHtml(data.title ?? 'terminal')}</span>` +
    `<span>shell</span>` +
    `</div>` +
    `<pre class="tm-pre">${lines}</pre>` +
    `</div>`
  );
}
