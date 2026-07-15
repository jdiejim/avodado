import { describe, expect, it } from 'vitest';
import { parseDocument } from '@avodado/core';
import { safeColor, safeUrl } from '../sanitize.js';
import { renderProse } from '../markdown.js';
import { renderDocument } from '../document.js';
import { renderStats } from '../blocks/stats.js';
import { renderBlock } from '../blocks/blockGraph.js';

describe('safeColor', () => {
  it('passes through hex, rgb, hsl, and named colours', () => {
    expect(safeColor('#0e54a1', '#000')).toBe('#0e54a1');
    expect(safeColor('#fff', '#000')).toBe('#fff');
    expect(safeColor('#0e54a1ff', '#000')).toBe('#0e54a1ff');
    expect(safeColor('rgb(14, 84, 161)', '#000')).toBe('rgb(14, 84, 161)');
    expect(safeColor('rgba(0,0,0,0.5)', '#000')).toBe('rgba(0,0,0,0.5)');
    expect(safeColor('hsl(210, 84%, 34%)', '#000')).toBe('hsl(210, 84%, 34%)');
    expect(safeColor('rebeccapurple', '#000')).toBe('rebeccapurple');
    expect(safeColor('transparent', '#000')).toBe('transparent');
  });

  it('rejects attribute-breakout payloads', () => {
    expect(safeColor('#fff" onload="alert(1)', '#000')).toBe('#000');
    expect(safeColor('red;background:url(x)', '#000')).toBe('#000');
    expect(safeColor('"><script>alert(1)</script>', '#000')).toBe('#000');
    expect(safeColor('url(javascript:alert(1))', '#000')).toBe('#000');
    expect(safeColor('', '#000')).toBe('#000');
    expect(safeColor(undefined, '#000')).toBe('#000');
  });
});

describe('safeUrl', () => {
  it('passes through safe schemes + relative + fragments', () => {
    expect(safeUrl('https://example.com')).toBe('https://example.com');
    expect(safeUrl('/docs/x')).toBe('/docs/x');
    expect(safeUrl('#section')).toBe('#section');
    expect(safeUrl('mailto:x@y.com')).toBe('mailto:x@y.com');
  });

  it('neutralises script-bearing schemes', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('#');
    expect(safeUrl('  JaVaScRiPt:alert(1)')).toBe('#');
    expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBe('#');
    expect(safeUrl('vbscript:msgbox(1)')).toBe('#');
  });
});

describe('markdown hardening (XSS)', () => {
  it('escapes raw block + inline HTML instead of passing it through', () => {
    const html = renderProse('Hello <img src=x onerror=alert(1)> and <script>alert(1)</script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;img');
    expect(html).toContain('&lt;script&gt;');
  });

  it('still renders legitimate markdown', () => {
    const html = renderProse('**bold** `code` [link](https://example.com)');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('href="https://example.com"');
  });

  it('rewrites javascript: and data: link hrefs to #', () => {
    const a = renderProse('[click](javascript:alert(1))');
    expect(a).toContain('href="#"');
    expect(a).not.toContain('javascript:');
    const b = renderProse('[x](data:text/html,<script>alert(1)</script>)');
    expect(b).not.toContain('data:text/html');
  });
});

describe('block renderers reject malicious colours', () => {
  it('stats accent breakout is dropped to the default', () => {
    const html = renderStats({
      stats: [{ value: '1', label: 'x', accent: '#fff" onload="alert(1)' }],
    });
    expect(html).not.toContain('onload=');
    expect(html).toContain('border-top-color:#0e54a1');
  });

  it('block group colour breakout is dropped to the default', () => {
    const html = renderBlock({
      groups: [{ col: 1, row: 1, label: 'G', color: '#fff" onload="alert(1)' }],
      nodes: [{ id: 'a', col: 1, row: 1, name: 'A' }],
    });
    expect(html).not.toContain('onload=');
  });
});

describe('renderDocument end-to-end XSS', () => {
  it('a hostile document produces no executable sinks', () => {
    const md = [
      '```meta',
      'title: Pwn',
      '```',
      '',
      'Prose with <img src=x onerror=alert(1)> and [js](javascript:alert(1)).',
      '',
      '```stats',
      'stats:',
      '  - { value: "1", label: x, accent: \'#fff" onload="alert(1)\' }',
      '```',
    ].join('\n');
    const html = renderDocument(parseDocument(md, 'pwn'));
    // No live executable sinks: no unescaped <img>/<script> tags, no
    // javascript:/on*= inside an actual attribute. (Escaped text like
    // `&lt;img onerror=…&gt;` is inert and allowed.)
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toMatch(/<[a-z]+[^>]*\son\w+=/i);
  });
});
