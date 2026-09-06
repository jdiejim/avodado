/**
 * Renders a `gitgraph` block — a branching and release model.
 *
 * The picture every branching-policy doc draws by hand: a lane per branch,
 * a dot per commit, a curve where a branch opens and another where it merges
 * back, and tags for the releases. Commits are a plain sequence, so the YAML
 * reads in the order the history happened.
 *
 * Lane order is the order branches are declared, else first appearance. A
 * commit on a branch nobody has seen yet OPENS that lane, forking from the
 * head of `from` (or of the lane before it), and `merge: <branch>` closes one
 * back into the branch the commit is on.
 *
 * Skin (`DESIGN.md`): branch lines are `muted`; a merge is the dashed return
 * stroke; a revert is a hollow dot, a hotfix a dot with a paper core, a
 * release a larger dot under a paper tag chip.
 *
 * Accent rule: the main branch line — the first lane — and its commit dots
 * are the one accent element; its name and tags stay ink (a branch's
 * `accent` name in the data no longer picks a hue; the skin tells lanes
 * apart by position and name).
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { renderLegend, type LegendItem } from '../svg/legend.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';

type GitData = BlockDataMap['gitgraph'];

const LEFT = 104; // branch names live here
const STEP = 96; // horizontal distance between commits
const LANE = 62; // vertical distance between branches
const TOP = 46; // room for the tag row
const DOT = 6;

interface Point {
  readonly x: number;
  readonly y: number;
  readonly lane: number;
}

export function renderGitgraph(data: GitData): string {
  // Lane order: declared branches first, then any the commits introduce.
  const lanes: string[] = [];
  for (const b of data.branches ?? []) if (!lanes.includes(b.name)) lanes.push(b.name);
  for (const c of data.commits) {
    const b = c.branch ?? lanes[0] ?? 'main';
    if (!lanes.includes(b)) lanes.push(b);
    if (c.merge !== undefined && !lanes.includes(c.merge)) lanes.push(c.merge);
  }
  if (lanes.length === 0) lanes.push('main');

  const main = lanes[0] ?? 'main';
  const isMain = (branch: string): boolean => branch === main;
  const colorOf = (branch: string): string => (isMain(branch) ? 'var(--accent)' : 'var(--muted)');
  const widthOf = (branch: string): number => (isMain(branch) ? 1.75 : 1.5);
  const laneY = (branch: string): number => TOP + Math.max(0, lanes.indexOf(branch)) * LANE;

  // Walk the sequence, placing each commit one step right of the last.
  const heads = new Map<string, Point>();
  const placed: Array<{ p: Point; branch: string; index: number }> = [];
  const edges: string[] = [];
  let column = 0;
  let merges = 0;

  data.commits.forEach((c, index) => {
    const branch = c.branch ?? lanes[0] ?? 'main';
    const x = LEFT + column * STEP;
    const y = laneY(branch);
    const point: Point = { x, y, lane: lanes.indexOf(branch) };
    const color = colorOf(branch);
    const sw = widthOf(branch);
    const head = heads.get(branch);

    if (head === undefined) {
      // First commit on this lane: fork it off its parent's head.
      const parent = c.from ?? lanes[Math.max(0, lanes.indexOf(branch) - 1)];
      const fork = parent !== undefined ? heads.get(parent) : undefined;
      if (fork !== undefined) edges.push(curve(fork, point, color, sw));
    } else {
      edges.push(
        `<line x1="${head.x}" y1="${head.y}" x2="${x}" y2="${y}" stroke="${color}" stroke-width="${sw}"/>`,
      );
    }

    if (c.merge !== undefined) {
      const source = heads.get(c.merge);
      if (source !== undefined) {
        edges.push(curve(source, point, colorOf(c.merge), widthOf(c.merge), true));
        merges += 1;
      }
      // The merged branch's lane ends here.
      heads.delete(c.merge);
    }

    heads.set(branch, point);
    placed.push({ p: point, branch, index });
    column += 1;
  });

  const width = LEFT + Math.max(1, column) * STEP;
  const height = TOP + lanes.length * LANE + 26;

  let s = `<svg viewBox="0 0 ${width} ${height}" role="img"><title>${escapeHtml(data.title ?? 'Branch graph')}</title>`;

  // Lane rails and their names.
  s += `<g${bl('branches')}>`;
  lanes.forEach((name, i) => {
    const y = TOP + i * LANE;
    s += `<line x1="${LEFT - 18}" y1="${y}" x2="${width - 12}" y2="${y}" stroke="var(--rule)" stroke-width="1" stroke-dasharray="2 5"/>`;
    const attrs = (data.branches ?? []).some((b) => b.name === name)
      ? bp(`branches.${(data.branches ?? []).findIndex((b) => b.name === name)}`)
      : '';
    s += `<text x="${LEFT - 26}" y="${y + 4}" class="gg-branch t-sub c-ink"${attrs}>${escapeHtml(name)}</text>`;
  });
  s += `</g>`;

  s += `<g>${edges.join('')}</g>`;

  const kinds = { release: false, hotfix: false, revert: false };
  s += `<g${bl('commits')}>`;
  placed.forEach(({ p, branch, index }) => {
    const c = data.commits[index];
    if (c === undefined) return;
    const color = colorOf(branch);
    const release = c.kind === 'release' || c.tag !== undefined;
    if (release) kinds.release = true;
    if (c.kind === 'hotfix') kinds.hotfix = true;
    if (c.kind === 'revert') kinds.revert = true;
    s += `<g${bp(`commits.${index}`)}>`;
    s += `<circle cx="${p.x}" cy="${p.y}" r="${release ? DOT + 2 : DOT}" fill="${c.kind === 'revert' ? 'var(--paper)' : color}" stroke="${color}" stroke-width="1.5"/>`;
    if (c.kind === 'hotfix') {
      s += `<circle cx="${p.x}" cy="${p.y}" r="2.5" fill="var(--paper)"/>`;
    }
    if (c.label !== undefined) {
      s += `<text x="${p.x}" y="${p.y + 22}" class="gg-msg t-sub" text-anchor="middle">${escapeHtml(c.label)}</text>`;
    }
    if (c.tag !== undefined) {
      const w = Math.max(34, c.tag.length * 6.5 + 14);
      s += `<g>`;
      s += `<rect x="${p.x - w / 2}" y="${p.y - 40}" width="${w}" height="18" rx="2" fill="var(--paper)" stroke="var(--ink)" stroke-width="1"/>`;
      s += `<text x="${p.x}" y="${p.y - 27.5}" class="t-badge c-ink" text-anchor="middle">${escapeHtml(c.tag)}</text>`;
      s += `<line x1="${p.x}" y1="${p.y - 22}" x2="${p.x}" y2="${p.y - 10}" stroke="var(--rule-solid)" stroke-width="1" stroke-dasharray="2 2"/>`;
      s += `</g>`;
    }
    s += `</g>`;
  });
  s += `</g></svg>`;

  const items: LegendItem[] = [{ swatch: 'line-dot-accent', label: `${main} (trunk)` }];
  if (lanes.length > 1) items.push({ swatch: 'line-dot', label: 'branch' });
  if (merges > 0) items.push({ swatch: 'edge-dashed', label: 'merge' });
  if (kinds.release) items.push({ swatch: 'chip', chip: 'v1', label: 'release tag' });
  if (kinds.hotfix) items.push({ swatch: 'chip', chip: '◉', label: 'hotfix' });
  if (kinds.revert) items.push({ swatch: 'chip', chip: '○', label: 'revert' });
  const legend = renderLegend(items);

  return diagramFrame(
    {
      tag: 'BRANCHES',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(legend.length > 0 ? { legendHtml: legend } : {}),
    },
    s,
  );
}

/**
 * The fork / merge curve: leaves its lane horizontally and arrives in the next
 * one horizontally, so the eye follows a branch rather than a diagonal. A
 * merge is the dashed return stroke of the skin.
 */
function curve(from: Point, to: Point, color: string, sw: number, merge = false): string {
  const midX = (from.x + to.x) / 2;
  const d = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}"${merge ? ' stroke-dasharray="5 4"' : ''}/>`;
}
