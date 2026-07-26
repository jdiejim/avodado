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
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';
import { diagramFrame } from './frame.js';

type GitData = BlockDataMap['gitgraph'];

const ACCENT: Readonly<Record<string, string>> = {
  navy: 'var(--navy)',
  blue: 'var(--blue)',
  teal: 'var(--teal)',
  green: 'var(--positive)',
  amber: 'var(--highlight)',
  purple: 'var(--purple)',
  red: 'var(--negative)',
  gray: 'var(--gray)',
};
const CYCLE = ['var(--navy)', 'var(--teal)', 'var(--purple)', 'var(--highlight)', 'var(--blue)'];

const LEFT = 104; // branch names live here
const STEP = 96; // horizontal distance between commits
const LANE = 62; // vertical distance between branches
const TOP = 46; // room for the tag row
const DOT = 7;

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

  const accentOf = new Map((data.branches ?? []).map((b) => [b.name, b.accent]));
  const colorOf = (branch: string): string => {
    const a = accentOf.get(branch);
    const i = Math.max(0, lanes.indexOf(branch));
    return a !== undefined ? (ACCENT[a] ?? CYCLE[0] ?? '') : (CYCLE[i % CYCLE.length] ?? '');
  };
  const laneY = (branch: string): number => TOP + Math.max(0, lanes.indexOf(branch)) * LANE;

  // Walk the sequence, placing each commit one step right of the last.
  const heads = new Map<string, Point>();
  const placed: Array<{ p: Point; branch: string; index: number }> = [];
  const edges: string[] = [];
  let column = 0;

  data.commits.forEach((c, index) => {
    const branch = c.branch ?? lanes[0] ?? 'main';
    const x = LEFT + column * STEP;
    const y = laneY(branch);
    const point: Point = { x, y, lane: lanes.indexOf(branch) };
    const color = colorOf(branch);
    const head = heads.get(branch);

    if (head === undefined) {
      // First commit on this lane: fork it off its parent's head.
      const parent = c.from ?? lanes[Math.max(0, lanes.indexOf(branch) - 1)];
      const fork = parent !== undefined ? heads.get(parent) : undefined;
      if (fork !== undefined) edges.push(curve(fork, point, color));
    } else {
      edges.push(
        `<line x1="${head.x}" y1="${head.y}" x2="${x}" y2="${y}" stroke="${color}" stroke-width="2"/>`,
      );
    }

    if (c.merge !== undefined) {
      const source = heads.get(c.merge);
      if (source !== undefined) edges.push(curve(source, point, colorOf(c.merge), true));
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
    const color = colorOf(name);
    s += `<line x1="${LEFT - 18}" y1="${y}" x2="${width - 12}" y2="${y}" stroke="var(--rule)" stroke-width="1" stroke-dasharray="2 5"/>`;
    const attrs = (data.branches ?? []).some((b) => b.name === name)
      ? bp(`branches.${(data.branches ?? []).findIndex((b) => b.name === name)}`)
      : '';
    s += `<text x="${LEFT - 26}" y="${y + 4}" class="gg-branch" fill="${color}"${attrs}>${escapeHtml(name)}</text>`;
  });
  s += `</g>`;

  s += `<g>${edges.join('')}</g>`;

  s += `<g${bl('commits')}>`;
  placed.forEach(({ p, branch, index }) => {
    const c = data.commits[index];
    if (c === undefined) return;
    const color = colorOf(branch);
    const release = c.kind === 'release' || c.tag !== undefined;
    s += `<g${bp(`commits.${index}`)}>`;
    s += `<circle cx="${p.x}" cy="${p.y}" r="${release ? DOT + 2 : DOT}" fill="${c.kind === 'revert' ? 'var(--white)' : color}" stroke="${color}" stroke-width="2"/>`;
    if (c.kind === 'hotfix') {
      s += `<circle cx="${p.x}" cy="${p.y}" r="2.5" fill="var(--white)"/>`;
    }
    if (c.label !== undefined) {
      s += `<text x="${p.x}" y="${p.y + 22}" class="gg-msg">${escapeHtml(c.label)}</text>`;
    }
    if (c.tag !== undefined) {
      const w = Math.max(34, c.tag.length * 7 + 14);
      s += `<g>`;
      s += `<rect x="${p.x - w / 2}" y="${p.y - 40}" width="${w}" height="19" rx="9" fill="var(--highlight-soft)" stroke="var(--highlight)" stroke-width="1"/>`;
      s += `<text x="${p.x}" y="${p.y - 27}" class="gg-tag">${escapeHtml(c.tag)}</text>`;
      s += `<line x1="${p.x}" y1="${p.y - 21}" x2="${p.x}" y2="${p.y - 10}" stroke="var(--highlight)" stroke-width="1" stroke-dasharray="2 2"/>`;
      s += `</g>`;
    }
    s += `</g>`;
  });
  s += `</g></svg>`;

  return diagramFrame(
    {
      tag: 'BRANCHES',
      tagBg: '#374151',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
    },
    s,
  );
}

/**
 * The fork / merge curve: leaves its lane horizontally and arrives in the next
 * one horizontally, so the eye follows a branch rather than a diagonal.
 */
function curve(from: Point, to: Point, color: string, merge = false): string {
  const midX = (from.x + to.x) / 2;
  const d = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2"${merge ? ' stroke-dasharray="5 3"' : ''}/>`;
}
