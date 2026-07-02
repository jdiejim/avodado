/**
 * Renders a `diff` block — a unified diff on the dark editor surface (the
 * same `.code-block` chrome as `code`, macOS dots included). Lines starting
 * `+` are additions (green), `-` removals (red), `@@` hunk headers (dim
 * italic); everything else is context. No syntax highlighting inside diff
 * lines — every line is escaped verbatim.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

function lineClass(line: string): string {
  if (line.startsWith('+')) return 'df-add';
  if (line.startsWith('-')) return 'df-del';
  if (line.startsWith('@@')) return 'df-hunk';
  return 'df-ctx';
}

export function renderDiff(data: BlockDataMap['diff']): string {
  const lines = data.code
    .split('\n')
    .map(
      (line) =>
        `<span class="df-line ${lineClass(line)}">${escapeHtml(line === '' ? ' ' : line)}</span>`,
    )
    .join('');
  return (
    `<div class="code-block diff-block">` +
    `<div class="code-header">` +
    `<span>${escapeHtml(data.title ?? '')}</span>` +
    `<span>${escapeHtml(data.lang ?? 'diff')}</span>` +
    `</div>` +
    `<pre class="diff-pre">${lines}</pre>` +
    `</div>`
  );
}
