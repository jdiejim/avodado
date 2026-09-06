/**
 * Renders a cluster diagram (Kubernetes-style) — namespace panels with
 * service tiles inside, optional replica counts as bar marks, and
 * orthogonal-routed edges between services across namespaces.
 *
 * Skin (`DESIGN.md`): a namespace is the `paper-2` group panel with a
 * hairline and a `.t-eyebrow` label (its `kind` as a chip top-right); a
 * service is the block family's shaped node — the same cylinder, pipe and
 * card silhouettes, kinds told apart by stroke, fill and eyebrow chip.
 * Replica marks are `muted` bars with a `×N` count. Edges follow the shared
 * stroke table (`solid` / `dashed` / `forbidden` / `error`).
 *
 * Accent rule: none. The schema marks no entry service, so the cluster
 * spends no colour.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { edgeLanes, entryPortOffsets, ortho } from '../svg/ortho.js';
import { edgeLabelLayer, type EdgeLabelPoint } from '../svg/edgeSteps.js';
import { SKIN_EDGE } from '../svg/blockStyle.js';
import { blockLegend, renderShapedNode } from './blockGraph.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';

type Service = NonNullable<BlockDataMap['cluster']['services']>[number];

const CYLINDER_KINDS = new Set(['db', 'database', 'store', 'warehouse', 'lake', 'postgres', 'mysql', 'mongo', 'mongodb', 'dynamo']);

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

  // Namespace panels — the skin's group panel: paper-2 wash, hairline, an
  // eyebrow label top-left and the kind chip top-right.
  s += `<g${bl('clusters')}>`;
  clusterBoxes.forEach((cb, ci) => {
    const kindLabel =
      cb.c.kind !== undefined
        ? `<text x="${cb.x + cb.w - 12}" y="${cb.y + 16}" class="t-eyebrow" text-anchor="end">${escapeHtml(cb.c.kind)}</text>`
        : '';
    s +=
      `<g${bp(`clusters.${ci}`)}>` +
      `<rect x="${cb.x}" y="${cb.y}" width="${cb.w}" height="${cb.h}" rx="6" fill="var(--paper-2)" fill-opacity="0.6" stroke="var(--rule-solid)" stroke-width="1"/>` +
      `<text x="${cb.x + 12}" y="${cb.y + 16}" class="t-eyebrow">${escapeHtml(cb.c.label)}</text>` +
      kindLabel +
      `</g>`;
  });
  s += `</g>`; // close the clusters list container

  // edges
  const pending: EdgeLabelPoint[] = [];
  const edgeKinds = new Set<string>();
  s += `<g${bl('edges')}>`;
  const lanes = edgeLanes(edges);
  const entries = entryPortOffsets(edges, (id) => rects.get(id));
  edges.forEach((e, ei) => {
    const A = rects.get(e.from);
    const B = rects.get(e.to);
    if (!A || !B) return;
    const p = ortho(A, B, lanes[ei] ?? 0, entries[ei] ?? 0);
    const kind = e.kind ?? 'solid';
    edgeKinds.add(kind);
    const st = SKIN_EDGE[kind] ?? SKIN_EDGE['solid'] ?? {
      stroke: 'var(--muted)',
      sw: 1.5,
      dash: '',
      marker: 'skArrow',
      err: false,
    };
    const dash = st.dash.length > 0 ? ` stroke-dasharray="${st.dash}"` : '';
    s += `<path d="${p.d}" fill="none" stroke="${st.stroke}" stroke-width="${st.sw}"${dash} marker-end="url(#${st.marker})"${bp(`edges.${ei}`)}/>`;
    pending.push({ lx: p.lx, ly: p.ly, ...(e.label !== undefined ? { label: e.label } : {}), err: st.err, path: `edges.${ei}` });
  });
  s += `</g>`; // close the edges list container

  // services — the block family's shaped nodes, plus the replica marks.
  s += `<g${bl('services')}>`;
  services.forEach((sv, si) => {
    const r = rects.get(sv.id);
    if (r === undefined) return;
    const reps = sv.replicas ?? 0;
    let repIndicator = '';
    if (reps > 0) {
      const shown = Math.min(reps, 5);
      // A cylinder's bottom rim takes the last 13px; the marks sit above it.
      const baseY = CYLINDER_KINDS.has((sv.kind ?? '').toLowerCase()) ? r.y + r.h - 24 : r.y + r.h - 14;
      let bars = '';
      for (let j = 0; j < shown; j++) {
        bars += `<rect x="${r.x + 12 + j * 7}" y="${baseY}" width="4" height="8" rx="1" fill="var(--muted)"/>`;
      }
      repIndicator =
        `<g>` +
        bars +
        `<text x="${r.x + 12 + shown * 7 + 4}" y="${baseY + 7}" class="t-sub">×${reps}</text>` +
        `</g>`;
    }
    const node = renderShapedNode(
      { kind: sv.kind, name: sv.label, ...(sv.tech !== undefined ? { tech: sv.tech } : {}) },
      r,
    );
    s += `<g${bp(`services.${si}`)}>${node}${repIndicator}</g>`;
  });
  s += `</g>`; // close the services list container

  const { overlay, legend: steps } = edgeLabelLayer(pending, [...rects.values()], { skin: true });
  s += overlay; // labels on top, never crossed by a line
  s += `</svg>`;

  const legend = blockLegend(services, edgeKinds, false);
  return diagramFrame(
    {
      tag: 'CLUSTER',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
    },
    s + steps,
  );
}
