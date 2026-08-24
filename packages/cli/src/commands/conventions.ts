/**
 * On-disk convention lint (`W_DOC_CONVENTION`) — path-based, so it lives in
 * the CLI, not in `@avodado/core`.
 *
 * The convention: docs live under the configured docs root with one level of
 * grouping (`docs/<area>/<doc>.md`), and filenames are kebab-case slugs
 * (lowercase a-z, 0-9, hyphens, `.md`). The slug is the reference prefix
 * (`doc#id`), so names are load-bearing. Files outside the docs root are not
 * checked — checking `resources/` fixtures is a legitimate use of `avo check`.
 *
 * Findings are always warnings. No flag escalates them.
 */

import { basename, relative, resolve, sep } from 'node:path';
import type { Diagnostic } from '@avodado/core';

/** Kebab-case doc filename: lowercase a-z, 0-9, single hyphens, `.md`. */
const KEBAB_FILE = /^[a-z0-9]+(-[a-z0-9]+)*\.md$/;

/** Maximum path depth under the docs root: `<area>/<doc>.md` = 2 segments. */
const MAX_DEPTH = 2;

/** Suggests a kebab-case name for a filename that is not kebab-case. */
export function kebabSuggestion(filename: string): string {
  const stem = filename.replace(/\.md$/i, '');
  const slug = stem
    // CamelCase → camel-case, before everything is lowercased.
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    // Every run of non-slug characters (underscores, spaces, dots, …) → one hyphen.
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug.length > 0 ? slug : 'doc'}.md`;
}

/**
 * Checks one file path against the on-disk convention.
 *
 * @param file - Path relative to `cwd` (as reported in diagnostics).
 * @param absolute - Absolute path on disk.
 * @param cwd - The working directory.
 * @param docsRoot - The configured docs root, relative to `cwd`.
 * @returns Zero or more `W_DOC_CONVENTION` warnings. Files outside the docs
 *   root return none.
 */
export function lintConventions(
  file: string,
  absolute: string,
  cwd: string,
  docsRoot: string,
): Diagnostic[] {
  const rel = relative(resolve(cwd, docsRoot), absolute);
  const inside = rel.length > 0 && !rel.startsWith('..') && !rel.startsWith(sep);
  if (!inside) return [];

  const diagnostics: Diagnostic[] = [];
  const name = basename(absolute);

  if (!KEBAB_FILE.test(name)) {
    diagnostics.push({
      file,
      level: 'warn',
      code: 'W_DOC_CONVENTION',
      message: `The file name "${name}" is not kebab-case. Doc names use lowercase a-z, 0-9, and hyphens. The name is the reference prefix, so refs to this doc inherit it.`,
      value: name,
      hint: `Rename the file to kebab-case: ${kebabSuggestion(name)}.`,
    });
  }

  const depth = rel.split(sep).length;
  if (depth > MAX_DEPTH) {
    diagnostics.push({
      file,
      level: 'warn',
      code: 'W_DOC_CONVENTION',
      message: `The file is ${depth} levels below ${docsRoot}/. The convention permits one group level: ${docsRoot}/<area>/<doc>.md.`,
      value: rel.split(sep).join('/'),
      hint: `Move the file to ${docsRoot}/<area>/${name}, then update refs to its old slug.`,
    });
  }

  return diagnostics;
}
