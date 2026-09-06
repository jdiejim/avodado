/**
 * Insert-menu thumbnails: each block type's starter template rendered through
 * the real pipeline (parse → renderDocumentSegments), memoised globally per
 * type. 88 SVG renders would jank the popover, so cards call this lazily (on
 * family expand) and every subsequent open is a cache hit.
 */

import { BLOCK_TEMPLATES, parseDocument, type BlockType } from '@avodado/core';
import { renderDocumentSegments } from '@avodado/render';

const cache = new Map<BlockType, string>();

/**
 * The rendered HTML (shared SVG defs + the block's segment) of `type`'s
 * starter template. Returns `''` if the renderer throws (a renderer bug —
 * the card then shows its text fallback).
 */
export function thumbnailHtml(type: BlockType): string {
  const hit = cache.get(type);
  if (hit !== undefined) return hit;
  let html = '';
  try {
    const doc = parseDocument(BLOCK_TEMPLATES[type], `thumb-${type}`);
    const r = renderDocumentSegments(doc);
    const body = type === 'meta' ? r.cover : (r.segments[0]?.html ?? '');
    html = body === '' ? '' : r.defs + body;
  } catch {
    html = '';
  }
  cache.set(type, html);
  return html;
}

/** Number of memoised thumbnails (test hook). */
export function thumbnailCacheSize(): number {
  return cache.size;
}

/** Clears the memo (test hook). */
export function clearThumbnailCache(): void {
  cache.clear();
}
