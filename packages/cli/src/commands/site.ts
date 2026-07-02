/**
 * Site core shared by `avo build` and `avo serve` — pure functions, no I/O.
 *
 * {@link buildSite} turns a set of parsed documents into a multi-page static
 * site: one HTML page per doc (wrapped in a shell with a left nav sidebar) plus
 * an `index.html` card grid built from each doc's `meta`. Cross-doc reference
 * chips (`data-ref="doc#id"`) are rewritten to relative `<slug>.html#id` links
 * using the {@link resolveRefs} graph.
 *
 * Diagnostics (schema + ref) are returned as values — the callers decide how
 * to surface them (`avo build` warns, `avo serve` shows an in-page banner).
 */

import {
  resolveRefs,
  validateDocument,
  type Diagnostic,
  type Document,
} from '@avodado/core';
import {
  buildThemeVars,
  DEFAULT_THEME,
  escapeHtml,
  houseCss,
  renderDocumentParts,
  type DocumentSection,
  type ThemeName,
} from '@avodado/render';

/** A loaded document ready for site rendering. */
export interface SiteDoc {
  /** Slug (path under the docs root without `.md`, e.g. `guides/api`). */
  readonly slug: string;
  /** Source file path relative to the project root (for diagnostics). */
  readonly file: string;
  /** The parsed document. */
  readonly doc: Document;
}

/** One rendered page of the site. */
export interface SitePage {
  /** Output path relative to the site root (`index.html` or `<slug>.html`). */
  readonly path: string;
  /** Complete standalone HTML. */
  readonly html: string;
  /** Page title. */
  readonly title: string;
}

/** Options for {@link buildSite}. */
export interface SiteOptions {
  /** Base theme name. */
  readonly theme?: ThemeName;
  /** CSS-variable overrides applied after the named theme. */
  readonly themeVars?: Readonly<Record<string, string>>;
  /** Inject the live-reload `EventSource` script (serve only, never build). */
  readonly liveReload?: boolean;
}

/** Result of {@link buildSite}. */
export interface SiteResult {
  /** All pages: `index.html` first, then one per doc. */
  readonly pages: readonly SitePage[];
  /** Schema + reference diagnostics across the whole doc set. */
  readonly diagnostics: readonly Diagnostic[];
}

/** Live-reload client (kept tiny; EventSource reconnects natively). */
const LIVE_RELOAD_SCRIPT = `<script>new EventSource('/__events').onmessage=()=>location.reload()</script>`;

/**
 * Compact sidebar + index-card stylesheet, in the house look: `var(--rule)`
 * hairlines, 13px nav type, sticky sidebar that collapses to a top list under
 * 900px. Inlined into every page so pages stay self-contained.
 */
const SITE_CSS = `
body{margin:0;}
.site{display:flex;align-items:flex-start;max-width:1440px;margin:0 auto;}
.site-nav{position:sticky;top:0;flex:none;width:248px;max-height:100vh;overflow-y:auto;padding:28px 18px 48px;border-right:1px solid var(--rule);font-family:var(--font-body);font-size:13px;}
.site-nav .nav-brand{display:block;font-family:var(--font-display);font-weight:700;font-size:14px;letter-spacing:.02em;color:var(--navy);text-decoration:none;padding:4px 8px;margin-bottom:6px;}
.site-nav .nav-head{font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:var(--gray);font-weight:700;padding:10px 8px 6px;border-top:1px solid var(--rule);}
.site-nav a{display:block;color:var(--charcoal);text-decoration:none;padding:4px 8px;border-radius:4px;line-height:1.45;}
.site-nav a:hover{background:var(--light-gray);}
.site-nav a.current{color:var(--navy);font-weight:700;background:var(--light-gray);}
.site-nav .nav-sections{margin:2px 0 8px 12px;padding-left:10px;border-left:1px solid var(--rule);}
.site-nav .nav-sections a{font-size:12px;color:var(--slate);padding:3px 6px;}
.site-main{flex:1;min-width:0;}
.site-main .docskin{padding-top:40px;}
@media (max-width:900px){
.site{display:block;}
.site-nav{position:static;width:auto;max-height:none;border-right:0;border-bottom:1px solid var(--rule);padding:20px 24px;}
}
.idx-head{padding:16px 0 28px;margin-bottom:36px;border-bottom:1px solid var(--rule);}
.idx-eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:var(--highlight);font-weight:700;margin-bottom:10px;}
.idx-title{font-family:var(--font-display);font-weight:700;font-size:clamp(32px,4.4vw,48px);line-height:1.1;letter-spacing:-.015em;color:var(--navy);margin:0;}
.idx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;}
.idx-card{display:block;border:1px solid var(--rule);border-radius:10px;background:var(--white);padding:22px 24px 18px;text-decoration:none;color:var(--charcoal);box-shadow:0 1px 2px rgba(0,0,0,.03),0 8px 20px -14px rgba(0,0,0,.10);}
.idx-card:hover{border-color:var(--navy);}
.idx-card .idx-tag{display:inline-block;font-family:var(--font-mono);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:3px 9px;background:var(--navy);color:var(--white);margin-bottom:12px;}
.idx-card h2{font-family:var(--font-display);font-weight:700;font-size:18px;line-height:1.25;color:var(--navy);margin:0 0 8px;}
.idx-card p{font-size:13px;line-height:1.55;color:var(--slate);margin:0 0 12px;}
.idx-card .idx-slug{font-family:var(--font-mono);font-size:11px;color:var(--gray);}
`;

