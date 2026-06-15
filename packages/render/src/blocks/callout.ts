/**
 * Renders a callout block — a tonal side-bar with title + body.
 *
 * Doc-studio variant: `tone` (note/tip/warn/danger) instead of the original
 * `kind`. Defaults to `note` if omitted. Title defaults to the tone's label.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

type Tone = 'note' | 'tip' | 'warn' | 'danger' | 'success';

const DEFAULT_TITLE: Record<Tone, string> = {
  note: 'Note',
  tip: 'Tip',
  warn: 'Warning',
  danger: 'Danger',
  success: 'Success',
};

export function renderCallout(data: BlockDataMap['callout']): string {
  const tone: Tone = data.tone ?? 'note';
  const title = data.title ?? DEFAULT_TITLE[tone];
  const body = data.body ?? '';
  return (
    `<div class="callout ${tone}">` +
    `<div class="callout-title">${escapeHtml(title)}</div>` +
    `<div class="callout-body">${escapeHtml(body)}</div>` +
    `</div>`
  );
}
