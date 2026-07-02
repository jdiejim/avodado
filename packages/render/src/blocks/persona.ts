/**
 * Renders a `persona` block — user persona cards on a responsive 2-column
 * grid (1 column on mobile). Each card: a circular initials avatar (accent
 * background), name + role, an italic quote with a left accent bar, then
 * compact labelled lists — GOALS (positive markers), FRUSTRATIONS (negative
 * markers) — and TOOLS as small mono chips. Sections with no data are omitted.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

type PersonaData = BlockDataMap['persona'];
type Persona = PersonaData['personas'][number];

/** Derives a 2-letter monogram from a name (first letters of first 2 words). */
export function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => w.length > 0);
  const first = words[0]?.charAt(0) ?? '';
  const second = words.length > 1 ? (words[words.length - 1]?.charAt(0) ?? '') : (words[0]?.charAt(1) ?? '');
  return `${first}${second}`.toUpperCase();
}

function renderList(label: string, kind: string, items: readonly string[] | undefined): string {
  if (items === undefined || items.length === 0) return '';
  const lis = items.map((it) => `<li class="pa-li">${escapeHtml(it)}</li>`).join('');
  return (
    `<div class="pa-section ${kind}">` +
    `<div class="pa-sec-label">${escapeHtml(label)}</div>` +
    `<ul class="pa-list">${lis}</ul>` +
    `</div>`
  );
}

function renderTools(tools: readonly string[] | undefined): string {
  if (tools === undefined || tools.length === 0) return '';
  const chips = tools.map((t) => `<span class="pa-tool">${escapeHtml(t)}</span>`).join('');
  return (
    `<div class="pa-section">` +
    `<div class="pa-sec-label">Tools</div>` +
    `<div class="pa-tools">${chips}</div>` +
    `</div>`
  );
}

function renderCard(p: Persona): string {
  const accent = p.accent !== undefined ? ` pa-${p.accent}` : '';
  const role = p.role !== undefined ? `<div class="pa-role">${escapeHtml(p.role)}</div>` : '';
  const quote =
    p.quote !== undefined ? `<blockquote class="pa-quote">${escapeHtml(p.quote)}</blockquote>` : '';
  return (
    `<div class="pa-card${accent}">` +
    `<div class="pa-id">` +
    `<span class="pa-avatar">${escapeHtml(initialsFor(p.name))}</span>` +
    `<div class="pa-who">` +
    `<div class="pa-name">${escapeHtml(p.name)}</div>` +
    role +
    `</div>` +
    `</div>` +
    quote +
    renderList('Goals', 'pa-goals', p.goals) +
    renderList('Frustrations', 'pa-frustrations', p.frustrations) +
    renderTools(p.tools) +
    `</div>`
  );
}

export function renderPersona(data: PersonaData): string {
  const head =
    data.title !== undefined ? `<div class="pa-head">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined
      ? `<p class="pa-desc">${escapeHtml(data.description)}</p>`
      : '';
  const cards = data.personas.map(renderCard).join('');
  return `<div class="persona">${head}${desc}<div class="pa-grid">${cards}</div></div>`;
}
