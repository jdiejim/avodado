/**
 * Insert-menu thumbnails: each block type's starter template rendered through
 * the real pipeline (parse → renderDocumentSegments), memoised globally per
 * type. 88 SVG renders would jank the popover, so cards call this lazily (on
 * family expand) and every subsequent open is a cache hit.
 */

import { BLOCK_TEMPLATES, parseDocument, type BlockType } from 'chiltepin-core';
import { renderDocumentSegments } from 'chiltepin-render';

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

const docCache = new Map<string, string>();

/**
 * The card thumbnail for a whole document: its first structural block (not
 * prose, not the cover, not a callout) rendered through the real pipeline;
 * the cover when the document has no such block. Memoised per `key`, which
 * callers build from slug + mtime so an edit refreshes the picture.
 */
export function docThumbnailHtml(key: string, source: string, slug: string): string {
  const hit = docCache.get(key);
  if (hit !== undefined) return hit;
  let html = '';
  try {
    const doc = parseDocument(source, slug);
    const r = renderDocumentSegments(doc);
    const skip = new Set(['meta', 'callout', 'prose']);
    let body = '';
    for (let i = 0; i < doc.segments.length; i += 1) {
      const seg = doc.segments[i];
      const rendered = r.segments[i]?.html ?? '';
      if (seg === undefined || seg.kind === 'markdown' || rendered === '') continue;
      if (skip.has(seg.kind)) continue;
      body = rendered;
      break;
    }
    if (body === '') body = r.segments.find((x) => x.html !== '')?.html ?? r.cover;
    html = body === '' ? '' : r.defs + body;
  } catch {
    html = '';
  }
  docCache.set(key, html);
  return html;
}
