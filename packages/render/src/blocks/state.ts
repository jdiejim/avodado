/**
 * Renders a state machine: rounded state pills + start/terminal markers + an
 * orthogonal-routed edge per transition, plus a transition table below.
 *
 * Ported from doc-studio.jsx `StateMachine` + `TransitionTable`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { edgeLanes, ortho } from '../svg/ortho.js';
import { wrapText } from '../svg/wrapText.js';
import { edgePill } from '../svg/edgePill.js';
import { edgeStep } from '../svg/edgeSteps.js';
import { GROUP_PADS, gridGroupsSvg, groupExtent } from '../svg/gridGroups.js';
import { gridMetaAttrs, nodeCellAttrs } from '../svg/gridMeta.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';
import { ensureGrid } from './autoLayout.js';

type StateNode = NonNullable<BlockDataMap['state']['states']>[number];

// Long state names wrap (word-aware, ≤3 lines of ~23 chars) so a pill can
// never grow past its grid cell and overlap a neighbour; the pill gains 15px
// of height per extra line instead.
function nameLines(s: StateNode): string[] {
  return wrapText(s.name ?? '', 23, 3);
}

function rectFor(s: StateNode & { col: number; row: number }, cellW: number, cellH: number, gapX: number, gapY: number, padX: number, padTop: number): {
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
  const lines = nameLines(s);
  const longest = Math.max(0, ...lines.map((ln) => ln.length));
  const pw = Math.max(96, Math.min(longest * 8 + 26, cellW + gapX - 26));
  const ph = 46 + (Math.max(1, lines.length) - 1) * 15;
  return { x: cx - pw / 2, y: cy - ph / 2, w: pw, h: ph, cx, cy };
}

function pillCls(kind: StateNode['kind']): string {
  if (kind === 'terminal') return 'pill pill-end';
  if (kind === 'wait') return 'pill pill-wait';
  if (kind === 'start') return 'pill pill-init';
  return 'pill pill-active';
}

export function renderState(data: BlockDataMap['state']): string {
  const trans = data.transitions ?? [];
  const rawStates = data.states ?? [];
  const quick = !(rawStates.length > 0 && rawStates.every((n) => n.col !== undefined && n.row !== undefined));
  const states = ensureGrid(rawStates, trans, 'LR');
  const cellW = 168;
  const cellH = 64;
  const gapX = 74;
  const gapY = 60;
  const groups = data.groups ?? [];
  // Group outlines overshoot their cells (label headroom): grow the padding
  // to fit them ONLY when groups exist, so group-less docs stay byte-identical.
  const padX = groups.length > 0 ? GROUP_PADS.padX : 30;
  const padTop = groups.length > 0 ? GROUP_PADS.padTop : 30;
  const padBot = groups.length > 0 ? GROUP_PADS.padBot : 20;
  const gx = groupExtent(groups);
  const cols = Math.max(1, ...states.map((s) => s.col), gx.cols);
  const rows = Math.max(1, ...states.map((s) => s.row), gx.rows);
  const width = padX * 2 + cols * cellW + (cols - 1) * gapX;
  const height = padTop * 2 + rows * cellH + (rows - 1) * gapY + padBot;
  const byId = new Map(states.map((s) => [s.id, s]));

  // Grid metadata for editors (Avodado Studio drag-to-connect): inert attrs
  // mirroring the layout constants plus each state's effective cell below.
  const gridMeta = gridMetaAttrs({ quick, cols, rows, cellW, cellH, gapX, gapY, padX, padTop });
  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"${gridMeta}><title>State machine</title>`;

  // Dashed group zones — beneath transitions and states. Only emitted when
  // present, keeping group-less documents byte-identical to the old output.
  if (groups.length > 0) {
    const xOf = (c: number): number => padX + (c - 1) * (cellW + gapX);
    const yOf = (r: number): number => padTop + (r - 1) * (cellH + gapY);
    s += gridGroupsSvg(groups, { xOf, yOf, cellW, cellH, gapX, gapY });
  }

  // The shared labelled-edge rule, with a twist: the state block already has a
  // transition table below the diagram, so at 4+ labelled transitions the
  // numerals refer to the TABLE rows (which gain a matching № column) instead
  // of a second step legend.
  const numbered = trans.length >= 4;

  // edge lines first; collect labels to draw last (on top of everything)
  const labels: string[] = [];
  const lanes = edgeLanes(trans);
  trans.forEach((t, ti) => {
    const A = byId.get(t.from);
    const B = byId.get(t.to);
    if (!A || !B) return;
    const label = t.event + (t.guard !== undefined ? ` ${t.guard}` : '');
    if (t.from === t.to) {
      const r = rectFor(A, cellW, cellH, gapX, gapY, padX, padTop);
      s += `<path d="M ${r.cx - 12} ${r.y} C ${r.cx - 30} ${r.y - 32}, ${r.cx + 30} ${r.y - 32}, ${r.cx + 12} ${r.y}" fill="none" stroke="var(--charcoal)" stroke-width="1.3" marker-end="url(#gArrow)"${bp(`transitions.${ti}`)}/>`;
      const mark = numbered ? edgeStep({ lx: r.cx, ly: r.y - 28 }, ti + 1) : edgePill({ lx: r.cx, ly: r.y - 28 }, label);
      labels.push(`<g${bp(`transitions.${ti}`)}>${mark}</g>`);
      return;
    }
    const p = ortho(
      rectFor(A, cellW, cellH, gapX, gapY, padX, padTop),
      rectFor(B, cellW, cellH, gapX, gapY, padX, padTop),
      lanes[ti] ?? 0,
    );
    s += `<path d="${p.d}" fill="none" stroke="var(--charcoal)" stroke-width="1.3" marker-end="url(#gArrow)"${bp(`transitions.${ti}`)}/>`;
    const mark = numbered ? edgeStep(p, ti + 1) : edgePill(p, label);
    labels.push(`<g${bp(`transitions.${ti}`)}>${mark}</g>`);
  });

  // states
  s += `<g${bl('states')}>`;
  states.forEach((st, si) => {
    const r = rectFor(st, cellW, cellH, gapX, gapY, padX, padTop);
    const place = nodeCellAttrs(st.col, st.row);
    if (st.kind === 'start') {
      s += `<circle cx="${r.cx}" cy="${r.cy}" r="10" fill="var(--charcoal)"${bp(`states.${si}`)}${place}/>`;
    } else if (st.kind === 'terminal') {
      s +=
        `<g${bp(`states.${si}`)}${place}>` +
        `<circle cx="${r.cx}" cy="${r.cy}" r="12" fill="#fff" stroke="var(--charcoal)" stroke-width="1.5"/>` +
        `<circle cx="${r.cx}" cy="${r.cy}" r="6" fill="var(--charcoal)"/>` +
        `</g>`;
    } else {
      const fill = st.kind === 'wait' ? '#fde7cd' : '#dcf1e2';
      const stroke = st.kind === 'wait' ? '#f7952c' : '#1f9747';
      const lines = nameLines(st);
      const nameText =
        lines.length <= 1
          ? `<text x="${r.cx}" y="${r.cy + 4.5}" class="sm-name" fill="var(--charcoal)"${bp(`states.${si}.name`)}>${escapeHtml(st.name ?? '')}</text>`
          : `<g${bp(`states.${si}.name`)}>` +
            lines
              .map(
                (ln, j) =>
                  `<text x="${r.cx}" y="${r.cy + 4.5 - (lines.length - 1) * 7.5 + j * 15}" class="sm-name" fill="var(--charcoal)">${escapeHtml(ln)}</text>`,
              )
              .join('') +
            `</g>`;
      s +=
        `<g filter="url(#gshadow)"${bp(`states.${si}`)}${place}>` +
        `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="23" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>` +
        nameText +
        `</g>`;
    }
  });
  s += `</g>`; // close the states list container

  s += labels.join(''); // labels on top, never crossed by a line
  s += `</svg>`;

  // transition table — in numbered mode a leading № column mirrors the circled
  // numerals on the diagram, so each arrow reads off its own table row.
  const name = (id: string): string => byId.get(id)?.name ?? id;
  const numCell = (ti: number): string =>
    numbered ? `<td class="t-num"><span class="edge-step"><b>${ti + 1}</b></span></td>` : '';
  const rows2 = trans
    .map(
      (t, ti) =>
        `<tr${bp(`transitions.${ti}`)}>` +
        numCell(ti) +
        `<td><span class="${pillCls(byId.get(t.from)?.kind)}">${escapeHtml(name(t.from))}</span></td>` +
        `<td style="font-family:var(--font-mono);font-size:11px"${bp(`transitions.${ti}.event`)}>${escapeHtml(t.event)}</td>` +
        `<td style="color:#6b7280;font-size:11px"${bp(`transitions.${ti}.guard`)}>${escapeHtml(t.guard ?? '—')}</td>` +
        `<td><span class="${pillCls(byId.get(t.to)?.kind)}">${escapeHtml(name(t.to))}</span></td>` +
        `</tr>`,
    )
    .join('');
  const table =
    trans.length > 0
      ? `<table class="transition-table">` +
        `<thead><tr>${numbered ? '<th>№</th>' : ''}<th>From</th><th>Event</th><th>Guard</th><th>To</th></tr></thead>` +
        `<tbody${bl('transitions')}>${rows2}</tbody></table>`
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
