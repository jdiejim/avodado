/**
 * Renders a `harvey` block — the rated comparison grid.
 *
 * Options across the top, criteria down the side, and a filled circle for how
 * well each option meets each one. A steering committee reads it faster than
 * any table of numbers, because a column of nearly-full circles argues for
 * itself — which is exactly why the block also computes and marks the leader,
 * so the picture and the arithmetic can't disagree.
 *
 * `benchmark` is for measured numbers; this is for judgements.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

type HarveyData = BlockDataMap['harvey'];

/** Ratings are 0–4: empty, quarter, half, three-quarter, full. */
const STEPS = 4;
const R = 9;

/**
 * One Harvey ball as SVG: a ring, plus a filled wedge for the rating. Quarters
 * are drawn as arcs from 12 o'clock so the fill reads clockwise, the way the
 * convention has always been printed.
 */
function ball(rating: number): string {
  const v = Math.max(0, Math.min(STEPS, Math.round(rating)));
  // The ball is the cell's only content — without an accessible name a screen
  // reader hears nothing. role="img" + aria-label speaks the rating.
  const open = `<svg width="${R * 2 + 2}" height="${R * 2 + 2}" viewBox="0 0 ${R * 2 + 2} ${R * 2 + 2}" role="img" aria-label="${v} of ${STEPS}">`;
  const ring = `<circle cx="${R + 1}" cy="${R + 1}" r="${R}" fill="var(--white)" stroke="var(--navy)" stroke-width="1.4"/>`;
  if (v === 0) return `${open}${ring}</svg>`;
  if (v === STEPS) {
    return `${open}${ring}<circle cx="${R + 1}" cy="${R + 1}" r="${R}" fill="var(--navy)"/></svg>`;
  }
  const sweep = (v / STEPS) * 360;
  const a = ((sweep - 90) * Math.PI) / 180;
  const x = R + 1 + R * Math.cos(a);
  const y = R + 1 + R * Math.sin(a);
  const large = sweep > 180 ? 1 : 0;
  const wedge = `<path d="M ${R + 1} ${R + 1} L ${R + 1} 1 A ${R} ${R} 0 ${large} 1 ${round(x)} ${round(y)} Z" fill="var(--navy)"/>`;
  return `${open}${ring}${wedge}</svg>`;
}

function round(v: number): number {
  return Math.round(v * 10) / 10;
}

export function renderHarvey(data: HarveyData): string {
  const cols = data.columns;
  // Weighted score per column, so the marked recommendation is arithmetic
  // rather than assertion — and a mismatch with `recommend` is visible.
  const totals = cols.map((_c, ci) =>
    data.rows.reduce((a, row) => a + (row.ratings[ci] ?? 0) * (row.weight ?? 1), 0),
  );
  const best = Math.max(...totals, 0);
  const recommended = data.recommend?.toLowerCase();

  const head = cols
    .map((c, ci) => {
      const isRec = recommended !== undefined && c.toLowerCase() === recommended;
      const chip = isRec ? `<span class="hv-rec">RECOMMENDED</span>` : '';
      return `<th class="hv-col${isRec ? ' hv-is-rec' : ''}"${bp(`columns.${ci}`)}>${escapeHtml(c)}${chip}</th>`;
    })
    .join('');

  const body = data.rows
    .map((row, ri) => {
      const weight =
        row.weight !== undefined && row.weight !== 1
          ? `<span class="hv-weight"${bp(`rows.${ri}.weight`)}>×${escapeHtml(String(row.weight))}</span>`
          : '';
      const note =
        row.note !== undefined
          ? `<span class="hv-note"${bp(`rows.${ri}.note`)}>${escapeHtml(row.note)}</span>`
          : '';
      const cells = cols
        .map((c, ci) => {
          const isRec = recommended !== undefined && c.toLowerCase() === recommended;
          const rating = row.ratings[ci];
          // A short row is "not assessed" rather than a zero score — a dash
          // says that, an empty ball would claim it scored badly.
          const cell =
            rating === undefined
              ? `<span class="hv-na">—</span>`
              : `${ball(rating)}<span class="hv-sr">${Math.max(0, Math.min(STEPS, Math.round(rating)))} of ${STEPS}</span>`;
          return `<td class="hv-cell${isRec ? ' hv-is-rec' : ''}"${bp(`rows.${ri}.ratings.${ci}`)}>${cell}</td>`;
        })
        .join('');
      return (
        `<tr${bp(`rows.${ri}`)}><td class="hv-crit">` +
        `<span class="hv-label"${bp(`rows.${ri}.label`)}>${escapeHtml(row.label)}</span>${weight}${note}</td>${cells}</tr>`
      );
    })
    .join('');

  const foot = `<tr class="hv-foot"><td>Weighted</td>${totals
    .map((t, ci) => {
      const isRec = recommended !== undefined && cols[ci]?.toLowerCase() === recommended;
      const leads = t === best && best > 0;
      return `<td class="hv-total${isRec ? ' hv-is-rec' : ''}${leads ? ' hv-lead' : ''}">${round(t)}</td>`;
    })
    .join('')}</tr>`;

  const [low, high] = data.scale ?? [];
  const scale =
    low !== undefined && high !== undefined
      ? `<div class="hv-scale">${ball(0)}<span>${escapeHtml(low)}</span>` +
        `${ball(STEPS)}<span>${escapeHtml(high)}</span></div>`
      : '';

  const caption =
    data.title !== undefined ? `<div class="hv-head">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined
      ? `<p class="hv-desc"${bp('description')}>${escapeHtml(data.description)}</p>`
      : '';

  return (
    `<div class="harvey">${caption}${desc}` +
    `<div class="hv-scroll"><table class="hv-table">` +
    `<thead><tr${bl('columns')}><th class="hv-crit">Criteria</th>${head}</tr></thead>` +
    `<tbody${bl('rows')}>${body}${foot}</tbody></table></div>${scale}</div>`
  );
}
