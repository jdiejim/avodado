/**
 * Renders a glossary block — a list of term/definition rows.
 *
 * Ported from doc-studio.jsx `Glossary`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

export function renderGlossary(data: BlockDataMap['glossary']): string {
  const terms = data.terms ?? [];
  const rows = terms
    .map(
      (t) =>
        `<div class="row"><dt>${escapeHtml(t.term)}</dt><dd>${escapeHtml(t.def)}</dd></div>`,
    )
    .join('');
  return `<div class="glossary">${rows}</div>`;
}
