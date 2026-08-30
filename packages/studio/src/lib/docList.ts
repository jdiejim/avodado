/**
 * Pure helpers for the rail's folder groups and the All-documents table —
 * derived entirely from the doc list (`DocListItem[]`) and the project's
 * `docsDir`. No new client state: slugs are the only input.
 */

import type { DocListItem } from '../api/client.js';

/** One rail group: a folder under docsDir (or docsDir itself) and its docs. */
export interface DocGroup {
  /** Grouping key: `''` for docsDir-level docs, else the top-level folder. */
  readonly key: string;
  /** Display label, e.g. `docs` or `docs / guides`. */
  readonly label: string;
  readonly docs: readonly DocListItem[];
}

/** The top-level folder of a slug (`guides/x/y` → `guides`), `''` if none. */
export function topFolder(slug: string): string {
  const i = slug.indexOf('/');
  return i === -1 ? '' : slug.slice(0, i);
}

/** The folder path shown for a doc: `docs` or `docs/guides` (full dirname). */
export function docFolder(slug: string, docsDir: string): string {
  const i = slug.lastIndexOf('/');
  return i === -1 ? docsDir : `${docsDir}/${slug.slice(0, i)}`;
}

/**
 * Groups docs by top-level folder under docsDir. Root docs come first under
 * the docsDir label; folders follow alphabetically. Docs inside a group are
 * sorted by title.
 */
export function groupDocs(docs: readonly DocListItem[], docsDir: string): DocGroup[] {
  const byKey = new Map<string, DocListItem[]>();
  for (const d of docs) {
    const key = topFolder(d.slug);
    const list = byKey.get(key);
    if (list === undefined) byKey.set(key, [d]);
    else list.push(d);
  }
  const keys = [...byKey.keys()].sort((a, b) => {
    if (a === '') return -1;
    if (b === '') return 1;
    return a.localeCompare(b);
  });
  return keys.map((key) => ({
    key,
    label: key === '' ? docsDir : `${docsDir} / ${key}`,
    docs: [...(byKey.get(key) ?? [])].sort((a, b) => a.title.localeCompare(b.title)),
  }));
}

/** `mtimeMs` → a compact "edited …" phrase (the table drops the verb). */
export function editedAgo(mtimeMs: number, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - mtimeMs) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(mtimeMs).toLocaleDateString();
}
