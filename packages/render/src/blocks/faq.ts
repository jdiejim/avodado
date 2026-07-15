/**
 * Renders a `faq` block — Q&A accordions built on native `<details>` (no
 * JavaScript), modeled on the `stories` renderer. The summary is a caret plus
 * the bold question; expanding reveals the answer. Answers are plain text —
 * escaped, with blank lines becoming paragraph breaks.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

type FaqData = BlockDataMap['faq'];
type FaqItem = FaqData['items'][number];

/** Escapes an answer, rendering blank-line-separated runs as paragraphs. */
function renderAnswer(text: string): string {
  const paras = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (paras.length === 0) return '';
  return paras.map((p) => `<p>${escapeHtml(p)}</p>`).join('');
}

function renderItem(item: FaqItem, index: number): string {
  const open = item.open === true ? ' open' : '';
  return (
    `<details class="fq-item"${open}${bp(`items.${index}`)}>` +
    `<summary class="fq-summary">` +
    `<span class="fq-caret" aria-hidden="true"></span>` +
    `<span class="fq-q"${bp(`items.${index}.q`)}>${escapeHtml(item.q)}</span>` +
    `</summary>` +
    `<div class="fq-a"${bp(`items.${index}.a`)}>${renderAnswer(item.a)}</div>` +
    `</details>`
  );
}

export function renderFaq(data: FaqData): string {
  const head =
    data.title !== undefined ? `<div class="fq-head">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined
      ? `<p class="fq-desc">${escapeHtml(data.description)}</p>`
      : '';
  const items = data.items.map((it, i) => renderItem(it, i)).join('');
  return `<div class="faq">${head}${desc}<div class="fq-list"${bl('items')}>${items}</div></div>`;
}
