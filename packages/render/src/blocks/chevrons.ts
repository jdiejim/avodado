/**
 * Renders a `chevrons` block — the consulting process strip. N chevron
 * arrows in one row (after {@link PER_ROW} they wrap to a second row at the
 * same width), each a polygon with a notch on the left and a point on the
 * right, the point nesting into the next chevron's notch. The label sits
 * centred inside (word-wrapped to two lines; a longer one is cut with an
 * ellipsis and kept whole in a `<title>`); the `desc` prints under each
 * chevron in mono.
 *
 * Skin (`DESIGN.md`): `current` (1-based) is the author's mark and takes the
 * accent — accent fill, paper text. The steps before it are done: `paper-2`
 * fill, muted text. The steps after it are outlined on paper. Without a
 * `current`, every step is outlined. A step the author toned `accent: red`
 * reads as `negative` (an exit, a failure step). The viewBox grows with the
 * count and the wrapped lines; nothing is clipped.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { countPhrase, diagramName } from '../svg/svgTitle.js';
import { wrapText } from '../svg/wrapText.js';
import { diagramFrame } from './frame.js';

/** Chevrons per row before the strip wraps. */
const PER_ROW = 8;
const PAD = 22;
/** Chevron width and height. */
const W = 150;
const H = 50;
/** Depth of the notch on the left and the point on the right. */
const NOTCH = 14;
/** Gap between a point and the next notch. */
const GAP = 5;
/** Vertical gap between rows. */
const ROW_GAP = 18;
/** Characters per label line inside the chevron (13px semibold Inter). */
const LABEL_CHARS = 16;
/** Characters per desc line under the chevron (10px mono). */
const DESC_CHARS = 23;
const LINE_H = 15;
const DESC_LINE_H = 13;

type Tone = 'done' | 'current' | 'todo' | 'negative';

const FILL: Record<Tone, string> = {
  done: 'var(--paper-2)',
  current: 'var(--accent)',
  todo: 'var(--paper)',
  negative: 'var(--negative-tint)',
};
const STROKE: Record<Tone, string> = {
  done: 'var(--rule-solid)',
  current: 'var(--accent)',
  todo: 'var(--ink)',
  negative: 'var(--negative)',
};
const TEXT_CLS: Record<Tone, string> = {
  done: 't-name c-muted',
  current: 't-name ch-on-accent',
  todo: 't-name c-ink',
  negative: 't-name c-negative',
};

/**
 * Wraps `text` to at most `lines` lines of `chars`; when the text does not
 * fit, the last line is cut with an ellipsis. Returns the lines and whether
 * anything was cut (the caller then adds a `<title>` with the full text).
 */
function fitLines(text: string, chars: number, lines: number): { lines: string[]; cut: boolean } {
  const out = wrapText(text, chars, lines);
  const whole = text.trim().split(/\s+/).join(' ');
  let cut = out.join(' ') !== whole;
  const fixed = out.map((l, i) => {
    if (l.length <= chars && !(cut && i === out.length - 1)) return l;
    cut = true;
    return `${l.slice(0, Math.max(1, chars - 1)).trimEnd()}…`;
  });
  return { lines: fixed, cut };
}

/** The polygon points of a chevron whose box starts at (x, y). */
function chevronPoints(x: number, y: number): string {
  const f = (v: number): string => v.toFixed(1);
  return [
    `${f(x)},${f(y)}`,
    `${f(x + W - NOTCH)},${f(y)}`,
    `${f(x + W)},${f(y + H / 2)}`,
    `${f(x + W - NOTCH)},${f(y + H)}`,
    `${f(x)},${f(y + H)}`,
    `${f(x + NOTCH)},${f(y + H / 2)}`,
  ].join(' ');
}

