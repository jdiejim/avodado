/**
 * Renders a cluster diagram (Kubernetes-style) — nested cluster boxes with
 * service tiles inside, optional replica counts as bar marks, and
 * orthogonal-routed edges between services across clusters.
 *
 * Ported from doc-studio.jsx `ClusterDiagram`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { ortho } from '../svg/ortho.js';
import { edgePill } from '../svg/edgePill.js';
import { blockStyle, nodeGlyph, GEDGE } from '../svg/blockStyle.js';
import { rectRoundRight } from '../svg/shapes.js';
import { diagramFrame } from './frame.js';

type Service = NonNullable<BlockDataMap['cluster']['services']>[number];

export function renderCluster(data: BlockDataMap['cluster']): string {
  const clusters = data.clusters ?? [];
  const services = data.services ?? [];
  const edges = data.edges ?? [];
  const svcByCluster = new Map<string, Service[]>();
  for (const c of clusters) svcByCluster.set(c.id, []);
  for (const sv of services) {
    const list = svcByCluster.get(sv.cluster);
    if (list !== undefined) list.push(sv);
  }
  const serviceW = 158;
  const serviceH = 78;
  const gapS = 22;
  const cPadX = 26;
  const cHeader = 38;
  const cPadTop = 18;
  const cPadBot = 22;
  const cGap = 28;
  const outerPad = 26;

  let maxPerCluster = 1;
  for (const list of svcByCluster.values()) {
    if (list.length > maxPerCluster) maxPerCluster = list.length;
  }
  const cols = Math.min(4, Math.max(1, maxPerCluster));
  const clusterW = cols * serviceW + (cols - 1) * gapS + cPadX * 2;
  const width = outerPad * 2 + clusterW;

  interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
  }
  const rects = new Map<string, Rect>();
  interface ClusterBox {
    c: NonNullable<BlockDataMap['cluster']['clusters']>[number];
    x: number;
    y: number;
    w: number;
    h: number;
  }
  const clusterBoxes: ClusterBox[] = [];

  let y = outerPad;
  for (const c of clusters) {
    const list = svcByCluster.get(c.id) ?? [];
    const rows = Math.max(1, Math.ceil(list.length / cols));
    const h = cHeader + cPadTop + rows * serviceH + (rows - 1) * gapS + cPadBot;
    const cx = outerPad;
    clusterBoxes.push({ c, x: cx, y, w: clusterW, h });
    list.forEach((sv, i) => {
      const r = Math.floor(i / cols);
      const col = i % cols;
      rects.set(sv.id, {
        x: cx + cPadX + col * (serviceW + gapS),
        y: y + cHeader + cPadTop + r * (serviceH + gapS),
        w: serviceW,
        h: serviceH,
      });
    });
    y += h + cGap;
  }
  const height = y - cGap + outerPad;

  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"><title>Cluster diagram</title>`;

  // cluster shells
  for (const cb of clusterBoxes) {
    const kindLabel =
      cb.c.kind !== undefined
        ? `<text x="${cb.x + cb.w - 14}" y="${cb.y + 21}" class="cl-kind">${escapeHtml(cb.c.kind)}</text>`
        : '';
    s +=
      `<g>` +
      `<rect x="${cb.x}" y="${cb.y}" width="${cb.w}" height="${cb.h}" rx="12" fill="var(--navy)" fill-opacity="0.035" stroke="var(--navy)" stroke-width="1.4" stroke-dasharray="8 5"/>` +
      `<rect x="${cb.x}" y="${cb.y}" width="${cb.w}" height="${cHeader}" rx="12" fill="var(--navy)"/>` +
      `<rect x="${cb.x}" y="${cb.y + cHeader - 12}" width="${cb.w}" height="12" fill="#0e54a1"/>` +
      `<text x="${cb.x + 16}" y="${cb.y + 21}" class="cl-head">${escapeHtml(cb.c.label)}</text>` +
      kindLabel +
      `</g>`;
  }

  // edges
  for (const e of edges) {
    const A = rects.get(e.from);
    const B = rects.get(e.to);
    if (!A || !B) continue;
    const p = ortho(A, B);
    const st = GEDGE[e.kind ?? 'solid'] ?? GEDGE['solid'] ?? {
      stroke: '#1a1a2e',
      sw: 1.4,
      dash: '',
      marker: 'gArrow',
      err: false,
    };
    s +=
      `<g><path d="${p.d}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}" stroke-dasharray="${st.dash}" marker-end="url(#${st.marker})"/>` +
      edgePill(p, e.label, st.err) +
      `</g>`;
  }

  // services
  for (const sv of services) {
    const r = rects.get(sv.id);
    if (r === undefined) continue;
    const st = blockStyle(sv.kind);
    const gl = nodeGlyph(sv.kind, r.x + 14, r.y + 14, st.accent);
    const nx = gl.length > 0 ? r.x + 38 : r.x + 14;
    const reps = sv.replicas ?? 0;
    const techLine =
      sv.tech !== undefined
        ? `<text x="${nx}" y="${r.y + 42}" class="blk-tech" fill="${st.accent}">${escapeHtml(sv.tech)}</text>`
        : '';
    const repIndicator =
      reps > 0
        ? (() => {
            const shown = Math.min(reps, 5);
            let bars = '';
            for (let j = 0; j < shown; j++) {
              bars += `<rect x="${r.x + 12 + j * 8}" y="${r.y + r.h - 14}" width="5" height="8" rx="1" fill="${st.accent}" opacity="0.7"/>`;
            }
            return (
              `<g>` +
              bars +
              `<text x="${r.x + 12 + shown * 8 + 4}" y="${r.y + r.h - 7}" class="blk-tech" fill="${st.accent}">×${reps}</text>` +
              `</g>`
            );
          })()
        : '';
    s +=
      `<g filter="url(#gshadow)">` +
      `<path d="${rectRoundRight(r.x, r.y, r.w, r.h, 8)}" fill="${st.fill}" stroke="${st.accent}" stroke-width="1.2"/>` +
      `<rect x="${r.x}" y="${r.y}" width="5" height="${r.h}" fill="${st.accent}"/>` +
      gl +
      `<text x="${nx}" y="${r.y + (sv.tech !== undefined ? 26 : 30)}" class="blk-name" fill="${st.text}" style="font-size:12px">${escapeHtml(sv.label)}</text>` +
      techLine +
      repIndicator +
      `</g>`;
  }

  s += `</svg>`;
  return diagramFrame(
    {
      tag: 'CLUSTER',
      tagBg: '#0e54a1',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    s,
  );
}
