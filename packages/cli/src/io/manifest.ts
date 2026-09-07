/**
 * Build manifest — the record of what `avo build` generated, so the next build
 * can remove what it no longer generates.
 *
 * The prune rule: **a build deletes only the files the previous build recorded
 * as its own output.** Nothing else in the output directory is ever touched —
 * a `CNAME`, a `.nojekyll`, an `assets/` folder, a hand-placed `404.html` were
 * never in the manifest, so they survive every build.
 *
 * Degradation: an output directory with no manifest (built by an older
 * Avodado, or by something else entirely) is left completely alone. The build
 * writes its files, writes a manifest, and reports that it pruned nothing;
 * from the next build on, pruning works.
 */

import { readFile, rmdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

/** File name of the manifest inside the output directory. */
export const MANIFEST_FILE = '.avodado-build.json';

/** On-disk shape. `files` are output-relative POSIX paths. */
export interface BuildManifest {
  readonly version: 1;
  /** CLI version that wrote it — informational. */
  readonly generator: string;
  /** Every path this build wrote, output-relative. */
  readonly files: readonly string[];
}

/**
 * Reads the manifest in `outDir`. Returns `undefined` when it is absent,
 * unreadable, or not a manifest this version understands — every one of those
 * means "prune nothing".
 */
export async function readManifest(outDir: string): Promise<BuildManifest | undefined> {
  let raw: string;
  try {
    raw = await readFile(join(outDir, MANIFEST_FILE), 'utf8');
  } catch {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<BuildManifest>;
    if (parsed.version !== 1 || !Array.isArray(parsed.files)) return undefined;
    const files = parsed.files.filter((f): f is string => typeof f === 'string');
    return { version: 1, generator: String(parsed.generator ?? ''), files };
  } catch {
    return undefined;
  }
}

/** Writes the manifest for the files this build generated. */
export async function writeManifest(
  outDir: string,
  files: readonly string[],
  generator: string,
): Promise<void> {
  const manifest: BuildManifest = { version: 1, generator, files: [...files].sort() };
  await writeFile(join(outDir, MANIFEST_FILE), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

/** True when `abs` is inside `root` (and is not `root` itself). */
function inside(root: string, abs: string): boolean {
  const rel = relative(root, abs);
  return rel !== '' && !rel.startsWith('..') && !rel.startsWith(sep);
}

/**
 * Removes files the previous build generated that this build did not.
 *
 * `previous` comes off disk, so every entry is re-checked: a path that escapes
 * `outDir` is ignored, and a missing file is a no-op. Directories left empty by
 * the removal are cleaned up, stopping at `outDir` itself.
 *
 * @returns The output-relative paths actually removed, sorted.
 */
export async function pruneStale(
  outDir: string,
  previous: readonly string[],
  current: ReadonlySet<string>,
): Promise<string[]> {
  const root = resolve(outDir);
  const removed: string[] = [];
  const parents = new Set<string>();
  for (const rel of previous) {
    if (current.has(rel)) continue;
    const abs = resolve(root, rel);
    if (!inside(root, abs)) continue; // tampered manifest — never climb out
    try {
      await unlink(abs);
    } catch {
      continue; // already gone, or a directory — leave it
    }
    removed.push(rel);
    parents.add(dirname(abs));
  }
  // Drop directories the removal emptied, deepest first, never outDir itself.
  for (const dir of [...parents].sort((a, b) => b.length - a.length)) {
    let cur = dir;
    while (inside(root, cur)) {
      try {
        await rmdir(cur); // fails (and stops the climb) when not empty
      } catch {
        break;
      }
      cur = dirname(cur);
    }
  }
  removed.sort();
  return removed;
}
