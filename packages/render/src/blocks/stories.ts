/**
 * Renders a `stories` block — a collapsible backlog of user stories in a single
 * section. Each story is a native `<details>` accordion (no JavaScript), so it
 * stays self-contained: the summary shows the id/title, a one-line role→want,
 * and points/priority chips; expanding reveals the full story, acceptance
 * criteria, and links.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

type StoriesData = BlockDataMap['stories'];
type Story = StoriesData['items'][number];

function chip(cls: string, text: string): string {
  return `<span class="st-chip ${cls}">${escapeHtml(text)}</span>`;
}

function summaryLine(story: Story): string {
  const heading = story.title ?? story.want ?? story.role ?? 'Story';
  const id = story.id !== undefined ? `<span class="st-id">${escapeHtml(story.id)}</span>` : '';
  const chips: string[] = [];
  if (story.points !== undefined) chips.push(chip('st-points', `${story.points} pts`));
  if (story.priority !== undefined) chips.push(chip('st-prio', story.priority));
  for (const t of story.tags ?? []) chips.push(chip('st-tag', t));
  const meta = chips.length > 0 ? `<span class="st-chips">${chips.join('')}</span>` : '';
  return (
    `<summary class="st-summary">` +
    `<span class="st-caret" aria-hidden="true"></span>` +
    `<span class="st-sum-main">${id}<span class="st-sum-title">${escapeHtml(heading)}</span></span>` +
    meta +
    `</summary>`
  );
}

function storyNarrative(story: Story): string {
  if (story.role === undefined && story.want === undefined && story.soThat === undefined) return '';
  const parts: string[] = [];
  if (story.role !== undefined) parts.push(`<b>As</b> ${escapeHtml(story.role)}`);
  if (story.want !== undefined) parts.push(`<b>I want</b> ${escapeHtml(story.want)}`);
  if (story.soThat !== undefined) parts.push(`<b>so that</b> ${escapeHtml(story.soThat)}`);
  return `<p class="st-narr">${parts.join(', ')}.</p>`;
}

function criteriaList(story: Story): string {
  const criteria = story.criteria ?? [];
  if (criteria.length === 0) return '';
  const rows = criteria
    .map((c) => {
      const segs: string[] = [];
      if (c.given !== undefined) segs.push(`<b>Given</b> ${escapeHtml(c.given)}`);
      if (c.when !== undefined) segs.push(`<b>when</b> ${escapeHtml(c.when)}`);
      if (c.then !== undefined) segs.push(`<b>then</b> ${escapeHtml(c.then)}`);
      return `<li>${segs.join(', ')}.</li>`;
    })
    .join('');
  return `<div class="st-ac-label">Acceptance criteria</div><ul class="st-ac">${rows}</ul>`;
}

function linksRow(story: Story): string {
  const links = story.links ?? [];
  if (links.length === 0) return '';
  const chips = links
    .map((l) => {
      const label = l.label ?? l.ref ?? l.mode ?? 'link';
      return `<span class="st-link">${escapeHtml(label)}</span>`;
    })
    .join('');
  return `<div class="st-links">${chips}</div>`;
}

function renderStory(story: Story): string {
  const open = story.open === true ? ' open' : '';
  return (
    `<details class="st-item"${open}>` +
    summaryLine(story) +
    `<div class="st-body">${storyNarrative(story)}${criteriaList(story)}${linksRow(story)}</div>` +
    `</details>`
  );
}

export function renderStories(data: StoriesData): string {
  const head = data.title !== undefined ? `<div class="st-head">${escapeHtml(data.title)}</div>` : '';
  const desc = data.description !== undefined ? `<p class="st-desc">${escapeHtml(data.description)}</p>` : '';
  const items = data.items.map(renderStory).join('');
  return `<div class="stories">${head}${desc}<div class="st-list">${items}</div></div>`;
}
