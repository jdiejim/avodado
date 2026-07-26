/**
 * Renders a `packet` block — a wire format laid out bit by bit.
 *
 * The diagram every RFC draws in ASCII: a ruler of bit offsets across the top,
 * then the header's fields as cells whose width IS their bit count. Because
 * the picture is arithmetic rather than art, a field that doesn't fit the rest
 * of its row wraps and continues on the next one — which is exactly what the
 * bytes do.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';

type PacketData = BlockDataMap['packet'];

const ACCENT: Readonly<Record<string, string>> = {
  navy: 'var(--navy)',
  blue: 'var(--blue)',
  teal: 'var(--teal)',
  green: 'var(--positive)',
  amber: 'var(--highlight)',
  purple: 'var(--purple)',
  red: 'var(--negative)',
  gray: 'var(--gray)',
};
const CYCLE = ['var(--light-blue)', 'var(--teal-soft)', 'var(--purple-soft)', 'var(--highlight-soft)'];

const LEFT = 34; // room for the row's starting bit offset
const RIGHT = 8;
const TOP = 26; // the bit ruler
const ROW_H = 46;
const W = 880;

/** One drawn cell: a field, or the part of one that fits this row. */
interface Cell {
  readonly label: string;
  readonly value: string | undefined;
  readonly color: string;
  readonly index: number;
  readonly row: number;
  readonly from: number;
  readonly bits: number;
  /** True when the field continues on the next row. */
  readonly cut: boolean;
  readonly cont: boolean;
}

export function renderPacket(data: PacketData): string {
  const width = data.width !== undefined && data.width > 0 ? Math.floor(data.width) : 32;
  const cells: Cell[] = [];
  let bit = 0; // running offset across the whole header

  data.fields.forEach((f, index) => {
    let left = Math.max(0, Math.floor(f.bits));
    let first = true;
    while (left > 0) {
      const row = Math.floor(bit / width);
      const from = bit % width;
      const take = Math.min(left, width - from);
      cells.push({
        label: f.label,
        value: f.value,
        color: f.accent !== undefined ? (ACCENT[f.accent] ?? CYCLE[0] ?? '') : (CYCLE[index % CYCLE.length] ?? ''),
        index,
        row,
        from,
        bits: take,
        cut: take < left,
        cont: !first,
      });
      bit += take;
      left -= take;
      first = false;
    }
  });

  const rows = Math.max(1, Math.ceil(bit / width) || 1);
  const height = TOP + rows * ROW_H + 10;
  const cellW = (W - LEFT - RIGHT) / width;
  const xAt = (b: number): number => LEFT + b * cellW;

  let s = `<svg viewBox="0 0 ${W} ${height}" role="img"><title>${escapeHtml(data.title ?? 'Packet layout')}</title>`;

  // Bit ruler: every 8th offset is labelled, the rest are ticks.
  s += `<g>`;
  for (let b = 0; b <= width; b += 1) {
    const x = xAt(b);
    const major = b % 8 === 0;
    s += `<line x1="${r(x)}" y1="${major ? 10 : 15}" x2="${r(x)}" y2="20" stroke="var(--rule)" stroke-width="1"/>`;
    if (major && b < width) {
      s += `<text x="${r(x + 2)}" y="${8}" class="pk-tick">${b}</text>`;
    }
  }
  s += `</g>`;

  s += `<g${bl('fields')}>`;
  cells.forEach((c) => {
    const x = xAt(c.from);
    const w = c.bits * cellW;
    const y = TOP + c.row * ROW_H;
    s += `<g${bp(`fields.${c.index}`)}>`;
    s += `<rect x="${r(x + 1)}" y="${r(y + 2)}" width="${r(w - 2)}" height="${ROW_H - 6}" rx="4" fill="${c.color}" stroke="var(--navy)" stroke-width="1" stroke-opacity="0.45"/>`;
    // A cell narrower than ~46px can't hold a name; its bit count still reads.
    const cx = x + w / 2;
    if (w >= 46) {
      const suffix = c.cont ? ' (cont.)' : c.cut ? ' →' : '';
      s += `<text x="${r(cx)}" y="${r(y + (c.value !== undefined && w >= 80 ? 19 : 25))}" class="pk-name">${escapeHtml(c.label + suffix)}</text>`;
      if (c.value !== undefined && w >= 80) {
        s += `<text x="${r(cx)}" y="${r(y + 33)}" class="pk-value">${escapeHtml(c.value)}</text>`;
      }
    }
    s += `<text x="${r(cx)}" y="${r(y + ROW_H - 11)}" class="pk-bits">${c.bits}</text>`;
    s += `<title>${escapeHtml(`${c.label} — ${c.bits} bit${c.bits === 1 ? '' : 's'} at offset ${c.row * width + c.from}`)}</title>`;
    s += `</g>`;
  });
  s += `</g>`;

  // Row offsets down the left edge, in bits.
  for (let row = 0; row < rows; row++) {
    s += `<text x="${LEFT - 8}" y="${r(TOP + row * ROW_H + ROW_H / 2)}" class="pk-off">${row * width}</text>`;
  }
  s += `</svg>`;

  const totalBits = bit;
  const footer =
    `<p class="pk-total">${totalBits} bits · ${Math.round((totalBits / 8) * 10) / 10} bytes` +
    (totalBits % width !== 0 ? ` · last row is ${totalBits % width} of ${width} bits` : '') +
    `</p>`;

  return diagramFrame(
    {
      tag: 'PACKET',
      tagBg: '#2f5c8f',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      footerHtml: footer,
    },
    s,
  );
}

function r(v: number): number {
  return Math.round(v * 10) / 10;
}
