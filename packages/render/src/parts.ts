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
  /** The block's user-supplied `id:` (referenceable as `doc#id`), if it has one. */
  readonly blockId?: string;
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

/**
 * Blocks whose `title` is the visual centerpiece — the section head must not
 * lift it (the block renders it itself at presentation scale).
 */
const OWNS_TITLE: ReadonlySet<BlockType> = new Set(['divider', 'takeaways']);

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

  const { title, lede } = readTitleAndLede(seg.data);
  // The section head owns the title at the top level — strip it from the data
  // so the block's own header doesn't repeat it (nested renders, e.g. gallery
  // cells, go through the registry directly and keep theirs). Blocks in
  // OWNS_TITLE render the title themselves (it IS the visual), so it stays.
  const ownsTitle = OWNS_TITLE.has(seg.kind);
  const bodyData =
    !ownsTitle && title !== undefined && typeof seg.data === 'object'
      ? { ...(seg.data as Record<string, unknown>), title: undefined }
      : seg.data;
  const body = dispatchBlock(seg.kind, bodyData as BlockDataMap[typeof seg.kind]);

  ctx.sectionNum += 1;
  const num = ctx.sectionNum;
  const id = `section-${pad2(num)}`;
  ctx.sections.push({
    id,
    num,
    label: SECTION_LABEL[seg.kind],
    ...(title !== undefined ? { title } : {}),
    ...(seg.id !== undefined ? { blockId: seg.id } : {}),
  });
  const head = renderSectionHead(num, seg.kind, ownsTitle ? undefined : title, lede);

  // A section can't carry two DOM ids: `section-NN` stays on the <section>
  // (existing nav consumers rely on it) and the block's user `id:` lands on a
  // nested zero-height anchor span, so `#<id>` links (ref chips) resolve.
  const anchor =
    seg.id !== undefined
      ? `<span class="block-anchor" id="${escapeHtml(seg.id)}" aria-hidden="true"></span>`
      : '';
  const dataId = seg.id !== undefined ? ` data-block-id="${escapeHtml(seg.id)}"` : '';

  return `<section id="${id}" class="section-block"${dataId}>${anchor}${head}${body}</section>`;
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
  /** Vertical alignment of the content (auto by weight, or forced via a heading marker). */
  readonly align?: 'top' | 'center' | 'bottom';
  /** `split` = consulting layout: prose (message) left, blocks (exhibit) right.
   *  Forced via a `{split}` heading marker. */
  readonly layout?: 'split';
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
/** Loose view of block data for sizing — only the array fields we count. */
type SizedData = {
  items?: unknown[];
  rows?: unknown[];
  stats?: unknown[];
  blocks?: ReadonlyArray<{ code?: string }>;
  levels?: unknown[];
  terms?: unknown[];
  parts?: unknown[];
  gates?: unknown[];
  nodes?: unknown[];
  screens?: unknown[];
  classes?: unknown[];
  states?: unknown[];
  entities?: unknown[];
  tasks?: unknown[];
  columns?: unknown[];
  lanes?: unknown[];
  steps?: unknown[];
  clusters?: unknown[];
  pros?: unknown[];
  cons?: unknown[];
  current?: { items?: unknown[] };
  target?: { items?: unknown[] };
};

const arrLen = (a: unknown): number => (Array.isArray(a) ? a.length : 0);

/** Largest array among a block's common item fields — a rough "how tall" proxy. */
function maxArr(d: SizedData): number {
  const fields = [
    d.items, d.rows, d.stats, d.blocks, d.levels, d.terms, d.parts, d.gates, d.nodes,
    d.screens, d.classes, d.states, d.entities, d.tasks, d.columns, d.lanes, d.steps, d.clusters,
  ];
  let m = 0;
  for (const f of fields) m = Math.max(m, arrLen(f));
  return m;
}

/**
 * Estimates how much vertical space a block needs, in arbitrary "slide units",
 * from its data (not pixels — this runs at build time). Used to paginate a heavy
 * heading across multiple slides so nothing is scaled down to an unreadable size.
 */
function blockWeight(seg: TypedSegment): number {
  if (seg.kind === 'meta') return 0;
  if (seg.parseError !== undefined || seg.data === null || seg.data === undefined) return 2;
  const d = seg.data as SizedData;
  if (seg.kind === 'callout' || seg.kind === 'pullquote') return 3;
  if (seg.kind === 'table') return 2 + arrLen(d.rows) * 1.4;
  if (seg.kind === 'proscons') return 2 + (arrLen(d.pros) + arrLen(d.cons)) * 1.1;
  if (seg.kind === 'cvt') return 2 + (arrLen(d.current?.items) + arrLen(d.target?.items)) * 1.1;
  if (seg.kind === 'code') {
    let lines = 0;
    for (const b of d.blocks ?? []) lines += String(b.code ?? '').split('\n').length;
    return 2 + arrLen(d.blocks) * 1.5 + lines * 0.35;
  }
  return 2 + maxArr(d) * 1.1; // lists, diagrams, charts, …
}

/** Max content weight before a heading spills onto a continuation slide. */
const SLIDE_BUDGET = 10;

