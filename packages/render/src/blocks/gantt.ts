/**
 * Renders a Gantt chart — period columns across the top, task rows with
 * horizontal bars told apart by kind.
 *
 * Skin (`DESIGN.md`): hairline period columns, `.t-eyebrow` period heads,
 * `.t-name` task labels. A planned bar is `paper-2` with an ink outline;
 * `done` is solid ink; `active` / `current` — the work happening now, the
 * one thing the schedule is read for — takes the accent; `milestone` is a
 * dashed outline. A legend strip under the drawing names the kinds present.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { wrapText } from '../svg/wrapText.js';
import { bl, bp } from '../paths.js';

type Kind = 'planned' | 'done' | 'active' | 'milestone';

function kindOf(kind: string | undefined): Kind {
  switch ((kind ?? '').toLowerCase()) {
    case 'done':
      return 'done';
    case 'active':
    case 'current':
      return 'active';
    case 'milestone':
      return 'milestone';
    default:
      return 'planned';
  }
}

const BAR_ATTRS: Record<Kind, string> = {
  planned: 'fill="var(--paper-2)" stroke="var(--ink)" stroke-width="1"',
  done: 'fill="var(--ink)" stroke="var(--ink)" stroke-width="1"',
  active: 'fill="var(--accent-tint)" stroke="var(--accent)" stroke-width="1.5"',
  milestone: 'fill="var(--paper)" stroke="var(--ink)" stroke-width="1.25" stroke-dasharray="4 3"',
};

const KIND_LEGEND: Record<Kind, LegendItem> = {
  planned: { swatch: 'node-fill2', label: 'planned' },
  done: { swatch: 'fill', fill: 'var(--ink)', label: 'done' },
  active: { swatch: 'node-accent', label: 'in progress' },
  milestone: { swatch: 'node-dashed', label: 'milestone' },
};

export function renderGantt(data: BlockDataMap['gantt']): string {
  const periods = data.periods ?? [];
  const tasks = data.tasks ?? [];
  const P = Math.max(periods.length, 1);
  const labelW = 156;
  const padX = 20;
  const padTop = 34;
  const barH = 18;
  const colW = 64;
  const padBot = 14;
  // Long task labels wrap (≤3 lines) inside the label gutter instead of
  // running under the bars; every row grows uniformly when any label wraps.
  const labelLines = tasks.map((t) => wrapText(t.label, Math.floor((labelW - padX) / 7), 3));
  const maxLines = Math.max(1, ...labelLines.map((ls) => ls.length));
  const rowH = 30 + (maxLines - 1) * 14;
  const width = labelW + padX * 2 + P * colW;
  const height = padTop + tasks.length * rowH + padBot;
  const xCol = (i: number): number => labelW + padX + i * colW;

  // Pinned to its natural size (and capped at the column) — an unframed
  // viewBox-only SVG would stretch to the container and blow the type up.
  let s = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="max-width:100%;height:auto" role="img"><title>Schedule</title>`;
  s += `<g${bl('periods')}>`;
  for (let i = 0; i < periods.length; i++) {
    s +=
      `<g${bp(`periods.${i}`)}>` +
      `<line x1="${xCol(i)}" y1="${padTop - 6}" x2="${xCol(i)}" y2="${height - padBot}" stroke="var(--rule)" stroke-width="1"/>` +
      `<text x="${xCol(i) + colW / 2}" y="${padTop - 12}" class="t-eyebrow" text-anchor="middle">${escapeHtml(periods[i] ?? '')}</text>` +
      `</g>`;
  }
  s += `</g>`;
  s += `<line x1="${xCol(P)}" y1="${padTop - 6}" x2="${xCol(P)}" y2="${height - padBot}" stroke="var(--rule)" stroke-width="1"/>`;
  const kinds = new Set<Kind>();
  s += `<g${bl('tasks')}>`;
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (t === undefined) continue;
    const kind = kindOf(t.kind);
    kinds.add(kind);
    const y = padTop + i * rowH;
    const bx = xCol(t.start ?? 0);
    const span = Math.max(1, t.span ?? 1);
    const bw = span * colW - 8;
    const ls = labelLines[i] ?? [];
    const cls = kind === 'active' ? 't-name c-accent' : 't-name';
    const label =
      ls.length <= 1
        ? `<text x="${padX}" y="${y + rowH / 2 + 4.5}" class="${cls}"${bp(`tasks.${i}.label`)}>${escapeHtml(t.label)}</text>`
        : `<g${bp(`tasks.${i}.label`)}>` +
          ls
            .map(
              (ln, j) =>
                `<text x="${padX}" y="${y + rowH / 2 + 4.5 - (ls.length - 1) * 7 + j * 14}" class="${cls}">${escapeHtml(ln)}</text>`,
            )
            .join('') +
          `</g>`;
    s +=
      `<g${bp(`tasks.${i}`)}>` +
      label +
      `<rect x="${bx + 4}" y="${y + (rowH - barH) / 2}" width="${bw}" height="${barH}" rx="2" ${BAR_ATTRS[kind]}/>` +
      `</g>`;
  }
  s += `</g>`;
  s += `</svg>`;
  const items = (['planned', 'done', 'active', 'milestone'] as const)
    .filter((k) => kinds.has(k))
    .map((k) => KIND_LEGEND[k]);
  return s + renderLegend(items);
}
