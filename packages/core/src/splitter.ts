/**
 * Splits a Markdown source string into prose runs and typed fenced blocks.
 *
 * The splitter only recognises fences whose info-string is a known
 * {@link BlockType}. Other fenced code blocks (e.g. ```` ```ts ````) fall through
 * to prose and are rendered by the Markdown pipeline.
 */

import { BLOCK_TYPES, BLOCK_TYPE_SET, type BlockType, type SuspectFence } from './types.js';
import { closest } from './suggest.js';

const OPEN_FENCE_RE = /^```([A-Za-z][\w-]*)\s*$/;
const CLOSE_FENCE_RE = /^```\s*$/;

/**
 * A raw segment before YAML parsing.
 *
 * The free-form Markdown variant uses `kind: 'markdown'` so the discriminator
 * stays distinct from the typed `prose` block.
 */
export type RawSegment =
  | { readonly kind: 'markdown'; readonly text: string; readonly line: number }
  | { readonly kind: BlockType; readonly raw: string; readonly line: number };

/**
 * Splits Markdown into prose and typed-block segments.
 *
 * - Line endings (`\r\n`, `\r`) are normalised to `\n` first.
 * - Only fences whose tag is in {@link BLOCK_TYPE_SET} are extracted as typed
 *   blocks; others remain in prose.
 * - Each segment captures its 1-based starting line number.
 * - If an opening fence is never closed, the block extends to EOF.
 *
 * @param md - The Markdown source.
 * @returns Ordered raw segments.
 *
 * @example
 * ```ts
 * splitMarkdown('## Intro\n\n```callout\nkind: note\n```\n');
 * // → [{ kind: 'prose', ... }, { kind: 'callout', raw: 'kind: note', line: 3 }]
 * ```
 */
export function splitMarkdown(md: string): RawSegment[] {
  const normalised = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalised.split('\n');
  const segments: RawSegment[] = [];

  let proseBuf: string[] = [];
  let proseStart = 1;
  let i = 0;

  const flushProse = (): void => {
    if (proseBuf.length === 0) return;
    const text = proseBuf.join('\n');
    if (text.trim().length > 0) {
      segments.push({ kind: 'markdown', text, line: proseStart });
    }
    proseBuf = [];
  };

  while (i < lines.length) {
    const line = lines[i] ?? '';
    const openMatch = OPEN_FENCE_RE.exec(line);
    const tag = openMatch?.[1];

    if (tag !== undefined && BLOCK_TYPE_SET.has(tag)) {
      flushProse();
      const blockStart = i + 1;
      const bodyLines: string[] = [];
      i++;
      while (i < lines.length && !CLOSE_FENCE_RE.test(lines[i] ?? '')) {
        bodyLines.push(lines[i] ?? '');
        i++;
      }
      segments.push({
        kind: tag as BlockType,
        raw: bodyLines.join('\n'),
        line: blockStart,
      });
      if (i < lines.length) i++;
      proseStart = i + 1;
    } else {
      if (proseBuf.length === 0) proseStart = i + 1;
      proseBuf.push(line);
      i++;
    }
  }

  flushProse();
  return segments;
}

/**
 * Scans for fence tags that aren't a known block type but are within edit
 * distance of one — i.e. likely typos (` ```sequnce ` for ` ```sequence `).
 * These would otherwise fall through to prose and render as an inert code
 * block, a silent authoring failure. Fences with known tags are skipped along
 * with their bodies, so interior lines are never mis-flagged.
 *
 * @param md - The Markdown source.
 * @returns The suspect fences found, in document order.
 */
export function detectSuspectFences(md: string): SuspectFence[] {
  const lines = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const out: SuspectFence[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    const tag = OPEN_FENCE_RE.exec(line)?.[1];
    if (tag !== undefined && BLOCK_TYPE_SET.has(tag)) {
      // Skip a known typed block in full so we don't inspect its body.
      i++;
      while (i < lines.length && !CLOSE_FENCE_RE.test(lines[i] ?? '')) i++;
      if (i < lines.length) i++;
      continue;
    }
    if (tag !== undefined) {
      // Candidates come from BLOCK_TYPES, so a match is a BlockType.
      const [suggestion] = closest(tag, BLOCK_TYPES, 2) as BlockType[];
      if (suggestion !== undefined) {
        out.push({ line: i + 1, tag, suggestion });
      }
    }
    i++;
  }
  return out;
}
