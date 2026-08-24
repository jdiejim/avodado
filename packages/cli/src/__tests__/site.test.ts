import { describe, expect, it } from 'vitest';
import { parseDocument } from '@avodado/core';
import { buildSite, type SiteDoc } from '../commands/site.js';

const DOC_A = `\`\`\`meta
title: Doc A
subtitle: The first document
tag: GUIDE
\`\`\`

\`\`\`sequence
id: seq-a
title: A flow
actors:
  - { id: C, name: Client }
  - { id: S, name: Server }
messages:
  - { from: C, to: S, label: GET /a, kind: sync }
\`\`\`

\`\`\`userstory
title: Stories
role: dev
want: cross-doc links
soThat: navigation works
links:
  - { ref: "b#seq-b", label: Cross }
  - { ref: "#seq-a", label: Same }
  - { ref: "#nope", label: Dangling }
\`\`\`
`;

const DOC_B = `\`\`\`meta
title: Doc B
tag: API
\`\`\`

\`\`\`sequence
id: seq-b
title: B flow
actors:
  - { id: C, name: Client }
  - { id: S, name: Server }
messages:
  - { from: C, to: S, label: GET /b, kind: sync }
\`\`\`
`;

const DOC_NESTED = `\`\`\`meta
title: Nested guide
\`\`\`

\`\`\`userstory
role: dev
want: relative links up
soThat: nested pages resolve
links:
  - { ref: "a#seq-a", label: Up and over }
\`\`\`
`;

function load(): SiteDoc[] {
  return [
    { slug: 'a', file: 'docs/a.md', doc: parseDocument(DOC_A, 'a') },
    { slug: 'b', file: 'docs/b.md', doc: parseDocument(DOC_B, 'b') },
    { slug: 'guides/x', file: 'docs/guides/x.md', doc: parseDocument(DOC_NESTED, 'guides/x') },
  ];
}

