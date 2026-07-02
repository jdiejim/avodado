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
  it('emits index.html plus one page per doc (nested slugs keep dirs)', () => {
    const { pages } = buildSite(load());
    expect(pages.map((p) => p.path)).toEqual(['index.html', 'a.html', 'b.html', 'guides/x.html']);
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
