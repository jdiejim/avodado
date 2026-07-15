/**
 * Renders a callout block — a tonal side-bar with title + body.
 *
 * Doc-studio variant: `tone` (note/tip/warn/danger) instead of the original
 * `kind`. Defaults to `note` if omitted. Title defaults to the tone's label.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bp } from '../paths.js';

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
  // Unknown tones (invalid per schema, but render is lenient) fall back to the
  // `note` title rather than an empty one.
  const title =
    data.title ?? (DEFAULT_TITLE as Partial<Record<string, string>>)[tone] ?? DEFAULT_TITLE.note;
  const body = data.body ?? '';
  return (
    `<div class="callout ${tone}">` +
    `<div class="callout-title"${bp('title')}>${escapeHtml(title)}</div>` +
    `<div class="callout-body"${bp('body')}>${escapeHtml(body)}</div>` +
    `</div>`
  );
}
