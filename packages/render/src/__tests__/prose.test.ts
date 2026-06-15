import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { renderProse } from '../markdown.js';

describe('renderProse', () => {
  it('wraps output in a .prose div', () => {
    const html = renderProse('Hello');
    expect(html.startsWith('<div class="prose">')).toBe(true);
    expect(html.endsWith('</div>')).toBe(true);
  });

  it('renders headings and paragraphs', () => {
    const root = parse(renderProse('# Title\n\nA paragraph.'));
    expect(root.querySelector('h1')?.text).toBe('Title');
    expect(root.querySelector('p')?.text).toBe('A paragraph.');
  });

  it('renders fenced code blocks with the language class (```ts fall-through)', () => {
    const html = renderProse('```ts\nconst x = 1;\n```');
    expect(html).toContain('<pre>');
    expect(html).toContain('<code class="language-ts">');
    expect(html).toContain('const x = 1;');
  });
});
