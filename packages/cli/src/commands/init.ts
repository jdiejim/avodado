/**
 * `avo init` — scaffold a new Avodado project in the current directory.
 *
 * Copies the template tree (docs sample, config, the authoring skill, and
 * editor adapters for Claude Code + Cursor) into `cwd`.
 */

import { cp, mkdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface InitOptions {
  readonly cwd: string;
  /** Overwrite files that already exist. Default: false (skip with a notice). */
  readonly force?: boolean;
}

export interface InitResult {
  readonly created: readonly string[];
  readonly skipped: readonly string[];
}

/**
 * Resolves the templates directory packaged with the CLI.
 *
 * Walks up from this module's location looking for a `templates` sibling.
 * Works for both `dist/bin.js` (one level up) and source layout
 * (`src/commands/init.ts`, two levels up).
 */
function templatesDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'templates');
    if (existsSync(candidate) && statSync(candidate).isDirectory()) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`Could not locate avodado/cli templates directory near ${import.meta.url}`);
}

const FILES: readonly string[] = [
  'avodado.config.json',
  'docs/getting-started.md',
  'CLAUDE.md',
  '.cursor/rules/avodado.mdc',
  '.avodado/skill/SKILL.md',
];

/**
 * Copies the template tree into `cwd`. Files that already exist are skipped
 * unless `force: true`. Returns the lists of created and skipped relative
 * paths so the caller can report them.
 */
export async function runInit(opts: InitOptions): Promise<InitResult> {
  const srcRoot = templatesDir();
  const created: string[] = [];
  const skipped: string[] = [];

  for (const rel of FILES) {
    const src = resolve(srcRoot, rel);
    const dst = join(opts.cwd, rel);
    if (existsSync(dst) && opts.force !== true) {
      skipped.push(rel);
      continue;
    }
    await mkdir(dirname(dst), { recursive: true });
    await cp(src, dst);
    created.push(rel);
  }

  return { created, skipped };
}
