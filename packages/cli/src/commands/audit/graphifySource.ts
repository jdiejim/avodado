/**
 * GraphifySource — enriches the audit from `<root>/graphify-out/graph.json`.
 *
 * ## Field dependence (keep this list current)
 *
 * The graph.json is graphify's node-link export. We depend ONLY on:
 *
 *   nodes[]: id, label, source_file        (community_name, file_type — read
 *                                            when present, never required)
 *   links[]: source, target, relation      (confidence — ignored today)
 *
 * Every other field (norm_label, community, confidence_score, weight,
 * graph.hyperedges, …) is ignored, so graphify can change them freely.
 *
 * ## What graphify supplies vs the builtin extractor
 *
 * Graphify classifies files and relations, not routes or schemas. So the
 * adapter COMPOSES: graphify enriches `stats` (distinct source files +
 * language histogram) and `godNodes` (link in-degree over calls/imports);
 * the builtin extractor still supplies entrypoints, routes, schemas,
 * packages, and externals.
 *
 * ## Fallback behavior
 *
 * Validation is a minimal structural check: `nodes` and `links` are arrays,
 * and their first elements carry the fields above. On a missing file the
 * audit silently uses the builtin source (with a "richer audit" hint). On a
 * parse error or shape mismatch the audit falls back to the builtin source
 * and reports one notice that names the reason. `avo audit` never fails
 * because graph.json is bad.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AuditStats, GodNodeEvidence } from './types.js';

/** The node fields we read (all others ignored). */
export interface GraphifyNode {
  readonly id: string;
  readonly label: string;
  readonly source_file?: string;
  readonly community_name?: string;
  readonly file_type?: string;
}

/** The link fields we read (all others ignored). */
export interface GraphifyLink {
  readonly source: string;
  readonly target: string;
  readonly relation?: string;
  readonly confidence?: string;
}

/** The validated slice of graph.json the audit consumes. */
export interface GraphifyGraph {
  readonly nodes: readonly GraphifyNode[];
  readonly links: readonly GraphifyLink[];
}

/** Result of trying to load graph.json. */
export type GraphifyLoad =
  | { readonly ok: true; readonly graph: GraphifyGraph }
  | { readonly ok: false; readonly missing: true }
  | { readonly ok: false; readonly missing: false; readonly reason: string };

/** Relative location graphify writes its export to. */
export const GRAPH_PATH = 'graphify-out/graph.json';

/**
 * Loads + minimally validates `<root>/graphify-out/graph.json`.
 * Returns a typed result — the caller decides how to report and fall back.
 */
export async function loadGraphify(root: string): Promise<GraphifyLoad> {
  const path = join(root, GRAPH_PATH);
  if (!existsSync(path)) return { ok: false, missing: true };
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    return {
      ok: false,
      missing: false,
      reason: `${GRAPH_PATH} did not parse as JSON (${(err as Error).message}).`,
    };
  }
  const obj = parsed as { nodes?: unknown; links?: unknown };
  if (!Array.isArray(obj.nodes) || !Array.isArray(obj.links)) {
    return {
      ok: false,
      missing: false,
      reason: `${GRAPH_PATH} has no nodes/links arrays.`,
    };
  }
  const n0 = obj.nodes[0] as Record<string, unknown> | undefined;
  if (n0 !== undefined && (typeof n0['id'] !== 'string' || typeof n0['label'] !== 'string')) {
    return {
      ok: false,
      missing: false,
      reason: `${GRAPH_PATH} nodes lack the id/label fields.`,
    };
  }
  const l0 = obj.links[0] as Record<string, unknown> | undefined;
  if (l0 !== undefined && (l0['source'] === undefined || l0['target'] === undefined)) {
    return {
      ok: false,
      missing: false,
      reason: `${GRAPH_PATH} links lack the source/target fields.`,
    };
  }
  return { ok: true, graph: { nodes: obj.nodes as GraphifyNode[], links: obj.links as GraphifyLink[] } };
}

/** Lowercased extension of a path, or '' when there is none. */
function extOf(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const i = base.lastIndexOf('.');
  return i <= 0 ? '' : base.slice(i + 1).toLowerCase();
}

/** Stats from the graph: distinct source files + their language histogram. */
export function graphifyStats(graph: GraphifyGraph): AuditStats {
  const files = new Set<string>();
  for (const node of graph.nodes) {
    if (typeof node.source_file === 'string' && node.source_file !== '') files.add(node.source_file);
  }
  const languages: Record<string, number> = {};
  for (const file of files) {
    const ext = extOf(file);
    if (ext === '' || ext.length > 6) continue;
    languages[ext] = (languages[ext] ?? 0) + 1;
  }
  return { files: files.size, languages };
}

/**
 * God nodes from the graph: in-degree over `calls`/`imports` links, mapped
 * back to the node's label + source_file for a citable name.
 */
export function graphifyGodNodes(graph: GraphifyGraph, top = 10): GodNodeEvidence[] {
  const inDegree = new Map<string, number>();
  for (const link of graph.links) {
    if (link.relation !== 'calls' && link.relation !== 'imports') continue;
    const target = String(link.target);
    inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
  }
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  return [...inDegree.entries()]
    .filter(([, degree]) => degree >= 3)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, top)
    .map(([id, degree]) => {
      const node = byId.get(id);
      return {
        name: node?.label ?? id,
        degree,
        file: node?.source_file ?? '',
      };
    });
}
