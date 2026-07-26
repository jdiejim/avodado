/**
 * Renders an `scqa` block — the executive summary, in Minto's order.
 *
 * Situation, complication, question, answer: the four moves that make an
 * opening slide argue instead of describe. Each is one line, and the block's
 * whole job is to keep them in that order and give the answer the weight —
 * everything above it exists to make the recommendation land.
 *
 * Rendered as a numbered ladder: the first three are quiet rows, the answer is
 * a filled card, and `because` hangs supporting points under it.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { renderInlineMd } from '../markdown.js';
import { bl, bp } from '../paths.js';

type ScqaData = BlockDataMap['scqa'];

/** The four moves, in the only order that works. */
const STEPS = [
  { key: 'situation', label: 'Situation', hint: 'what everyone already agrees on' },
  { key: 'complication', label: 'Complication', hint: 'what changed' },
  { key: 'question', label: 'Question', hint: 'what has to be settled' },
] as const;

export function renderScqa(data: ScqaData): string {
  const rows = STEPS.filter((s) => typeof data[s.key] === 'string' && data[s.key] !== '')
    .map((s, i) => {
      const text = data[s.key] as string;
      return (
        `<div class="sq-row"${bp(s.key)}>` +
        `<span class="sq-num">${i + 1}</span>` +
        `<div class="sq-body"><span class="sq-label">${escapeHtml(s.label)}</span>` +
        `<p class="sq-text">${renderInlineMd(text)}</p></div></div>`
      );
    })
    .join('');

  const because =
    data.because !== undefined && data.because.length > 0
      ? `<ul class="sq-because"${bl('because')}>` +
        data.because
          .map((b, i) => `<li${bp(`because.${i}`)}>${renderInlineMd(b)}</li>`)
          .join('') +
        `</ul>`
      : '';

  // The answer is the point of the block: it gets the filled card, and it
  // renders even when the three setup rows are missing.
  const answer =
    typeof data.answer === 'string' && data.answer !== ''
      ? `<div class="sq-answer"${bp('answer')}>` +
        `<span class="sq-label sq-label-answer">Answer</span>` +
        `<p class="sq-text sq-text-answer">${renderInlineMd(data.answer)}</p>${because}</div>`
      : '';

  const caption =
    data.title !== undefined ? `<div class="sq-head">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined
      ? `<p class="sq-desc"${bp('description')}>${escapeHtml(data.description)}</p>`
      : '';

  return `<div class="scqa">${caption}${desc}${rows}${answer}</div>`;
}
