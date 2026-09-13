/**
 * The data-flow shape vocabulary shared by `dfd` and `threatmodel`: a process
 * is a paper bubble, an external entity a dashed rectangle with an `EXT`
 * chip, a data store the three-sided box on the inactive fill with a `DB`
 * chip. One implementation, so a threat model draws the same nodes as the
 * data-flow diagram it annotates. Extracted verbatim from the dfd renderer —
 * `dfd` output is byte-identical to the pre-extraction markup.
 */

import { escapeHtml } from '../escape.js';
import { nodeSkin, type NodeSkin } from './blockStyle.js';
import { bp } from '../paths.js';

export type DfdKind = 'process' | 'external' | 'store';

/** Normalises an authored `kind` (`datastore` is a store; anything else is a process). */
export function dfdKindOf(kind: string | undefined): DfdKind {
  const k = (kind ?? 'process').toLowerCase();
  if (k === 'external') return 'external';
  if (k === 'store' || k === 'datastore') return 'store';
  return 'process';
}

/** A node box (top-left + size). */
export interface DfdRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** The paint of one node: the skin's outline / fill / dash plus its chip tone. */
export interface DfdPaint {
  readonly skin: NodeSkin;
  readonly stroke: string;
  readonly sw: number;
  readonly fill: string;
  /** ` stroke-dasharray="4 3"` for dashed kinds, else `''`. */
  readonly dash: string;
  /** ` c-accent` / ` c-muted` / `''` — the class suffix of the kind chip. */
  readonly chipTone: string;
}

/**
 * How the skin paints a dfd kind (`DESIGN.md`): 1.5px `ink` for primary nodes,
 * 1px `rule-solid` on `paper-2` for the store; an accented node takes the
 * accent outline on the accent tint.
 */
export function dfdPaint(k: DfdKind, accent: boolean): DfdPaint {
  const sk = nodeSkin(k === 'process' ? undefined : k);
  const stroke = accent ? 'var(--accent)' : sk.primary ? 'var(--ink)' : 'var(--rule-solid)';
  const sw = accent || sk.primary ? 1.5 : 1;
  const fill = accent ? 'var(--accent-tint)' : sk.fill === 'paper-2' ? 'var(--paper-2)' : 'var(--paper)';
  const dash = sk.dashed ? ' stroke-dasharray="4 3"' : '';
  // The kind chip — `muted` on the inactive fill, where `soft` would sit
  // under the small-text floor.
  const chipTone = accent ? ' c-accent' : sk.fill === 'paper-2' ? ' c-muted' : '';
  return { skin: sk, stroke, sw, fill, dash, chipTone };
}

/** The node outline: bubble (process), three-sided box (store), rectangle (external). */
export function dfdShape(k: DfdKind, r: DfdRect, p: DfdPaint): string {
  if (k === 'process') {
    return `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="16" fill="${p.fill}" stroke="${p.stroke}" stroke-width="${p.sw}"/>`;
  }
  if (k === 'store') {
    return (
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${p.fill}" stroke="none"/>` +
      `<path d="M${r.x + r.w} ${r.y} H ${r.x} V ${r.y + r.h} H ${r.x + r.w}" fill="none" stroke="${p.stroke}" stroke-width="${p.sw}"/>`
    );
  }
  return `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${p.fill}" stroke="${p.stroke}" stroke-width="${p.sw}"${p.dash}/>`;
}

/** The kind chip, top-right inside the node (`''` when the kind has none). */
export function dfdChip(r: DfdRect, p: DfdPaint): string {
  return p.skin.chip !== ''
    ? `<text x="${r.x + r.w - 10}" y="${r.y + 14}" class="t-eyebrow${p.chipTone}" text-anchor="end">${escapeHtml(p.skin.chip)}</text>`
    : '';
}

/**
 * The node name, centred: one `<text>` for a single line, or a `<g>` of lines
 * (14px apart) for a wrapped name. `path` tags the name for editors.
 */
export function dfdName(lines: readonly string[], name: string, r: DfdRect, accent: boolean, path: string): string {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const tone = accent ? ' c-accent' : '';
  return lines.length <= 1
    ? `<text x="${cx}" y="${cy + 4}" class="t-name${tone}" text-anchor="middle"${bp(path)}>${escapeHtml(name)}</text>`
    : `<g${bp(path)}>` +
        lines
          .map(
            (ln, j) =>
              `<text x="${cx}" y="${cy + 4 - (lines.length - 1) * 7 + j * 14}" class="t-name${tone}" text-anchor="middle">${escapeHtml(ln)}</text>`,
          )
          .join('') +
        `</g>`;
}
