/**
 * Meta is rendered as the document cover (not as a body block). The registry
 * entry for `meta` returns an empty string; {@link renderCover} produces the
 * cover from the {@link Document.meta} data.
 *
 * Class names match doc-studio: `.cover-bar`, `.cover-pad`, `.cover-meta`,
 * `.cover-title`, `.cover-sub`.
 */

import type { MetaData } from '@avodado/core';
import { escapeHtml } from '../escape.js';

/** Renders the document cover (banner + meta line + title + optional subtitle). */
export function renderCover(meta: MetaData | undefined): string {
  const title = meta?.title ?? 'Untitled';
  const tag = meta?.tag ?? '';
  const subtitle = meta?.subtitle;
  const sub =
    subtitle !== undefined ? `<p class="cover-sub">${escapeHtml(subtitle)}</p>` : '';
  return (
    `<div class="cover-bar"></div>` +
    `<div class="cover-pad">` +
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
