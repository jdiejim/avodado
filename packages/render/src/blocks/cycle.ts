/**
 * Renders a cycle — a closed loop of stages arranged in a circle, clockwise
 * from 12 o'clock, with arc arrows between consecutive stages and the last
 * stage feeding the first.
 *
 * Stage pills carry the numbered-circle language of the edge-steps pattern;
 * step descriptions (when present) move to the numbered legend under the SVG,
 * exactly like labelled edges do on dense node diagrams.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { wrapText } from '../svg/wrapText.js';
import { edgeStep, stepsLegend } from '../svg/edgeSteps.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';

interface CycleStepNorm {
  readonly label: string;
  readonly desc?: string | undefined;
  /** Data path of the step's label for direct editing: the whole scalar when
   *  the step was written as a bare string, `steps.N.label` otherwise. */
  readonly labelPath: string;
}

export function renderCycle(data: BlockDataMap['cycle']): string {
  const steps: CycleStepNorm[] = data.steps.map((s, i) =>
    typeof s === 'string'
      ? { label: s, labelPath: `steps.${i}` }
      : { label: s.label, desc: s.desc, labelPath: `steps.${i}.label` },
  );
  const n = steps.length;

  // Uniform pill size across the ring, sized by the longest wrapped line.
  const lines = steps.map((s) => wrapText(s.label, 14, 2));
  const maxChars = Math.max(1, ...lines.flat().map((ln) => ln.length));
  const maxLines = Math.max(1, ...lines.map((ls) => ls.length));
  const pillW = Math.min(150, Math.max(96, maxChars * 7 + 30));
  const pillH = 34 + (maxLines - 1) * 14;

  // Ring radius: adjacent pill centers must clear a full pill width plus a
  // gap (chord = 2R·sin(π/n)); small n gets a readable floor.
  const R = Math.max(96, Math.ceil((pillW + 40) / (2 * Math.sin(Math.PI / n))));
  const pad = 30;
  const c = R + pillW / 2 + pad; // center x == center y
  const size = c * 2;
  const angleOf = (i: number): number => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const centerOf = (i: number): { x: number; y: number } => ({
    x: c + R * Math.cos(angleOf(i)),
    y: c + R * Math.sin(angleOf(i)),
  });

  let s = `<svg viewBox="0 0 ${size} ${size}" role="img"><title>Cycle</title>`;

  // Smallest angular trim (walked in 1° increments) that puts a ring point
  // clear of pill i's rectangle plus a margin — exact for every pill aspect
  // and ring size, so arrows hug the pills without ever starting inside one.
  const clearOf = (i: number, dir: 1 | -1): number => {
    const p = centerOf(i);
    const halfW = pillW / 2 + 10;
    const halfH = pillH / 2 + 10;
    const step = Math.PI / 180;
    for (let t = step; t < Math.PI / n; t += step) {
      const a = angleOf(i) + dir * t;
      const x = c + R * Math.cos(a);
      const y = c + R * Math.sin(a);
      if (Math.abs(x - p.x) > halfW || Math.abs(y - p.y) > halfH) return t;
    }
    return Math.PI / n;
  };

  // Arc arrows between consecutive stages (i → i+1, wrapping).
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a1 = angleOf(i) + clearOf(i, 1);
    const a2 = angleOf(i + 1) - clearOf(j, -1);
    if (a2 - a1 < 0.08) continue; // pills touching — skip rather than overlap
    const x1 = c + R * Math.cos(a1);
    const y1 = c + R * Math.sin(a1);
    const x2 = c + R * Math.cos(a2);
    const y2 = c + R * Math.sin(a2);
    s += `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R} ${R} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="var(--charcoal)" stroke-width="1.4" marker-end="url(#gArrow)"/>`;
  }

  // Optional hub label in the middle of the ring.
  if (data.center !== undefined && data.center.length > 0) {
    const hub = wrapText(data.center, 18, 3);
    s +=
      `<g class="cycle-center"${bp('center')}>` +
      hub
        .map(
          (ln, j) =>
            `<text x="${c}" y="${c + 4 - (hub.length - 1) * 8 + j * 16}">${escapeHtml(ln)}</text>`,
        )
        .join('') +
      `</g>`;
  }

  s += `<g${bl('steps')}>`;
  steps.forEach((st, i) => {
    const p = centerOf(i);
    const ls = lines[i] ?? [];
    const x = p.x - pillW / 2;
    const y = p.y - pillH / 2;
    // Bare-string steps already expose their whole scalar on the pill group —
    // don't nest a second identical path around the wrapped lines.
    const wrapPath = st.labelPath === `steps.${i}` ? '' : bp(st.labelPath);
    const label =
      ls.length <= 1
        ? `<text x="${p.x.toFixed(1)}" y="${(p.y + 4).toFixed(1)}" class="cycle-name"${bp(st.labelPath)}>${escapeHtml(st.label)}</text>`
        : `<g${wrapPath}>` +
          ls
            .map(
              (ln, j) =>
                `<text x="${p.x.toFixed(1)}" y="${(p.y + 4 - (ls.length - 1) * 7 + j * 14).toFixed(1)}" class="cycle-name">${escapeHtml(ln)}</text>`,
            )
            .join('') +
          `</g>`;
    // Circled step numeral, radially outward — offset to the pill's rectangle
    // boundary along the ray (not a fixed distance, which lands inside wide
    // pills at side angles), plus the numeral's own clearance.
    const ca = Math.cos(angleOf(i));
    const sa = Math.sin(angleOf(i));
    const boundary = Math.min(
      Math.abs(ca) > 1e-6 ? pillW / 2 / Math.abs(ca) : Infinity,
      Math.abs(sa) > 1e-6 ? pillH / 2 / Math.abs(sa) : Infinity,
    );
    const out = boundary + 14;
    const np = { lx: p.x + ca * out, ly: p.y + sa * out };
    s +=
      `<g filter="url(#gshadow)"${bp(`steps.${i}`)}>` +
      `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${pillW}" height="${pillH}" rx="${Math.min(17, pillH / 2)}" fill="var(--navy)" stroke="none"/>` +
      label +
      `</g>` +
      // The circled numeral selects its stage too (editors twin it with the
      // pill and the numbered legend row via the shared data path).
      `<g${bp(`steps.${i}`)}>${edgeStep(np, i + 1)}</g>`;
  });
  s += `</g></svg>`;

  // Descriptions live in the numbered legend, matching the node numerals.
  const legend = steps.some((st) => st.desc !== undefined && st.desc.length > 0)
    ? stepsLegend(
        steps.map((st, i) => ({
          label: st.desc !== undefined && st.desc.length > 0 ? `${st.label} — ${st.desc}` : st.label,
          path: `steps.${i}`,
        })),
      )
    : '';

  return diagramFrame(
    {
      tag: 'CYCLE',
      tagBg: '#0d9488',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    s + legend,
  );
}
