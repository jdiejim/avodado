/**
 * Document parser — turns a Markdown string into a {@link Document}.
 *
 * Errors (YAML parse failures, schema problems) are deferred to
 * {@link validateDocument}. The parser's job is to produce a model; validation's
 * job is to report problems with that model.
 */

import { splitMarkdown, detectSuspectFences } from './splitter.js';
import { parseBlockBody } from './yaml.js';
import type { Document, MetaData, Segment, TypedSegment } from './types.js';

function extractId(data: unknown): string | undefined {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return undefined;
  const id = (data as { id?: unknown }).id;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

function extractMeta(data: unknown): MetaData | undefined {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return undefined;
  const d = data as { title?: unknown; subtitle?: unknown; tag?: unknown; logo?: unknown };
  const meta: { -readonly [K in keyof MetaData]: MetaData[K] } = {};
  if (typeof d.title === 'string') meta.title = d.title;
  if (typeof d.subtitle === 'string') meta.subtitle = d.subtitle;
  if (typeof d.tag === 'string') meta.tag = d.tag;
  if (typeof d.logo === 'string') meta.logo = d.logo;
  return Object.keys(meta).length > 0 ? meta : undefined;
}

/**
 * Parses an Avodado Markdown document.
 *
 * @param markdown - The document source.
 * @param slug - The document slug (typically the path under the docs root,
 *   stripped of `.md`).
 * @returns A {@link Document} ready to validate, resolve, and render.
 *
 * @example
 * ```ts
 * const doc = parseDocument(await readFile('docs/orders.md', 'utf8'), 'orders');
 * ```
 */
export function parseDocument(markdown: string, slug: string): Document {
  const raws = splitMarkdown(markdown);
  const segments: Segment[] = [];
  let meta: MetaData | undefined;
  // Tracks how many typed (non-prose) blocks we've seen, so meta-detection
  // ("is this the document's first block?") is O(1) per block, not O(n).
  let typedBlockCount = 0;

  for (const r of raws) {
    if (r.kind === 'markdown') {
      segments.push({ kind: 'markdown', text: r.text, line: r.line });
      continue;
    }
    typedBlockCount += 1;

    const parsed = parseBlockBody(r.raw);
    const id = parsed.ok ? extractId(parsed.data) : undefined;

    const seg = {
      kind: r.kind,
      raw: r.raw,
      line: r.line,
      data: parsed.ok ? parsed.data : undefined,
      ...(id !== undefined ? { id } : {}),
      ...(parsed.ok
        ? {}
        : {
            parseError: parsed.message,
            ...(parsed.line !== undefined ? { parseErrorLine: parsed.line } : {}),
            ...(parsed.column !== undefined ? { parseErrorColumn: parsed.column } : {}),
          }),
    } as TypedSegment;
    segments.push(seg);

    // `meta` is only meaningful as the document's very first typed block.
    if (r.kind === 'meta' && meta === undefined && typedBlockCount === 1 && parsed.ok) {
      meta = extractMeta(parsed.data);
    }
  }

  const suspectFences = detectSuspectFences(markdown);

  return {
    slug,
    segments,
    ...(meta !== undefined ? { meta } : {}),
    ...(suspectFences.length > 0 ? { suspectFences } : {}),
  };
}
