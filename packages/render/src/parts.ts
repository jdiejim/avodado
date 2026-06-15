/**
 * Renders a parsed {@link Document} into its composable PARTS — the CSS, the
 * theme-variable string, the inner body HTML (for a `<div class="docskin">`),
 * the title, and a section index for navigation.
 *
 * {@link renderDocument} (in `document.ts`) wraps these parts into a standalone
 * `<!doctype html>` page. Embedding consumers (e.g. a React app) inject the
 * parts directly: one `<style>` with `css`, a scoped `<style>` that sets the
 * theme vars, and the `body` inside their own `.docskin` host. This avoids
 * nesting a full HTML document inside the page and enables live theme switching
 * (swap only the theme-vars style) and section-level navigation (each section
 * carries an `id`).
 */

import type { BlockDataMap, BlockType, Document, Segment, TypedSegment } from '@avodado/core';
import { houseCss } from './css.js';
import { escapeHtml } from './escape.js';
import { renderCover } from './blocks/meta.js';
import { SECTION_LABEL } from './blocks/frame.js';
import { renderProse } from './markdown.js';
import { htmlRenderers } from './registry.js';
import { globalDefsSvg } from './svg/defs.js';
import { DEFAULT_THEME, themeStyle, type ThemeName } from './themes.js';

/** Options shared by {@link renderDocumentParts} and the page renderer. */
export interface RenderPartsOptions {
  /** Theme name. Defaults to `textbook`. */
  readonly theme?: ThemeName;
  /**
   * Custom CSS-variable overrides applied after the named theme (they win),
   * e.g. `{ '--navy': '#123456' }`.
   */
  readonly themeVars?: Readonly<Record<string, string>>;
}

/** One navigable section of a rendered document. */
export interface DocumentSection {
  /** DOM id of the `<section>` (e.g. `section-01`). */
  readonly id: string;
  /** 1-based section number. */
  readonly num: number;
  /** Section label (e.g. `Roadmap`, `Sequence`). */
  readonly label: string;
  /** The block's title, if it has one. */
  readonly title?: string;
}

/** The composable pieces of a rendered document. */
export interface DocumentParts {
  /** Theme-independent house stylesheet. Inject once. */
  readonly css: string;
  /** Theme variable declarations (e.g. `--navy:#0f766e;`), or `''` for default. */
  readonly themeVars: string;
  /** Inner HTML for a `<div class="docskin">` host: defs + cover + sections. */
  readonly body: string;
  /** Document title (from the `meta` block). */
  readonly title: string;
  /** Section index for navigation. */
  readonly sections: readonly DocumentSection[];
}

