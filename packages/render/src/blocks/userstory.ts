/**
 * Renders a userstory block — story statement, optional meta chips, optional
 * acceptance-criteria list, and optional related-links chips.
 *
 * Matches doc-studio's `.story` shell (`.story-stmt`, `.story-meta`,
 * `.story-chip`, `.ac-title`, `.ac-item`, `.gwt`, `.link-chip`).
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { refIdPart } from './refs.js';

export function renderUserStory(data: BlockDataMap['userstory']): string {
  const role = data.role ?? 'user';
  const want = data.want ?? '…';
  const soThat = data.soThat ?? '…';

  // Optional header: title on the left, tags + points + priority as badges.
  const headBits: string[] = [];
  if (data.title !== undefined)
    headBits.push(`<span class="story-title"${bp('title')}>${escapeHtml(data.title)}</span>`);
  (data.tags ?? []).forEach((t, i) =>
    headBits.push(`<span class="story-chip"${bp(`tags.${i}`)}>${escapeHtml(t)}</span>`),
  );
  if (data.points !== undefined && data.points !== null)
    headBits.push(`<span class="story-chip pts"${bp('points')}>${escapeHtml(data.points)} pts</span>`);
  if (data.priority !== undefined)
    headBits.push(`<span class="story-chip"${bp('priority')}>Priority · ${escapeHtml(data.priority)}</span>`);

  let h = `<div class="story">`;
  if (headBits.length > 0) h += `<div class="story-head">${headBits.join('')}</div>`;
  h += `<div class="story-stmt">As a <b${bp('role')}>${escapeHtml(role)}</b>, I want to <b${bp('want')}>${escapeHtml(want)}</b>, so that <b${bp('soThat')}>${escapeHtml(soThat)}</b>.</div>`;
  h += `</div>`;

  const crit = data.criteria ?? [];
  if (crit.length > 0) {
    h += `<div class="ac-title">Acceptance criteria</div>`;
    crit.forEach((c, i) => {
      h +=
        `<div class="ac-item"${bp(`criteria.${i}`)}><div class="gwt">` +
        `<span class="k g">Given</span><span class="v"${bp(`criteria.${i}.given`)}>${escapeHtml(c.given ?? '')}</span>` +
        `<span class="k w">When</span><span class="v"${bp(`criteria.${i}.when`)}>${escapeHtml(c.when ?? '')}</span>` +
        `<span class="k t">Then</span><span class="v"${bp(`criteria.${i}.then`)}>${escapeHtml(c.then ?? '')}</span>` +
        `</div></div>`;
    });
  }

  const links = data.links ?? [];
  if (links.length > 0) {
    h += `<div class="ac-title">Related</div><div class="links-row"${bl('links')}>`;
    links.forEach((l, i) => {
      const inner =
        `<span class="lt">${escapeHtml(l.mode ?? '')}</span>` + `${escapeHtml(l.label ?? '')}`;
      // A link WITH a ref is a real anchor (`#id` resolves same-doc; `avo build`
      // rewrites cross-doc hrefs via data-ref). Attribute order class → data-ref
      // → href is load-bearing for that rewrite. Label-only links stay chips.
      h +=
        l.ref !== undefined && l.ref !== ''
          ? `<a class="link-chip" data-ref="${escapeHtml(l.ref)}" href="#${escapeHtml(refIdPart(l.ref))}"${bp(`links.${i}`)}>${inner}</a>`
          : `<span class="link-chip"${bp(`links.${i}`)}>${inner}</span>`;
    });
    h += `</div>`;
  }

  return h;
}
