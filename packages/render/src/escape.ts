/**
 * HTML entity escaping, matching the reference renderer's `esc` semantics.
 *
 * Escapes `&`, `<`, `>`, and `"`. `null`/`undefined` become the empty string.
 * Non-string values are coerced via `String()`.
 */

const REPL: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

/**
 * Escapes a value for safe insertion into HTML text or attribute content.
 *
 * @param value - The value to escape (any type).
 * @returns The escaped string. Empty string for `null`/`undefined`.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"]/g, (c) => REPL[c] ?? c);
}
