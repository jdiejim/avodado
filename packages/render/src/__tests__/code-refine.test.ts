/**
 * The refined `code` block: `highlight` ranges band exactly the named lines,
 * `lines` numbers from `start`, `cols` / `compare` lay snippets out as a
 * grid, `caption` renders, `wrap` soft-wraps — and the `diff` / `terminal`
 * surfaces stay byte-identical to the output captured before the refinement.
 */

import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { renderCode, parseHighlight, splitHighlightedLines } from '../blocks/code.js';
import { highlightCode } from '../highlight.js';
import { houseCss } from '../css.js';

const FOUR = 'a\nb\nc\nd\n';

/** The class of every line span, in order (the parser keeps `<pre>` raw, so a regex reads it). */
function lineClasses(html: string): string[] {
  return [...html.matchAll(/<span class="(cl[^"]*)">/g)].map((m) => m[1] ?? '');
}

describe('highlight ranges', () => {
  it('parses `n` and `a-b` tokens, ignoring junk', () => {
    expect([...parseHighlight('3-5, 8')]).toEqual([3, 4, 5, 8]);
    expect([...parseHighlight(' 2 ')]).toEqual([2]);
    expect([...parseHighlight('x, 5-3, 0, -1, 4')]).toEqual([4]);
    expect(parseHighlight(undefined).size).toBe(0);
  });

  it('marks exactly the named lines', () => {
    const html = renderCode({ code: FOUR, highlight: '2-3' });
    expect(lineClasses(html)).toEqual(['cl', 'cl cl-hl', 'cl cl-hl', 'cl']);
  });

  it('ignores a range past the end', () => {
    const html = renderCode({ code: FOUR, highlight: '4-9, 12' });
    expect(lineClasses(html)).toEqual(['cl', 'cl', 'cl', 'cl cl-hl']);
  });

  it('works per entry in `blocks[]`', () => {
    const html = renderCode({
      blocks: [
        { code: FOUR, highlight: '1' },
        { code: FOUR, highlight: '4' },
      ],
    });
    const cards = html.split('<div class="code-block').slice(1);
    expect(cards).toHaveLength(2);
    expect(lineClasses(cards[0] ?? '')).toEqual(['cl cl-hl', 'cl', 'cl', 'cl']);
    expect(lineClasses(cards[1] ?? '')).toEqual(['cl', 'cl', 'cl', 'cl cl-hl']);
  });

  it('keeps every line self-contained when a token spans a newline', () => {
    const src = '/* a\nb */ x\ny';
    const lines = splitHighlightedLines(highlightCode(src));
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect((line.match(/<span/g) ?? []).length).toBe((line.match(/<\/span>/g) ?? []).length);
    }
    expect(lines[0]).toBe('<span class="com">/* a</span>');
    expect(lines[1]).toBe('<span class="com">b */</span> x');
    expect(lines[2]).toBe('y');
    // The line text survives the split: joining the lines back is the source.
    expect(lines.map((l) => parse(l).textContent).join('\n')).toBe(src);
  });
});

describe('line numbers', () => {
  it('are off by default and on with `lines: true`', () => {
    expect(renderCode({ code: FOUR })).not.toContain('cb-lines');
    expect(renderCode({ code: FOUR, lines: true })).toContain('cb-lines');
  });

  it('start at `start` and size the gutter to the last number', () => {
    const html = renderCode({ code: FOUR, lines: true, start: 98 });
    expect(html).toContain('--code-start:97;--code-gutter:3ch');
    const one = renderCode({ code: FOUR, lines: true });
    expect(one).toContain('--code-start:0;--code-gutter:1ch');
  });

  it('are drawn by CSS counters the reader cannot select', () => {
    expect(houseCss).toMatch(/\.cb-lines \.cl::before\{[^}]*content:counter\(line\)[^}]*user-select:none/);
  });

  it('do not add a phantom line for the trailing newline', () => {
    expect(lineClasses(renderCode({ code: FOUR, lines: true }))).toHaveLength(4);
    expect(lineClasses(renderCode({ code: 'a\nb', lines: true }))).toHaveLength(2);
  });
});

