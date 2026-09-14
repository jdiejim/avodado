/**
 * The review dialog's change summary — a pure diff of two document sources at
 * BLOCK granularity (never lines): what would hit the disk if we saved now.
 *
 * Pairing algorithm (kept simple and stable):
 *
 * 1. Parse both sources. For each CURRENT segment in order, consume the first
 *    unconsumed BASELINE segment whose kind and raw/text are EXACTLY equal —
 *    those pairs are unchanged and excluded from the summary. Because pairing
 *    is by content (not position), a pure reorder pairs everything and yields
 *    zero `edited` items.
 * 2. Reorders ARE reported: walking the exact pairs in current order, any pair
 *    whose baseline index sits BEFORE an already-consumed one is `reordered`
 *    (one item per displaced segment — not a minimal move set).
 * 3. Among the leftovers, same-kind segments pair in order as `edited`;
 *    remaining current-only segments are `added`, baseline-only `removed`.
 *
 * Labels: a typed block's `title` from its data, else its {@link BLOCK_LABELS}
 * type name; prose shows its first ~40 characters.
 */

import { parseDocument, BLOCK_LABELS, type BlockType, type Segment } from 'chiltepin-core';

/** What happened to one segment between the saved baseline and now. */
export interface ChangeItem {
  readonly kind: BlockType | 'markdown';
  readonly label: string;
  readonly change: 'edited' | 'added' | 'removed' | 'reordered';
}

const PROSE_SNIPPET_LEN = 40;

/** Human label for a segment — block title, type name, or a prose snippet. */
export function segmentLabel(seg: Segment): string {
  if (seg.kind === 'markdown') {
    const text = seg.text.replace(/\s+/g, ' ').trim();
    if (text === '') return 'Text';
    return text.length > PROSE_SNIPPET_LEN ? `${text.slice(0, PROSE_SNIPPET_LEN)}…` : text;
  }
  const data = seg.data;
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    const title = (data as { title?: unknown }).title;
    if (typeof title === 'string' && title.trim() !== '') return title.trim();
  }
  return BLOCK_LABELS[seg.kind];
}

/** Exact-content identity of a segment (kind + raw body / prose text). */
function contentKey(seg: Segment): string {
  return seg.kind === 'markdown' ? `markdown\u0000${seg.text}` : `${seg.kind}\u0000${seg.raw}`;
}

/**
 * Summarises what saving `currentSource` over `baselineSource` would change,
 * one {@link ChangeItem} per affected segment. An empty array on a dirty doc
 * means the difference is formatting-only (whitespace the parser normalises
 * away). Items are ordered by position — current-document order, with
 * `removed` items (which have no current position) last, in baseline order.
 */
export function changesSummary(
  baselineSource: string,
  currentSource: string,
  slug: string,
): ChangeItem[] {
  const base = parseDocument(baselineSource, slug).segments;
  const cur = parseDocument(currentSource, slug).segments;

  // 1. Exact matches, greedy in order: current index → baseline index.
  const baseUsed = new Array<boolean>(base.length).fill(false);
  const exactPair = new Map<number, number>();
  cur.forEach((seg, ci) => {
    const key = contentKey(seg);
    for (let bi = 0; bi < base.length; bi++) {
      if (!baseUsed[bi] && contentKey(base[bi] as Segment) === key) {
        baseUsed[bi] = true;
        exactPair.set(ci, bi);
        return;
      }
    }
  });

  // 2. Reorders among the exact pairs (baseline index regressed).
  const reordered = new Set<number>();
  let maxBase = -1;
  for (const [ci, bi] of [...exactPair.entries()].sort((a, b) => a[0] - b[0])) {
    if (bi < maxBase) reordered.add(ci);
    else maxBase = bi;
  }

  // 3. Leftovers: same-kind pairing in order → edited; rest added/removed.
  const leftCur = cur.map((_, i) => i).filter((i) => !exactPair.has(i));
  const leftBase = base.map((_, i) => i).filter((i) => !baseUsed[i]);
  const edited = new Set<number>();
  const removedBase = new Set<number>(leftBase);
  for (const ci of leftCur) {
    const kind = (cur[ci] as Segment).kind;
    const bi = leftBase.find((b) => removedBase.has(b) && (base[b] as Segment).kind === kind);
    if (bi !== undefined) {
      removedBase.delete(bi);
      edited.add(ci);
    }
  }

  const items: ChangeItem[] = [];
  cur.forEach((seg, ci) => {
    if (reordered.has(ci)) items.push({ kind: seg.kind, label: segmentLabel(seg), change: 'reordered' });
    else if (edited.has(ci)) items.push({ kind: seg.kind, label: segmentLabel(seg), change: 'edited' });
    else if (!exactPair.has(ci)) items.push({ kind: seg.kind, label: segmentLabel(seg), change: 'added' });
  });
  base.forEach((seg, bi) => {
    if (removedBase.has(bi)) items.push({ kind: seg.kind, label: segmentLabel(seg), change: 'removed' });
  });
  return items;
}
