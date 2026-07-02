/**
 * Renders an `slo` block — service-level objectives with error budgets. One
 * row-card per SLO: name + window chip, the SLI line, target vs current as
 * labeled values, and an optional horizontal burn bar showing the fraction of
 * the error budget consumed (green < 0.5, amber 0.5–0.8, red > 0.8; a budget
 * above 1 renders a full red bar with an "exhausted" caption).
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

type SloData = BlockDataMap['slo'];
type SloItem = SloData['items'][number];

/** Picks the burn-bar tone class for a consumed-budget fraction. */
function budgetTone(budget: number): string {
  if (budget > 0.8) return 'slo-b-hot';
  if (budget >= 0.5) return 'slo-b-warn';
  return 'slo-b-ok';
}

function renderBudget(budget: number): string {
  const clamped = Math.min(budget, 1);
  const width = Math.round(clamped * 1000) / 10;
  const caption =
    budget >= 1
      ? 'error budget exhausted'
      : `${Math.round(clamped * 100)}% of error budget used`;
  return (
    `<div class="slo-budget">` +
    `<div class="slo-track">` +
    `<div class="slo-fill ${budgetTone(budget)}" style="width:${width}%"></div>` +
    `</div>` +
    `<div class="slo-caption">${escapeHtml(caption)}</div>` +
    `</div>`
  );
}

function renderItem(item: SloItem): string {
  const windowChip =
    item.window !== undefined
      ? `<span class="slo-window">${escapeHtml(item.window)}</span>`
      : '';
  const exhausted = item.budget !== undefined && item.budget >= 1;
  const current =
    item.current !== undefined
      ? `<div class="slo-val">` +
        `<span class="slo-v-label">Current</span>` +
        `<span class="slo-v-num ${exhausted ? 'slo-bad' : 'slo-ok'}">${escapeHtml(item.current)}</span>` +
        `</div>`
      : '';
  const budget = item.budget !== undefined ? renderBudget(item.budget) : '';
  return (
    `<div class="slo-item">` +
    `<div class="slo-top">` +
    `<span class="slo-name">${escapeHtml(item.name)}</span>` +
    windowChip +
    `</div>` +
    `<p class="slo-sli">${escapeHtml(item.sli)}</p>` +
    `<div class="slo-vals">` +
    `<div class="slo-val">` +
    `<span class="slo-v-label">Target</span>` +
    `<span class="slo-v-num">${escapeHtml(item.target)}</span>` +
    `</div>` +
    current +
    `</div>` +
    budget +
    `</div>`
  );
}

export function renderSlo(data: SloData): string {
  const head =
    data.title !== undefined ? `<div class="slo-head">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined
      ? `<p class="slo-desc">${escapeHtml(data.description)}</p>`
      : '';
  const items = data.items.map(renderItem).join('');
  return `<div class="slo">${head}${desc}<div class="slo-list">${items}</div></div>`;
}
