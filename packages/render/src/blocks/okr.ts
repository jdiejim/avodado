/**
 * Renders an `okr` block — objectives with key results. One card per
 * objective: the objective as the bold headline with an optional right-aligned
 * owner chip, then one row per key result — the KR text, a slim rounded
 * progress bar coloured by status (done / on-track green, at-risk amber,
 * off-track red, no status navy), and the percentage in mono to the right.
 * Progress is clamped to [0, 1].
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

type OkrData = BlockDataMap['okr'];
type OkrItem = OkrData['items'][number];
type Kr = OkrItem['krs'][number];

/** Progress-bar tone class for a KR status. */
function krTone(status: Kr['status']): string {
  if (status === 'done' || status === 'on-track') return 'okr-b-ok';
  if (status === 'at-risk') return 'okr-b-warn';
  if (status === 'off-track') return 'okr-b-bad';
  return 'okr-b-plain';
}

function renderKr(kr: Kr, path: string): string {
  const clamped = Math.min(Math.max(kr.progress, 0), 1);
  const width = Math.round(clamped * 1000) / 10;
  const pct = `${Math.round(clamped * 100)}%`;
  return (
    `<div class="okr-kr"${bp(path)}>` +
    `<div class="okr-kr-text"${bp(`${path}.kr`)}>${escapeHtml(kr.kr)}</div>` +
    `<div class="okr-kr-bar">` +
    `<div class="okr-track"><div class="okr-fill ${krTone(kr.status)}" style="width:${width}%"></div></div>` +
    `<span class="okr-pct"${bp(`${path}.progress`)}>${escapeHtml(pct)}</span>` +
    `</div>` +
    `</div>`
  );
}

function renderItem(item: OkrItem, i: number): string {
  const owner =
    item.owner !== undefined
      ? `<span class="okr-owner"${bp(`items.${i}.owner`)}>${escapeHtml(item.owner)}</span>`
      : '';
  const krs = item.krs.map((kr, k) => renderKr(kr, `items.${i}.krs.${k}`)).join('');
  return (
    `<div class="okr-item"${bp(`items.${i}`)}>` +
    `<div class="okr-top">` +
    `<span class="okr-objective"${bp(`items.${i}.objective`)}>${escapeHtml(item.objective)}</span>` +
    owner +
    `</div>` +
    `<div class="okr-krs"${bl(`items.${i}.krs`)}>${krs}</div>` +
    `</div>`
  );
}

export function renderOkr(data: OkrData): string {
  const head =
    data.title !== undefined ? `<div class="okr-head">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined
      ? `<p class="okr-desc">${escapeHtml(data.description)}</p>`
      : '';
  const items = data.items.map((item, i) => renderItem(item, i)).join('');
  return `<div class="okr">${head}${desc}<div class="okr-list"${bl('items')}>${items}</div></div>`;
}
