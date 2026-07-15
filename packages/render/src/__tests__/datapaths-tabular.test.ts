/**
 * Direct-edit path tagging, second wave (tabular / card renderers): each
 * renderer emits `data-bp` (one addressable YAML value/item) and `data-bl`
 * (array container) attributes whose paths match the block's schema field
 * names. The attributes are inert metadata — these tests pin the contract the
 * studio's direct-edit layer navigates by.
 */

import { describe, expect, it } from 'vitest';
import { renderAnatomy } from '../blocks/anatomy.js';
import { renderCode } from '../blocks/code.js';
import { renderComposition } from '../blocks/composition.js';
import { renderEndpoint } from '../blocks/endpoint.js';
import { renderEnvelope } from '../blocks/envelope.js';
import { renderMatrix } from '../blocks/matrix.js';
import { renderOptions } from '../blocks/options.js';
import { renderPattern } from '../blocks/pattern.js';
import { renderSlo } from '../blocks/slo.js';
import { renderSpec } from '../blocks/spec.js';

describe('data-path tagging (tabular / card blocks)', () => {
  it('code tags each snippet, its title/lang/code, and the blocks container', () => {
    const html = renderCode({
      blocks: [
        { title: 'a.ts', lang: 'ts', code: 'const a = 1;' },
        { code: 'echo hi' },
      ],
    });
    expect(html).toContain('<div data-bl="blocks">');
    expect(html).toContain('data-bp="blocks.0"');
    expect(html).toContain('data-bp="blocks.0.title"');
    expect(html).toContain('data-bp="blocks.1.lang"');
    expect(html).toContain('<pre data-bp="blocks.1.code">');
  });

  it('code single-snippet shorthand tags top-level title/lang/code (no blocks wrapper)', () => {
    const html = renderCode({ title: 'main.ts', lang: 'ts', code: 'const x = 1;' });
    expect(html).toContain('data-bp="title"');
    expect(html).toContain('data-bp="lang"');
    expect(html).toContain('<pre data-bp="code">');
    expect(html).not.toContain('data-bl="blocks"');
    // A bare `session` (no kind) reads as a terminal session.
    const term = renderCode({ session: '$ ls' });
    expect(term).toContain('<pre class="tm-pre" data-bp="session">');
  });

  it('code (kind: diff) tags the lang chip and the code container', () => {
    const html = renderCode({ kind: 'diff', title: 'fix', lang: 'diff', code: '+a\n-b\n@@ h' });
    expect(html).toContain('data-bp="lang"');
    expect(html).toContain('<pre class="diff-pre" data-bp="code">');
  });

  it('code (kind: terminal) tags the session container', () => {
    const html = renderCode({ kind: 'terminal', title: 'shell', session: '$ ls\nout\n# note' });
    expect(html).toContain('<pre class="tm-pre" data-bp="session">');
  });

  it('endpoint tags method/path, params, body, responses, and examples', () => {
    const html = renderEndpoint({
      method: 'POST',
      path: '/orders',
      auth: 'Bearer',
      params: [{ name: 'expand', in: 'query', type: 'string', desc: 'Expand refs' }],
      body: [{ name: 'sku', type: 'string', required: true, desc: 'Item' }],
      responses: [
        { status: 201, desc: 'Created', example: '{"id":1}' },
        { status: 400, desc: 'Bad request' },
      ],
      request: '{"sku":"x"}',
      response: '{"id":1}',
    });
    expect(html).toContain('data-bp="method"');
    expect(html).toContain('data-bp="path"');
    expect(html).toContain('data-bp="auth"');
    expect(html).toContain('<tbody data-bl="params">');
    expect(html).toContain('<tr data-bp="params.0">');
    expect(html).toContain('data-bp="params.0.name"');
    expect(html).toContain('data-bp="params.0.desc"');
    expect(html).toContain('<tbody data-bl="body">');
    expect(html).toContain('data-bp="body.0.type"');
    expect(html).toContain('<tbody data-bl="responses">');
    expect(html).toContain('data-bp="responses.1"');
    expect(html).toContain('data-bp="responses.0.status"');
    expect(html).toContain('data-bp="responses.0.example"');
    expect(html).toContain('data-bp="request"');
    expect(html).toContain('data-bp="response"');
  });

  it('envelope tags assumptions, steps, their fields, and the result band', () => {
    const html = renderEnvelope({
      assumptions: [{ label: 'DAU', value: '10M' }],
      steps: [
        { label: 'Writes', calc: '10M × 2', result: '20M/day' },
        { label: 'QPS', calc: '20M / 86400', result: '~230' },
      ],
      result: { label: 'Peak QPS', value: '~700' },
    });
    expect(html).toContain('<div class="env-givens" data-bl="assumptions">');
    expect(html).toContain('data-bp="assumptions.0"');
    expect(html).toContain('data-bp="assumptions.0.value"');
    expect(html).toContain('<div class="env-steps" data-bl="steps">');
    expect(html).toContain('data-bp="steps.1.calc"');
    expect(html).toContain('data-bp="steps.0.result"');
    expect(html).toContain('data-bp="result"');
    expect(html).toContain('data-bp="result.value"');
  });

  it('slo tags items, name/sli/target, and the items container', () => {
    const html = renderSlo({
      items: [
        { name: 'API availability', sli: 'Good / total requests', target: '99.9%', current: '99.95%', budget: 0.3 },
        { name: 'Latency', sli: 'p99 < 300ms', target: '99%' },
      ],
    });
    expect(html).toContain('<div class="slo-list" data-bl="items">');
    expect(html).toContain('data-bp="items.0"');
    expect(html).toContain('data-bp="items.0.sli"');
    expect(html).toContain('data-bp="items.1.target"');
    expect(html).toContain('data-bp="items.1.name"');
  });

  it('matrix tags corner, col heads, rows, labels, cells, and the rows container', () => {
    const html = renderMatrix({
      corner: 'Role',
      cols: ['App', 'Billing'],
      rows: [
        { label: 'Admin', cells: ['Full', 'Full'] },
        { label: 'Viewer', cells: ['Read', '—'] },
      ],
    });
    expect(html).toContain('data-bp="corner"');
    expect(html).toContain('data-bp="cols.1"');
    expect(html).toContain('<tbody data-bl="rows">');
    expect(html).toContain('<tr data-bp="rows.0">');
    expect(html).toContain('data-bp="rows.1.label"');
    expect(html).toContain('data-bp="rows.0.cells.1"');
    expect(html).toContain('data-bp="rows.1.cells.0"');
  });

  it('anatomy tags segments, cards, their fields, and the parts container', () => {
    const html = renderAnatomy({
      separator: ':',
      parts: [
        { label: 'App', value: 'crm' },
        { label: 'Action', value: 'read', note: 'verb' },
      ],
    });
    expect(html).toContain('<div class="a-cards" data-bl="parts">');
    expect(html).toContain('data-bp="parts.0"');
    expect(html).toContain('data-bp="parts.0.value"');
    expect(html).toContain('data-bp="parts.1.label"');
    expect(html).toContain('data-bp="parts.1.note"');
    expect(html).toContain('data-bp="separator"');
  });

  it('composition tags gate cards, their fields, the result, and the gates container', () => {
    const html = renderComposition({
      result: 'crm:contacts:read',
      gates: [
        { label: 'Role grants', kicker: 'GATE 1', desc: 'union of roles' },
        { label: 'Plan limits', source: 'billing' },
      ],
    });
    expect(html).toContain('<div class="cp-row" data-bl="gates">');
    expect(html).toContain('data-bp="gates.0"');
    expect(html).toContain('data-bp="gates.0.kicker"');
    expect(html).toContain('data-bp="gates.1.label"');
    expect(html).toContain('data-bp="gates.0.desc"');
    expect(html).toContain('data-bp="result"');
  });

  it('spec tags row labels, values, step pills, and both containers', () => {
    const html = renderSpec({
      rows: [
        { label: 'GROUPS', value: 'none' },
        { label: 'RESOLUTION', steps: ['user', 'role', 'perm'] },
      ],
    });
    expect(html).toContain('data-bl="rows"');
    expect(html).toContain('data-bp="rows.0.label"');
    expect(html).toContain('data-bp="rows.0.value"');
    expect(html).toContain('<div class="sp-flow" data-bl="rows.1.steps">');
    expect(html).toContain('data-bp="rows.1.steps.2"');
  });

  it('pattern tags name, text rows, forces chips, participants, and consequences', () => {
    const html = renderPattern({
      name: 'Outbox',
      category: 'Messaging',
      intent: 'Atomic DB + publish',
      forces: ['dual write', 'exactly-once'],
      solution: 'Write events to an outbox table',
      participants: [{ name: 'Relay', role: 'polls the outbox' }],
      consequences: { pros: ['atomic'], cons: ['lag'] },
      note: 'Pair with CDC',
    });
    expect(html).toContain('data-bp="name"');
    expect(html).toContain('data-bp="category"');
    expect(html).toContain('data-bp="intent"');
    expect(html).toContain('data-bp="solution"');
    expect(html).toContain('data-bp="note"');
    expect(html).toContain('data-bl="forces"');
    expect(html).toContain('data-bp="forces.1"');
    expect(html).toContain('<ul class="pt-parts" data-bl="participants">');
    expect(html).toContain('data-bp="participants.0.name"');
    expect(html).toContain('data-bp="participants.0.role"');
    expect(html).toContain('data-bl="consequences.pros"');
    expect(html).toContain('data-bp="consequences.pros.0"');
    expect(html).toContain('data-bl="consequences.cons"');
    expect(html).toContain('data-bp="consequences.cons.0"');
  });

  it('options tags cards, title/how/verdict, pros/cons lists, and the items container', () => {
    const html = renderOptions({
      items: [
        {
          title: 'Embedded roles',
          kicker: 'OPTION A',
          how: 'roles live on the user row',
          pros: ['simple'],
          cons: ['no reuse', 'drift'],
          verdict: 'Rejected',
          tone: 'rejected',
        },
        { title: 'RBAC service', verdict: 'Chosen', tone: 'chosen' },
      ],
    });
    expect(html).toContain('<div class="op-grid" data-bl="items">');
    expect(html).toContain('data-bp="items.0"');
    expect(html).toContain('data-bp="items.0.title"');
    expect(html).toContain('data-bp="items.0.how"');
    expect(html).toContain('data-bp="items.1.verdict"');
    expect(html).toContain('data-bl="items.0.pros"');
    expect(html).toContain('data-bp="items.0.pros.0"');
    expect(html).toContain('data-bl="items.0.cons"');
    expect(html).toContain('data-bp="items.0.cons.1"');
  });
});
