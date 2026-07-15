/**
 * Meta is rendered as the document cover (not as a body block). The registry
 * entry for `meta` returns an empty string; {@link renderCover} produces the
 * cover from the {@link Document.meta} data.
 *
 * Class names match doc-studio: `.cover-bar`, `.cover-pad`, `.cover-meta`,
 * `.cover-title`, `.cover-sub`, `.cover-logo`.
 */

import type { MetaData } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { safeUrl } from '../sanitize.js';

/** Renders the document cover (banner + optional logo + meta line + title + subtitle). */
export function renderCover(meta: MetaData | undefined): string {
  const title = meta?.title ?? 'Untitled';
  const tag = meta?.tag ?? '';
  const subtitle = meta?.subtitle;
  const sub =
    subtitle !== undefined ? `<p class="cover-sub">${escapeHtml(subtitle)}</p>` : '';
  const logo =
    meta?.logo !== undefined && meta.logo !== ''
      ? `<img class="cover-logo" src="${escapeHtml(safeUrl(meta.logo))}" alt="${escapeHtml(title)}">`
      : '';
  return (
    `<div class="cover-bar"></div>` +
    `<div class="cover-pad">` +
    logo +
    `<div class="cover-meta"><span>DOCUMENT</span><span class="accent">${escapeHtml(tag)}</span></div>` +
    `<h1 class="cover-title">${escapeHtml(title)}</h1>` +
    sub +
    `</div>`
  );
}

/**
 * Block-registry entry for `meta`. Always returns empty: the cover is rendered
 * separately by {@link renderCover}, called from {@link renderDocument}.
 */
export function renderMetaBlock(): string {
  return '';
}
