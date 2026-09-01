/**
 * `pie` → `chart` block data (`kind: donut`).
 *
 * Supported: the header `pie`, optionally followed by `showData` and/or
 * `title Text` on the same line or on its own line; slice lines
 * `"Label" : 42`. `showData` and `%%` comments are ignored.
 */

import { bodyLines, fail, startsWithWord, unquote, type MermaidResult } from './lines.js';

const HEADER_RE = /^pie(?:\s+showData)?(?:\s+title\s+(.+))?$/;
const SLICE_RE = /^("[^"]*"|[^:"]+?)\s*:\s*(-?\d+(?:\.\d+)?)\s*$/;

export function convertPie(text: string): MermaidResult {
  const lines = bodyLines(text);
  const first = lines[0];
  if (first === undefined) return fail('empty pie', 1);
  const h = HEADER_RE.exec(first.text);
  if (h === null) return fail(`cannot read pie header: "${first.text}"`, first.line);
  let title = h[1]?.trim();
  const items: { label: string; value: number }[] = [];

  for (const { text: t, line } of lines.slice(1)) {
    if (t === 'showData') continue;
    if (startsWithWord(t, 'title')) {
      title = t.slice('title'.length).trim();
      continue;
    }
    const s = SLICE_RE.exec(t);
    if (s === null) return fail(`cannot read pie slice: "${t}" (expected \`"Label" : 42\`)`, line);
    items.push({ label: unquote(s[1] ?? ''), value: Number(s[2]) });
  }

  return {
    ok: true,
    data: {
      kind: 'donut',
      ...(title !== undefined && title.length > 0 ? { title } : {}),
      ...(items.length > 0 ? { items } : {}),
    },
  };
}