describe('buildSite', () => {
  it('emits index.html plus one page and one deck per doc (nested slugs keep dirs)', () => {
    const { pages } = buildSite(load());
    expect(pages.map((p) => p.path)).toEqual([
      'index.html',
      'a.html',
      'a.slides.html',
      'b.html',
      'b.slides.html',
      'guides/x.html',
      'guides/x.slides.html',
    ]);
  });

  it('rewrites cross-doc refs to <slug>.html#id with fixed attribute order', () => {
    const { pages } = buildSite(load());
    const a = pages.find((p) => p.path === 'a.html');
    expect(a?.html).toContain('data-ref="b#seq-b" href="b.html#seq-b"');
  });

  it('leaves same-doc refs as #id (no-op)', () => {
    const { pages } = buildSite(load());
    const a = pages.find((p) => p.path === 'a.html');
    expect(a?.html).toContain('data-ref="#seq-a" href="#seq-a"');
  });

  it('drops the href on dangling refs but keeps data-ref', () => {
    const { pages, diagnostics } = buildSite(load());
    const a = pages.find((p) => p.path === 'a.html');
    expect(a?.html).toContain('data-ref="#nope"');
    expect(a?.html).not.toContain('data-ref="#nope" href');
    expect(diagnostics.some((d) => d.code === 'E_DANGLING_REF' && d.value === '#nope')).toBe(true);
  });

  it('uses depth-relative hrefs from nested pages', () => {
    const { pages } = buildSite(load());
    const nested = pages.find((p) => p.path === 'guides/x.html');
    // Ref chip climbs out of guides/.
    expect(nested?.html).toContain('data-ref="a#seq-a" href="../a.html#seq-a"');
    // Nav + brand links climb too.
    expect(nested?.html).toContain('href="../index.html"');
    expect(nested?.html).toContain('href="../a.html">Doc A</a>');
  });

  it('renders a sidebar with every doc, the current one highlighted, and its sections', () => {
    const { pages } = buildSite(load());
    const a = pages.find((p) => p.path === 'a.html');
    expect(a?.html).toContain('<a class="current" href="a.html">Doc A</a>');
    expect(a?.html).toContain('href="b.html">Doc B</a>');
    expect(a?.html).toContain('href="guides/x.html">Nested guide</a>');
    // Current doc's section list links #section-NN.
    expect(a?.html).toContain('<a href="#section-01">A flow</a>');
    // Other docs don't get section lists.
    const b = pages.find((p) => p.path === 'b.html');
    expect(b?.html).not.toContain('<a href="#section-01">A flow</a>');
  });

  it('builds an index card grid from each doc meta', () => {
    const { pages } = buildSite(load());
    const index = pages.find((p) => p.path === 'index.html');
    expect(index?.html).toContain('<a class="idx-card" href="a.html">');
    expect(index?.html).toContain('<span class="idx-tag">GUIDE</span>');
    expect(index?.html).toContain('<h2>Doc A</h2>');
    expect(index?.html).toContain('<p>The first document</p>');
    expect(index?.html).toContain('<a class="idx-card" href="guides/x.html">');
    expect(index?.html).toContain('<h2>Nested guide</h2>');
  });

  it('puts a Doc | Slides toggle on doc pages (not the index)', () => {
    const { pages } = buildSite(load());
    const a = pages.find((p) => p.path === 'a.html');
    expect(a?.html).toContain('class="view-toggle"');
    expect(a?.html).toContain('<a aria-current="page" href="a.html">Doc</a>');
    expect(a?.html).toContain('<a href="a.slides.html">Slides</a>');
    const index = pages.find((p) => p.path === 'index.html');
    expect(index?.html).not.toContain('class="view-toggle"');
  });

  it('deck pages carry the standalone deck plus a back-link pill to the doc page', () => {
    const { pages } = buildSite(load());
    const deck = pages.find((p) => p.path === 'a.slides.html');
    expect(deck?.title).toBe('Doc A — Slides');
    expect(deck?.html).toContain('class="deck-nav"'); // toSlides markup intact
    expect(deck?.html).toContain('class="deck-doc-link" href="a.html"');
  });

  it('nested docs link page ↔ deck by basename (same directory at any depth)', () => {
    const { pages } = buildSite(load());
    const page = pages.find((p) => p.path === 'guides/x.html');
    expect(page?.html).toContain('<a href="x.slides.html">Slides</a>');
    const deck = pages.find((p) => p.path === 'guides/x.slides.html');
    expect(deck?.html).toContain('class="deck-doc-link" href="x.html"');
  });

  it('keeps the plain index unchanged when richIndex is false', () => {
    const { pages } = buildSite(load(), { richIndex: false });
    const index = pages.find((p) => p.path === 'index.html');
    expect(index?.html).not.toContain('idx-tldr');
    expect(index?.html).not.toContain('idx-group');
    expect(index?.html).not.toContain('idx-graph');
    expect(index?.html).not.toContain('<svg');
  });

  it('defaults to the rich index — byte-identical to an explicit richIndex: true', () => {
    const docs = load();
    const byDefault = buildSite(docs);
    const explicit = buildSite(docs, { richIndex: true });
    for (const p of byDefault.pages) {
      expect(explicit.pages.find((r) => r.path === p.path)?.html).toBe(p.html);
    }
    // These three docs tag uniquely (GUIDE, API, folder) — the degeneracy
    // fallback keeps the flat card grid, no digest, no group headers; only
    // the cross-reference graph section is added.
    const index = byDefault.pages.find((p) => p.path === 'index.html');
    expect(index?.html).toContain('<div class="idx-grid">');
    expect(index?.html).not.toContain('class="idx-tldr"');
    expect(index?.html).not.toContain('class="idx-group"');
    expect(index?.html).toContain('class="idx-graph"');
  });

  it('injects the live-reload script only when liveReload is set', () => {
    const docs = load();
    const built = buildSite(docs);
    const served = buildSite(docs, { liveReload: true });
    for (const p of built.pages) expect(p.html).not.toContain('EventSource');
    for (const p of served.pages) {
      expect(p.html).toContain(`new EventSource('/__events').onmessage=()=>location.reload()`);
    }
  });
});

