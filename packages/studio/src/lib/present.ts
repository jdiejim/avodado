/**
 * Present mode's renderer: the CURRENT canvas state (unsaved edits included)
 * as a self-contained slide-deck HTML string, ready for an `<iframe srcDoc>`.
 * Pure — parse + render, no store, no DOM.
 */

import { parseDocument } from 'chiltepin-core';
import { toSlides } from 'chiltepin-render';

/**
 * Renders `source` (any string, saved or not) to the full deck HTML that
 * `chiltepin slides` would produce for it.
 */
export function presentDeckHtml(source: string, slug: string): string {
  return toSlides(parseDocument(source, slug));
}
