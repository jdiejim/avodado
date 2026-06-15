/**
 * Renders a state machine: rounded state pills + start/terminal markers + an
 * orthogonal-routed edge per transition, plus a transition table below.
 *
 * Ported from doc-studio.jsx `StateMachine` + `TransitionTable`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { ortho } from '../svg/ortho.js';
import { edgePill } from '../svg/edgePill.js';
import { diagramFrame } from './frame.js';

type StateNode = NonNullable<BlockDataMap['state']['states']>[number];

function rectFor(s: StateNode, cellW: number, cellH: number, gapX: number, gapY: number, padX: number, padTop: number): {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
} {
  const cx = padX + (s.col - 1) * (cellW + gapX) + cellW / 2;
  const cy = padTop + (s.row - 1) * (cellH + gapY) + cellH / 2;
  if (s.kind === 'start' || s.kind === 'terminal') {
    return { x: cx - 13, y: cy - 13, w: 26, h: 26, cx, cy };
  }
  const pw = Math.max(96, (s.name ?? '').length * 8 + 26);
  const ph = 46;
  return { x: cx - pw / 2, y: cy - ph / 2, w: pw, h: ph, cx, cy };
}

function pillCls(kind: StateNode['kind']): string {
  if (kind === 'terminal') return 'pill pill-end';
  if (kind === 'wait') return 'pill pill-wait';
  if (kind === 'start') return 'pill pill-init';
  return 'pill pill-active';
}

export function renderState(data: BlockDataMap['state']): string {
  const states = data.states ?? [];
  const trans = data.transitions ?? [];
  const cellW = 168;
  const cellH = 64;
  const gapX = 74;
  const gapY = 60;
  const padX = 30;
  const padTop = 30;
  const padBot = 20;
  const cols = Math.max(1, ...states.map((s) => s.col));
  const rows = Math.max(1, ...states.map((s) => s.row));
  const width = padX * 2 + cols * cellW + (cols - 1) * gapX;
  const height = padTop * 2 + rows * cellH + (rows - 1) * gapY + padBot;
  const byId = new Map(states.map((s) => [s.id, s]));

  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"><title>State machine</title>`;

  // edges first
  for (const t of trans) {
    const A = byId.get(t.from);
    const B = byId.get(t.to);
    if (!A || !B) continue;
    const label = t.event + (t.guard !== undefined ? ` ${t.guard}` : '');
    if (t.from === t.to) {
      const r = rectFor(A, cellW, cellH, gapX, gapY, padX, padTop);
      s +=
        `<g><path d="M ${r.cx - 12} ${r.y} C ${r.cx - 30} ${r.y - 32}, ${r.cx + 30} ${r.y - 32}, ${r.cx + 12} ${r.y}" fill="none" stroke="#1a1a2e" stroke-width="1.3" marker-end="url(#gArrow)"/>` +
        edgePill({ lx: r.cx, ly: r.y - 28 }, label) +
        `</g>`;
      continue;
    }
    const p = ortho(
      rectFor(A, cellW, cellH, gapX, gapY, padX, padTop),
      rectFor(B, cellW, cellH, gapX, gapY, padX, padTop),
    );
    s +=
      `<g><path d="${p.d}" fill="none" stroke="#1a1a2e" stroke-width="1.3" marker-end="url(#gArrow)"/>` +
      edgePill(p, label) +
      `</g>`;
  }

  // states
  for (const st of states) {
    const r = rectFor(st, cellW, cellH, gapX, gapY, padX, padTop);
    if (st.kind === 'start') {
      s += `<circle cx="${r.cx}" cy="${r.cy}" r="10" fill="#1a1a2e"/>`;
    } else if (st.kind === 'terminal') {
      s +=
        `<g>` +
        `<circle cx="${r.cx}" cy="${r.cy}" r="12" fill="#fff" stroke="#1a1a2e" stroke-width="1.5"/>` +
        `<circle cx="${r.cx}" cy="${r.cy}" r="6" fill="#1a1a2e"/>` +
        `</g>`;
    } else {
      const fill = st.kind === 'wait' ? '#fde7cd' : '#dcf1e2';
      const stroke = st.kind === 'wait' ? '#f7952c' : '#1f9747';
      s +=
        `<g filter="url(#gshadow)">` +
        `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="23" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>` +
        `<text x="${r.cx}" y="${r.cy + 4.5}" class="sm-name" fill="#1a1a2e">${escapeHtml(st.name ?? '')}</text>` +
        `</g>`;
    }
  }

  s += `</svg>`;

  // transition table
  const name = (id: string): string => byId.get(id)?.name ?? id;
  const rows2 = trans
    .map(
      (t) =>
        `<tr>` +
        `<td><span class="${pillCls(byId.get(t.from)?.kind)}">${escapeHtml(name(t.from))}</span></td>` +
        `<td style="font-family:var(--font-mono);font-size:11px">${escapeHtml(t.event)}</td>` +
        `<td style="color:#6b7280;font-size:11px">${escapeHtml(t.guard ?? '—')}</td>` +
        `<td><span class="${pillCls(byId.get(t.to)?.kind)}">${escapeHtml(name(t.to))}</span></td>` +
        `</tr>`,
    )
    .join('');
  const table =
    trans.length > 0
      ? `<table class="transition-table">` +
        `<thead><tr><th>From</th><th>Event</th><th>Guard</th><th>To</th></tr></thead>` +
        `<tbody>${rows2}</tbody></table>`
      : '';

  return diagramFrame(
    {
      tag: 'STATE',
      tagBg: '#6b21a8',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    s + table,
  );
}
