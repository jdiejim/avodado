/**
 * File-system helpers: glob expansion, document reading, slug derivation.
 *
 * Slug rule: a doc's slug is its path relative to the docs root, stripped of
 * `.md` and normalised to forward slashes. Files outside the docs root fall
 * back to their basename without `.md`.
 */

import { readFile } from 'node:fs/promises';
import { basename, relative, resolve, sep } from 'node:path';
import fg from 'fast-glob';

/** A document file on disk, with derived slug. */
export interface DocFile {
  /** Absolute path on disk. */
  readonly absolute: string;
  /** Path relative to cwd (used in diagnostics). */
  readonly file: string;
  /** Slug derived from path under the docs root. */
  readonly slug: string;
  /** Raw markdown source. */
  readonly source: string;
}

/**
 * Expands one or more glob patterns to a list of {@link DocFile}s with read
 * content and derived slugs.
 *
 * @param patterns - One or more glob patterns (relative to `cwd`).
 * @param cwd - The working directory the patterns resolve from.
 * @param docsRoot - The docs root the slug is derived against.
 */
export async function loadDocs(
  patterns: readonly string[],
  cwd: string,
  docsRoot: string,
): Promise<DocFile[]> {
  const matches = await fg(patterns as string[], {
    cwd,
    absolute: true,
    onlyFiles: true,
    dot: false,
  });
  const docsRootAbs = resolve(cwd, docsRoot);
  const files = await Promise.all(
    matches.map(async (absolute): Promise<DocFile> => {
      const file = relative(cwd, absolute);
      const slug = deriveSlug(absolute, docsRootAbs);
      const source = await readFile(absolute, 'utf8');
      return { absolute, file, slug, source };
    }),
  );
  files.sort((a, b) => a.file.localeCompare(b.file));
  return files;
}

function deriveSlug(absolute: string, docsRootAbs: string): string {
  const rel = relative(docsRootAbs, absolute);
  const inside = !rel.startsWith('..') && !rel.startsWith(sep) && rel.length > 0;
  const path = inside ? rel : basename(absolute);
  return path.replace(/\\/g, '/').replace(/\.md$/i, '');
}
