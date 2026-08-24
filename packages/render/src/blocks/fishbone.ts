/**
 * Renders a fishbone (Ishikawa) — cause & effect analysis. The effect sits in
 * a head box at the right of a horizontal spine; cause categories are bones
 * that slant off the spine, alternating above and below; specific causes are
 * horizontal item labels ticked along each bone.
 *
 * All text stays horizontal. Every bone carries a computed left "envelope"
 * (its slant run plus its widest label), and attach points accumulate along
 * the spine so envelopes never intersect — long labels grow the viewBox
 * instead of colliding. Text past the wrap budget is ellipsized, with the
 * full string in a `<title>` on its group (the org-tree pattern).
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { wrapText } from '../svg/wrapText.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';

/** Bone slant: 62° from the spine. */
const TAN = Math.tan((62 * Math.PI) / 180);
/** Minimum bone height (a bone with no items still reads as a bone). */
const MIN_H = 64;
/** Horizontal clearance between one bone's envelope and the previous bone. */
const PITCH_GAP = 28;
const PAD = 26;

interface Clamped {
  readonly lines: string[];
  /** True when lines were dropped — the render must carry a full-text <title>. */
  readonly truncated: boolean;
}

/** Wraps and clamps: when lines were dropped, the last kept line gains `…`. */
function wrapClamp(text: string, max: number, maxLines: number): Clamped {
  const lines = wrapText(text, max, maxLines);
  const kept = lines.join(' ');
  const full = String(text).trim().split(/\s+/).join(' ');
  const truncated = kept !== full && lines.length > 0;
  if (truncated) {
    const last = lines[lines.length - 1] ?? '';
    lines[lines.length - 1] = `${last}…`;
  }
  return { lines, truncated };
}

/** Full-text hover fallback, emitted only where the visible text was clamped. */
const tip = (c: Clamped, full: string): string =>
  c.truncated ? `<title>${escapeHtml(full)}</title>` : '';

const widest = (lines: readonly string[]): number =>
  Math.max(0, ...lines.map((ln) => ln.length));

interface BoneNorm {
  /** Index into `data.causes` (for data paths). */
  readonly idx: number;
  /** The full, unclamped label — the <title> fallback when clamped. */
  readonly label: string;
  readonly labelClamped: Clamped;
  readonly labelW: number;
  readonly items: ReadonlyArray<{
    readonly full: string;
    readonly clamped: Clamped;
    readonly w: number;
  }>;
  /** Vertical step between consecutive item ticks on this bone. */
  readonly gap: number;
  /** Bone height this bone needs (side uses the max). */
  readonly needH: number;
}

