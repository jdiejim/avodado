/**
 * `avo catalog [-s]` — build and render a living catalog of every block type:
 * one block per section (one per slide with `-s`), each showing its identifier
 * (the fenced type name an AI uses to "grab" the block), a one-line description
 * of what it does, and a live sample. Great as an at-a-glance reference, and as
 * a deck to paste/screenshot for teammates.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  BLOCK_TYPES,
  BLOCK_TEMPLATES,
  BLOCK_DESCRIPTIONS,
  BLOCK_FAMILIES,
  isBlockFamily,
  type BlockFamily,
} from '@avodado/core';
import { runSingle, type SingleFormat, type SingleResult } from './single.js';

// The catalog data (templates, descriptions, families) lives in @avodado/core
// (`blocks/catalog.ts`) so non-CLI consumers can share it. These aliases keep
// the CLI's historical `Demo*` names for the existing commands and tests.

/** A block family — alias of {@link BlockFamily} under the CLI's demo name. */
export type DemoFamily = BlockFamily;

/** The families in display order, with their human labels. */
export const DEMO_FAMILIES = BLOCK_FAMILIES;

/** True when `value` names a demo family. */
export const isDemoFamily: (value: string) => value is DemoFamily = isBlockFamily;

export { BLOCK_FAMILY, BLOCK_DESCRIPTIONS, familyBlocks } from '@avodado/core';

/**
 * Builds the catalog document: a `meta` cover, then one section per block type
 * (skipping `meta`, which is the cover). Each section's heading is the block
 * identifier, so as slides every block lands on its own titled slide.
 */
export function buildCatalogDoc(): string {
  const cover =
    '```meta\n' +
    'title: Avodado block catalog\n' +
    'subtitle: A sample of every block — the identifier to use and what it is for.\n' +
    `tag: CATALOG · ${BLOCK_TYPES.length} BLOCKS\n` +
    '```\n';
  const sections = BLOCK_TYPES.filter((t) => t !== 'meta').map(
    (t) => `## ${t}\n\n**\`${t}\`** — ${BLOCK_DESCRIPTIONS[t]}\n\n${BLOCK_TEMPLATES[t]}`,
  );
  return `${cover}\n${sections.join('\n')}`;
}

/**
 * Renders the catalog to `format` (html by default; slides shows one block per
 * slide) and either opens a temp preview or writes to `output`.
 */
export async function runCatalog(opts: {
  readonly format?: SingleFormat;
  readonly output?: string;
  readonly preview?: boolean;
}): Promise<SingleResult> {
  const format = opts.format ?? 'html';
  const dir = join(tmpdir(), 'avodado-catalog');
  await mkdir(dir, { recursive: true });
  const input = join(dir, 'catalog.md');
  await writeFile(input, buildCatalogDoc(), 'utf8');
  return runSingle({
    cwd: dir,
    input,
    format,
    ...(opts.output !== undefined ? { output: opts.output } : { preview: opts.preview ?? true }),
  });
}
