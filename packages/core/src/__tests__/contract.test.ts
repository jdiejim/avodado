/**
 * The schema-derived block contract (`avo block <type>`): every block prints,
 * every example validates, and the hand-written terse-form hints match the
 * grammar table in normalize.ts exactly — no grammar without a hint, no hint
 * without a grammar.
 */

import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES } from '../types.js';
import { blockContract, formatBlockContract, TERSE_HINTS } from '../blocks/contract.js';
import { describeBlockSchema, type FieldNode } from '../blocks/introspect.js';
import { hasTerseGrammar } from '../blocks/normalize.js';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';

/** Every list path (`field` or `parent.child`) a terse grammar could attach to. */
function listPaths(root: FieldNode): string[] {
  if (root.kind !== 'object') return [];
  const out: string[] = [];
  for (const f of root.fields) {
    if (f.node.kind !== 'array') continue;
    out.push(f.name);
    const el = f.node.element;
    if (el.kind === 'object') {
      for (const g of el.fields) if (g.node.kind === 'array') out.push(`${f.name}.${g.name}`);
    }
  }
  return out;
}

describe('blockContract', () => {
  it('prints for every block type and the example validates', () => {
    for (const type of BLOCK_TYPES) {
      const text = formatBlockContract(type);
      expect(text.startsWith(`${type} — `)).toBe(true);
      expect(text).toContain('```' + type);
      const c = blockContract(type);
      const doc = parseDocument('```' + type + '\n' + c.example + '\n```\n', 'contract');
      expect(validateDocument(doc, `${type}.md`), `${type} example should validate`).toEqual([]);
    }
  });

  it('terse hints and terse grammars name the same list fields', () => {
    for (const type of BLOCK_TYPES) {
      const hinted = Object.keys(TERSE_HINTS[type] ?? {});
      for (const key of hinted) {
        expect(
          hasTerseGrammar(type, key.split('.')),
          `${type}.${key} has a hint but no grammar`,
        ).toBe(true);
      }
      for (const key of listPaths(describeBlockSchema(type))) {
        if (hasTerseGrammar(type, key.split('.'))) {
          expect(hinted, `${type}.${key} has a grammar but no hint`).toContain(key);
        }
      }
    }
  });

  it('marks required fields, enums, numbers, and bare-text bodies', () => {
    const seq = formatBlockContract('sequence');
    expect(seq).toContain('actors[]: { id*, name*, sub, external(bool) }');
    expect(seq).toContain('kind: sync|response|async|error|note');
    expect(seq).toContain('messages: `from -> to: label`');
    const c4 = formatBlockContract('c4');
    expect(c4).toContain('col(n 1..100)');
    const callout = formatBlockContract('callout');
    expect(callout).toContain('taken whole as `body`');
    const chart = blockContract('chart');
    expect(chart.aliases.map((a) => a.name).sort()).toEqual(['funnel', 'waterfall']);
  });
});
