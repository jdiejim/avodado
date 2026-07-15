/**
 * Renders a `persona` block — user persona cards on a responsive 2-column
 * grid (1 column on mobile). Each card: a circular initials avatar (accent
 * background), name + role, an italic quote with a left accent bar, then
 * compact labelled lists — GOALS (positive markers), FRUSTRATIONS (negative
 * markers) — and TOOLS as small mono chips. Sections with no data are omitted.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

type PersonaData = BlockDataMap['persona'];
type Persona = PersonaData['personas'][number];

/** Derives a 2-letter monogram from a name (first letters of first 2 words). */
export function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => w.length > 0);
  const first = words[0]?.charAt(0) ?? '';
  const second = words.length > 1 ? (words[words.length - 1]?.charAt(0) ?? '') : (words[0]?.charAt(1) ?? '');
  return `${first}${second}`.toUpperCase();
}

function renderList(
  label: string,
  kind: string,
  path: string,
  items: readonly string[] | undefined,
): string {
  if (items === undefined || items.length === 0) return '';
  const lis = items
    .map((it, i) => `<li class="pa-li"${bp(`${path}.${i}`)}>${escapeHtml(it)}</li>`)
    .join('');
  return (
    `<div class="pa-section ${kind}">` +
    `<div class="pa-sec-label">${escapeHtml(label)}</div>` +
    `<ul class="pa-list"${bl(path)}>${lis}</ul>` +
    `</div>`
  );
}

function renderTools(path: string, tools: readonly string[] | undefined): string {
  if (tools === undefined || tools.length === 0) return '';
  const chips = tools
    .map((t, i) => `<span class="pa-tool"${bp(`${path}.${i}`)}>${escapeHtml(t)}</span>`)
    .join('');
  return (
    `<div class="pa-section">` +
    `<div class="pa-sec-label">Tools</div>` +
    `<div class="pa-tools"${bl(path)}>${chips}</div>` +
    `</div>`
  );
}

function renderCard(p: Persona, i: number): string {
  const accent = p.accent !== undefined ? ` pa-${p.accent}` : '';
  const role =
    p.role !== undefined
      ? `<div class="pa-role"${bp(`personas.${i}.role`)}>${escapeHtml(p.role)}</div>`
      : '';
  const quote =
    p.quote !== undefined
      ? `<blockquote class="pa-quote"${bp(`personas.${i}.quote`)}>${escapeHtml(p.quote)}</blockquote>`
      : '';
  return (
    `<div class="pa-card${accent}"${bp(`personas.${i}`)}>` +
    `<div class="pa-id">` +
    `<span class="pa-avatar">${escapeHtml(initialsFor(p.name))}</span>` +
    `<div class="pa-who">` +
    `<div class="pa-name"${bp(`personas.${i}.name`)}>${escapeHtml(p.name)}</div>` +
    role +
    `</div>` +
    `</div>` +
    quote +
    renderList('Goals', 'pa-goals', `personas.${i}.goals`, p.goals) +
    renderList('Frustrations', 'pa-frustrations', `personas.${i}.frustrations`, p.frustrations) +
    renderTools(`personas.${i}.tools`, p.tools) +
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
  const cards = data.personas.map((p, i) => renderCard(p, i)).join('');
  return `<div class="persona">${head}${desc}<div class="pa-grid"${bl('personas')}>${cards}</div></div>`;
}
