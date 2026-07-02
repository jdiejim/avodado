/**
 * Renders a `matrix` block — a role × resource capability grid. Rows are
 * subjects (e.g. roles), columns are resources/apps, and each cell holds a
 * capability value that is tinted by meaning (full / partial / none).
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

type MatrixData = BlockDataMap['matrix'];

/** Classifies a cell value into a tone class so cells colour by meaning. */
function cellTone(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (v === '' || v === '—' || v === '-' || v === 'none' || v === 'no' || v === '✗' || v === 'x') {
    return 'm-none';
  }
  if (
    v === 'full' || v === 'all' || v === 'admin' || v === 'owner' || v === 'yes' || v === '✓' ||
    v === 'write' || v === 'manage'
  ) {
    return 'm-full';
  }
  return 'm-some';
}

export function renderMatrix(data: MatrixData): string {
  const corner = data.corner ?? '';
  const head =
    `<tr><th class="mx-corner">${escapeHtml(corner)}</th>` +
    data.cols.map((c) => `<th scope="col">${escapeHtml(c)}</th>`).join('') +
    `</tr>`;
  const body = data.rows
    .map((row) => {
      const cells = data.cols
        .map((_, i) => {
          const val = row.cells[i] ?? '';
          const shown = val.trim() === '' ? '—' : val;
          return `<td class="mx-cell ${cellTone(val)}">${escapeHtml(shown)}</td>`;
        })
        .join('');
      return `<tr><th scope="row" class="mx-row">${escapeHtml(row.label)}</th>${cells}</tr>`;
    })
    .join('');
  const caption =
    data.title !== undefined ? `<div class="mx-title">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined ? `<p class="mx-desc">${escapeHtml(data.description)}</p>` : '';
  return `<div class="matrix">${caption}${desc}<div class="mx-scroll"><table class="mx-grid"><thead>${head}</thead><tbody>${body}</tbody></table></div></div>`;
}
