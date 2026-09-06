/**
 * Renders a state machine: rounded state pills + start/terminal markers + an
 * orthogonal-routed edge per transition, plus a transition table below.
 *
 * Skin (`DESIGN.md`): a state is a paper pill with an ink outline; a `wait`
 * state is the inactive fill (`paper-2`, hairline). The start marker is a
 * filled ink dot, a terminal a bullseye. Transitions are `muted`; a transition
 * into an error terminal is `negative`.
 *
 * Accent rule: the one terminal state that is not an error exit (its name does
 * not read as a failure) takes the accent, together with the transitions into
 * it — the success exit reads at a glance. Two or more candidates, or none,
 * means no accent.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { edgeLanes, entryPortOffsets, ortho } from '../svg/ortho.js';
import { wrapText } from '../svg/wrapText.js';
import { edgeMask } from '../svg/edgePill.js';
import { edgeStep } from '../svg/edgeSteps.js';
import { GROUP_PADS, gridGroupsSvg, groupExtent } from '../svg/gridGroups.js';
import { gridMetaAttrs, nodeCellAttrs } from '../svg/gridMeta.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';
import { ensureGrid } from './autoLayout.js';

type StateNode = NonNullable<BlockDataMap['state']['states']>[number];

/** A terminal whose name reads as a failure is an error exit, never the accent. */
const ERR_RE = /\b(error|fail|failed|failure|reject|rejected|cancel|cancelled|canceled|abort|aborted|timeout|timed out|expired|dead)\b/i;

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
  const states = ensureGrid(rawStates, trans, data.dir ?? 'LR');
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

  // Error exits and the accent (see the header comment).
  const isErrTerminal = (s: StateNode | undefined): boolean =>
    s !== undefined && s.kind === 'terminal' && (ERR_RE.test(s.name ?? '') || ERR_RE.test(s.id));
  const successExits = states.filter((s) => s.kind === 'terminal' && !isErrTerminal(s));
  const accentId = successExits.length === 1 ? successExits[0]?.id : undefined;

  // Grid metadata for editors (Avodado Studio drag-to-connect): inert attrs
  // mirroring the layout constants plus each state's effective cell below.
  const gridMeta = gridMetaAttrs({ quick, cols, rows, cellW, cellH, gapX, gapY, padX, padTop });
  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"${gridMeta}><title>State machine</title>`;

  // Group panels — beneath transitions and states. Only emitted when present.
  if (groups.length > 0) {
    const xOf = (c: number): number => padX + (c - 1) * (cellW + gapX);
    const yOf = (r: number): number => padTop + (r - 1) * (cellH + gapY);
    s += gridGroupsSvg(groups, { xOf, yOf, cellW, cellH, gapX, gapY, skin: true });
  }

  // The shared labelled-edge rule, with a twist: the state block already has a
  // transition table below the diagram, so at 4+ labelled transitions the
  // numerals refer to the TABLE rows (which gain a matching № column) instead
  // of a second step legend.
  const numbered = trans.length >= 4;

  // edge lines first; collect labels to draw last (on top of everything)
  const labels: string[] = [];
  const used = { plain: false, error: false, accent: false };
  const lanes = edgeLanes(trans);
  const entries = entryPortOffsets(trans, (id) => {
    const n = byId.get(id);
    return n !== undefined ? rectFor(n, cellW, cellH, gapX, gapY, padX, padTop) : undefined;
  });
  trans.forEach((t, ti) => {
    const A = byId.get(t.from);
    const B = byId.get(t.to);
    if (!A || !B) return;
    const label = t.event + (t.guard !== undefined ? ` ${t.guard}` : '');
    const isErr = isErrTerminal(B);
    const isAccent = !isErr && accentId !== undefined && t.to === accentId;
    const stroke = isErr ? 'var(--negative)' : isAccent ? 'var(--accent)' : 'var(--muted)';
    const marker = isErr ? 'skErr' : isAccent ? 'skAccent' : 'skArrow';
    const sw = isAccent ? 1.75 : 1.5;
    const tone = isErr ? 'error' : isAccent ? 'accent' : 'muted';
    if (isErr) used.error = true;
    else if (isAccent) used.accent = true;
    else used.plain = true;
    if (t.from === t.to) {
      const r = rectFor(A, cellW, cellH, gapX, gapY, padX, padTop);
      s += `<path d="M ${r.cx - 12} ${r.y} C ${r.cx - 30} ${r.y - 32}, ${r.cx + 30} ${r.y - 32}, ${r.cx + 12} ${r.y}" fill="none" stroke="${stroke}" stroke-width="${sw}" marker-end="url(#${marker})"${bp(`transitions.${ti}`)}/>`;
      const at = { lx: r.cx, ly: r.y - 28 };
      const mark = numbered ? edgeStep(at, ti + 1, isErr, true) : edgeMask(at, label, tone);
      labels.push(`<g${bp(`transitions.${ti}`)}>${mark}</g>`);
      return;
    }
    const p = ortho(
      rectFor(A, cellW, cellH, gapX, gapY, padX, padTop),
      rectFor(B, cellW, cellH, gapX, gapY, padX, padTop),
      lanes[ti] ?? 0,
      entries[ti] ?? 0,
    );
    s += `<path d="${p.d}" fill="none" stroke="${stroke}" stroke-width="${sw}" marker-end="url(#${marker})"${bp(`transitions.${ti}`)}/>`;
    const mark = numbered ? edgeStep(p, ti + 1, isErr, true) : edgeMask(p, label, tone);
    labels.push(`<g${bp(`transitions.${ti}`)}>${mark}</g>`);
  });

  // states
  const kinds = { active: false, wait: false, start: false, end: false, errEnd: false };
  s += `<g${bl('states')}>`;
  states.forEach((st, si) => {
    const r = rectFor(st, cellW, cellH, gapX, gapY, padX, padTop);
    const place = nodeCellAttrs(st.col, st.row);
    if (st.kind === 'start') {
      kinds.start = true;
      s += `<circle cx="${r.cx}" cy="${r.cy}" r="10" fill="var(--ink)"${bp(`states.${si}`)}${place}/>`;
    } else if (st.kind === 'terminal') {
      const accent = st.id === accentId;
      const err = isErrTerminal(st);
      if (err) kinds.errEnd = true;
      else if (!accent) kinds.end = true;
      const tone = accent ? 'var(--accent)' : err ? 'var(--negative)' : 'var(--ink)';
      const fill = accent ? 'var(--accent-tint)' : err ? 'var(--negative-tint)' : 'var(--paper)';
      s +=
        `<g${bp(`states.${si}`)}${place}>` +
        `<circle cx="${r.cx}" cy="${r.cy}" r="12" fill="${fill}" stroke="${tone}" stroke-width="1.5"/>` +
        `<circle cx="${r.cx}" cy="${r.cy}" r="6" fill="${tone}"/>` +
        `</g>`;
    } else {
      const wait = st.kind === 'wait';
      if (wait) kinds.wait = true;
      else kinds.active = true;
      const fill = wait ? 'var(--paper-2)' : 'var(--paper)';
      const stroke = wait ? 'var(--rule-solid)' : 'var(--ink)';
      const sw = wait ? 1 : 1.5;
      const lines = nameLines(st);
      const nameText =
        lines.length <= 1
          ? `<text x="${r.cx}" y="${r.cy + 4.5}" class="t-name" text-anchor="middle"${bp(`states.${si}.name`)}>${escapeHtml(st.name ?? '')}</text>`
          : `<g${bp(`states.${si}.name`)}>` +
            lines
              .map(
                (ln, j) =>
                  `<text x="${r.cx}" y="${r.cy + 4.5 - (lines.length - 1) * 7.5 + j * 15}" class="t-name" text-anchor="middle">${escapeHtml(ln)}</text>`,
              )
              .join('') +
            `</g>`;
      s +=
        `<g${bp(`states.${si}`)}${place}>` +
        `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="23" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>` +
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
        `<td class="c-soft" style="font-size:11px"${bp(`transitions.${ti}.guard`)}>${escapeHtml(t.guard ?? '—')}</td>` +
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

  const items: LegendItem[] = [];
  if (kinds.start) items.push({ swatch: 'chip', chip: '●', label: 'start' });
  if (kinds.active) items.push({ swatch: 'node', label: 'state' });
  if (kinds.wait) items.push({ swatch: 'node-fill2', label: 'waiting' });
  if (kinds.end) items.push({ swatch: 'chip', chip: '◉', label: 'end' });
  if (used.plain) items.push({ swatch: 'edge', label: 'transition' });
  if (used.error || kinds.errEnd) items.push({ swatch: 'edge-error', label: 'error exit' });
  if (accentId !== undefined) items.push({ swatch: 'node-accent', label: 'success exit' });
  const legend = renderLegend(items);

  return diagramFrame(
    {
      tag: 'STATE',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
      ...(table.length > 0 ? { footerHtml: table } : {}),
    },
    s,
  );
}