interface RenderCtx {
  sectionNum: number;
  sections: DocumentSection[];
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Reads optional title/lede from a block's data, defensively typed. */
function readTitleAndLede(data: unknown): { title?: string; lede?: string } {
  if (data === null || typeof data !== 'object') return {};
  const d = data as { title?: unknown; lede?: unknown };
  const out: { title?: string; lede?: string } = {};
  if (typeof d.title === 'string' && d.title.length > 0) out.title = d.title;
  if (typeof d.lede === 'string' && d.lede.length > 0) out.lede = d.lede;
  return out;
}

function renderSectionHead(num: number, kind: BlockType, title?: string, lede?: string): string {
  const label = SECTION_LABEL[kind];
  const titleHtml =
    title !== undefined ? `<h2 class="section-title">${escapeHtml(title)}</h2>` : '';
  const ledeHtml = lede !== undefined ? `<p class="section-lede">${escapeHtml(lede)}</p>` : '';
  return (
    `<div class="section-head">` +
    `<div class="section-num">SECTION ${pad2(num)} · ${escapeHtml(label)}</div>` +
    titleHtml +
    ledeHtml +
    `</div>`
  );
}

/**
 * Dispatches a typed block to its renderer. The registry is keyed by the same
 * `BlockType` discriminant as the segment, so this single contained cast asserts
 * the invariant rather than leaking casts to every call site.
 */
function dispatchBlock<K extends BlockType>(kind: K, data: BlockDataMap[K]): string {
  const fn = htmlRenderers[kind] as (data: BlockDataMap[K]) => string;
  return fn(data);
}

function renderTypedSegment(seg: TypedSegment, ctx: RenderCtx): string {
  if (seg.kind === 'meta') return '';
  if (seg.parseError !== undefined) {
    return `<div class="err">${escapeHtml(seg.kind)} block — parse error:\n${escapeHtml(seg.parseError)}</div>`;
  }
  if (seg.data === null || seg.data === undefined) return '';

  const body = dispatchBlock(seg.kind, seg.data as BlockDataMap[typeof seg.kind]);

  ctx.sectionNum += 1;
  const num = ctx.sectionNum;
  const { title, lede } = readTitleAndLede(seg.data);
  const id = `section-${pad2(num)}`;
  ctx.sections.push({
    id,
    num,
    label: SECTION_LABEL[seg.kind],
    ...(title !== undefined ? { title } : {}),
  });
  const head = renderSectionHead(num, seg.kind, title, lede);

  return `<section id="${id}" class="section-block">${head}${body}</section>`;
}

function renderSegment(seg: Segment, ctx: RenderCtx): string {
  if (seg.kind === 'markdown') return renderProse(seg.text);
  return renderTypedSegment(seg, ctx);
}

/** Builds the theme-variable declaration string (named theme + overrides). */
export function buildThemeVars(
  theme: ThemeName,
  vars?: Readonly<Record<string, string>>,
): string {
  let css = themeStyle(theme);
  if (vars !== undefined) {
    for (const k of Object.keys(vars)) css += `${k}:${vars[k]};`;
  }
  return css;
}

/**
 * Renders a document into its composable parts.
 *
 * @param doc - The parsed Avodado document.
 * @param opts - Optional theme + variable overrides.
 * @returns The CSS, theme vars, body HTML, title, and section index.
 */
export function renderDocumentParts(doc: Document, opts: RenderPartsOptions = {}): DocumentParts {
  const title = doc.meta?.title ?? 'Untitled';
  const theme = opts.theme ?? DEFAULT_THEME;
  const themeVars = buildThemeVars(theme, opts.themeVars);
  const ctx: RenderCtx = { sectionNum: 0, sections: [] };
  const body =
    globalDefsSvg() +
    renderCover(doc.meta) +
    doc.segments.map((s) => renderSegment(s, ctx)).join('');
  return { css: houseCss, themeVars, body, title, sections: ctx.sections };
}

/** One presentation slide (used by the slides export). */
export interface Slide {
  /** Section label (e.g. `Sequence`), or `Cover`. */
  readonly label: string;
  /** The block's title, if any. */
  readonly title?: string;
  /** Inner HTML for a `<div class="docskin slide">`. */
  readonly html: string;
}

/** A document rendered as a sequence of slides. */
export interface SlidesResult {
  readonly css: string;
  readonly themeVars: string;
  readonly title: string;
  /** Shared SVG `<defs>` (markers + filters). Place once at the deck root —
   *  NOT inside a slide, since slides toggle `display:none` and a filter
   *  referenced from a hidden subtree won't resolve (the element vanishes). */
  readonly defs: string;
  readonly slides: readonly Slide[];
}

/**
 * Renders a document as a deck of slides — one slide for the cover and one per
 * top-level section block. Markdown prose is attached to the slide that follows
 * it (or a trailing "Notes" slide). The SVG `<defs>` ride along on the first
 * slide so diagram markers resolve document-wide.
 */
export function renderSlides(doc: Document, opts: RenderPartsOptions = {}): SlidesResult {
  const title = doc.meta?.title ?? 'Untitled';
  const theme = opts.theme ?? DEFAULT_THEME;
  const themeVars = buildThemeVars(theme, opts.themeVars);
  const ctx: RenderCtx = { sectionNum: 0, sections: [] };
  const slides: Slide[] = [];

  if (doc.meta !== undefined) slides.push({ label: 'Cover', title, html: renderCover(doc.meta) });

  // Slide-break mode: if the document uses `---` thematic breaks, each break
  // starts a new slide — so one slide can hold several blocks + prose, and the
  // author controls pagination. The first `#`/`##` heading in a slide is its
  // title. Otherwise we fall back to one slide per block (legacy behavior).
  const usesBreaks = doc.segments.some((s) => s.kind === 'markdown' && /^\s*---\s*$/m.test(s.text));

  if (usesBreaks) {
    let parts: string[] = [];
    let heading: string | undefined;
    let label: string | undefined;
    const flush = (): void => {
      const html = parts.join('');
      if (html.trim() !== '' || heading !== undefined) {
        slides.push({ label: label ?? 'Slide', ...(heading !== undefined ? { title: heading } : {}), html });
      }
      parts = [];
      heading = undefined;
      label = undefined;
    };
    for (const seg of doc.segments) {
      if (seg.kind === 'meta') continue;
      if (seg.kind === 'markdown') {
        const chunks = seg.text.split(/^\s*---\s*$/m);
        chunks.forEach((chunk, i) => {
          if (i > 0) flush(); // a `---` separated this chunk from the previous one
          const kept: string[] = [];
          for (const line of chunk.split('\n')) {
            const m = /^(#{1,2})\s+(.+?)\s*$/.exec(line);
            if (m !== null) {
              if (heading === undefined) heading = m[2];
            } else {
              kept.push(line);
            }
          }
          const h = renderProse(kept.join('\n'));
          if (h.trim() !== '') parts.push(h);
        });
      } else {
        parts.push(renderSegment(seg, ctx));
        if (label === undefined) label = ctx.sections[ctx.sections.length - 1]?.label;
      }
    }
    flush();
  } else {
    let prose = '';
    let heading: string | undefined;
    for (const seg of doc.segments) {
      if (seg.kind === 'markdown') {
        // A top-level heading (`#`/`##`) becomes the slide title; deeper ones stay.
        const kept: string[] = [];
        for (const line of seg.text.split('\n')) {
          const m = /^(#{1,2})\s+(.+?)\s*$/.exec(line);
          if (m !== null) heading = m[2];
          else kept.push(line);
        }
        const h = renderProse(kept.join('\n'));
        if (h.trim() !== '') prose += h;
        continue;
      }
      if (seg.kind === 'meta') continue;
      const html = renderSegment(seg, ctx);
      const sec = ctx.sections[ctx.sections.length - 1];
      const slideTitle = heading ?? sec?.title;
      slides.push({
        label: sec?.label ?? 'Section',
        ...(slideTitle !== undefined ? { title: slideTitle } : {}),
        html: prose + html,
      });
      prose = '';
      heading = undefined;
    }
    if (prose.trim() !== '') slides.push({ label: 'Notes', html: prose });
  }

  return { css: houseCss, themeVars, title, defs: globalDefsSvg(), slides };
}