export function renderChevrons(data: BlockDataMap['chevrons']): string {
  const steps = data.steps;
  const n = steps.length;
  const current = data.current !== undefined && Number.isFinite(data.current) ? Math.round(data.current) : undefined;
  const hasCurrent = current !== undefined && current >= 1 && current <= n;

  const toneOf = (i: number, accent: string | undefined): Tone => {
    if (accent === 'red') return 'negative';
    if (!hasCurrent) return 'todo';
    if (i + 1 === current) return 'current';
    return i + 1 < current ? 'done' : 'todo';
  };

  const labels = steps.map((s) => fitLines(s.label, LABEL_CHARS, 2));
  const descs = steps.map((s) => (s.desc !== undefined ? fitLines(s.desc, DESC_CHARS, 2) : { lines: [], cut: false }));

  const perRow = Math.min(PER_ROW, n);
  const rows = Math.ceil(n / PER_ROW);
  const step = W - NOTCH + GAP;
  const width = PAD * 2 + (perRow - 1) * step + W;

  // Each row is as tall as its tallest desc, so a wrapped desc never runs
  // into the next row.
  const rowH: number[] = [];
  for (let r = 0; r < rows; r += 1) {
    const inRow = descs.slice(r * PER_ROW, (r + 1) * PER_ROW);
    const descLines = Math.max(0, ...inRow.map((d) => d.lines.length));
    rowH.push(H + (descLines > 0 ? 8 + descLines * DESC_LINE_H : 0));
  }
  const height = PAD * 2 + rowH.reduce((a, b) => a + b, 0) + (rows - 1) * ROW_GAP;

  const f = (v: number): string => v.toFixed(1);
  const name = diagramName('Process chevrons', data.title, [countPhrase(n, 'step')]);
  let s = `<svg viewBox="0 0 ${f(width)} ${f(height)}" role="img" aria-label="${escapeHtml(name)}"><title>${escapeHtml(name)}</title>`;

  const used = new Set<Tone>();
  s += `<g${bl('steps')}>`;
  let rowY = PAD;
  steps.forEach((st, i) => {
    const r = Math.floor(i / PER_ROW);
    const c = i % PER_ROW;
    if (c === 0 && r > 0) rowY += (rowH[r - 1] ?? H) + ROW_GAP;
    const x = PAD + c * step;
    const y = rowY;
    const tone = toneOf(i, st.accent);
    used.add(tone);
    const lab = labels[i] ?? { lines: [st.label], cut: false };
    const des = descs[i] ?? { lines: [], cut: false };
    const cx = x + W / 2 + NOTCH / 4;
    let g = `<g class="ch-step ch-${tone}"${bp(`steps.${i}`)}>`;
    if (lab.cut || des.cut) {
      g += `<title>${escapeHtml(st.desc !== undefined ? `${st.label} — ${st.desc}` : st.label)}</title>`;
    }
    g += `<polygon points="${chevronPoints(x, y)}" fill="${FILL[tone]}" stroke="${STROKE[tone]}" stroke-width="${tone === 'current' ? 1.5 : 1.25}" stroke-linejoin="round"/>`;
    // Label lines centred on the chevron's vertical middle.
    const lh = lab.lines.length;
    const ty0 = y + H / 2 - ((lh - 1) * LINE_H) / 2 + 4.5;
    lab.lines.forEach((line, li) => {
      g += `<text x="${f(cx)}" y="${f(ty0 + li * LINE_H)}" class="${TEXT_CLS[tone]}" text-anchor="middle"${li === 0 ? bp(`steps.${i}.label`) : ''}>${escapeHtml(line)}</text>`;
    });
    if (des.lines.length > 0) {
      const dy0 = y + H + 8 + 10;
      des.lines.forEach((line, li) => {
        g += `<text x="${f(cx)}" y="${f(dy0 + li * DESC_LINE_H)}" class="t-sub c-muted" text-anchor="middle"${li === 0 ? bp(`steps.${i}.desc`) : ''}>${escapeHtml(line)}</text>`;
      });
    }
    s += g + `</g>`;
  });
  s += `</g></svg>`;

  const legend: LegendItem[] = [];
  if (used.has('done')) legend.push({ swatch: 'node-fill2', label: 'done' });
  if (used.has('current')) legend.push({ swatch: 'node-accent', label: 'current step' });
  if (used.has('todo')) legend.push({ swatch: 'node', label: hasCurrent ? 'upcoming' : 'step' });
  if (used.has('negative')) legend.push({ swatch: 'node-negative', label: 'failure / exit' });
  const legendHtml = renderLegend(legend);

  return diagramFrame(
    {
      tag: 'CHEVRONS',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legendHtml.length > 0 ? { legendHtml } : {}),
    },
    s,
  );
}
