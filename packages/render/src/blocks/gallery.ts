/**
 * Renders a `gallery` block — a true grid (2 columns by default) of cells. Each
 * cell is one of: a syntax-highlighted code snippet, a plain note (title +
 * caption), or a **nested block** (e.g. a `c4` / `block` / `belogic` diagram) so
 * you can compare several architectures side by side. Set `cols` to control the
 * column count (2 for a bug grid, 3–4 for a comparison).
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { highlightCode } from '../highlight.js';
// Same-package cycle: the registry imports this renderer, and we use the registry
// only at call time (renderNested), by which point it's fully initialised.
import { htmlRenderers } from '../registry.js';

type GalleryData = BlockDataMap['gallery'];
type GalleryItem = GalleryData['items'][number];

/** Renders a nested block (a `{ type, ...data }` cell) via the HTML registry. */
function renderNested(block: { readonly type: string }): string {
  const data: Record<string, unknown> = { ...block };
  delete data.type;
  const fn = (htmlRenderers as unknown as Record<string, (d: unknown) => string>)[block.type];
  return fn !== undefined ? fn(data) : '';
}

function renderCard(item: GalleryItem): string {
  const accent = item.accent !== undefined ? ` gl-${item.accent}` : '';
  const title =
    item.title !== undefined ? `<div class="gl-card-title">${escapeHtml(item.title)}</div>` : '';
  const caption =
    item.caption !== undefined ? `<div class="gl-cap">${escapeHtml(item.caption)}</div>` : '';

  // A nested diagram cell — the diagram brings its own frame, so no card chrome.
  if (item.block !== undefined) {
    return `<div class="gl-cell${accent}">${title}${renderNested(item.block)}${caption}</div>`;
  }
  // A code cell.
  if (item.code !== undefined) {
    const header =
      item.title !== undefined || item.lang !== undefined
        ? `<div class="code-header"><span>${escapeHtml(item.title ?? '')}</span><span>${escapeHtml(item.lang ?? '')}</span></div>`
        : '';
    return `<div class="gl-card gl-code${accent}">${header}<pre>${highlightCode(item.code)}</pre>${caption}</div>`;
  }
  // A plain note cell.
  return `<div class="gl-card${accent}">${title}${caption}</div>`;
}

export function renderGallery(data: GalleryData): string {
  const head = data.title !== undefined ? `<div class="gl-head">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined ? `<p class="gl-desc">${escapeHtml(data.description)}</p>` : '';
  const cols = data.cols !== undefined && data.cols > 0 ? Math.floor(data.cols) : 2;
  const style = ` style="--gl-cols:${cols}"`;
  const cards = data.items.map(renderCard).join('');
  return `<div class="gallery">${head}${desc}<div class="gl-grid"${style}>${cards}</div></div>`;
}
