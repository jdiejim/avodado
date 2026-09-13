import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { BLOCK_TEMPLATES, parseDocument } from '@avodado/core';
import { renderThreatmodel } from '../blocks/threatmodel.js';
import { renderDfd } from '../blocks/dfd.js';
import type { BlockDataMap } from '@avodado/core';

type Data = BlockDataMap['threatmodel'];

function catalog(): Data {
  const doc = parseDocument(BLOCK_TEMPLATES.threatmodel, 'threatmodel');
  const seg = doc.segments.find((s) => s.kind === 'threatmodel');
  if (seg === undefined || seg.kind !== 'threatmodel' || seg.data === null || seg.data === undefined) throw new Error('no template');
  return seg.data as Data;
}

describe('threatmodel', () => {
  const data = catalog();
  const html = renderThreatmodel(data);
  const root = parse(html);

  it('renders the catalog template: 3 nodes in the dfd shapes, 2 trust boundaries', () => {
    expect(root.querySelectorAll('g[data-bl="nodes"] > g')).toHaveLength(3);
    expect(root.querySelectorAll('.tm-bounds g[data-bl="boundaries"] > g')).toHaveLength(2);
    expect(html).toContain('>EXT<');
    expect(html).toContain('>DB<');
    expect(html).toContain('Trusted network');
  });

  it('draws the tls hop with a lock and the internal hop plain; no plain chip without channel plain', () => {
    expect(root.querySelectorAll('.tm-lock')).toHaveLength(1);
    expect(root.querySelectorAll('path[data-channel="plain"]')).toHaveLength(0);
    expect(html).not.toContain('>plain<');
    expect(root.querySelector('.diagram-legend')?.text).toContain('tls');
  });

  it('marks a plain channel as a dashed negative edge with a PLAIN chip', () => {
    const h = renderThreatmodel({
      ...data,
      edges: [{ from: 'browser', to: 'auth', label: 'POST /login', channel: 'plain' }],
    });
    const r = parse(h);
    const plain = r.querySelectorAll('path[data-channel="plain"]');
    expect(plain).toHaveLength(1);
    expect(plain[0]?.getAttribute('stroke')).toBe('var(--negative)');
    expect(plain[0]?.getAttribute('stroke-dasharray')).toBe('4 3');
    expect(h).toContain('>plain<');
    expect(r.querySelector('.diagram-legend')?.text).toContain('unencrypted');
  });

  it('lists the threats in a table of 3 rows with the STRIDE letters and full words', () => {
    const rows = root.querySelectorAll('tbody[data-bl="threats"] > tr');
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.querySelector('.tm-cat')?.text)).toEqual(['S', 'I', 'T']);
    expect(rows.map((r) => r.querySelector('.tm-cat')?.getAttribute('title'))).toEqual(['Spoofing', 'Information disclosure', 'Tampering']);
    // Targets resolve to node names; severity and status chips reuse the risk classes.
    expect(rows.map((r) => r.querySelector('.tm-target')?.text)).toEqual(['Browser', 'Auth service', 'Users DB']);
    expect(rows[0]?.querySelector('.rk-sev-high')).not.toBeNull();
    expect(rows[1]?.querySelector('.tm-st-open')).not.toBeNull();
  });

  it('prints an edge target as "from → to" with node names', () => {
    const h = renderThreatmodel({
      ...data,
      threats: [{ target: 'browser->auth', category: 'I', threat: 'Sniffed' }],
    });
    expect(parse(h).querySelector('.tm-target')?.text).toBe('Browser → Auth service');
  });

  it('has no NaN and no hex', () => {
    expect(html).not.toMatch(/NaN/);
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });

  it('draws the same node shapes as dfd', () => {
    const dfd = renderDfd({
      nodes: data.nodes.map((n) => ({ id: n.id, col: n.col, row: n.row, name: n.name, ...(n.kind !== undefined ? { kind: n.kind } : {}) })),
      edges: [],
    });
    const shape = (h: string, i: number): string | undefined =>
      parse(h).querySelectorAll('g[data-bl="nodes"] > g')[i]?.querySelector('rect')?.getAttribute('rx');
    // The process bubble carries the same radius in both renderers.
    expect(shape(html, 1)).toBe('16');
    expect(shape(dfd, 1)).toBe('16');
  });
});
