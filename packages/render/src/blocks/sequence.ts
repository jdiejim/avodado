/**
 * Renders a sequence diagram as inline SVG, plus an optional step-by-step
 * list below the SVG and an optional diagram footer with metadata pills.
 *
 * Matches the layout of `resources/sample-orders-api.html` (the canonical
 * "rich" rendering).
 *
 * Actors are objects (`{id, name, sub?, external?}`); messages reference
 * actors by `id`. Message `kind`:
 * - `sync` — solid arrow, bold navy label (default)
 * - `response` / `async` — dashed arrow, normal label
 * - `error` — red arrow, red bold label, step list item gets `.err`
 * - `note` — no arrow, italic gray label, badge on the from-actor's lane
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { diagramFrame } from './frame.js';

type MsgKind = 'sync' | 'response' | 'async' | 'error' | 'note';

interface KindStyle {
  readonly cls: string;
  readonly marker: 'sqArrow' | 'sqOpen' | 'sqErr' | null;
  readonly txt: string;
}

const KIND: Record<MsgKind, KindStyle> = {
  sync: { cls: 'msg-line', marker: 'sqArrow', txt: 'msg-text em' },
  response: { cls: 'msg-line dashed', marker: 'sqOpen', txt: 'msg-text' },
  async: { cls: 'msg-line dashed', marker: 'sqOpen', txt: 'msg-text' },
  error: { cls: 'msg-line err', marker: 'sqErr', txt: 'msg-text err' },
  note: { cls: '', marker: null, txt: 'msg-text note' },
};

const DB_PATTERN = /postgres|sql|\bdb\b|database|store/i;

function renderStepList(
  rows: ReadonlyArray<{ kind: MsgKind; from: string; to: string; summary?: string; code?: string; note?: string }>,
  actorById: Map<string, { name: string }>,
): string {
  const items = rows.filter((r) => r.summary !== undefined && r.summary.length > 0);
  if (items.length === 0) return '';

  const lis = items
    .map((r) => {
      const errCls = r.kind === 'error' ? ' class="err"' : '';
      const actorErrCls = r.kind === 'error' ? ' err' : '';
      const fromName = actorById.get(r.from)?.name ?? r.from;
      const toName = r.kind === 'note' ? '' : ` &rarr; ${escapeHtml(actorById.get(r.to)?.name ?? r.to)}`;
      const actorLabel = `${escapeHtml(fromName)}${toName}`;
      const code =
        r.code !== undefined && r.code.length > 0
          ? `<pre class="sql">${escapeHtml(r.code)}</pre>`
          : '';
      const note =
        r.note !== undefined && r.note.length > 0
          ? `<span class="step-note">${escapeHtml(r.note)}</span>`
          : '';
      return (
        `<li${errCls}>` +
        `<span class="step-actor${actorErrCls}">${actorLabel}</span>` +
        `<span class="step-summary">${escapeHtml(r.summary ?? '')}</span>` +
        code +
        note +
        `</li>`
      );
    })
    .join('');

  return (
    `<div class="seq-steps">` +
    `<div class="seq-steps-title">Step-by-step</div>` +
    `<ol>${lis}</ol>` +
    `</div>`
  );
}

function renderFoot(foot: NonNullable<BlockDataMap['sequence']['foot']>): string {
  if (foot.length === 0) return '';
  const parts = foot
    .map((f) => `<span><strong>${escapeHtml(f.label)}:</strong> ${escapeHtml(f.value)}</span>`)
    .join('');
  return `<div class="diagram-foot">${parts}</div>`;
}

export function renderSequence(data: BlockDataMap['sequence']): string {
  const actors = data.actors ?? [];
  const messages = data.messages ?? [];
  const N = Math.max(actors.length, 1);
  const leftPad = 24;
  const laneW = 168;
  const gap = 58;
  const headY = 16;
  const headH = 42;
  const cx = (i: number): number => leftPad + laneW / 2 + i * (laneW + gap);
  const width = leftPad * 2 + N * laneW + (N - 1) * gap;
  const idx = (id: string): number => actors.findIndex((a) => a.id === id);
  const msgStartY = 92;
  const step = 42;

  type Row = {
    n: number;
    y: number;
    fromI: number;
    toI: number;
    kind: MsgKind;
    label: string;
    from: string;
    to: string;
    summary?: string;
    code?: string;
    note?: string;
  };
  const rows: Row[] = messages.map((m, k): Row => {
    const base: Row = {
      n: k + 1,
      y: msgStartY + k * step,
      fromI: idx(m.from),
      toI: idx(m.to),
      kind: (m.kind ?? 'sync') as MsgKind,
      label: m.label ?? '',
      from: m.from,
      to: m.to,
    };
    if (m.summary !== undefined) base.summary = m.summary;
    if (m.code !== undefined) base.code = m.code;
    if (m.note !== undefined) base.note = m.note;
    return base;
  });
  const bottom = msgStartY + messages.length * step + 12;
  const height = bottom + 6;

  const activations = actors.map((a, i) => {
    if (i === 0) return null;
    const ys = rows.filter((r) => r.fromI === i || r.toI === i).map((r) => r.y);
    if (ys.length === 0) return null;
    const db = DB_PATTERN.test(`${a.name} ${a.sub ?? ''}`);
    return { i, y1: Math.min(...ys) - 8, y2: Math.max(...ys) + 8, db };
  });

  let s =
    `<svg viewBox="0 0 ${width} ${height}" role="img">` +
    `<title>Sequence diagram</title>` +
    `<defs>` +
    `<marker id="sqArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">` +
    `<path d="M0,0 L10,5 L0,10 z" fill="#1a1a2e"/></marker>` +
    `<marker id="sqOpen" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">` +
    `<path d="M0,0 L10,5 L0,10" fill="none" stroke="#1a1a2e" stroke-width="1.2"/></marker>` +
    `<marker id="sqErr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">` +
    `<path d="M0,0 L10,5 L0,10 z" fill="#991b1b"/></marker>` +
    `</defs>`;

  for (let i = 0; i < actors.length; i++) {
    const x = cx(i);
    s += `<line x1="${x}" y1="${headY + headH}" x2="${x}" y2="${bottom}" class="lifeline"/>`;
  }

  for (const ac of activations) {
    if (!ac) continue;
    s += `<rect x="${cx(ac.i) - 4}" y="${ac.y1}" width="8" height="${ac.y2 - ac.y1}" class="activation${ac.db ? ' pg' : ''}"/>`;
  }

  actors.forEach((a, i) => {
    const extCls = a.external === true ? ' ext' : '';
    const sub =
      a.sub !== undefined
        ? `<text x="${cx(i)}" y="${headY + 36}" class="lane-head-sub${extCls}">${escapeHtml(a.sub)}</text>`
        : '';
    s +=
      `<g>` +
      `<rect x="${cx(i) - laneW / 2}" y="${headY}" width="${laneW}" height="${headH}" class="lane-head${extCls}"/>` +
      `<text x="${cx(i)}" y="${headY + 22}" class="lane-head-text">${escapeHtml(a.name)}</text>` +
      sub +
      `</g>`;
  });

  for (const r of rows) {
    const k = KIND[r.kind];

    // `note` kind — just a numbered annotation at the from-actor's lane
    if (r.kind === 'note' || r.toI < 0) {
      if (r.fromI < 0) continue;
      const x = cx(r.fromI);
      s +=
        `<g>` +
        `<circle cx="${x + 18}" cy="${r.y - 10}" r="10" class="step-badge"/>` +
        `<text x="${x + 18}" y="${r.y - 6.5}" class="step-badge-text">${r.n}</text>` +
        `<text x="${x + 34}" y="${r.y - 6}" class="msg-text note">${escapeHtml(r.label)}</text>` +
        `</g>`;
      continue;
    }
    // self-message — loop back to the same lane
    if (r.fromI === r.toI) {
      const x = cx(r.fromI);
      const errCls = r.kind === 'error' ? ' err' : '';
      s +=
        `<g>` +
        `<circle cx="${x + 18}" cy="${r.y - 10}" r="10" class="step-badge${errCls}"/>` +
        `<text x="${x + 18}" y="${r.y - 6.5}" class="step-badge-text">${r.n}</text>` +
        `<text x="${x + 34}" y="${r.y - 6}" class="msg-text note">${escapeHtml(r.label)}</text>` +
        `</g>`;
      continue;
    }

    const x1 = cx(r.fromI);
    const x2 = cx(r.toI);
    const ltr = x2 > x1;
    const end = x2 + (ltr ? -3 : 3);
    const errBadge = r.kind === 'error' ? ' err' : '';
    // Badge sits just inside the from-lane on the side facing the target.
    const badgeX = ltr ? x1 + 18 : x1 - 18;
    // Label anchors next to the badge (start-aligned LTR, end-aligned RTL).
    // Matches the sample's `<text x="badgeX+18" ... >` / `<text x="badgeX-18" ... text-anchor="end">` layout.
    const labelX = ltr ? badgeX + 16 : badgeX - 16;
    const labelAnchor = ltr ? 'start' : 'end';
    const markerAttr = k.marker !== null ? ` marker-end="url(#${k.marker})"` : '';
    s +=
      `<line x1="${x1}" y1="${r.y}" x2="${end}" y2="${r.y}" class="${k.cls}"${markerAttr}/>` +
      `<circle cx="${badgeX}" cy="${r.y - 10}" r="10" class="step-badge${errBadge}"/>` +
      `<text x="${badgeX}" y="${r.y - 6.5}" class="step-badge-text">${r.n}</text>` +
      `<text x="${labelX}" y="${r.y - 6}" class="${k.txt}" text-anchor="${labelAnchor}">${escapeHtml(r.label)}</text>`;
  }

  s += `</svg>`;

  const actorById = new Map<string, { name: string }>();
  for (const a of actors) actorById.set(a.id, { name: a.name });
  const stepList = renderStepList(rows, actorById);
  const footHtml = data.foot !== undefined ? renderFoot(data.foot) : '';

  // Tag + title
  const method = data.endpoint?.method.toLowerCase();
  const tag = data.endpoint?.method ?? 'FLOW';
  const titleHtml = (() => {
    if (data.endpoint?.path !== undefined) {
      const t = data.title !== undefined ? ` &mdash; ${escapeHtml(data.title)}` : '';
      return `<code>${escapeHtml(data.endpoint.path)}</code>${t}`;
    }
    return data.title !== undefined ? escapeHtml(data.title) : '';
  })();

  const frameOpts: Parameters<typeof diagramFrame>[0] = {
    tag,
    ...(method !== undefined ? { tagClass: method } : { tagBg: '#374151' }),
    ...(titleHtml.length > 0 ? { titleHtml } : {}),
    ...(data.description !== undefined ? { desc: data.description } : {}),
    ...(footHtml.length > 0 ? { footerHtml: footHtml } : {}),
  };

  return diagramFrame(frameOpts, s + stepList);
}