// ─── Rich index (default; `--no-rich-index` opts out) ────────────────────────

const RICH_R1 = `\`\`\`meta
title: Parser guide
subtitle: Parser walkthrough
tag: Guide
\`\`\`

\`\`\`sequence
id: seq-r1
title: Parse flow
actors:
  - { id: C, name: Client }
  - { id: S, name: Server }
messages:
  - { from: C, to: S, label: parse, kind: sync }
\`\`\`
`;

const RICH_R2 = `\`\`\`meta
title: Renderer guide
tag: GUIDE
\`\`\`
`;

const RICH_R3 = `\`\`\`meta
title: API reference
tag: API
\`\`\`

\`\`\`userstory
role: dev
want: a link to the parser
soThat: readers can jump
links:
  - { ref: "r1#seq-r1", label: Parser }
\`\`\`
`;

const RICH_R4 = `\`\`\`meta
title: Nested note
subtitle: A nested note
\`\`\`
`;

const RICH_R5 = `\`\`\`meta
title: API cookbook
tag: API · v2
\`\`\`
`;

function loadRich(): SiteDoc[] {
  return [
    { slug: 'r1', file: 'docs/r1.md', doc: parseDocument(RICH_R1, 'r1') },
    { slug: 'r2', file: 'docs/r2.md', doc: parseDocument(RICH_R2, 'r2') },
    { slug: 'r3', file: 'docs/r3.md', doc: parseDocument(RICH_R3, 'r3') },
    { slug: 'notes/r4', file: 'docs/notes/r4.md', doc: parseDocument(RICH_R4, 'notes/r4') },
    { slug: 'r5', file: 'docs/r5.md', doc: parseDocument(RICH_R5, 'r5') },
  ];
}

