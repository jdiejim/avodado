/**
 * Renders a `changelog` block — release history on a vertical rail. Each
 * release gets a dot on the rail (navy; red for a breaking release), a bold
 * mono version pill, an optional date and tag chip, then one row per change
 * with a coloured keep-a-changelog type chip (ADDED green, CHANGED blue,
 * FIXED amber, REMOVED gray, SECURITY red). Untyped items get no chip.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

type ChangelogData = BlockDataMap['changelog'];
type Release = ChangelogData['releases'][number];
type Item = Release['items'][number];

function renderItem(item: Item, path: string): string {
  const chip =
    item.type !== undefined
      ? `<span class="cg-type cg-t-${item.type}"${bp(`${path}.type`)}>${escapeHtml(item.type)}</span>`
      : '';
  return (
    `<div class="cg-item"${bp(path)}>` +
    chip +
    `<span class="cg-text"${bp(`${path}.text`)}>${escapeHtml(item.text)}</span>` +
    `</div>`
  );
}

function renderRelease(rel: Release, ri: number): string {
  const breaking = rel.tag === 'breaking';
  const date =
    rel.date !== undefined
      ? `<span class="cg-date"${bp(`releases.${ri}.date`)}>${escapeHtml(rel.date)}</span>`
      : '';
  const tag =
    rel.tag !== undefined
      ? `<span class="cg-tag cg-tag-${rel.tag}"${bp(`releases.${ri}.tag`)}>${escapeHtml(rel.tag)}</span>`
      : '';
  const items = rel.items.map((item, k) => renderItem(item, `releases.${ri}.items.${k}`)).join('');
  return (
    `<div class="cg-release"${bp(`releases.${ri}`)}>` +
    `<span class="cg-dot${breaking ? ' cg-dot-breaking' : ''}"></span>` +
    `<div class="cg-rel-head">` +
    `<span class="cg-version${breaking ? ' cg-v-breaking' : ''}"${bp(`releases.${ri}.version`)}>${escapeHtml(rel.version)}</span>` +
    date +
    tag +
    `</div>` +
    `<div class="cg-items"${bl(`releases.${ri}.items`)}>${items}</div>` +
    `</div>`
  );
}

export function renderChangelog(data: ChangelogData): string {
  const head =
    data.title !== undefined ? `<div class="cg-head">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined
      ? `<p class="cg-desc">${escapeHtml(data.description)}</p>`
      : '';
  const releases = data.releases.map((rel, ri) => renderRelease(rel, ri)).join('');
  return `<div class="changelog">${head}${desc}<div class="cg-rail"${bl('releases')}>${releases}</div></div>`;
}