describe('grid, compare, caption, wrap', () => {
  it('`cols: 2` sets --code-cols:2 on the blocks container', () => {
    const html = renderCode({ cols: 2, blocks: [{ code: 'a' }, { code: 'b' }] });
    expect(html).toContain('<div data-bl="blocks" class="code-grid" style="--code-cols:2">');
  });

  it('stacks by default (no grid class)', () => {
    expect(renderCode({ blocks: [{ code: 'a' }, { code: 'b' }] })).toContain('<div data-bl="blocks">');
  });

  it('`compare` prints the two eyebrows in a two-column grid', () => {
    const html = renderCode({ kind: 'compare', blocks: [{ code: 'a' }, { code: 'b' }] });
    expect(html).toContain('--code-cols:2');
    const eyebrows = parse(html).querySelectorAll('.code-eyebrow').map((e) => e.textContent);
    expect(eyebrows).toEqual(['BEFORE', 'AFTER']);
  });

  it("`compare` keeps an entry's own title", () => {
    const html = renderCode({ kind: 'compare', blocks: [{ title: 'v1.ts', code: 'a' }, { code: 'b' }] });
    expect(parse(html).querySelectorAll('.code-eyebrow').map((e) => e.textContent)).toEqual(['AFTER']);
    expect(html).toContain('>v1.ts</span>');
  });

  it('renders captions per entry and for the block', () => {
    const single = renderCode({ code: 'a', caption: 'one <line>' });
    expect(single).toContain('<div class="code-cap" data-bp="caption">one &lt;line&gt;</div>');
    const grid = renderCode({ caption: 'group', blocks: [{ code: 'a', caption: 'first' }] });
    expect(grid).toContain('data-bp="blocks.0.caption">first</div>');
    expect(grid).toContain('<div class="code-cap code-cap-group" data-bp="caption">group</div>');
  });

  it('`wrap: true` adds the wrap class', () => {
    expect(renderCode({ code: 'a', wrap: true })).toContain('code-block cb cb-wrap');
    expect(renderCode({ code: 'a' })).not.toContain('cb-wrap');
  });

  it('keeps the single-snippet data paths', () => {
    expect(renderCode({ title: 'main.ts', lang: 'ts', code: 'const x = 1;' })).toContain('<pre data-bp="code">');
  });
});

describe('diff and terminal are untouched', () => {
  // Captured from the renderer before the refinement.
  const DIFF =
    '<div class="code-block diff-block"><div class="code-header"><span>fix: clamp retry backoff</span><span data-bp="lang">TypeScript</span></div><pre class="diff-pre" data-bp="code"><span class="df-line df-hunk">@@ -12,7 +12,7 @@</span><span class="df-line df-ctx"> function backoff(attempt: number): number {</span><span class="df-line df-del">-  return 100 * attempt ** 2;</span><span class="df-line df-add">+  return Math.min(30_000, 100 * attempt ** 2);</span><span class="df-line df-ctx"> }</span><span class="df-line df-ctx"> </span></pre></div>';
  const TERM =
    '<div class="code-block terminal-block"><div class="code-header"><span>deploy — production</span><span>shell</span></div><pre class="tm-pre" data-bp="session"><span class="tm-line tm-cmd"><span class="tm-prompt">$</span> <span class="tm-cmd-text">kubectl rollout status deploy/api</span></span><span class="tm-line tm-comment"># wait for the rollout to settle before tagging</span><span class="tm-line tm-out">deployment &quot;api&quot; successfully rolled out</span><span class="tm-line tm-cmd"><span class="tm-prompt">$</span> <span class="tm-cmd-text">git tag v1.4.1 &amp;&amp; git push --tags</span></span></pre></div>';
  const BARE =
    '<div class="code-block terminal-block"><div class="code-header"><span>deploy — production</span><span>shell</span></div><pre class="tm-pre" data-bp="session"><span class="tm-line tm-cmd"><span class="tm-prompt">$</span> <span class="tm-cmd-text">ls</span></span><span class="tm-line tm-out">out</span></pre></div>';

  it('kind: diff', () => {
    expect(
      renderCode({
        kind: 'diff',
        title: 'fix: clamp retry backoff',
        lang: 'TypeScript',
        code: '@@ -12,7 +12,7 @@\n function backoff(attempt: number): number {\n-  return 100 * attempt ** 2;\n+  return Math.min(30_000, 100 * attempt ** 2);\n }\n',
      }),
    ).toBe(DIFF);
  });

  it('kind: terminal', () => {
    expect(
      renderCode({
        kind: 'terminal',
        title: 'deploy — production',
        session:
          '$ kubectl rollout status deploy/api\n# wait for the rollout to settle before tagging\ndeployment "api" successfully rolled out\n$ git tag v1.4.1 && git push --tags\n',
      }),
    ).toBe(TERM);
  });

  it('a bare `session` still reads as a terminal', () => {
    expect(renderCode({ title: 'deploy — production', session: '$ ls\nout\n' })).toBe(BARE);
  });
});

describe('the skin', () => {
  it('carries no hex in the code section', () => {
    const section = houseCss.slice(houseCss.indexOf('/* ── code (refined)'));
    expect(section.length).toBeGreaterThan(100);
    expect(section).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(section).toMatch(/\.cl-hl\{[^}]*var\(--accent\)/);
  });
});
