import { describe, expect, it } from 'vitest';
import { parseDocument } from '../parser.js';
import { DENSITY_BUDGETS, lintDensity } from '../density.js';

/** Parses and density-lints a markdown string in one step. */
function lint(md: string, file = 'doc.md') {
  return lintDensity(parseDocument(md, 'doc'), file);
}

/** A sequence block with `n` messages between two actors. */
function sequenceDoc(messages: number, actors = 2): string {
  const a = Array.from({ length: actors }, (_, i) => `  - { id: a${i}, label: A${i} }`);
  const m = Array.from({ length: messages }, (_, i) => `  - { from: a0, to: a1, label: m${i} }`);
  return `\`\`\`sequence\nid: seq\nactors:\n${a.join('\n')}\nmessages:\n${m.join('\n')}\n\`\`\`\n`;
}

/** An erd block with `n` entities. */
function erdDoc(entities: number): string {
  const e = Array.from({ length: entities }, (_, i) => `  - { name: E${i} }`);
  return `\`\`\`erd\nentities:\n${e.join('\n')}\n\`\`\`\n`;
}

/** A flow block with `n` nodes. */
function flowDoc(nodes: number): string {
  const n = Array.from({ length: nodes }, (_, i) => `  - { id: n${i}, label: N${i} }`);
  return `\`\`\`flow\nnodes:\n${n.join('\n')}\n\`\`\`\n`;
}

/** A kanban block with `n` columns. */
function kanbanDoc(columns: number): string {
  const c = Array.from({ length: columns }, (_, i) => `  - { label: C${i} }`);
  return `\`\`\`kanban\ncolumns:\n${c.join('\n')}\n\`\`\`\n`;
}

describe('lintDensity budgets', () => {
  it('sequence at 24 messages is clean; 25 warns and names count and cap', () => {
    expect(lint(sequenceDoc(24))).toEqual([]);
    const diags = lint(sequenceDoc(25));
    expect(diags).toHaveLength(1);
    const d = diags[0];
    expect(d?.code).toBe('W_DENSE_BLOCK');
    expect(d?.level).toBe('warn');
    expect(d?.message).toContain('25 messages');
    expect(d?.message).toContain('24');
    expect(d?.message).toContain('sequence');
    expect(d?.message).toContain("'seq'");
    expect(d?.hint).toContain('Split the flow into one sequence per scenario.');
  });

  it('sequence at 8 actors is clean; 9 warns on the actor budget', () => {
    expect(lint(sequenceDoc(1, 8))).toEqual([]);
    const diags = lint(sequenceDoc(1, 9));
    expect(diags).toHaveLength(1);
    expect(diags[0]?.message).toContain('9 actors');
    expect(diags[0]?.message).toContain('8');
  });

  it('erd at 12 entities is clean; 13 warns', () => {
    expect(lint(erdDoc(12))).toEqual([]);
    const diags = lint(erdDoc(13));
    expect(diags).toHaveLength(1);
    expect(diags[0]?.code).toBe('W_DENSE_BLOCK');
    expect(diags[0]?.message).toContain('13 entities');
    expect(diags[0]?.message).toContain('12');
    expect(diags[0]?.hint).toContain('Split the model by domain.');
  });

  it('flow at 24 nodes is clean; 25 warns', () => {
    expect(lint(flowDoc(24))).toEqual([]);
    const diags = lint(flowDoc(25));
    expect(diags).toHaveLength(1);
    expect(diags[0]?.message).toContain('25 nodes');
    expect(diags[0]?.message).toContain('24');
  });

  it('kanban at 8 columns is clean; 9 warns', () => {
    expect(lint(kanbanDoc(8))).toEqual([]);
    const diags = lint(kanbanDoc(9));
    expect(diags).toHaveLength(1);
    expect(diags[0]?.message).toContain('9 columns');
    expect(diags[0]?.message).toContain('8');
  });

  it('points the diagnostic at the counted array inside the block', () => {
    const d = lint(sequenceDoc(25))[0];
    // Fence line 1, id line 2, actors: 3 (+2 items), messages: line 6 — the
    // array value node starts at its first item, line 7.
    expect(d?.file).toBe('doc.md');
    expect(d?.line).toBe(7);
  });
});

describe('lintDensity defensiveness', () => {
  it('never warns or throws on missing, empty, or malformed arrays', () => {
    const md = [
      '```sequence\ntitle: no arrays at all\n```',
      '```erd\nentities: not-an-array\n```',
      '```flow\nnodes: 42\n```',
      '```kanban\ncolumns: { label: scalar-map }\n```',
      '```graph\n- a\n- b\n```', // body is a list, not a map
    ].join('\n\n');
    expect(lint(md)).toEqual([]);
  });

  it('skips blocks whose body failed to parse', () => {
    const md = '```sequence\nmessages: [unclosed\n```\n';
    expect(lint(md)).toEqual([]);
  });

  it('ignores block types without a budget', () => {
    const rows = Array.from({ length: 60 }, (_, i) => `  - [r${i}]`).join('\n');
    expect(lint(`\`\`\`table\nrows:\n${rows}\n\`\`\`\n`)).toEqual([]);
  });
});

describe('DENSITY_BUDGETS map', () => {
  it('ships the documented caps', () => {
    const cap = (type: keyof typeof DENSITY_BUDGETS, field: string) =>
      DENSITY_BUDGETS[type]?.find((b) => b.field === field)?.cap;
    expect(cap('sequence', 'actors')).toBe(8);
    expect(cap('sequence', 'messages')).toBe(24);
    expect(cap('flow', 'nodes')).toBe(24);
    expect(cap('dfd', 'nodes')).toBe(24);
    expect(cap('state', 'states')).toBe(16);
    expect(cap('c4', 'nodes')).toBe(20);
    expect(cap('block', 'nodes')).toBe(20);
    expect(cap('felogic', 'nodes')).toBe(20);
    expect(cap('frontend', 'nodes')).toBe(20);
    expect(cap('erd', 'entities')).toBe(12);
    expect(cap('tree', 'nodes')).toBe(40);
    expect(cap('graph', 'nodes')).toBe(30);
    expect(cap('cluster', 'services')).toBe(16);
    expect(cap('archmap', 'areas')).toBe(8);
    expect(cap('kanban', 'columns')).toBe(8);
    expect(cap('timeline', 'items')).toBe(20);
    expect(cap('journey', 'stages')).toBe(10);
    expect(cap('storymap', 'backbone')).toBe(10);
    expect(cap('slopegraph', 'items')).toBe(20);
  });
});