export function renderFishbone(data: BlockDataMap['fishbone']): string {
  const bones: BoneNorm[] = data.causes.map((c, idx) => {
    const labelClamped = wrapClamp(c.label, 16, 4);
    const items = (c.items ?? []).map((it) => {
      const clamped = wrapClamp(it, 24, 2);
      return { full: it, clamped, w: widest(clamped.lines) * 6.6 };
    });
    const maxItemLines = Math.max(1, ...items.map((it) => it.clamped.lines.length));
    const gap = 14 + maxItemLines * 13;
    const needH = items.length > 0 ? 52 + (items.length - 1) * gap : MIN_H;
    return {
      idx,
      label: c.label,
      labelClamped,
      labelW: widest(labelClamped.lines) * 7.4,
      items,
      gap,
      needH,
    };
  });

  // Even indices ride above the spine, odd below — the classic stagger.
  const top = bones.filter((b) => b.idx % 2 === 0);
  const bottom = bones.filter((b) => b.idx % 2 === 1);

  // Uniform bone height per side, so cause labels align on a shelf.
  const sideH = (side: readonly BoneNorm[]): number =>
    side.length === 0 ? 0 : Math.max(MIN_H, ...side.map((b) => b.needH));
  const hTop = sideH(top);
  const hBot = sideH(bottom);
  const labelBlock = (side: readonly BoneNorm[]): number =>
    side.length === 0 ? 0 : Math.max(...side.map((b) => b.labelClamped.lines.length)) * 15 + 12;
  const labTop = labelBlock(top);
  const labBot = labelBlock(bottom);

  // How far a bone reaches left of its spine attach point: the slant run plus
  // half the cause label, or an item's tick + text — whichever is widest.
  const envOf = (b: BoneNorm, h: number): number => {
    let env = h / TAN + b.labelW / 2 + 4;
    b.items.forEach((it, j) => {
      const v = h - (26 + j * b.gap); // height above/below the spine
      env = Math.max(env, v / TAN + 10 + it.w);
    });
    return Math.max(env, 40);
  };

  // Attach points accumulate so each envelope sits fully right of the
  // previous attach point — no two bones can share pixels.
  const place = (side: readonly BoneNorm[], h: number, x0: number): number[] => {
    const xs: number[] = [];
    let prev = x0;
    side.forEach((b, i) => {
      const x = prev + (i === 0 ? 0 : PITCH_GAP) + envOf(b, h);
      xs.push(x);
      prev = x;
    });
    return xs;
  };
  const axTop = place(top, hTop, PAD);
  const axBot = place(bottom, hBot, PAD + 44);

  // Effect head, wrapped to at most 3 lines.
  const eff = wrapClamp(data.effect, 16, 3);
  const effLines = eff.lines;
  const headW = Math.max(96, widest(effLines) * 7.4 + 28);
  const headH = effLines.length * 16 + 18;

  const spineY = Math.max(PAD + labTop + hTop, PAD + headH / 2 + 4);
  const height = Math.max(spineY + hBot + labBot, spineY + headH / 2 + 4) + PAD;
  const spineEnd = Math.max(PAD + 40, ...axTop, ...axBot) + 30;
  const headX = spineEnd + 6;
  const width = headX + headW + PAD;

  const f = (v: number): string => v.toFixed(1);
  // Explicit width/height pin the SVG to its natural size — the frame's
  // `max-width:100%; height:auto` then only ever shrinks it. Without them a
  // viewBox-only SVG stretches to the container, blowing small diagrams up.
  let s = `<svg viewBox="0 0 ${f(width)} ${f(height)}" width="${f(width)}" height="${f(height)}" role="img"><title>Fishbone</title>`;

  // Spine, arrowed into the head.
  s += `<path d="M ${PAD} ${f(spineY)} L ${f(headX - 4)} ${f(spineY)}" fill="none" stroke="var(--charcoal)" stroke-width="1.8" marker-end="url(#gArrow)"/>`;

  const bone = (b: BoneNorm, ax: number, h: number, dir: 1 | -1): string => {
    // dir −1 = above the spine, +1 = below.
    const ox = ax - h / TAN;
    const oy = spineY + dir * h;
    let g = `<g${bp(`causes.${b.idx}`)}>`;
    g += `<path d="M ${f(ax)} ${f(spineY)} L ${f(ox)} ${f(oy)}" fill="none" stroke="var(--charcoal)" stroke-width="1.4"/>`;
    // Cause label on the shelf beyond the bone's outer end.
    const lh = 15;
    const n = b.labelClamped.lines.length;
    const firstY = dir === -1 ? oy - 10 - (n - 1) * lh : oy + 20;
    g += `<g${bp(`causes.${b.idx}.label`)}>${tip(b.labelClamped, b.label)}`;
    b.labelClamped.lines.forEach((ln, li) => {
      g += `<text x="${f(ox)}" y="${f(firstY + li * lh)}" class="fb-cause">${escapeHtml(ln)}</text>`;
    });
    g += `</g>`;
    if (b.items.length > 0) {
      g += `<g${bl(`causes.${b.idx}.items`)}>`;
      b.items.forEach((it, j) => {
        const v = h - (26 + j * b.gap); // height from spine; item 0 nearest the label
        const y = spineY + dir * v;
        const bx = ax - v / TAN;
        let ig = `<g${bp(`causes.${b.idx}.items.${j}`)}>${tip(it.clamped, it.full)}`;
        ig += `<path d="M ${f(bx - 6)} ${f(y)} L ${f(bx)} ${f(y)}" stroke="var(--gray)" stroke-width="1.2"/>`;
        const m = it.clamped.lines.length;
        it.clamped.lines.forEach((ln, li) => {
          ig += `<text x="${f(bx - 10)}" y="${f(y + 4 - ((m - 1) * 13) / 2 + li * 13)}" class="fb-item">${escapeHtml(ln)}</text>`;
        });
        g += ig + `</g>`;
      });
      g += `</g>`;
    }
    return g + `</g>`;
  };

  s += `<g${bl('causes')}>`;
  top.forEach((b, i) => {
    const ax = axTop[i];
    if (ax !== undefined) s += bone(b, ax, hTop, -1);
  });
  bottom.forEach((b, i) => {
    const ax = axBot[i];
    if (ax !== undefined) s += bone(b, ax, hBot, 1);
  });
  s += `</g>`;

  // The head: the effect in a filled box at the right of the spine.
  const hy = spineY - headH / 2;
  s += `<g filter="url(#gshadow)"${bp('effect')}>${tip(eff, data.effect)}`;
  s += `<rect x="${f(headX)}" y="${f(hy)}" width="${f(headW)}" height="${f(headH)}" rx="8" fill="var(--navy)" stroke="none"/>`;
  effLines.forEach((ln, li) => {
    s += `<text x="${f(headX + headW / 2)}" y="${f(spineY + 4.5 - ((effLines.length - 1) * 16) / 2 + li * 16)}" class="fb-effect">${escapeHtml(ln)}</text>`;
  });
  s += `</g></svg>`;

  return diagramFrame(
    {
      tag: 'FISHBONE',
      tagBg: '#b45309',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    s,
  );
}
