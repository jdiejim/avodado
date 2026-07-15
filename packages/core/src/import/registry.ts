/**
 * Importer registry — the honest, data-only catalog of what Avodado can
 * import. Each importer maps file extensions to what it produces: a `block`
 * importer yields ready-to-insert fenced blocks (CSV → `table` /
 * `statustable` / `chart`), a `document` importer yields a whole Markdown
 * document (OpenAPI → API doc). No framework: an array plus one lookup.
 */

/** One import source Avodado understands. */
export interface Importer {
  readonly id: 'csv' | 'openapi';
  /** Lowercase file extensions (with the dot) this importer claims. */
  readonly extensions: readonly string[];
  /** What the importer produces: a fenced block or a whole document. */
  readonly kind: 'block' | 'document';
}

/** Every importer, in preference order. */
export const IMPORTERS: readonly Importer[] = [
  { id: 'csv', extensions: ['.csv'], kind: 'block' },
  { id: 'openapi', extensions: ['.yaml', '.yml', '.json'], kind: 'document' },
];

/**
 * The importer that claims `name`'s extension (case-insensitive), or `null`.
 * Extension-only routing — a `.json` hit still needs a content sniff to tell
 * OpenAPI from arbitrary JSON; that judgement belongs to the caller.
 */
export function importerForFile(name: string): Importer | null {
  const dot = name.lastIndexOf('.');
  if (dot === -1) return null;
  const ext = name.slice(dot).toLowerCase();
  return IMPORTERS.find((imp) => imp.extensions.includes(ext)) ?? null;
}
