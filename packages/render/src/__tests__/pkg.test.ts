import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { BLOCK_TEMPLATES, parseDocument } from '@avodado/core';
import { renderPkg } from '../blocks/pkg.js';
import { renderDocument } from '../document.js';

type Data = Parameters<typeof renderPkg>[0];

const BACKEND: Data = {
  title: 'Backend module layout',
  packages: [
    { id: 'api', col: 1, row: 1, name: 'api', contains: ['routes', 'middleware'] },
    { id: 'domain', col: 2, row: 1, name: 'domain', contains: ['orders', 'payments', 'inventory'] },
    { id: 'infra', col: 3, row: 1, name: 'infra', contains: ['postgres', 'kafka', 'stripe'] },
    { id: 'shared', col: 2, row: 2, name: 'shared', contains: ['ids', 'money', 'clock'] },
  ],
  deps: [
    { from: 'api', to: 'domain', kind: 'use' },
    { from: 'domain', to: 'infra', kind: 'import', label: 'ports only' },
    { from: 'domain', to: 'shared' },
    { from: 'infra', to: 'shared' },
  ],
};

const NO_HEX = /#[0-9a-f]{3,6}\b/i;

describe('pkg', () => {
  it('renders the catalog template', () => {
    const html = renderDocument(parseDocument(BLOCK_TEMPLATES.pkg, 'pkg'));
    expect(html).toContain('Backend module layout');
    expect(html).toContain('«import» ports only');
    expect(html).not.toContain('NaN');
  });

  it('draws a tabbed folder per package and one dashed arrow per dependency', () => {
    const html = renderPkg(BACKEND);
    expect(html).not.toMatch(NO_HEX);
    const root = parse(html);
    const folders = root.querySelectorAll('g[data-bl="packages"] > g[data-bp]');
    expect(folders).toHaveLength(4);
    // Each folder: the tab path plus the body rect.
    for (const f of folders) {
      expect(f.querySelectorAll('path')).toHaveLength(1);
      expect(f.querySelectorAll('rect')).toHaveLength(1);
    }
    const deps = root.querySelectorAll('g[data-bl="deps"] path');
    expect(deps).toHaveLength(4);
    for (const d of deps) {
      expect(d.getAttribute('stroke-dasharray')).toBe('5 4');
      expect(d.getAttribute('marker-end')).toBe('url(#skArrow)');
    }
  });

  it('prints members in mono, capped at five plus a "+n more" line', () => {
    const root = parse(renderPkg(BACKEND));
    expect(root.querySelectorAll('[data-bl="packages.1.contains"] text').map((t) => t.text)).toEqual(['orders', 'payments', 'inventory']);
    const many = renderPkg({
      packages: [{ id: 'a', name: 'a', contains: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'] }],
    });
    const lines = parse(many).querySelectorAll('[data-bl="packages.0.contains"] text').map((t) => t.text);
    expect(lines).toEqual(['m1', 'm2', 'm3', 'm4', 'm5', '+2 more']);
  });

  it('places packages on the grid: same row shares y, a lower row sits below', () => {
    const root = parse(renderPkg(BACKEND));
    const rect = (path: string): { x: number; y: number } => {
      const r = root.querySelector(`[data-bp="${path}"] rect`);
      return { x: Number(r?.getAttribute('x')), y: Number(r?.getAttribute('y')) };
    };
    expect(rect('packages.0').y).toBe(rect('packages.1').y);
    expect(rect('packages.0').x).toBeLessThan(rect('packages.1').x);
    expect(rect('packages.3').y).toBeGreaterThan(rect('packages.1').y);
    expect(rect('packages.3').x).toBe(rect('packages.1').x);
  });

  it('lays packages out automatically when col / row are absent', () => {
    const html = renderPkg({
      packages: [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }, { id: 'c', name: 'c' }],
      deps: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }],
    });
    const xs = parse(html).querySelectorAll('g[data-bl="packages"] > g[data-bp] rect').map((r) => Number(r.getAttribute('x')));
    expect(new Set(xs).size).toBe(3);
    expect(html).not.toContain('NaN');
  });

  it('draws a parent package as a larger folder around its children', () => {
    const html = renderPkg({
      packages: [
        { id: 'core', name: 'core', stereotype: 'layer' },
        { id: 'a', col: 1, row: 1, name: 'a', parent: 'core', contains: ['x'] },
        { id: 'b', col: 2, row: 1, name: 'b', parent: 'core' },
        { id: 'ui', col: 3, row: 1, name: 'ui' },
      ],
      deps: [{ from: 'ui', to: 'core', kind: 'access' }],
    });
    const root = parse(html);
    const box = (path: string): { x: number; y: number; r: number; b: number } => {
      const el = root.querySelector(`[data-bp="${path}"] rect`);
      const x = Number(el?.getAttribute('x'));
      const y = Number(el?.getAttribute('y'));
      return { x, y, r: x + Number(el?.getAttribute('width')), b: y + Number(el?.getAttribute('height')) };
    };
    const core = box('packages.0');
    const a = box('packages.1');
    const b = box('packages.2');
    expect(core.x).toBeLessThan(a.x);
    expect(core.y).toBeLessThan(a.y);
    expect(core.r).toBeGreaterThan(b.r);
    expect(core.b).toBeGreaterThan(b.b);
    expect(root.querySelector('[data-bp="packages.0"] rect')?.getAttribute('fill')).toBe('var(--paper-2)');
    expect(html).toContain('«layer»');
    expect(html).toContain('«access»');
    // The dependency onto the parent lands on its box and the viewBox holds it.
    const vb = root.querySelector('svg')?.getAttribute('viewBox')?.split(' ').map(Number) ?? [];
    expect(core.x).toBeGreaterThanOrEqual(0);
    expect(core.y).toBeGreaterThanOrEqual(0);
    expect(vb[2]).toBeGreaterThan(box('packages.3').r);
    expect(vb[3]).toBeGreaterThan(core.b);
    const legend = root.querySelectorAll('.diagram-legend .lg-label').map((l) => l.text);
    expect(legend).toEqual(['package', 'parent package', 'dependency', 'access']);
  });
});