/** `../` prefix that climbs from a page at `slug` back to the site root. */
function rootPrefix(slug: string): string {
  const depth = slug.split('/').length - 1;
  return '../'.repeat(depth);
}

/** Matches the ref-chip attribute pair as emitted by the renderers — the
 * attribute order (`data-ref` then `href`) is fixed at emission and locked by
 * render unit tests, so this anchored rewrite is safe over our own markup. */
const REF_CHIP_RE = / data-ref="([^"]+)" href="#[^"]*"/g;

/** Same shape as core's `REF_RE`: optional doc part + `#` + id. */
const REF_RE = /^([\w/.-]+)?#([\w.-]+)$/;

/**
 * Rewrites cross-doc ref chips in one page's HTML: `data-ref="doc#id"` gets
 * `href="<relative>/doc.html#id"`; same-doc refs keep `#id`; dangling refs
 * lose the `href` (the chip renders plain) but keep `data-ref`.
 */
function rewriteRefs(
  html: string,
  slug: string,
  nodes: ReadonlyMap<string, { readonly doc: string }>,
): string {
  const prefix = rootPrefix(slug);
  return html.replace(REF_CHIP_RE, (whole, ref: string) => {
    const m = REF_RE.exec(ref);
    if (m === null) return whole;
    const targetDoc = m[1] ?? slug;
    const id = m[2] ?? '';
    const node = nodes.get(id);
    if (node === undefined || node.doc !== targetDoc) return ` data-ref="${ref}"`; // dangling
    if (node.doc === slug) return ` data-ref="${ref}" href="#${id}"`;
    return ` data-ref="${ref}" href="${prefix}${node.doc}.html#${id}"`;
  });
}

/** Nav entry for the sidebar doc list. */
interface NavDoc {
  readonly slug: string;
  readonly title: string;
}

/** Renders the left sidebar: all docs (current highlighted) + the current
 * doc's section list. `current === undefined` on the index page. */
function sidebar(
  navDocs: readonly NavDoc[],
  current: string | undefined,
  sections: readonly DocumentSection[],
): string {
  const prefix = current !== undefined ? rootPrefix(current) : '';
  const items = navDocs
    .map((d) => {
      const isCurrent = d.slug === current;
      const cls = isCurrent ? ' class="current"' : '';
      const link = `<a${cls} href="${prefix}${escapeHtml(d.slug)}.html">${escapeHtml(d.title)}</a>`;
      if (!isCurrent || sections.length === 0) return link;
      const secs = sections
        .map((s) => `<a href="#${s.id}">${escapeHtml(s.title ?? s.label)}</a>`)
        .join('');
      return link + `<div class="nav-sections">${secs}</div>`;
    })
    .join('');
  return (
    `<aside class="site-nav">` +
    `<a class="nav-brand" href="${prefix}index.html">Documentation</a>` +
    `<div class="nav-head">Documents</div>` +
    `<nav>${items}</nav>` +
    `</aside>`
  );
}

