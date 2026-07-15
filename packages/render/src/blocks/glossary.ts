/**
 * Renders a glossary block — a list of term/definition rows.
 *
 * Ported from doc-studio.jsx `Glossary`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

export function renderGlossary(data: BlockDataMap['glossary']): string {
  const terms = data.terms ?? [];
  const rows = terms
    .map(
      (t, i) =>
        `<div class="row"${bp(`terms.${i}`)}><dt${bp(`terms.${i}.term`)}>${escapeHtml(t.term)}</dt><dd${bp(`terms.${i}.def`)}>${escapeHtml(t.def)}</dd></div>`,
    )
    .join('');
  return `<div class="glossary"${bl('terms')}>${rows}</div>`;
}
