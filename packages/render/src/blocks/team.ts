/**
 * Renders a `team` block — compact people cards on a responsive grid
 * (3 columns → 2 → 1). Each card: a circular initials avatar (explicit
 * `initials` or derived from the name, accent background), the name, an
 * uppercase role kicker, and an optional focus line. Quiet and professional.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { initialsFor } from './persona.js';

type TeamData = BlockDataMap['team'];
type Member = TeamData['members'][number];

function renderMember(m: Member): string {
  const accent = m.accent !== undefined ? ` tem-${m.accent}` : '';
  const initials = m.initials !== undefined && m.initials.length > 0 ? m.initials : initialsFor(m.name);
  const role = m.role !== undefined ? `<div class="tem-role">${escapeHtml(m.role)}</div>` : '';
  const focus = m.focus !== undefined ? `<div class="tem-focus">${escapeHtml(m.focus)}</div>` : '';
  return (
    `<div class="tem-card${accent}">` +
    `<span class="tem-avatar">${escapeHtml(initials)}</span>` +
    `<div class="tem-name">${escapeHtml(m.name)}</div>` +
    role +
    focus +
    `</div>`
  );
}

export function renderTeam(data: TeamData): string {
  const head =
    data.title !== undefined ? `<div class="tem-head">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined
      ? `<p class="tem-desc">${escapeHtml(data.description)}</p>`
      : '';
  const members = data.members.map(renderMember).join('');
  return `<div class="team">${head}${desc}<div class="tem-grid">${members}</div></div>`;
}
