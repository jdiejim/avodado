/**
 * Document export from Studio's toolbar: the CURRENT canvas state (unsaved
 * edits included) as a downloadable file, mirroring `avo html | slides | pdf |
 * pptx`.
 *
 * HTML and slides are produced entirely in the browser — the renderer is
 * already in this bundle — and handed to the user as a Blob download. PDF and
 * PowerPoint need headless Chromium, so the rendered HTML (page HTML for PDF,
 * deck HTML for PowerPoint) is POSTed to the studio file bridge
 * (`POST /api/export/pdf|pptx`), which runs Playwright and streams the bytes
 * back.
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
  await bridgeExport('pdf', docHtml(doc, theme, themeVars), `${baseName(slug)}.pdf`, 'PDF');
}

/**
 * Downloads the current doc as a PowerPoint deck (`.pptx`). Renders the slide
 * deck HTML here, then asks the file bridge to drive it through Chromium —
 * each slide is photographed into a full-bleed 16:9 image slide, so the deck
 * looks exactly like Present mode. Same first-export Chromium download and
 * error behavior as {@link exportPdf}.
 */
export async function exportPptx(
  doc: Document,
  slug: string,
  theme: ThemeName,
  themeVars: ThemeVars,
): Promise<void> {
  const html = toSlides(doc, { theme, ...(themeVars !== undefined ? { themeVars } : {}) });
  await bridgeExport('pptx', html, `${baseName(slug)}.pptx`, 'PowerPoint');
}

/** POSTs HTML to the file bridge's Chromium exporter and downloads the bytes. */
async function bridgeExport(
  kind: 'pdf' | 'pptx',
  html: string,
  filename: string,
  label: string,
): Promise<void> {
  const res = await fetch(`/api/export/${kind}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html }),
  });
  if (!res.ok) {
    let message = `${label} export failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body.error === 'string') message = body.error;
    } catch {
      /* non-JSON error body — keep the status-based message */
    }
    throw new Error(message);
  }
  const mime =
    kind === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  download(filename, await res.blob(), mime);
}
