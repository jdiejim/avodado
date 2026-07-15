/**
 * Direct-edit path tagging for the ARCHITECTURE-family renderers: each emits
 * `data-bp` (one addressable YAML value/item) and `data-bl` (array container)
 * attributes whose paths match the block's schema field names. The shared
 * block-graph engine backs every `block` preset (infra/event/ddd/network),
 * and the felogic engine backs both variants (default + `variant: be`) —
 * tagging once lights up the whole family.
 */

import { describe, expect, it } from 'vitest';
import { renderBlock } from '../blocks/blockGraph.js';
import { renderFelogic } from '../blocks/felogic.js';
import { renderCluster } from '../blocks/cluster.js';
import { renderArchmap } from '../blocks/archmap.js';
import { renderUml } from '../blocks/uml.js';
import { renderFrontend } from '../blocks/frontend.js';
import { renderWireframe } from '../blocks/wireframe.js';

describe('data-path tagging (architecture family)', () => {
  it('block graph tags groups, layers, nodes, and edges in both layouts — for the whole family', () => {
    const grid = {
      groups: [{ col: 1, row: 1, cols: 2, rows: 1, label: 'VPC' }],
      nodes: [
        { id: 'api', col: 1, row: 1, kind: 'service', name: 'API' },
        { id: 'db', col: 2, row: 1, kind: 'db', name: 'DB' },
      ],
      edges: [{ from: 'api', to: 'db', label: 'reads' }],
    };
    const html = renderBlock(grid);
    expect(html).toContain('<g data-bl="groups">');
    expect(html).toContain('<g data-bp="groups.0">');
    expect(html).toContain('<g data-bl="nodes">');
    expect(html).toContain('data-bp="nodes.0"');
    expect(html).toContain('data-bp="nodes.1"');
    expect(html).toContain('<g data-bl="edges">');
    expect(html).toContain('data-bp="edges.0"');

    // Layered mode: layers + systemLabel are addressable too.
    const layered = renderBlock({
      systemLabel: 'Shop',
      layers: [{ label: 'Edge' }, { label: 'Core' }],
      nodes: [
        { id: 'cdn', layer: 0, name: 'CDN' },
        { id: 'svc', layer: 1, name: 'Service' },
      ],
      edges: [{ from: 'cdn', to: 'svc', label: 'routes' }],
    });
    expect(layered).toContain('data-bp="systemLabel"');
    expect(layered).toContain('<g data-bl="layers">');
    expect(layered).toContain('<g data-bp="layers.1">');
    expect(layered).toContain('<g data-bp="nodes.0">');
    expect(layered).toContain('data-bp="edges.0"');

    // The engine is shared: a preset (the former `infra` type) emits the same paths.
    const infra = renderBlock({ ...grid, preset: 'infra' as const });
    expect(infra).toContain('<g data-bp="groups.0">');
    expect(infra).toContain('data-bp="nodes.1"');
    expect(infra).toContain('data-bp="edges.0"');
  });

  it('grid layout exposes drag metadata: grid geometry on the svg, effective col/row per node', () => {
    // Placed mode: coordinates come straight from the YAML; no auto flag.
    const placed = renderBlock({
      nodes: [
        { id: 'api', col: 1, row: 1, name: 'API' },
        { id: 'db', col: 2, row: 1, w: 2, name: 'DB' },
      ],
      edges: [{ from: 'api', to: 'db' }],
    });
    expect(placed).toContain(' data-grid="1"');
    expect(placed).not.toContain('data-grid-auto');
    expect(placed).toContain('data-cell-w="178"');
    expect(placed).toContain('data-cell-h="88"');
    expect(placed).toContain('data-gap-x="64"');
    expect(placed).toContain('data-pad-x="38"');
    expect(placed).toContain('data-pad-top="52"');
    expect(placed).toMatch(/data-bp="nodes\.1" data-col="2" data-row="1" data-w="2"/);

    // Quick mode (no col/row anywhere): auto-layout runs, the svg says so,
    // and every node still advertises its EFFECTIVE cell.
    const quick = renderBlock({
      nodes: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    });
    expect(quick).toContain('data-grid-auto="1"');
    expect(quick).toMatch(/data-bp="nodes\.0" data-col="\d+" data-row="\d+"/);
    expect(quick).toMatch(/data-bp="nodes\.1" data-col="\d+" data-row="\d+"/);

    // Layered mode has no grid — no drag metadata.
    const layered = renderBlock({
      layers: [{ label: 'Edge' }],
      nodes: [{ id: 'cdn', layer: 0, name: 'CDN' }],
    });
    expect(layered).not.toContain('data-grid');
  });

  it('felogic tags groups, nodes (cards and shaped), and edges — and variant: be emits the same paths', () => {
    const data = {
      groups: [{ col: 1, row: 1, cols: 2, rows: 1, label: 'Domain' }],
      nodes: [
        { id: 'svc', col: 1, row: 1, kind: 'service', name: 'OrderService' },
        { id: 'db', col: 2, row: 1, kind: 'db', name: 'orders-db' },
      ],
      edges: [{ from: 'svc', to: 'db', label: 'reads', kind: 'reads' as const }],
    };
    const html = renderFelogic(data);
    expect(html).toContain('<g data-bl="groups">');
    expect(html).toContain('<g data-bp="groups.0">');
    expect(html).toContain('<g data-bl="nodes">');
    expect(html).toContain('data-bp="nodes.0"'); // card node
    expect(html).toContain('<g data-bp="nodes.1">'); // shaped (cylinder) node
    expect(html).toContain('data-bp="edges.0"');

    const be = renderFelogic({ ...data, variant: 'be' as const });
    expect(be).toContain('<g data-bp="groups.0">');
    expect(be).toContain('<g data-bp="nodes.1">');
    expect(be).toContain('data-bp="edges.0"');
  });

  it('cluster tags cluster shells, services, and edges plus all three containers', () => {
    const html = renderCluster({
      clusters: [
        { id: 'ns1', label: 'frontend', kind: 'namespace' },
        { id: 'ns2', label: 'data', kind: 'namespace' },
      ],
      services: [
        { id: 'web', cluster: 'ns1', label: 'web', replicas: 3 },
        { id: 'pg', cluster: 'ns2', label: 'postgres', kind: 'db' },
      ],
      edges: [{ from: 'web', to: 'pg', label: 'sql' }],
    });
    expect(html).toContain('<g data-bl="clusters">');
    expect(html).toContain('<g data-bp="clusters.0">');
    expect(html).toContain('<g data-bp="clusters.1">');
    expect(html).toContain('<g data-bl="services">');
    expect(html).toContain('data-bp="services.0"');
    expect(html).toContain('data-bp="services.1"'); // cylinder branch
    expect(html).toContain('<g data-bl="edges">');
    expect(html).toContain('data-bp="edges.0"');
  });

  it('archmap tags areas, their label/desc, and item tiles', () => {
    const html = renderArchmap({
      title: 'Capability map',
      description: 'Target state',
      areas: [
        { label: 'Channels', desc: 'Customer-facing', items: ['Web', { name: 'App', status: 'target' as const }] },
        { label: 'Core', items: ['Billing'] },
      ],
    });
    expect(html).toContain('data-bp="title"');
    expect(html).toContain('data-bp="description"');
    expect(html).toContain('data-bl="areas"');
    expect(html).toContain('data-bp="areas.0"');
    expect(html).toContain('data-bp="areas.0.label"');
    expect(html).toContain('data-bp="areas.0.desc"');
    expect(html).toContain('data-bl="areas.0.items"');
    expect(html).toContain('data-bp="areas.0.items.1"');
    expect(html).toContain('data-bp="areas.1.items.0"');
  });

  it('uml tags class boxes, name, attr/method lines, and relationships', () => {
    const html = renderUml({
      classes: [
        {
          id: 'a',
          name: 'Animal',
          stereotype: 'abstract',
          attrs: ['+name: string', '-age: number'],
          methods: ['+speak(): void'],
        },
        { id: 'd', name: 'Dog', methods: ['+speak(): void'] },
      ],
      rels: [{ from: 'd', to: 'a', kind: 'inheritance' as const, label: 'is-a' }],
    });
    expect(html).toContain('<g data-bl="classes">');
    expect(html).toContain('data-bp="classes.0"');
    expect(html).toContain('data-bp="classes.0.name"');
    expect(html).toContain('<g data-bl="classes.0.attrs">');
    expect(html).toContain('data-bp="classes.0.attrs.1"');
    expect(html).toContain('data-bp="classes.1.methods.0"');
    expect(html).toContain('<g data-bl="rels">');
    expect(html).toContain('data-bp="rels.0"');
  });

  it('frontend tags component nodes and the nodes container', () => {
    const html = renderFrontend({
      nodes: [
        { id: 'app', name: 'App', kind: 'root' as const },
        { id: 'nav', parent: 'app', name: 'Nav', kind: 'component' as const, note: 'sticky' },
      ],
    });
    expect(html).toContain('<g data-bl="nodes">');
    expect(html).toContain('data-bp="nodes.0"');
    expect(html).toContain('data-bp="nodes.1"');
  });

  it('wireframe tags screens, title/url/label subfields, and element groups', () => {
    const html = renderWireframe({
      screens: [
        {
          device: 'browser' as const,
          url: 'shop.example',
          label: 'Landing',
          elements: [{ type: 'header' as const, label: 'Shop' }, { type: 'button' as const }],
        },
        { device: 'phone' as const, title: 'Cart', elements: [{ type: 'list' as const, rows: 2 }] },
      ],
    });
    expect(html).toContain('<g data-bl="screens">');
    expect(html).toContain('data-bp="screens.0"');
    expect(html).toContain('data-bp="screens.0.url"');
    expect(html).toContain('data-bp="screens.1.title"');
    expect(html).toContain('<g data-bp="screens.0.label">');
    expect(html).toContain('<g data-bl="screens.0.elements">');
    expect(html).toContain('<g data-bp="screens.0.elements.1">');
    expect(html).toContain('<g data-bp="screens.1.elements.0">');
  });
});
