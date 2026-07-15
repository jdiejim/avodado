/**
 * Renders a `stories` block — a collapsible backlog of user stories in a single
 * section. Each story is a native `<details>` accordion (no JavaScript), so it
 * stays self-contained: the summary shows the id/title, a one-line role→want,
 * and points/priority chips; expanding reveals the full story, acceptance
 * criteria, and links.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { refIdPart } from './refs.js';

type StoriesData = BlockDataMap['stories'];
type Story = StoriesData['items'][number];

function chip(cls: string, text: string): string {
  return `<span class="st-chip ${cls}">${escapeHtml(text)}</span>`;
}

function summaryLine(story: Story, i: number): string {
  const heading = story.title ?? story.want ?? story.role ?? 'Story';
  // The summary heading falls back title → want → role, so its path tracks
  // whichever field is actually displayed (untagged on the 'Story' fallback).
  const headingField =
    story.title !== undefined ? 'title' : story.want !== undefined ? 'want' : story.role !== undefined ? 'role' : undefined;
  const headingPath = headingField !== undefined ? bp(`items.${i}.${headingField}`) : '';
  const id =
    story.id !== undefined
      ? `<span class="st-id"${bp(`items.${i}.id`)}>${escapeHtml(story.id)}</span>`
      : '';
  const chips: string[] = [];
  if (story.points !== undefined) chips.push(chip('st-points', `${story.points} pts`));
  if (story.priority !== undefined) chips.push(chip('st-prio', story.priority));
  for (const t of story.tags ?? []) chips.push(chip('st-tag', t));
  const meta = chips.length > 0 ? `<span class="st-chips">${chips.join('')}</span>` : '';
  return (
    `<summary class="st-summary">` +
    `<span class="st-caret" aria-hidden="true"></span>` +
    `<span class="st-sum-main">${id}<span class="st-sum-title"${headingPath}>${escapeHtml(heading)}</span></span>` +
    meta +
    `</summary>`
  );
}

function storyNarrative(story: Story, i: number): string {
  if (story.role === undefined && story.want === undefined && story.soThat === undefined) return '';
  // Each value follows its bold keyword in flowing prose, so the value text
  // gets an inert span of its own to carry the path.
  const parts: string[] = [];
  if (story.role !== undefined)
    parts.push(`<b>As</b> <span${bp(`items.${i}.role`)}>${escapeHtml(story.role)}</span>`);
  if (story.want !== undefined)
    parts.push(`<b>I want</b> <span${bp(`items.${i}.want`)}>${escapeHtml(story.want)}</span>`);
  if (story.soThat !== undefined)
    parts.push(`<b>so that</b> <span${bp(`items.${i}.soThat`)}>${escapeHtml(story.soThat)}</span>`);
  return `<p class="st-narr">${parts.join(', ')}.</p>`;
}

function criteriaList(story: Story, i: number): string {
  const criteria = story.criteria ?? [];
  if (criteria.length === 0) return '';
  const rows = criteria
    .map((c, k) => {
      const segs: string[] = [];
      if (c.given !== undefined) segs.push(`<b>Given</b> ${escapeHtml(c.given)}`);
      if (c.when !== undefined) segs.push(`<b>when</b> ${escapeHtml(c.when)}`);
      if (c.then !== undefined) segs.push(`<b>then</b> ${escapeHtml(c.then)}`);
      return `<li${bp(`items.${i}.criteria.${k}`)}>${segs.join(', ')}.</li>`;
    })
    .join('');
  return `<div class="st-ac-label">Acceptance criteria</div><ul class="st-ac"${bl(`items.${i}.criteria`)}>${rows}</ul>`;
}

function linksRow(story: Story, i: number): string {
  const links = story.links ?? [];
  if (links.length === 0) return '';
  const chips = links
    .map((l, k) => {
      const label = l.label ?? l.ref ?? l.mode ?? 'link';
      // Ref-bearing links are real anchors; attribute order class → data-ref →
      // href is load-bearing for `avo build`'s cross-doc rewrite.
      if (l.ref !== undefined && l.ref !== '') {
        return `<a class="st-link" data-ref="${escapeHtml(l.ref)}" href="#${escapeHtml(refIdPart(l.ref))}"${bp(`items.${i}.links.${k}`)}>${escapeHtml(label)}</a>`;
      }
      return `<span class="st-link"${bp(`items.${i}.links.${k}`)}>${escapeHtml(label)}</span>`;
    })
    .join('');
  return `<div class="st-links"${bl(`items.${i}.links`)}>${chips}</div>`;
}

function renderStory(story: Story, i: number): string {
  const open = story.open === true ? ' open' : '';
  return (
    `<details class="st-item"${open}${bp(`items.${i}`)}>` +
    summaryLine(story, i) +
    `<div class="st-body">${storyNarrative(story, i)}${criteriaList(story, i)}${linksRow(story, i)}</div>` +
    `</details>`
  );
}

export function renderStories(data: StoriesData): string {
  const head = data.title !== undefined ? `<div class="st-head">${escapeHtml(data.title)}</div>` : '';
  const desc = data.description !== undefined ? `<p class="st-desc">${escapeHtml(data.description)}</p>` : '';
  const items = data.items.map((story, i) => renderStory(story, i)).join('');
  return `<div class="stories">${head}${desc}<div class="st-list"${bl('items')}>${items}</div></div>`;
}
