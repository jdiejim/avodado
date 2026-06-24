/**
 * Wraps text to fit within an approximate character-per-line budget, capping
 * the total number of lines. Word-aware (won't break mid-word).
 *
 * Used by diagram renderers for fixed-size labels. Ported from
 * `resources/doc-studio.jsx` `wrapText`.
 */

/**
 * @param text - Source text (any value is coerced via `String(...)`).
 * @param max - Approximate maximum characters per line.
 * @param maxLines - Maximum number of lines to return (later lines dropped).
 * @returns An array of wrapped lines; empty array for empty input.
 */
export function wrapText(text: unknown, max: number, maxLines: number): string[] {
  if (text === undefined || text === null || text === '') return [];
  const words = String(text).split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!cur) {
      cur = w;
      continue;
    }
    if ((cur + ' ' + w).length <= max) {
      cur += ' ' + w;
    } else {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines.slice(0, maxLines);
}