/** Wraps a page's nav + main content into a standalone HTML document. */
function pageShell(args: {
  readonly title: string;
  readonly css: string;
  readonly themeVars: string;
  readonly nav: string;
  readonly main: string;
  readonly liveReload: boolean;
}): string {
  const themeBlock = args.themeVars.length > 0 ? `<style>:root{${args.themeVars}}</style>` : '';
  const reload = args.liveReload ? LIVE_RELOAD_SCRIPT : '';
  return (
    `<!doctype html>\n` +
    `<html lang="en">\n` +
    `<head>\n` +
    `<meta charset="utf-8">\n` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">\n` +
    `<title>${escapeHtml(args.title)}</title>\n` +
    `<style>${args.css}</style>` +
    themeBlock +
    `<style>${SITE_CSS}</style>\n` +
    `</head>\n` +
    `<body>\n` +
    `<div class="site">\n` +
    args.nav +
    `\n<main class="site-main"><div class="docskin">${args.main}</div></main>\n` +
    `</div>\n` +
    reload +
    `</body>\n` +
    `</html>\n`
  );
}

/** Renders the index page's meta-card grid. */
function indexCards(docs: readonly SiteDoc[]): string {
  const cards = docs
    .map((d) => {
      const meta = d.doc.meta;
      const tag =
        meta?.tag !== undefined ? `<span class="idx-tag">${escapeHtml(meta.tag)}</span>` : '';
      const title = escapeHtml(meta?.title ?? d.slug);
      const sub = meta?.subtitle !== undefined ? `<p>${escapeHtml(meta.subtitle)}</p>` : '';
      return (
        `<a class="idx-card" href="${escapeHtml(d.slug)}.html">` +
        tag +
        `<h2>${title}</h2>` +
        sub +
        `<span class="idx-slug">${escapeHtml(d.slug)}</span>` +
        `</a>`
      );
    })
    .join('');
  return (
    `<div class="idx-head">` +
    `<div class="idx-eyebrow">${docs.length} document${docs.length === 1 ? '' : 's'}</div>` +
    `<h1 class="idx-title">Documentation</h1>` +
    `</div>` +
    `<div class="idx-grid">${cards}</div>`
  );
}

/**
 * Builds the whole site in memory: `index.html` plus one page per doc, with
 * the sidebar nav and cross-doc ref links resolved. Pure — no file writes.
 */
export function buildSite(docs: readonly SiteDoc[], opts: SiteOptions = {}): SiteResult {
  const diagnostics: Diagnostic[] = [];
  for (const d of docs) diagnostics.push(...validateDocument(d.doc, d.file));
  const resolved = resolveRefs(docs.map((d) => ({ doc: d.doc, file: d.file })));
  diagnostics.push(...resolved.diagnostics);

  const themeOpts = {
    ...(opts.theme !== undefined ? { theme: opts.theme } : {}),
    ...(opts.themeVars !== undefined ? { themeVars: opts.themeVars } : {}),
  };
  const liveReload = opts.liveReload === true;

  const rendered = docs.map((d) => ({ doc: d, parts: renderDocumentParts(d.doc, themeOpts) }));
  const navDocs: NavDoc[] = rendered.map((r) => ({
    slug: r.doc.slug,
    title: r.doc.doc.meta?.title ?? r.doc.slug,
  }));
  // The index reuses the first doc's css/themeVars (identical for every doc);
  // an empty doc set still gets a styled index from the theme directly.
  const first = rendered[0];
  const css = first?.parts.css ?? houseCss;
  const themeVars =
    first?.parts.themeVars ?? buildThemeVars(opts.theme ?? DEFAULT_THEME, opts.themeVars);

  const pages: SitePage[] = [];
  pages.push({
    path: 'index.html',
    title: 'Documentation',
    html: pageShell({
      title: 'Documentation',
      css,
      themeVars,
      nav: sidebar(navDocs, undefined, []),
      main: indexCards(docs),
      liveReload,
    }),
  });

  for (const { doc, parts } of rendered) {
    const shell = pageShell({
      title: parts.title,
      css: parts.css,
      themeVars: parts.themeVars,
      nav: sidebar(navDocs, doc.slug, parts.sections),
      main: parts.body,
      liveReload,
    });
    pages.push({
      path: `${doc.slug}.html`,
      title: parts.title,
      html: rewriteRefs(shell, doc.slug, resolved.graph.nodes),
    });
  }

  return { pages, diagnostics };
}
