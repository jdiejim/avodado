/**
 * Renders a `checklist` block — pass / fail items with the evidence behind
 * each. Items sit flat (`items`) or under group headings (`groups`); every
 * item is one row: a verdict chip (glyph + word), the item text, the
 * evidence in mono, the note, and a ref. The footer derives the counts and
 * the pass rate over the items that apply — `na` is excluded, `partial`
 * counts as half a pass, `pending` counts against.
 *
 * Skin (`DESIGN.md`): pass is ink on `paper-2` with a ✓, fail is `negative`
 * with a ✗, partial takes the accent (the author's marks — what still needs
 * work), pending and n/a are soft outlines. The terse `[pass] item — evidence`
 * form is expanded by core before the data reaches this renderer.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

type ChecklistData = BlockDataMap['checklist'];
type Item = NonNullable<ChecklistData['items']>[number];
type Status = Item['status'];

const GLYPH: Record<Status, string> = { pass: '✓', fail: '✗', partial: '◐', na: '—', pending: '○' };
const WORD: Record<Status, string> = { pass: 'pass', fail: 'fail', partial: 'partial', na: 'n/a', pending: 'pending' };

/** The derived footer numbers. `rate` is null when no item applies. */
export interface ChecklistTotals {
  readonly pass: number;
  readonly fail: number;
  readonly partial: number;
  readonly pending: number;
  readonly na: number;
  /** pass + ½ partial over pass + fail + partial + pending, as a 0–100 percentage; null when nothing applies. */
  readonly rate: number | null;
}

export function checklistTotals(items: readonly Item[]): ChecklistTotals {
  const n = { pass: 0, fail: 0, partial: 0, pending: 0, na: 0 };
  for (const it of items) n[it.status] += 1;
  const applies = n.pass + n.fail + n.partial + n.pending;
  const rate = applies === 0 ? null : ((n.pass + n.partial / 2) / applies) * 100;
  return { ...n, rate };
}

function renderItem(it: Item, path: string): string {
  const evidence =
    it.evidence !== undefined ? `<span class="cl-evidence"${bp(`${path}.evidence`)}>${escapeHtml(it.evidence)}</span>` : '';
  const note = it.note !== undefined ? `<span class="cl-note"${bp(`${path}.note`)}>${escapeHtml(it.note)}</span>` : '';
  const ref = it.ref !== undefined ? `<span class="cl-ref"${bp(`${path}.ref`)}>${escapeHtml(it.ref)}</span>` : '';
  return (
    `<div class="cl-item cl-s-${it.status}"${bp(path)}>` +
    `<span class="cl-verdict cl-v-${it.status}"${bp(`${path}.status`)}><span class="cl-glyph" aria-hidden="true">${GLYPH[it.status]}</span>${WORD[it.status]}</span>` +
    `<div class="cl-body"><span class="cl-text"${bp(`${path}.item`)}>${escapeHtml(it.item)}</span>${evidence}${note}${ref}</div>` +
    `</div>`
  );
}

export function renderChecklist(data: ChecklistData): string {
  const flat = data.items ?? [];
  const groups = data.groups ?? [];
  const all: Item[] = [...flat, ...groups.flatMap((g) => g.items)];

  const head =
    data.title !== undefined || data.standard !== undefined
      ? `<div class="cl-head">` +
        (data.title !== undefined ? `<span class="cl-title"${bp('title')}>${escapeHtml(data.title)}</span>` : '') +
        (data.standard !== undefined ? `<span class="cl-standard"${bp('standard')}>${escapeHtml(data.standard)}</span>` : '') +
        `</div>`
      : '';
  const desc = data.description !== undefined ? `<p class="cl-desc"${bp('description')}>${escapeHtml(data.description)}</p>` : '';

  let body = '';
  if (flat.length > 0) body += `<div class="cl-items"${bl('items')}>${flat.map((it, i) => renderItem(it, `items.${i}`)).join('')}</div>`;
  if (groups.length > 0) {
    body += `<div class="cl-groups"${bl('groups')}>`;
    groups.forEach((g, gi) => {
      body +=
        `<div class="cl-group"${bp(`groups.${gi}`)}>` +
        `<div class="cl-group-label t-eyebrow"${bp(`groups.${gi}.label`)}>${escapeHtml(g.label)}</div>` +
        `<div class="cl-items"${bl(`groups.${gi}.items`)}>${g.items.map((it, i) => renderItem(it, `groups.${gi}.items.${i}`)).join('')}</div>` +
        `</div>`;
    });
    body += `</div>`;
  }

  const t = checklistTotals(all);
  const parts: string[] = [`${t.pass} pass`, `${t.fail} fail`];
  if (t.partial > 0) parts.push(`${t.partial} partial`);
  if (t.pending > 0) parts.push(`${t.pending} pending`);
  if (t.na > 0) parts.push(`${t.na} n/a`);
  const rate = t.rate === null ? '—' : `${Math.round(t.rate)}%`;
  const foot =
    all.length > 0
      ? `<div class="cl-foot"><span class="cl-counts">${parts.join(' · ')}</span><span class="cl-rate">pass rate <b>${rate}</b></span></div>`
      : '';

  return `<div class="checklist">${head}${desc}${body}${foot}</div>`;
}
