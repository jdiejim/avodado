/**
 * The Mermaid input dialect.
 *
 * A ```` ```mermaid ```` fence whose first meaningful line is one of five
 * diagram keywords parses into the matching typed block. The converters emit
 * exactly the shapes the block schemas accept, so validation and rendering
 * are identical to a YAML block; YAML stays the canonical form on disk (an
 * edit rewrites the fence to the canonical tag). Any other Mermaid diagram
 * (`gantt`, `classDiagram`, `mindmap`, …) stays prose.
 */

import { stringify as stringifyYaml } from 'yaml';
import type { BlockType } from '../types.js';
import { convertSequence } from './sequence.js';
import { convertFlow } from './flow.js';
import { convertErd } from './erd.js';
import { convertState } from './state.js';
import { convertPie } from './pie.js';
import type { MermaidResult } from './lines.js';

export type { MermaidResult } from './lines.js';

/** The fence tag that opens a Mermaid body. Also the segment's `sourceType`. */
export const MERMAID_SOURCE = 'mermaid';

/** Block types the Mermaid dialect can produce. */
export type MermaidKind = 'sequence' | 'flow' | 'erd' | 'state' | 'chart';

/** Mermaid diagram keyword → the block type it converts to. */
export const MERMAID_KEYWORDS: Readonly<Record<string, MermaidKind>> = {
  sequenceDiagram: 'sequence',
  flowchart: 'flow',
  graph: 'flow',
  erDiagram: 'erd',
  stateDiagram: 'state',
  'stateDiagram-v2': 'state',
  pie: 'chart',
};

/**
 * The block type a Mermaid body converts to, decided by its first non-blank,
 * non-`%%` line — or `undefined` when the diagram is not one of the five
 * supported grammars (the fence then stays prose).
 */
export function detectMermaidKind(text: string): MermaidKind | undefined {
  const first = text
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith('%%'));
  if (first === undefined) return undefined;
  const word = /^[\w-]+/.exec(first)?.[0];
  return word !== undefined ? MERMAID_KEYWORDS[word] : undefined;
}

/**
 * Converts a Mermaid body to the data of block `kind`. Never throws: a line
 * the subset cannot read comes back as `{ ok: false, message, line }` with
 * the 1-based line within the body.
 */
export function convertMermaid(kind: BlockType, text: string): MermaidResult {
  switch (kind) {
    case 'sequence':
      return convertSequence(text);
    case 'flow':
      return convertFlow(text);
    case 'erd':
      return convertErd(text);
    case 'state':
      return convertState(text);
    case 'chart':
      return convertPie(text);
    default:
      return { ok: false, message: `no Mermaid grammar converts to \`${kind}\`` };
  }
}

/**
 * The canonical YAML body for a Mermaid segment — what an editor writes back
 * under the canonical fence tag. `undefined` when the body does not convert
 * (the segment carries a `parseError` in that case).
 */
export function mermaidBodyYaml(kind: BlockType, text: string): string | undefined {
  const r = convertMermaid(kind, text);
  if (!r.ok) return undefined;
  // `raw` convention: no trailing newline.
  return stringifyYaml(r.data, { lineWidth: 0 }).replace(/\n$/, '');
}