export function renderSlides(doc: Document, opts: RenderPartsOptions = {}): SlidesResult {
  const title = doc.meta?.title ?? 'Untitled';
  const theme = opts.theme ?? DEFAULT_THEME;
  const themeVars = buildThemeVars(theme, opts.themeVars);
  const ctx: RenderCtx = { sectionNum: 0, sections: [] };
  const slides: Slide[] = [];

  if (doc.meta !== undefined) slides.push({ label: 'Cover', title, html: renderCover(doc.meta) });

  // Slide-break mode: each top-level Markdown heading (`#`/`##`) starts a new
  // slide and is its title; everything until the next heading (prose + blocks)
  // stays on that slide. `###`+ headings stay in the body. If the doc has no
  // top-level headings at all, we fall back to one slide per block (legacy).
  const headingRe = /^(#{1,2})\s+(.+?)\s*$/;
  const usesHeadings = doc.segments.some(
    (s) => s.kind === 'markdown' && s.text.split('\n').some((l) => headingRe.test(l)),
  );

  if (usesHeadings) {
    let parts: Array<{ h: string; block: boolean }> = [];
    let heading: string | undefined;
    let label: string | undefined;
    let blocks = 0;
    let proseChars = 0;
    let weight = 0;
    let forced: 'top' | 'center' | 'bottom' | undefined;
    let forcedLayout: 'split' | undefined;
    // `keep` = true for a continuation slide (same heading spilled over): keep the
    // title/marker, reset only the content. `false` = a real new heading boundary.
    const pushSlide = (keep: boolean): void => {
      const raw = parts.map((p) => p.h).join('');
      if (raw.trim() !== '' || (heading !== undefined && !keep)) {
        // Split slides center on the stage regardless of prose length — the
        // message column reads as a unit beside its exhibit.
        const align =
          forced ??
          (forcedLayout === 'split'
            ? 'center'
            : blocks >= 2 || proseChars > 240
              ? 'top'
              : 'center');
        // Split layout: prose becomes the left "message" column, blocks the
        // right "exhibit" column — the classic consulting slide.
        const html =
          forcedLayout === 'split' && raw.trim() !== ''
            ? `<div class="sl-msg">${parts.filter((p) => !p.block).map((p) => p.h).join('')}</div>` +
              `<div class="sl-exhibit">${parts.filter((p) => p.block).map((p) => p.h).join('')}</div>`
            : raw;
        slides.push({
          label: label ?? 'Slide',
          ...(heading !== undefined ? { title: heading } : {}),
          html,
          align,
          ...(forcedLayout !== undefined ? { layout: forcedLayout } : {}),
        });
      }
      parts = [];
      blocks = 0;
      proseChars = 0;
      weight = 0;
      label = undefined;
      if (!keep) {
        heading = undefined;
        forced = undefined;
        forcedLayout = undefined;
      }
    };
    // Append a piece of content, spilling onto a continuation slide first if it
    // would overflow the budget (but never flush an empty slide). Split-layout
    // slides never spill: message + exhibit belong together, and the deck's
    // fit() scaler absorbs the size.
    const addPart = (h: string, w: number, block: boolean): void => {
      if (forcedLayout !== 'split' && parts.length > 0 && weight + w > SLIDE_BUDGET) {
        pushSlide(true);
      }
      parts.push({ h, block });
      weight += w;
    };
    for (const seg of doc.segments) {
      if (seg.kind === 'meta') continue;
      if (seg.kind === 'markdown') {
        let buf: string[] = [];
        const flushBuf = (): void => {
          const text = buf.join('\n').trim();
          if (text !== '') {
            const h = renderProse(buf.join('\n'));
            if (h.trim() !== '') {
              addPart(h, Math.max(1, text.length / 180), false);
              proseChars += text.length;
            }
          }
          buf = [];
        };
        for (const line of seg.text.split('\n')) {
          const m = headingRe.exec(line);
          if (m !== null) {
            flushBuf();
            pushSlide(false); // a heading starts a new slide
            // Optional marker, e.g. `## Title {top}` or `## Title {split}` —
            // stripped from the title.
            let title = m[2] ?? '';
            const mark = /\s*\{(top|center|middle|bottom|split)\}\s*$/i.exec(title);
            if (mark !== null) {
              title = title.slice(0, mark.index).replace(/\s+$/, '');
              const a = (mark[1] ?? '').toLowerCase();
              if (a === 'split') forcedLayout = 'split';
              else forced = a === 'middle' || a === 'center' ? 'center' : a === 'bottom' ? 'bottom' : 'top';
            }
            heading = title;
          } else {
            buf.push(line);
          }
        }
        flushBuf();
      } else {
        addPart(renderSegment(seg, ctx), blockWeight(seg), true);
        blocks += 1;
        label = ctx.sections[ctx.sections.length - 1]?.label;
      }
    }
    pushSlide(false);
  } else {
    // No headings/breaks: one slide per block (legacy).
    let prose = '';
    for (const seg of doc.segments) {
      if (seg.kind === 'markdown') {
        const h = renderProse(seg.text);
        if (h.trim() !== '') prose += h;
        continue;
      }
      if (seg.kind === 'meta') continue;
      const html = renderSegment(seg, ctx);
      const sec = ctx.sections[ctx.sections.length - 1];
      slides.push({
        label: sec?.label ?? 'Section',
        ...(sec?.title !== undefined ? { title: sec.title } : {}),
        html: prose + html,
      });
      prose = '';
    }
    if (prose.trim() !== '') slides.push({ label: 'Notes', html: prose });
  }

  return { css: houseCss, themeVars, title, defs: globalDefsSvg(), slides };
}
