/**
 * Shared helper for reference-bearing link chips (`userstory` + `stories`).
 *
 * A ref is `#id` or `doc#id`. Block ids are repo-global unique, so `href="#id"`
 * is already correct within one document; `avo build` rewrites cross-doc hrefs
 * by post-processing the emitted `data-ref` attribute.
 */

/** The id part of a ref: `doc#id` → `id`, `#id` → `id`, `id` → `id`. */
export function refIdPart(ref: string): string {
  return ref.slice(ref.indexOf('#') + 1);
}
