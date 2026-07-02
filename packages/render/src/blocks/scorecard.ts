/**
 * Renders a `scorecard` block — a weighted decision matrix in the house table
 * style. Criteria are rows (with a small "×N" weight chip when the weight is
 * not 1), options are columns with centered mono score cells, and a footer
 * TOTAL row carries the weighted sum per option. The winning option's column
 * header and total are highlighted with a WINNER chip (ties highlight all).
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

type ScorecardData = BlockDataMap['scorecard'];

/** Formats a total: integer when whole, one decimal when fractional. */
function fmtTotal(v: number): string {
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function renderScorecard(data: ScorecardData): string {
  const criteria = data.criteria;
  const options = data.options;
  const totals = options.map((opt) =>
    criteria.reduce((acc, c, i) => acc + (opt.scores[i] ?? 0) * (c.weight ?? 1), 0),
  );
  const best = totals.length > 0 ? Math.max(...totals) : 0;
  const isWinner = (i: number): boolean => totals[i] === best;

  const headCells = options
    .map((opt, i) => {
      const win = isWinner(i);
      const chip = win ? `<span class="sc-winner">WINNER</span>` : '';
      const note =
        opt.note !== undefined ? `<span class="sc-note">${escapeHtml(opt.note)}</span>` : '';
      return `<th class="c${win ? ' sc-win' : ''}">${escapeHtml(opt.label)}${chip}${note}</th>`;
    })
    .join('');
  const head = `<tr><th>Criteria</th>${headCells}</tr>`;

  const body = criteria
    .map((c, ci) => {
      const weight = c.weight ?? 1;
      const chip = weight !== 1 ? `<span class="sc-weight">×${escapeHtml(String(weight))}</span>` : '';
      const cells = options
        .map((opt) => {
          const score = opt.scores[ci];
          return `<td class="c sc-score">${score !== undefined ? escapeHtml(String(score)) : '—'}</td>`;
        })
        .join('');
      return `<tr><td class="sc-crit">${escapeHtml(c.label)}${chip}</td>${cells}</tr>`;
    })
    .join('');

  const footCells = totals
    .map((t, i) => `<td class="c sc-total${isWinner(i) ? ' sc-win' : ''}">${escapeHtml(fmtTotal(t))}</td>`)
    .join('');
  const foot = `<tr class="sc-foot"><td>TOTAL</td>${footCells}</tr>`;

  const caption =
    data.title !== undefined ? `<div class="sc-head">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined ? `<p class="sc-desc">${escapeHtml(data.description)}</p>` : '';
  return (
    `<div class="scorecard">${caption}${desc}` +
    `<div class="sc-scroll"><table class="sc-table">` +
    `<thead>${head}</thead><tbody>${body}${foot}</tbody>` +
    `</table></div></div>`
  );
}
