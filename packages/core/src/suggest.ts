/**
 * "Did you mean?" suggestions — a tiny dependency-free fuzzy matcher used to
 * turn a typo'd block type, field name, or enum value into an actionable hint.
 */

/**
 * Levenshtein edit distance between two strings (insert / delete / substitute,
 * cost 1 each). Iterative two-row implementation — O(a·b) time, O(b) space.
 *
 * @param a - First string.
 * @param b - Second string.
 * @returns The minimum number of single-character edits to turn `a` into `b`.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
      // prev[j] = delete, curr[j-1] = insert, prev[j-1] = substitute
      const del = (prev[j] ?? 0) + 1;
      const ins = (curr[j - 1] ?? 0) + 1;
      const sub = (prev[j - 1] ?? 0) + cost;
      curr[j] = del < ins ? (del < sub ? del : sub) : ins < sub ? ins : sub;
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length] ?? 0;
}

/**
 * Returns the candidates closest to `input`, nearest first, within
 * `maxDistance` edits. Case-insensitive. Empty when nothing is close enough —
 * so a wildly wrong value yields no (misleading) suggestion.
 *
 * @param input - The value the author wrote.
 * @param candidates - The set of valid values.
 * @param maxDistance - Maximum edit distance to consider a match (default 2).
 * @returns Up to 3 closest candidates, nearest first.
 *
 * @example
 * ```ts
 * closest('sequnce', ['sequence', 'state', 'erd']); // → ['sequence']
 * ```
 */
export function closest(
  input: string,
  candidates: readonly string[],
  maxDistance = 2,
): string[] {
  const needle = input.toLowerCase();
  const scored: Array<{ value: string; dist: number }> = [];
  for (const c of candidates) {
    const dist = levenshtein(needle, c.toLowerCase());
    if (dist <= maxDistance) scored.push({ value: c, dist });
  }
  scored.sort((x, y) => x.dist - y.dist || x.value.localeCompare(y.value));
  return scored.slice(0, 3).map((s) => s.value);
}
