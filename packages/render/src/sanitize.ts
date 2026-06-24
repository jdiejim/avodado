/**
 * Output-safety helpers.
 *
 * Avodado documents are normally authored by trusted hands, but rendered output
 * is also shown in untrusted contexts — the playground renders documents from
 * shared URLs, and any hosted preview renders whatever a visitor pastes. So the
 * renderer treats author-supplied values (colours, link hrefs, prose HTML) as
 * untrusted and neutralises anything that could break out of its target context.
 *
 * These functions are pure and allocation-light; they run on every render.
 */

/**
 * Matches a safe CSS colour value: hex (`#rgb`/`#rgba`/`#rrggbb`/`#rrggbbaa`),
 * `rgb()/rgba()`, `hsl()/hsla()`, or a bare CSS named colour. Anything with a
 * quote, semicolon, angle bracket, or `url(` is rejected — those are the
 * shapes an attacker uses to break out of a `fill="…"` or `style="…"` context.
 */
const SAFE_COLOR_RE =
  /^(#[0-9a-fA-F]{3,8}|rgba?\([\d.,\s%]+\)|hsla?\([\d.,\s%]+\)|[a-zA-Z]{1,24})$/;

/**
 * Returns `value` if it is a safe CSS colour, otherwise `fallback`.
 *
 * Use this for any author-supplied colour that gets interpolated into an SVG
 * attribute (`fill`, `stroke`) or a `style` declaration.
 *
 * @param value - The candidate colour (any author string, or undefined).
 * @param fallback - The colour to use when `value` is missing or unsafe.
 */
export function safeColor(value: string | undefined, fallback: string): string {
  if (value === undefined) return fallback;
  const trimmed = value.trim();
  return SAFE_COLOR_RE.test(trimmed) ? trimmed : fallback;
}

/** URL schemes that can execute script or smuggle markup. */
const DANGEROUS_URL_RE = /^\s*(javascript|data|vbscript):/i;

/**
 * Returns `url` if its scheme is safe to put in an `href`/`src`, otherwise `#`.
 *
 * Relative URLs, fragments (`#id`), and the usual web schemes pass through;
 * `javascript:`, `data:`, and `vbscript:` are rejected.
 *
 * @param url - The candidate URL.
 */
export function safeUrl(url: string): string {
  return DANGEROUS_URL_RE.test(url) ? '#' : url;
}
