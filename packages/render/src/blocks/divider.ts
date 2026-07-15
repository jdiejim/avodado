/**
 * Renders a `divider` block — a full-width section-break band: an optional
 * mono kicker flanked by short rule lines, a display title, and an optional
 * subtitle, centered on a subtle accent wash. As the only block under a
 * heading it becomes a clean interstitial slide automatically.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bp } from '../paths.js';

export function renderDivider(data: BlockDataMap['divider']): string {
  const accentCls = data.accent !== undefined ? ` dvd-${data.accent}` : '';
  const kicker =
    data.kicker !== undefined
      ? `<div class="dvd-kicker"><span class="dvd-rule" aria-hidden="true"></span>` +
        `<span class="dvd-kicker-text"${bp('kicker')}>${escapeHtml(data.kicker)}</span>` +
        `<span class="dvd-rule" aria-hidden="true"></span></div>`
      : '';
  const subtitle =
    data.subtitle !== undefined
      ? `<p class="dvd-subtitle"${bp('subtitle')}>${escapeHtml(data.subtitle)}</p>`
      : '';
  return (
    `<div class="dvd${accentCls}">` +
    kicker +
    `<div class="dvd-title"${bp('title')}>${escapeHtml(data.title)}</div>` +
    subtitle +
    `</div>`
  );
}
