/**
 * Renders a `pattern` block — a design-pattern reference card (GoF-style):
 * a header (name + category pill), then labelled rows for intent, forces,
 * participants, structure/solution, and consequences (pros vs cons). Built for
 * "explain this backend/architecture pattern" tutorials.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

type PatternData = BlockDataMap['pattern'];

function textRow(label: string, value: string | undefined, path: string): string {
  if (value === undefined || value === '') return '';
  return `<div class="pt-row"><div class="pt-label">${label}</div><div class="pt-value"${bp(path)}>${escapeHtml(value)}</div></div>`;
}

function chipsRow(label: string, items: readonly string[] | undefined, listPath: string): string {
  if (items === undefined || items.length === 0) return '';
  const chips = items
    .map((c, i) => `<span class="pt-chip"${bp(`${listPath}.${i}`)}>${escapeHtml(c)}</span>`)
    .join('');
  return `<div class="pt-row"><div class="pt-label">${label}</div><div class="pt-value"><div class="pt-chips"${bl(listPath)}>${chips}</div></div></div>`;
}

function participantsRow(data: PatternData): string {
  const ps = data.participants ?? [];
  if (ps.length === 0) return '';
  const rows = ps
    .map((p, i) => {
      const role =
        p.role !== undefined
          ? `<span class="pt-prole"${bp(`participants.${i}.role`)}>${escapeHtml(p.role)}</span>`
          : '';
      return `<li${bp(`participants.${i}`)}><span class="pt-pname"${bp(`participants.${i}.name`)}>${escapeHtml(p.name)}</span>${role}</li>`;
    })
    .join('');
  return `<div class="pt-row"><div class="pt-label">Participants</div><div class="pt-value"><ul class="pt-parts"${bl('participants')}>${rows}</ul></div></div>`;
}

function consequencesRow(data: PatternData): string {
  const c = data.consequences;
  if (c === undefined) return '';
  const pros = c.pros ?? [];
  const cons = c.cons ?? [];
  if (pros.length === 0 && cons.length === 0) return '';
  const col = (cls: string, sign: string, items: readonly string[], listPath: string): string =>
    items.length === 0
      ? ''
      : `<ul class="pt-cons-list ${cls}"${bl(listPath)}>${items.map((item, i) => `<li${bp(`${listPath}.${i}`)}><span class="pt-sign">${sign}</span>${escapeHtml(item)}</li>`).join('')}</ul>`;
  return (
    `<div class="pt-row"><div class="pt-label">Consequences</div>` +
    `<div class="pt-value"><div class="pt-cons">${col('pt-pro', '+', pros, 'consequences.pros')}${col('pt-con', '−', cons, 'consequences.cons')}</div></div></div>`
  );
}

export function renderPattern(data: PatternData): string {
  const cat = data.category !== undefined ? `<span class="pt-cat"${bp('category')}>${escapeHtml(data.category)}</span>` : '';
  const header =
    `<div class="pt-header"><span class="pt-kicker">PATTERN</span>` +
    `<span class="pt-name"${bp('name')}>${escapeHtml(data.name)}</span>${cat}</div>`;
  const body =
    textRow('Intent', data.intent, 'intent') +
    chipsRow('Forces', data.forces, 'forces') +
    textRow('Solution', data.solution, 'solution') +
    textRow('Structure', data.structure, 'structure') +
    participantsRow(data) +
    consequencesRow(data) +
    textRow('Notes', data.note, 'note');
  return `<div class="pattern">${header}<div class="pt-rows">${body}</div></div>`;
}
