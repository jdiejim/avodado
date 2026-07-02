/**
 * Renders a `hashmap` block — bucket slots with chained entries, in pure SVG
 * inside the diagram frame (tag HASH).
 *
 * A vertical column of bucket slots (mono index in a 34px light-gray cell);
 * each bucket's entries chain rightward as rounded `key` / `key: value`
 * pills joined by small arrows, so collision chains read left → right. Empty
 * buckets show a dim "—". Entries whose `bucket` falls outside 0..N-1 are
 * skipped; rendering caps at 12 buckets with a "+N more" note.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { dsTone } from '../svg/dsTone.js';
import { diagramFrame } from './frame.js';

type HashmapData = BlockDataMap['hashmap'];
type Entry = NonNullable<HashmapData['entries']>[number];

const IDX_W = 34;
const ROW_H = 30;
const GAP_Y = 10;
const PILL_H = 24;
const LINK_W = 16; // arrow run between chained pills
const PAD_X = 6;
const MAX_BUCKETS = 12;
const MIN_WIDTH = 320;

/** Truncates a pill label to keep chains inside the frame. */
function fit(text: string): string {
  return text.length > 24 ? `${text.slice(0, 23)}…` : text;
}

function pillText(e: Entry): string {
  return e.value !== undefined && e.value.length > 0 ? `${e.key}: ${e.value}` : e.key;
}

export function renderHashmap(data: HashmapData): string {
  const total = Math.max(0, Math.floor(data.buckets));
  const shown = Math.min(total, MAX_BUCKETS);
  const overflow = total - shown;
  const entries = data.entries ?? [];

  // Group in-range entries by bucket, preserving source order per chain.
  const chains = new Map<number, Entry[]>();
  for (const e of entries) {
    const b = Math.floor(e.bucket);
    if (b < 0 || b >= total) continue; // out-of-range entries are skipped
    const chain = chains.get(b) ?? [];
    chain.push(e);
    chains.set(b, chain);
  }

  const noteH = overflow > 0 ? 20 : 0;
  const height = Math.max(shown, 1) * (ROW_H + GAP_Y) - (shown > 0 ? GAP_Y : 0) + 12 + noteH;

  // Pre-measure each chain to size the viewBox.
  const pillW = (e: Entry): number => Math.max(34, Math.round(fit(pillText(e)).length * 6.6) + 18);
  let width = MIN_WIDTH;
  for (let b = 0; b < shown; b += 1) {
    let x = PAD_X + IDX_W + LINK_W;
    for (const e of chains.get(b) ?? []) x += pillW(e) + LINK_W;
    width = Math.max(width, x + PAD_X);
  }

  let s = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img"><title>Hash map</title>`;

  if (shown === 0) {
    s += `<text x="${PAD_X}" y="${ROW_H / 2 + 9}" class="ds-empty">(empty)</text></svg>`;
    return frame(data, s);
  }

  for (let b = 0; b < shown; b += 1) {
    const y = 4 + b * (ROW_H + GAP_Y);
    const cy = y + ROW_H / 2;
    // Bucket index cell.
    s += `<rect x="${PAD_X}" y="${y}" width="${IDX_W}" height="${ROW_H}" rx="4" fill="var(--light-gray)" stroke="var(--rule)"/>`;
    s += `<text x="${PAD_X + IDX_W / 2}" y="${cy + 4}" class="hsh-idx">${b}</text>`;

    const chain = chains.get(b) ?? [];
    if (chain.length === 0) {
      s += `<text x="${PAD_X + IDX_W + 12}" y="${cy + 4}" class="hsh-nil">—</text>`;
      continue;
    }
    let x = PAD_X + IDX_W;
    chain.forEach((e) => {
      const w = pillW(e);
      s += `<path d="M${x + 1},${cy} L${x + LINK_W - 2},${cy}" class="hsh-link" marker-end="url(#gSoft)"/>`;
      x += LINK_W;
      const t = dsTone(e.tone);
      s += `<rect x="${x}" y="${cy - PILL_H / 2}" width="${w}" height="${PILL_H}" rx="11" fill="${t.fill}" stroke="${t.stroke}" stroke-width="1.2"/>`;
      s += `<text x="${x + w / 2}" y="${cy + 4}" class="hsh-key" fill="${t.text}">${escapeHtml(fit(pillText(e)))}</text>`;
      x += w;
    });
  }

  if (overflow > 0) {
    const y = 4 + shown * (ROW_H + GAP_Y) + 10;
    s += `<text x="${PAD_X}" y="${y}" class="hsh-more">+${overflow} more bucket${overflow === 1 ? '' : 's'}</text>`;
  }

  s += `</svg>`;
  return frame(data, s);
}

function frame(data: HashmapData, inner: string): string {
  return diagramFrame(
    {
      tag: 'HASH',
      tagBg: '#374151',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    inner,
  );
}
