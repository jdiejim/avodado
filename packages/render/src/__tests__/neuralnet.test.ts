import { describe, expect, it } from 'vitest';
import { HTMLElement, parse } from 'node-html-parser';
import { BLOCK_TEMPLATES, parseDocument } from '@avodado/core';
import { renderNeuralnet } from '../blocks/neuralnet.js';
import { renderDocument } from '../document.js';

type Data = Parameters<typeof renderNeuralnet>[0];

/** Direct children of `el` whose tag is one of `tags`. */
const direct = (el: HTMLElement | undefined | null, ...tags: string[]): HTMLElement[] =>
  (el?.childNodes ?? []).filter((n): n is HTMLElement => n instanceof HTMLElement && tags.includes(n.rawTagName));

const DIGITS: Data = {
  title: 'Digit classifier',
  params: '1.2M',
  layers: [
    { label: 'Input', units: 784, kind: 'input', note: '28×28 pixels' },
    { label: 'Conv 3×3', units: 32, kind: 'conv', activation: 'ReLU' },
    { label: 'Max pool', units: 32, kind: 'pool' },
    { label: 'Dense', units: 128, kind: 'dense', activation: 'ReLU' },
    { label: 'Dropout 0.3', units: 128, kind: 'dropout' },
    { label: 'Output', units: 10, kind: 'output', activation: 'softmax' },
  ],
};

const NO_HEX = /#[0-9a-f]{3,6}\b/i;

describe('neuralnet', () => {
  it('renders the catalog template', () => {
    const html = renderDocument(parseDocument(BLOCK_TEMPLATES.neuralnet, 'nn'));
    expect(html).toContain('Digit classifier');
    expect(html).toContain('>784<');
  });

  it('draws min(units, maxUnits) glyphs per layer and prints the real unit count', () => {
    const root = parse(renderNeuralnet(DIGITS));
    const layers = root.querySelectorAll('g[data-bl="layers"] > g[data-bp]');
    expect(layers).toHaveLength(6);
    const glyphs = (i: number): number => direct(layers[i], 'circle', 'rect', 'path').length;
    // 784 / 32 / 32 / 128 / 128 / 10 → capped at the default 6 everywhere.
    for (let i = 0; i < 6; i++) expect(glyphs(i)).toBe(6);
    expect(layers[0]?.querySelector('[data-bp="layers.0.units"]')?.text).toBe('784');
    // The ellipsis: three small dots inside a truncated layer, none in an exact one.
    expect(layers[0]?.querySelectorAll('g[data-decorative] circle')).toHaveLength(3);
    const exact = parse(renderNeuralnet({ layers: [{ label: 'a', units: 3 }, { label: 'b', units: 2 }] }));
    const cols = exact.querySelectorAll('g[data-bl="layers"] > g[data-bp]');
    expect(direct(cols[0], 'circle')).toHaveLength(3);
    expect(direct(cols[1], 'circle')).toHaveLength(2);
    expect(cols[0]?.querySelectorAll('g[data-decorative] circle')).toHaveLength(0);
  });

  it('honours maxUnits', () => {
    const root = parse(renderNeuralnet({ ...DIGITS, maxUnits: 3 }));
    const first = root.querySelector('g[data-bl="layers"] > g[data-bp]');
    expect(direct(first, 'circle')).toHaveLength(3);
  });

  it('meshes consecutive layers and skips a layer that says connect: none', () => {
    const dense = parse(renderNeuralnet({ layers: [{ label: 'a', units: 3 }, { label: 'b', units: 4 }] }));
    expect(dense.querySelectorAll('line')).toHaveLength(12);
    const none = parse(renderNeuralnet({ layers: [{ label: 'a', units: 3 }, { label: 'b', units: 4, connect: 'none' }] }));
    expect(none.querySelectorAll('line')).toHaveLength(0);
  });

  it('prints the activation in mono, the params in the footer, and a legend of the kinds present', () => {
    const html = renderNeuralnet(DIGITS);
    const root = parse(html);
    expect(root.querySelector('[data-bp="layers.1.activation"]')?.text).toBe('ReLU');
    expect(root.querySelector('[data-bp="layers.1.activation"]')?.classList.contains('t-sub')).toBe(true);
    expect(root.querySelector('.diagram-foot')?.text).toContain('1.2M');
    const legend = root.querySelectorAll('.diagram-legend .lg-label').map((l) => l.text);
    expect(legend).toEqual(['input', 'conv', 'pool', 'dense', 'dropout', 'output']);
    expect(html).not.toMatch(NO_HEX);
    expect(html).not.toContain('NaN');
  });

  it('grows the viewBox with the layer count', () => {
    const w = (n: number): number => {
      const layers = Array.from({ length: n }, (_, i) => ({ label: `L${i}`, units: 4 }));
      const vb = parse(renderNeuralnet({ layers })).querySelector('svg')?.getAttribute('viewBox') ?? '';
      return Number(vb.split(' ')[2]);
    };
    expect(w(6)).toBeGreaterThan(w(2));
  });
});
