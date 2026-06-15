/**
 * Renders a userstory block — story statement, optional meta chips, optional
 * acceptance-criteria list, and optional related-links chips.
 *
 * Matches doc-studio's `.story` shell (`.story-stmt`, `.story-meta`,
 * `.story-chip`, `.ac-title`, `.ac-item`, `.gwt`, `.link-chip`).
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

export function renderUserStory(data: BlockDataMap['userstory']): string {
  const role = data.role ?? 'user';
  const want = data.want ?? '…';
  const soThat = data.soThat ?? '…';

  const chips: string[] = [];
  if (data.priority !== undefined)
    chips.push(`<span class="story-chip">Priority · ${escapeHtml(data.priority)}</span>`);
  if (data.points !== undefined && data.points !== null)
    chips.push(`<span class="story-chip">${escapeHtml(data.points)} pts</span>`);

  let h =
    `<div class="story">` +
    `<div class="story-stmt">As a <b>${escapeHtml(role)}</b>, I want to <b>${escapeHtml(want)}</b>, so that <b>${escapeHtml(soThat)}</b>.</div>`;
  if (chips.length > 0) {
    h += `<div class="story-meta">${chips.join('')}</div>`;
  }
  h += `</div>`;

  const crit = data.criteria ?? [];
  if (crit.length > 0) {
    h += `<div class="ac-title">Acceptance criteria</div>`;
    for (const c of crit) {
      h +=
        `<div class="ac-item"><div class="gwt">` +
        `<span class="k g">Given</span><span class="v">${escapeHtml(c.given ?? '')}</span>` +
        `<span class="k w">When</span><span class="v">${escapeHtml(c.when ?? '')}</span>` +
        `<span class="k t">Then</span><span class="v">${escapeHtml(c.then ?? '')}</span>` +
        `</div></div>`;
    }
  }

  const links = data.links ?? [];
  if (links.length > 0) {
    h += `<div class="ac-title">Related</div><div class="links-row">`;
    for (const l of links) {
      h +=
        `<span class="link-chip">` +
        `<span class="lt">${escapeHtml(l.mode ?? '')}</span>` +
        `${escapeHtml(l.label ?? '')}` +
        `</span>`;
    }
    h += `</div>`;
  }

  return h;
}
