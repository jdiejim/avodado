/**
 * Present mode's renderer: the CURRENT canvas state (unsaved edits included)
 * as a self-contained slide-deck HTML string, ready for an `<iframe srcDoc>`.
 * Pure — parse + render, no store, no DOM.
 */

import { parseDocument } from '@avodado/core';
import { toSlides } from '@avodado/render';

/**
 * Renders `source` (any string, saved or not) to the full deck HTML that
 * `avo slides` would produce for it.
 */
export function presentDeckHtml(source: string, slug: string): string {
  return toSlides(parseDocument(source, slug));
}
