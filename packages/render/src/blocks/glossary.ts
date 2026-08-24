/**
 * Renders a glossary block — a list of term/definition rows.
 *
 * Ported from doc-studio.jsx `Glossary`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

/** A muted "not: X, Y" suffix listing the term's avoided words, if any. */
function avoidSuffix(avoid: readonly string[] | undefined, i: number): string {
  if (avoid === undefined || avoid.length === 0) return '';
  const words = avoid
    .map((a, j) => `<span${bp(`terms.${i}.avoid.${j}`)}>${escapeHtml(a)}</span>`)
    .join(', ');
  return ` <span class="avoid"${bl(`terms.${i}.avoid`)}>not: ${words}</span>`;
}

export function renderGlossary(data: BlockDataMap['glossary']): string {
  const terms = data.terms ?? [];
  const rows = terms
    .map(
      (t, i) =>
        `<div class="row"${bp(`terms.${i}`)}><dt${bp(`terms.${i}.term`)}>${escapeHtml(t.term)}</dt><dd${bp(`terms.${i}.def`)}>${escapeHtml(t.def)}${avoidSuffix(t.avoid, i)}</dd></div>`,
    )
    .join('');
  return `<div class="glossary"${bl('terms')}>${rows}</div>`;
}
