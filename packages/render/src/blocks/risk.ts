/**
 * Renders a `risk` block — a risk register as scannable row-cards. Severity
 * derives from likelihood × impact: both high → critical (solid red chip),
 * exactly one high → high, both low → low, everything else medium. Each card
 * carries the severity chip + risk text, an "L: … · I: …" mono line, the
 * mitigation, and right-aligned owner + status chips (open amber, mitigating
 * blue, accepted gray, closed green).
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

type RiskData = BlockDataMap['risk'];
type RiskItem = RiskData['items'][number];
type Severity = 'critical' | 'high' | 'medium' | 'low';

/** Derives the severity bucket from likelihood × impact. */
function severityOf(item: RiskItem): Severity {
  const { likelihood: l, impact: i } = item;
  if (l === 'high' && i === 'high') return 'critical';
  if (l === 'high' || i === 'high') return 'high';
  if (l === 'low' && i === 'low') return 'low';
  return 'medium';
}

function renderItem(item: RiskItem): string {
  const sev = severityOf(item);
  const mitigation =
    item.mitigation !== undefined
      ? `<p class="rk-mitigation"><span class="rk-mit-label">Mitigation:</span> ${escapeHtml(item.mitigation)}</p>`
      : '';
  const owner =
    item.owner !== undefined ? `<span class="rk-owner">${escapeHtml(item.owner)}</span>` : '';
  const status =
    item.status !== undefined
      ? `<span class="rk-status rk-st-${item.status}">${escapeHtml(item.status)}</span>`
      : '';
  const chips = owner !== '' || status !== '' ? `<span class="rk-chips">${owner}${status}</span>` : '';
  return (
    `<div class="rk-item">` +
    `<div class="rk-top">` +
    `<span class="rk-sev rk-sev-${sev}">${sev}</span>` +
    `<span class="rk-risk">${escapeHtml(item.risk)}</span>` +
    chips +
    `</div>` +
    `<div class="rk-meta">L: ${escapeHtml(item.likelihood)} · I: ${escapeHtml(item.impact)}</div>` +
    mitigation +
    `</div>`
  );
}

export function renderRisk(data: RiskData): string {
  const head =
    data.title !== undefined ? `<div class="rk-head">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined
      ? `<p class="rk-desc">${escapeHtml(data.description)}</p>`
      : '';
  const items = data.items.map(renderItem).join('');
  return `<div class="risk">${head}${desc}<div class="rk-list">${items}</div></div>`;
}
