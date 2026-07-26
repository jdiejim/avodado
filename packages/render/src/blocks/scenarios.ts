/**
 * Renders a `scenarios` block — base, upside and downside against the same
 * drivers.
 *
 * The table a plan is defended with. Cases go in columns so the comparison is
 * the point: read across a driver row and you see how much of the outcome
 * hangs on that one assumption. `outcome` is the number the room actually
 * argues about, so it gets an emphasised row of its own, and the base case is
 * marked because every other column is read relative to it.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

type ScenariosData = BlockDataMap['scenarios'];

/** Tone → the class carrying its accent. */
const TONE: Readonly<Record<string, string>> = {
  pos: 'sc-pos',
  neg: 'sc-neg',
  base: 'sc-base',
};

export function renderScenarios(data: ScenariosData): string {
  const cases = data.cases;

  const head = cases
    .map((c, ci) => {
      const tone = c.tone !== undefined ? ` ${TONE[c.tone] ?? ''}` : '';
      const badge = c.tone === 'base' ? `<span class="sn-badge">BASE CASE</span>` : '';
      const note =
        c.note !== undefined ? `<span class="sn-note">${escapeHtml(c.note)}</span>` : '';
      return `<th class="sn-case${tone}"${bp(`cases.${ci}`)}>${escapeHtml(c.label)}${badge}${note}</th>`;
    })
    .join('');

  const rows = data.drivers
    .map((driver, di) => {
      const cells = cases
        .map((c, ci) => {
          const tone = c.tone !== undefined ? ` ${TONE[c.tone] ?? ''}` : '';
          // A case that doesn't state an assumption for this driver is silent
          // about it, which is not the same as saying "no change".
          const v = c.values[di];
          return v === undefined
            ? `<td class="sn-cell sn-blank${tone}">·</td>`
            : `<td class="sn-cell${tone}"${bp(`cases.${ci}.values.${di}`)}>${escapeHtml(v)}</td>`;
        })
        .join('');
      return `<tr><td class="sn-driver"${bp(`drivers.${di}`)}>${escapeHtml(driver)}</td>${cells}</tr>`;
    })
    .join('');

  const hasOutcome = cases.some((c) => c.outcome !== undefined);
  const outcome = hasOutcome
    ? `<tr class="sn-outcome"><td>${escapeHtml(data.outcomeLabel ?? 'Outcome')}</td>` +
      cases
        .map((c, ci) => {
          const tone = c.tone !== undefined ? ` ${TONE[c.tone] ?? ''}` : '';
          return c.outcome === undefined
            ? `<td class="${tone.trim()}">—</td>`
            : `<td class="${tone.trim()}"${bp(`cases.${ci}.outcome`)}>${escapeHtml(c.outcome)}</td>`;
        })
        .join('') +
      `</tr>`
    : '';

  const caption =
    data.title !== undefined ? `<div class="sn-head">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined
      ? `<p class="sn-desc"${bp('description')}>${escapeHtml(data.description)}</p>`
      : '';

  return (
    `<div class="scenarios">${caption}${desc}` +
    `<div class="sn-scroll"><table class="sn-table">` +
    `<thead><tr${bl('cases')}><th class="sn-driver">Driver</th>${head}</tr></thead>` +
    `<tbody${bl('drivers')}>${rows}${outcome}</tbody>` +
    `</table></div></div>`
  );
}
