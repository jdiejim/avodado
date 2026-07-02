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
  const cPadX = 24;
  const cHeader = 34;
  const cPadBot = 22;
  const cGap = 34;
  const outerPad = 26;

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

  // Namespaces sit side by side, each sized to its own services (≤2 per row) —
  // no shared width, so a one-service namespace stays a small box.
  let x = outerPad;
  let maxH = 0;
  for (const c of clusters) {
    const list = svcByCluster.get(c.id) ?? [];
    const colsC = Math.min(2, Math.max(1, list.length));
    const rowsC = Math.max(1, Math.ceil(list.length / colsC));
    const w = colsC * serviceW + (colsC - 1) * gapS + cPadX * 2;
    const h = cHeader + rowsC * serviceH + (rowsC - 1) * gapS + cPadBot;
    clusterBoxes.push({ c, x, y: outerPad, w, h });
    list.forEach((sv, i) => {
      const row = Math.floor(i / colsC);
      const col = i % colsC;
      rects.set(sv.id, {
        x: x + cPadX + col * (serviceW + gapS),
        y: outerPad + cHeader + row * (serviceH + gapS),
        w: serviceW,
        h: serviceH,
      });
    });
    if (h > maxH) maxH = h;
    x += w + cGap;
  }
  const width = x - cGap + outerPad;
  const height = outerPad * 2 + maxH;

  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"><title>Cluster diagram</title>`;

  // cluster shells — the refined zone style: dashed outline, tinted wash,
  // coloured label top-left, muted kind chip top-right (no solid header bar).
  for (const cb of clusterBoxes) {
    const kindLabel =
      cb.c.kind !== undefined
        ? `<text x="${cb.x + cb.w - 14}" y="${cb.y + 22}" class="cl-kind" style="fill:var(--gray)">${escapeHtml(cb.c.kind)}</text>`
        : '';
    s +=
      `<g>` +
      `<rect x="${cb.x}" y="${cb.y}" width="${cb.w}" height="${cb.h}" rx="12" fill="var(--navy)" fill-opacity="0.03" stroke="var(--navy)" stroke-opacity="0.65" stroke-width="1.3" stroke-dasharray="7 5"/>` +
      `<text x="${cb.x + 16}" y="${cb.y + 22}" class="grp-label" fill="var(--navy)">${escapeHtml(cb.c.label)}</text>` +
      kindLabel +
      `</g>`;
  }

  // edges
  const labels: string[] = [];
  for (const e of edges) {
    const A = rects.get(e.from);
    const B = rects.get(e.to);
    if (!A || !B) continue;
    const p = ortho(A, B);
    const st = GEDGE[e.kind ?? 'solid'] ?? GEDGE['solid'] ?? {
      stroke: 'var(--charcoal)',
      sw: 1.4,
      dash: '',
      marker: 'gArrow',
      err: false,
    };
    s += `<path d="${p.d}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}" stroke-dasharray="${st.dash}" marker-end="url(#${st.marker})"/>`;
    labels.push(edgePill(p, e.label, st.err));
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
    const isCyl = ['db', 'database', 'store', 'warehouse', 'lake', 'postgres', 'mysql', 'mongo', 'mongodb', 'dynamo'].includes(
      (sv.kind ?? '').toLowerCase(),
    );
    if (isCyl) {
      // Data stores keep their canonical cylinder shape inside the namespace.
      const ry = 10;
      const rx2 = r.w / 2;
      const cx = r.x + r.w / 2;
      const techCyl =
        sv.tech !== undefined
          ? `<text x="${cx}" y="${r.y + 48}" class="blk-tech" fill="${st.accent}" text-anchor="middle">${escapeHtml(sv.tech)}</text>`
          : '';
      s +=
        `<g filter="url(#gshadow)">` +
        `<path d="M${r.x} ${r.y + ry} A ${rx2} ${ry} 0 0 1 ${r.x + r.w} ${r.y + ry} V ${r.y + r.h - ry} A ${rx2} ${ry} 0 0 1 ${r.x} ${r.y + r.h - ry} Z" fill="${st.fill}" stroke="${st.accent}" stroke-width="1.2"/>` +
        `<path d="M${r.x} ${r.y + ry} A ${rx2} ${ry} 0 0 0 ${r.x + r.w} ${r.y + ry}" fill="none" stroke="${st.accent}" stroke-width="1.2"/>` +
        `<text x="${cx}" y="${r.y + (sv.tech !== undefined ? 36 : 42)}" class="blk-name" fill="${st.text}" style="font-size:12px" text-anchor="middle">${escapeHtml(sv.label)}</text>` +
        techCyl +
        repIndicator +
        `</g>`;
    } else {
      s +=
        `<g filter="url(#gshadow)">` +
        `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="8" fill="${st.fill}" stroke="${st.accent}" stroke-width="1.2"/>` +
        gl +
        `<text x="${nx}" y="${r.y + (sv.tech !== undefined ? 26 : 30)}" class="blk-name" fill="${st.text}" style="font-size:12px">${escapeHtml(sv.label)}</text>` +
        techLine +
        repIndicator +
        `</g>`;
    }
  }

  s += labels.join(''); // labels on top, never crossed by a line
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
