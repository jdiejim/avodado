import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { resolveRefs } from '../resolve.js';

describe('resolveRefs', () => {
  it('resolves a same-doc reference (bare #id)', () => {
    const md = [
      '```sequence',
      'id: seq-place-order',
      'actors: [A, B]',
      'messages: []',
      '```',
      '',
      '```userstory',
      'role: shopper',
      'want: pay',
      'soThat: complete purchase',
      'links:',
      '  - { ref: "#seq-place-order", label: Flow }',
      '```',
    ].join('\n');
    const doc = parseDocument(md, 'orders');
    const { graph, diagnostics } = resolveRefs([{ doc, file: 'orders.md' }]);
    expect(diagnostics).toEqual([]);
    expect(graph.nodes.has('seq-place-order')).toBe(true);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({ to: 'orders#seq-place-order' });
  });

  it('resolves a cross-doc reference (doc#id)', () => {
    const a = parseDocument(
      ['```sequence', 'id: seq-a', 'actors: [X]', 'messages: []', '```'].join('\n'),
      'a',
    );
    const b = parseDocument(
      [
        '```userstory',
        'role: u',
        'want: w',
        'soThat: t',
        'links:',
        '  - { ref: "a#seq-a", label: Flow }',
        '```',
      ].join('\n'),
      'b',
    );
    const { diagnostics } = resolveRefs([
      { doc: a, file: 'a.md' },
      { doc: b, file: 'b.md' },
    ]);
    expect(diagnostics).toEqual([]);
  });

  it('reports E_DANGLING_REF with file, line, and offending value', () => {
    const md = [
      '```userstory',
      'role: u',
      'want: w',
      'soThat: t',
      'links:',
      '  - { ref: "#missing", label: x }',
      '```',
    ].join('\n');
    const doc = parseDocument(md, 'doc');
    const { diagnostics } = resolveRefs([{ doc, file: 'doc.md' }]);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      file: 'doc.md',
      level: 'error',
      code: 'E_DANGLING_REF',
      value: '#missing',
      line: 1,
    });
  });

  it('reports E_DUP_ID with both file/line locations referenced', () => {
    const a = parseDocument(['```sequence', 'id: dup', 'actors: []', 'messages: []', '```'].join('\n'), 'a');
    const b = parseDocument(['```erd', 'id: dup', 'entities: []', 'relations: []', '```'].join('\n'), 'b');
    const { diagnostics } = resolveRefs([
      { doc: a, file: 'a.md' },
      { doc: b, file: 'b.md' },
    ]);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      file: 'b.md',
      code: 'E_DUP_ID',
      value: 'dup',
    });
    expect(diagnostics[0]?.message).toContain('a.md');
  });

  it('reports E_BAD_REF_FORMAT for a malformed ref string', () => {
    const md = [
      '```userstory',
      'role: u',
      'want: w',
      'soThat: t',
      'links:',
      '  - { ref: "not a valid ref", label: x }',
      '```',
    ].join('\n');
    const doc = parseDocument(md, 'doc');
    const { diagnostics } = resolveRefs([{ doc, file: 'doc.md' }]);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ code: 'E_BAD_REF_FORMAT', value: 'not a valid ref' });
  });

  it('ignores a userstory with no links', () => {
    const md = ['```userstory', 'role: u', 'want: w', 'soThat: t', '```'].join('\n');
    const doc = parseDocument(md, 'doc');
    const { diagnostics, graph } = resolveRefs([{ doc, file: 'doc.md' }]);
    expect(diagnostics).toEqual([]);
    expect(graph.edges).toEqual([]);
  });
});
