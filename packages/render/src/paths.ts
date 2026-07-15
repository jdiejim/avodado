/**
 * Data-path attribute helpers for direct on-diagram editing.
 *
 * Renderers tag the element that visually represents one addressable YAML
 * value/item with `data-bp` (block path), and the CONTAINER element of a YAML
 * array with `data-bl` (block list). Paths are dot-joined segments from the
 * block's data root; a numeric segment is an array index — e.g. `actors.0`,
 * `messages.2.text`, `rows.1.2`, `entities.0.columns.3`, `title`.
 *
 * The attributes are inert metadata: emitted on every render target (serve,
 * build, export), they change no visual output and work identically on SVG
 * (`<g data-bp="…">`) and HTML elements. Editors (Avodado Studio) use them to
 * map DOM hits back to YAML paths.
 */

import { escapeHtml } from './escape.js';

/** ` data-bp="…"` — marks the element for one addressable YAML value/item. */
export function bp(path: string): string {
  return ` data-bp="${escapeHtml(path)}"`;
}

/** ` data-bl="…"` — marks the container element of a YAML array. */
export function bl(listPath: string): string {
  return ` data-bl="${escapeHtml(listPath)}"`;
}
