/**
 * `avo demo [family]` — render the bundled showcase doc (every block type, or
 * just one family of blocks) so a user can see Avodado without writing
 * anything. Defaults to opening an HTML preview in the browser.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseDocument } from '@avodado/core';
import { runSingle, type SingleFormat, type SingleResult } from './single.js';
import { templatesDir } from './init.js';
import { BLOCK_FAMILY, DEMO_FAMILIES, type DemoFamily } from './catalog.js';

/**
 * Filters the demo source down to one family of blocks.
 *
 * Mechanism: `parseDocument` yields ordered segments; markdown segments carry
 * their raw `.text` and typed segments carry the raw body `.raw` plus the fence
 * tag `.kind`, so the filtered doc is re-emitted losslessly — markdown segments
 * verbatim, typed segments as a rebuilt ` ```kind … ``` ` fence. The `meta`
 * cover is always kept; a markdown run (usually a `## heading` + lede) is kept
 * only when the typed block *immediately after it* is kept, so orphan headings
 * for filtered-out blocks are dropped.
 */
export function filterDemoSource(source: string, family: DemoFamily): string {
  const doc = parseDocument(source, 'demo');
  const label = DEMO_FAMILIES.find((f) => f.id === family)?.label ?? family;
  const out: string[] = [];
  let pendingMarkdown: string | undefined;
  for (const seg of doc.segments) {
    if (seg.kind === 'markdown') {
      // Only the run directly before a kept block survives — track the latest.
      pendingMarkdown = seg.text;
      continue;
    }
    const keep = seg.kind === 'meta' || BLOCK_FAMILY[seg.kind] === family;
    if (keep) {
      if (seg.kind === 'meta') {
        // Re-tag the cover so the filtered showcase names its family.
        out.push('```meta\n' + retagMeta(seg.raw, label) + '\n```');
      } else {
        if (pendingMarkdown !== undefined) out.push(pendingMarkdown.trim());
        out.push('```' + seg.kind + '\n' + seg.raw + '\n```');
      }
    }
    pendingMarkdown = undefined; // consumed or orphaned either way
  }
  return out.join('\n\n') + '\n';
}

/** Rewrites the demo cover's `tag:` line to name the family being shown. */
function retagMeta(raw: string, label: string): string {
  const tagged = `tag: DEMO · ${label.toUpperCase()}`;
  if (/^tag:.*$/m.test(raw)) return raw.replace(/^tag:.*$/m, tagged);
  return `${raw}\n${tagged}`;
}

/** Renders the bundled demo doc to `format` and opens it (preview by default). */
export async function runDemo(opts: {
  readonly format?: SingleFormat;
  readonly preview?: boolean;
  /** Absolute output path (the caller resolves it) — disables preview. */
  readonly output?: string;
  /** Restrict the showcase to one block family. */
  readonly family?: DemoFamily;
}): Promise<SingleResult> {
  const format = opts.format ?? 'html';
  let source = await readFile(join(templatesDir(), 'demo.md'), 'utf8');
  if (opts.family !== undefined) source = filterDemoSource(source, opts.family);

  // Drop the demo doc in its own temp dir and render it from there, so it uses
  // the default theme and never touches the user's project.
  const dir = join(tmpdir(), 'avodado-demo');
  await mkdir(dir, { recursive: true });
  const input = join(dir, opts.family === undefined ? 'demo.md' : `demo-${opts.family}.md`);
  await writeFile(input, source, 'utf8');

  return runSingle({
    cwd: dir,
    input,
    format,
    ...(opts.output !== undefined ? { output: opts.output } : { preview: opts.preview ?? true }),
  });
}
