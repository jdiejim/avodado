/**
 * Insert-menu thumbnails: each block type's starter template rendered through
 * the real pipeline (parse → renderDocumentSegments), memoised globally per
 * (theme, type). 88 SVG renders would jank the popover, so cards call this
 * lazily (on family expand) and every subsequent open is a cache hit.
 */

import { BLOCK_TEMPLATES, parseDocument, type BlockType } from '@avodado/core';
import { renderDocumentSegments, type ThemeName } from '@avodado/render';

const cache = new Map<string, string>();

/**
 * The rendered HTML (shared SVG defs + the block's segment) of `type`'s
 * starter template. Returns `''` if the renderer throws (a renderer bug —
 * the card then shows its text fallback).
 */
export function thumbnailHtml(type: BlockType, theme: ThemeName): string {
  const key = `${theme}:${type}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let html = '';
  try {
    const doc = parseDocument(BLOCK_TEMPLATES[type], `thumb-${type}`);
    const r = renderDocumentSegments(doc, { theme });
    const body = type === 'meta' ? r.cover : (r.segments[0]?.html ?? '');
    html = body === '' ? '' : r.defs + body;
  } catch {
    html = '';
  }
  cache.set(key, html);
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
