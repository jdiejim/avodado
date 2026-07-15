/**
 * Document export from Studio's toolbar: the CURRENT canvas state (unsaved
 * edits included) as a downloadable file, mirroring `avo html | slides | pdf`.
 *
 * HTML and slides are produced entirely in the browser — the renderer is
 * already in this bundle — and handed to the user as a Blob download. PDF needs
 * headless Chromium, so the themed HTML is POSTed to the studio file bridge
 * (`POST /api/export/pdf`), which runs Playwright and streams the bytes back.
 */

import type { Document } from '@avodado/core';
import { renderDocument, toSlides, type ThemeName } from '@avodado/render';

type ThemeVars = Readonly<Record<string, string>> | undefined;

/** `docs/api/orders` → `orders`; the export lands as `orders.<ext>`. */
function baseName(slug: string): string {
  return slug.split('/').pop() ?? slug;
}

/** Renders the doc to standalone HTML with the studio's active theme. */
function docHtml(doc: Document, theme: ThemeName, themeVars: ThemeVars): string {
  return renderDocument(doc, { theme, ...(themeVars !== undefined ? { themeVars } : {}) });
}

/** Triggers a browser download of `data` as `filename`. */
function download(filename: string, data: BlobPart, mime: string): void {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Downloads the current doc as a standalone, themed HTML page. */
export function exportDocHtml(
  doc: Document,
  slug: string,
  theme: ThemeName,
  themeVars: ThemeVars,
): void {
  download(`${baseName(slug)}.html`, docHtml(doc, theme, themeVars), 'text/html;charset=utf-8');
}

/** Downloads the current doc as a self-contained slide deck (HTML). */
export function exportDeckHtml(
  doc: Document,
  slug: string,
  theme: ThemeName,
  themeVars: ThemeVars,
): void {
  const html = toSlides(doc, { theme, ...(themeVars !== undefined ? { themeVars } : {}) });
  download(`${baseName(slug)}.slides.html`, html, 'text/html;charset=utf-8');
}

/**
 * Downloads the current doc as a PDF. Renders the themed HTML here, then asks
 * the file bridge to run it through Chromium. Chromium is downloaded on the
 * server's first PDF export (~100 MB, one time), so this can take a while then;
 * the caller should show progress. Throws with the server's message on failure.
 */
export async function exportPdf(
  doc: Document,
  slug: string,
  theme: ThemeName,
  themeVars: ThemeVars,
): Promise<void> {
  const res = await fetch('/api/export/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html: docHtml(doc, theme, themeVars) }),
  });
  if (!res.ok) {
    let message = `PDF export failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body.error === 'string') message = body.error;
    } catch {
      /* non-JSON error body — keep the status-based message */
    }
    throw new Error(message);
  }
  download(`${baseName(slug)}.pdf`, await res.blob(), 'application/pdf');
}