describe('buildSite rich index', () => {
  it('puts a TLDR digest at the top: doc count plus one line per group', () => {
    const { pages } = buildSite(loadRich(), { richIndex: true });
    const index = pages.find((p) => p.path === 'index.html');
    expect(index?.html).toContain('<div class="idx-eyebrow">5 documents</div>');
    // Multi-doc group line: label + count only — no single doc's subtitle.
    expect(index?.html).toContain(
      '<a href="#group-guide"><strong>Guide</strong> · 2 documents</a>',
    );
    expect(index?.html).toContain('<a href="#group-api"><strong>API</strong> · 2 documents</a>');
    // A group of one keeps its doc's subtitle as the one-liner.
    expect(index?.html).toContain(
      '<a href="#group-notes"><strong>notes</strong> · 1 document — A nested note</a>',
    );
  });

  it('groups cards by the first tag token (case-insensitive), folder fallback, largest first', () => {
    const { pages } = buildSite(loadRich(), { richIndex: true });
    const index = pages.find((p) => p.path === 'index.html');
    const html = index?.html ?? '';
    // Guide + GUIDE merge into one group of 2; label keeps first-seen casing.
    expect(html).toContain(
      '<section class="idx-group" id="group-guide"><h2 class="idx-group-head">Guide<span class="idx-group-count">2</span></h2>',
    );
    // Compound badge "API · v2" groups by its first token with plain "API".
    expect(html).toContain(
      '<section class="idx-group" id="group-api"><h2 class="idx-group-head">API<span class="idx-group-count">2</span></h2>',
    );
    const apiSection = html.slice(html.indexOf('id="group-api"'), html.indexOf('id="group-guide"'));
    expect(apiSection).toContain('<a class="idx-card" href="r5.html">');
    // Untagged nested doc falls back to its top-level folder.
    expect(html).toContain('<h2 class="idx-group-head">notes<span class="idx-group-count">1</span></h2>');
    // Largest groups first; equal sizes order by label (API before Guide).
    expect(html.indexOf('id="group-api"')).toBeLessThan(html.indexOf('id="group-guide"'));
    expect(html.indexOf('id="group-guide"')).toBeLessThan(html.indexOf('id="group-notes"'));
    // Cards keep their current look inside groups.
    expect(html).toContain('<a class="idx-card" href="r1.html">');
    // The full compound badge stays on the card — only grouping uses the token.
    expect(html).toContain('<span class="idx-tag">API · v2</span>');
  });

  it('normalizes tag casing on cards inside a group to the first-seen form', () => {
    const { pages } = buildSite(loadRich(), { richIndex: true });
    const html = pages.find((p) => p.path === 'index.html')?.html ?? '';
    // r2 is tagged GUIDE; inside the Guide group its pill shows Guide (r1's casing).
    const cardStart = html.indexOf('class="idx-card" href="r2.html"');
    const r2Card = html.slice(cardStart, html.indexOf('</a>', cardStart));
    expect(r2Card).toContain('<span class="idx-tag">Guide</span>');
    expect(html).not.toContain('<span class="idx-tag">GUIDE</span>');
  });

  it('falls back to the flat card grid when most groups are singletons', () => {
    const docs = [
      { slug: 'r1', file: 'docs/r1.md', doc: parseDocument(RICH_R1, 'r1') },
      { slug: 'r3', file: 'docs/r3.md', doc: parseDocument(RICH_R3, 'r3') },
      { slug: 'r5', file: 'docs/r5.md', doc: parseDocument(RICH_R5.replace('API · v2', 'RFC'), 'r5') },
    ];
    const { pages } = buildSite(docs, { richIndex: true });
    const html = pages.find((p) => p.path === 'index.html')?.html ?? '';
    // Three groups of one (Guide, API, RFC) — grouping restates the grid.
    // (The stylesheet still carries the .idx-* rules; the markup must not.)
    expect(html).not.toContain('class="idx-tldr"');
    expect(html).not.toContain('class="idx-group"');
    expect(html).toContain('<div class="idx-grid">');
    expect(html).toContain('<a class="idx-card" href="r1.html">');
    // The cross-reference graph (r3 → r1) still renders.
    expect(html).toContain('class="idx-graph"');
    expect(html).toContain('<svg');
  });

  it('renders the cross-reference graph through the graph renderer, with a link legend', () => {
    const { pages } = buildSite(loadRich(), { richIndex: true });
    const index = pages.find((p) => p.path === 'index.html');
    const html = index?.html ?? '';
    expect(html).toContain('class="idx-graph"');
    expect(html).toContain('<svg'); // real rendered graph block
    expect(html).toContain('Cross-references');
    // Node labels are doc titles; only docs in an edge appear.
    expect(html).toContain('Parser guide');
    expect(html).toContain('API reference');
    // Legend links each graph doc to its page.
    expect(html).toContain('<li><a href="r3.html">API reference</a>');
    expect(html).toContain('<li><a href="r1.html">Parser guide</a>');
  });

  it('omits the graph section when no doc references another', () => {
    const docs = loadRich().filter((d) => d.slug !== 'r3'); // r3 holds the only cross-ref
    const { pages } = buildSite(docs, { richIndex: true });
    const index = pages.find((p) => p.path === 'index.html');
    // The stylesheet still carries `.idx-graph` rules; the markup must not.
    expect(index?.html).not.toContain('class="idx-graph"');
    expect(index?.html).not.toContain('<svg');
  });

  it('changes only the index page — doc pages and decks stay identical', () => {
    const docs = loadRich();
    const plain = buildSite(docs, { richIndex: false });
    const rich = buildSite(docs, { richIndex: true });
    for (const p of plain.pages) {
      if (p.path === 'index.html') continue;
      expect(rich.pages.find((r) => r.path === p.path)?.html).toBe(p.html);
    }
  });
});
