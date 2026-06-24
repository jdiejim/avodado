/**
 * Renders a `pattern` block — a design-pattern reference card (GoF-style):
 * a header (name + category pill), then labelled rows for intent, forces,
 * participants, structure/solution, and consequences (pros vs cons). Built for
 * "explain this backend/architecture pattern" tutorials.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

type PatternData = BlockDataMap['pattern'];

function textRow(label: string, value: string | undefined): string {
  if (value === undefined || value === '') return '';
  return `<div class="pt-row"><div class="pt-label">${label}</div><div class="pt-value">${escapeHtml(value)}</div></div>`;
}

function chipsRow(label: string, items: readonly string[] | undefined): string {
  if (items === undefined || items.length === 0) return '';
  const chips = items.map((i) => `<span class="pt-chip">${escapeHtml(i)}</span>`).join('');
  return `<div class="pt-row"><div class="pt-label">${label}</div><div class="pt-value"><div class="pt-chips">${chips}</div></div></div>`;
}

function participantsRow(data: PatternData): string {
  const ps = data.participants ?? [];
  if (ps.length === 0) return '';
  const rows = ps
    .map((p) => {
      const role = p.role !== undefined ? `<span class="pt-prole">${escapeHtml(p.role)}</span>` : '';
      return `<li><span class="pt-pname">${escapeHtml(p.name)}</span>${role}</li>`;
    })
    .join('');
  return `<div class="pt-row"><div class="pt-label">Participants</div><div class="pt-value"><ul class="pt-parts">${rows}</ul></div></div>`;
}

function consequencesRow(data: PatternData): string {
  const c = data.consequences;
  if (c === undefined) return '';
  const pros = c.pros ?? [];
  const cons = c.cons ?? [];
  if (pros.length === 0 && cons.length === 0) return '';
  const col = (cls: string, sign: string, items: readonly string[]): string =>
    items.length === 0
      ? ''
      : `<ul class="pt-cons-list ${cls}">${items.map((i) => `<li><span class="pt-sign">${sign}</span>${escapeHtml(i)}</li>`).join('')}</ul>`;
  return (
    `<div class="pt-row"><div class="pt-label">Consequences</div>` +
    `<div class="pt-value"><div class="pt-cons">${col('pt-pro', '+', pros)}${col('pt-con', '−', cons)}</div></div></div>`
  );
}

export function renderPattern(data: PatternData): string {
  const cat = data.category !== undefined ? `<span class="pt-cat">${escapeHtml(data.category)}</span>` : '';
  const header =
    `<div class="pt-header"><span class="pt-kicker">PATTERN</span>` +
    `<span class="pt-name">${escapeHtml(data.name)}</span>${cat}</div>`;
  const body =
    textRow('Intent', data.intent) +
    chipsRow('Forces', data.forces) +
    textRow('Solution', data.solution) +
    textRow('Structure', data.structure) +
    participantsRow(data) +
    consequencesRow(data) +
    textRow('Notes', data.note);
  return `<div class="pattern">${header}<div class="pt-rows">${body}</div></div>`;
}
