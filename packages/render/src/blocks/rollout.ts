/**
 * Renders a rollout plan as a horizontal stage strip (HTML). Each stage is a
 * paper card: a `STAGE n` eyebrow, the `.t-name` name, the status word as a
 * chip, a traffic bar (ink fill proportional to `traffic` on a `paper-2`
 * track), the hold `duration` in `.t-sub`, and the note. The stage's `gate`
 * — what must pass before the next stage starts — rides as a `.t-arrow`
 * chip on the connector to the next card.
 *
 * Status uses the shared chip encoding (`DESIGN.md`): done = `paper-2` fill,
 * current = accent outline (the one accent), next = dashed, blocked =
 * `negative`. `rollback` is the footer line. The strip scrolls sideways past
 * ~5 stages; nothing is dropped.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { renderLegend, type LegendItem, type LegendSwatch } from '../svg/legend.js';
import { diagramFrame } from './frame.js';

type Status = NonNullable<BlockDataMap['rollout']['stages'][number]['status']>;

const STATUS_SWATCH: Record<Status, LegendSwatch> = {
  done: 'node-fill2',
  current: 'node-accent-outline',
  next: 'node-dashed',
  blocked: 'node-negative',
};

const STATUS_ORDER: readonly Status[] = ['done', 'current', 'next', 'blocked'];

function fmtPct(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

export function renderRollout(data: BlockDataMap['rollout']): string {
  const stages = data.stages ?? [];
  const present = new Set<Status>();
  let hasGate = false;

  let strip = `<div class="ro-strip"${bl('stages')}>`;
  stages.forEach((st, i) => {
    const status = st.status !== undefined && st.status in STATUS_SWATCH ? st.status : undefined;
    if (status !== undefined) present.add(status);
    const stCls = status !== undefined ? ` ro-s-${status}` : '';
    const chip =
      status !== undefined
        ? `<span class="ro-status ro-st-${status}"${bp(`stages.${i}.status`)}>${escapeHtml(status)}</span>`
        : '';
    const traffic =
      st.traffic !== undefined
        ? `<div class="ro-traffic"${bp(`stages.${i}.traffic`)}>` +
          `<div class="ro-track"><div class="ro-fill" style="width:${Math.min(100, Math.max(0, st.traffic))}%"></div></div>` +
          `<span class="ro-pct t-sub">${fmtPct(st.traffic)}%</span>` +
          `</div>`
        : '';
    const duration =
      st.duration !== undefined
        ? `<div class="ro-dur t-sub"${bp(`stages.${i}.duration`)}>${escapeHtml(st.duration)}</div>`
        : '';
    const note =
      st.note !== undefined ? `<div class="ro-note"${bp(`stages.${i}.note`)}>${escapeHtml(st.note)}</div>` : '';
    strip +=
      `<div class="ro-stage${stCls}"${bp(`stages.${i}`)}>` +
      `<span class="ro-n t-eyebrow">Stage ${i + 1}</span>` +
      `<div class="ro-head"><span class="ro-name t-name"${bp(`stages.${i}.name`)}>${escapeHtml(st.name)}</span>${chip}</div>` +
      traffic +
      duration +
      note +
      `</div>`;
    // The connector after a stage carries that stage's gate. The last stage
    // gets one only when it has a gate to show.
    const last = i === stages.length - 1;
    if (!last || st.gate !== undefined) {
      const gate =
        st.gate !== undefined
          ? `<span class="ro-gate t-arrow"${bp(`stages.${i}.gate`)}>${escapeHtml(st.gate)}</span>`
          : '';
      if (st.gate !== undefined) hasGate = true;
      strip += `<div class="ro-link${last ? ' ro-link-end' : ''}">${gate}</div>`;
    }
  });
  strip += `</div>`;

  const items: LegendItem[] = STATUS_ORDER.filter((s) => present.has(s)).map((s) => ({
    swatch: STATUS_SWATCH[s],
    label: s,
  }));
  if (hasGate) items.push({ swatch: 'chip', chip: 'GATE', label: 'gate — must pass to advance' });
  const legendHtml = renderLegend(items);

  const footerHtml =
    data.rollback !== undefined
      ? `<div class="ro-rollback"${bp('rollback')}><span class="t-eyebrow">Rollback</span><span class="ro-rollback-text">${escapeHtml(data.rollback)}</span></div>`
      : '';

  return diagramFrame(
    {
      tag: 'ROLLOUT',
      ...(data.strategy !== undefined ? { path: data.strategy } : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legendHtml.length > 0 ? { legendHtml } : {}),
      ...(footerHtml.length > 0 ? { footerHtml } : {}),
    },
    strip,
  );
}
