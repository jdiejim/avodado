/**
 * HTML export — a thin delegate to `@avodado/render`.
 *
 * Kept as a distinct entry point so consumers can think of "export" as a single
 * concept (HTML and PDF live behind one API) without pulling in the renderer
 * directly.
 */

import type { Document } from '@avodado/core';
import { renderDocument } from '@avodado/render';

/**
 * Renders a {@link Document} to a standalone HTML string.
 *
 * @param doc - The parsed document.
 * @returns A complete HTML string.
 */
export function toHtml(doc: Document): string {
  return renderDocument(doc);
}
