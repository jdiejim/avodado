/**
 * `avo sync openapi` — generate an Avodado doc from an OpenAPI spec, or
 * verify that an existing doc matches what the spec would generate (CI drift).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, resolve, extname } from 'node:path';
import { openapiToMarkdown, parseOpenApi } from '@avodado/sync';

/** Inputs for {@link runSyncOpenApi}. */
export interface SyncOpenApiOptions {
  readonly cwd: string;
  /** Path to the OpenAPI spec (relative or absolute). */
  readonly spec: string;
  /** Output path (write mode). Mutually exclusive with `check`. */
  readonly out?: string;
  /** Path to compare generated output against (drift mode). */
  readonly check?: string;
  /** Slug used to namespace generated block ids. Defaults to the output basename. */
  readonly slug?: string;
}

/** Result of `avo sync openapi`. */
export interface SyncOpenApiResult {
  readonly exitCode: 0 | 1 | 2;
  /** A short, plain-text summary suitable for logging. */
  readonly message: string;
  /** When `check` mode finds drift: the line-level diff. */
  readonly diff?: string;
}

function slugFromPath(path: string): string {
  const base = basename(path, extname(path));
  return base.length > 0 ? base : 'api';
}

/**
 * Generates an Avodado doc from an OpenAPI spec — either writing it to disk,
 * or comparing the in-memory result against an existing doc on disk and
 * reporting drift.
 */
export async function runSyncOpenApi(opts: SyncOpenApiOptions): Promise<SyncOpenApiResult> {
  if (opts.out === undefined && opts.check === undefined) {
    return { exitCode: 2, message: 'avo sync openapi: must specify --out <path> or --check <path>' };
  }
  if (opts.out !== undefined && opts.check !== undefined) {
    return { exitCode: 2, message: 'avo sync openapi: --out and --check are mutually exclusive' };
  }

  const specAbs = resolve(opts.cwd, opts.spec);
  if (!existsSync(specAbs)) {
    return { exitCode: 2, message: `Spec not found: ${specAbs}` };
  }

  const source = await readFile(specAbs, 'utf8');
  let spec;
  try {
    spec = parseOpenApi(source);
  } catch (err) {
    return { exitCode: 1, message: `Failed to parse spec: ${(err as Error).message}` };
  }

  const targetPath = opts.out ?? opts.check;
  if (targetPath === undefined) {
    return { exitCode: 2, message: 'no target path' };
  }
  const slug = opts.slug ?? slugFromPath(targetPath);
  const generated = openapiToMarkdown(spec, { slug });

  if (opts.out !== undefined) {
    const outAbs = resolve(opts.cwd, opts.out);
    await mkdir(dirname(outAbs), { recursive: true });
    await writeFile(outAbs, generated, 'utf8');
    return {
      exitCode: 0,
      message: `Wrote ${outAbs} (${generated.length} bytes)`,
    };
  }

  // Check mode — compare against existing file.
  const checkAbs = resolve(opts.cwd, opts.check ?? '');
  if (!existsSync(checkAbs)) {
    return {
      exitCode: 1,
      message: `Drift: ${checkAbs} does not exist. Run with --out ${opts.check} to generate it.`,
    };
  }
  const existing = await readFile(checkAbs, 'utf8');
  if (existing === generated) {
    return {
      exitCode: 0,
      message: `OK: ${checkAbs} matches ${specAbs} (${generated.length} bytes)`,
    };
  }
  return {
    exitCode: 1,
    message: `Drift: ${checkAbs} differs from what ${specAbs} would generate.`,
    diff: simpleDiff(existing, generated),
  };
}

/** Tiny line-level diff for the drift report. Not a full diff library; good enough for CI. */
function simpleDiff(a: string, b: string): string {
  const aLines = a.split('\n');
  const bLines = b.split('\n');
  const out: string[] = [];
  const max = Math.max(aLines.length, bLines.length);
  for (let i = 0; i < max; i++) {
    const av = aLines[i];
    const bv = bLines[i];
    if (av === bv) continue;
    if (av !== undefined) out.push(`- ${av}`);
    if (bv !== undefined) out.push(`+ ${bv}`);
    if (out.length >= 40) {
      out.push(`… (truncated; ${max - i - 1} more lines)`);
      break;
    }
  }
  return out.join('\n');
}
