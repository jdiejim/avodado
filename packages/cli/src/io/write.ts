/**
 * Overwrite safety for every command that writes to a path the user named.
 *
 * The rule, applied identically everywhere:
 *
 * - A command that writes a **document** (`avo sync … --out`, `avo new -o`,
 *   `avo block -o`, `avo template -o`, `avo design <slug> -o`, `avo skill -o`)
 *   never replaces an existing file. Those paths point into `docs/`, and the
 *   file there is usually hand-written.
 * - A command that writes an **export** (`avo html|slides|pdf|pptx`, and the
 *   gallery writers `demo` / `catalog` / `compare` / `design -p -o`, which all
 *   route through the same writer) replaces a file only when the path already
 *   carries the extension that command produces. Re-exporting `report.html`
 *   over `report.html` is the intended loop; writing HTML over `notes.md` or
 *   `Makefile` is data loss, and refuses.
 * - `--force` overrides both.
 *
 * `avo build` is out of scope here: it owns its output directory and tracks
 * what it generated in a manifest (see `io/manifest.ts`).
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** Inputs to {@link overwriteRefusal}. */
export interface OverwriteGuard {
  /** The user asked for the overwrite explicitly — never refuse. */
  readonly force?: boolean | undefined;
  /**
   * Path suffixes this command regenerates in place (e.g. `['.html']`).
   * A target that ends with one of them is treated as this command's own
   * previous output. Omitted (the document case) protects every existing file.
   */
  readonly regenerates?: readonly string[];
  /** Flag name quoted in the refusal. Defaults to `--force`. */
  readonly flag?: string;
}

/**
 * Returns the refusal message for writing `abs`, or `undefined` when the write
 * is safe. Pure apart from one `existsSync`.
 */
export function overwriteRefusal(abs: string, guard: OverwriteGuard = {}): string | undefined {
  if (guard.force === true) return undefined;
  if (!existsSync(abs)) return undefined;
  const lower = abs.toLowerCase();
  const regenerates = guard.regenerates ?? [];
  if (regenerates.some((ext) => lower.endsWith(ext.toLowerCase()))) return undefined;
  const flag = guard.flag ?? '--force';
  return `${abs} already exists — refusing to overwrite it. Pass ${flag} to replace it, or write to another path.`;
}

/** Thrown by {@link assertWritable} — carries only the refusal message. */
export class OverwriteRefusedError extends Error {
  public override readonly name = 'OverwriteRefusedError';
}

/**
 * Throws {@link OverwriteRefusedError} when writing `abs` would destroy an
 * existing file. For command modules that report by throwing (the CLI's
 * top-level handler prints the message and exits 1).
 */
export function assertWritable(abs: string, guard: OverwriteGuard = {}): void {
  const refusal = overwriteRefusal(abs, guard);
  if (refusal !== undefined) throw new OverwriteRefusedError(refusal);
}

/** Creates the parent directory and writes `data`, refusing to clobber. */
export async function writeFileSafe(
  abs: string,
  data: string | Uint8Array,
  guard: OverwriteGuard = {},
): Promise<void> {
  assertWritable(abs, guard);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, data);
}
