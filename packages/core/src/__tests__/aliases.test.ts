/**
 * Permanent block-type aliases: every old spelling parses to its canonical
 * kind with the tag preserved in `sourceType`, the alias patch applied for
 * keys the body doesn't set (body wins), and a `W_ALIAS_TYPE` warning — never
 * an error, so `avo check` exit semantics are unchanged.
 */

import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES, BLOCK_TYPE_SET } from '../types.js';
import { BLOCK_ALIASES, ALIAS_TYPE_SET, BLOCK_SYNONYMS } from '../blocks/aliases.js';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';

/** A minimal valid body per alias (valid under the canonical schema). */
const ALIAS_BODIES: Record<string, string> = {
  infra: 'nodes:\n  - { id: a, col: 1, row: 1, name: A }',
  event: 'nodes:\n  - { id: a, col: 1, row: 1, name: A }',
  ddd: 'nodes:\n  - { id: a, col: 1, row: 1, name: A }',
  network: 'nodes:\n  - { id: a, col: 1, row: 1, name: A }',
  belogic: 'nodes:\n  - { id: a, col: 1, row: 1, name: A }',
  dag: 'nodes:\n  - { id: a, col: 1, row: 1, label: A }',
  waterfall: 'items:\n  - { label: DNS, value: 35 }',
  funnel: 'stages:\n  - { label: Visited, value: 100, desc: top of funnel }',
  diff: 'code: "+added line"',
  terminal: 'session: "$ ls"',
  mece: 'nodes:\n  - { id: root, label: Why }',
  tracker: 'items:\n  - { task: First, status: doing, priority: high }',
};

describe('BLOCK_ALIASES shape', () => {
  it('there are exactly 12 aliases and 87 canonical types, with no overlap', () => {
    expect(Object.keys(BLOCK_ALIASES)).toHaveLength(12);
    expect(BLOCK_TYPES).toHaveLength(87);
    for (const name of Object.keys(BLOCK_ALIASES)) {
      expect(BLOCK_TYPE_SET.has(name), `${name} must not be a canonical type`).toBe(false);
      expect(ALIAS_TYPE_SET.has(name)).toBe(true);
    }
  });

  it('every alias targets a canonical type and carries display data', () => {
    for (const [name, alias] of Object.entries(BLOCK_ALIASES)) {
      expect(BLOCK_TYPE_SET.has(alias.type), `${name} → ${alias.type}`).toBe(true);
      expect(alias.sectionLabel.length, `${name} sectionLabel`).toBeGreaterThan(0);
      expect(alias.label.length, `${name} label`).toBeGreaterThan(0);
      expect(alias.description.length, `${name} description`).toBeGreaterThan(0);
    }
  });

  it('BLOCK_SYNONYMS is the exact inverse of BLOCK_ALIASES', () => {
    const flattened = Object.entries(BLOCK_SYNONYMS).flatMap(([type, names]) =>
      (names ?? []).map((n) => [n, type] as const),
    );
    expect(flattened).toHaveLength(12);
    for (const [name, type] of flattened) {
      expect(BLOCK_ALIASES[name]?.type).toBe(type);
    }
    expect(BLOCK_SYNONYMS.chart).toEqual(expect.arrayContaining(['waterfall', 'funnel']));
    expect(BLOCK_SYNONYMS.block).toEqual(
      expect.arrayContaining(['infra', 'event', 'ddd', 'network']),
    );
  });
});

describe('alias parsing', () => {
  it('every alias fence parses to its canonical kind with sourceType + patch applied', () => {
    for (const [name, alias] of Object.entries(BLOCK_ALIASES)) {
      const body = ALIAS_BODIES[name];
      expect(body, `missing test body for ${name}`).toBeDefined();
      const doc = parseDocument(`\`\`\`${name}\n${body}\n\`\`\`\n`, name);
      const seg = doc.segments[0];
      if (seg === undefined || seg.kind === 'markdown') throw new Error(`${name}: no block`);
      expect(seg.kind, name).toBe(alias.type);
      expect(seg.sourceType, name).toBe(name);
      const data = seg.data as Record<string, unknown>;
      for (const [k, v] of Object.entries(alias.patch ?? {})) {
        expect(data[k], `${name} patch ${k}`).toBe(v);
      }
    }
  });

  it('body wins over the alias patch (aliased waterfall keeps an explicit kind: funnel)', () => {
    const doc = parseDocument(
      '```waterfall\nkind: funnel\nitems:\n  - { label: A, value: 1 }\n```\n',
      'w',
    );
    const seg = doc.segments[0];
    if (seg?.kind !== 'chart') throw new Error('expected a chart segment');
    expect((seg.data as { kind?: unknown }).kind).toBe('funnel');
  });

  it('a canonical fence has no sourceType and no W_ALIAS_TYPE', () => {
    const doc = parseDocument('```chart\nkind: bar\nlabels: [a]\n```\n', 'c');
    const seg = doc.segments[0];
    if (seg?.kind !== 'chart') throw new Error('expected a chart segment');
    expect(seg.sourceType).toBeUndefined();
    expect(validateDocument(doc, 'c.md')).toEqual([]);
  });
});

describe('W_ALIAS_TYPE', () => {
  it('every alias fence yields exactly one W_ALIAS_TYPE warning and zero errors', () => {
    for (const [name, alias] of Object.entries(BLOCK_ALIASES)) {
      const md = `\`\`\`${name}\n${ALIAS_BODIES[name]}\n\`\`\`\n`;
      const diags = validateDocument(parseDocument(md, name), `${name}.md`);
      // Warnings only — exit-code semantics unchanged; `avo check` stays green.
      expect(diags.filter((d) => d.level === 'error'), name).toEqual([]);
      const warns = diags.filter((d) => d.code === 'W_ALIAS_TYPE');
      expect(warns, name).toHaveLength(1);
      expect(warns[0]).toMatchObject({
        level: 'warn',
        line: 1,
        value: name,
        suggestions: [alias.type],
      });
      expect(warns[0]?.message).toContain(`\`${name}\` now lives in \`${alias.type}\``);
      expect(warns[0]?.message).toContain('both spellings work; no change needed');
    }
  });

  it('mentions the injected patch in the message', () => {
    const md = `\`\`\`waterfall\n${ALIAS_BODIES.waterfall}\n\`\`\`\n`;
    const diags = validateDocument(parseDocument(md, 'w'), 'w.md');
    const warn = diags.find((d) => d.code === 'W_ALIAS_TYPE');
    expect(warn?.message).toContain('(kind: waterfall)');
  });
});

describe('alias fences and suspect detection', () => {
  it('an alias fence is a known tag — never suspect', () => {
    const doc = parseDocument(`\`\`\`waterfall\n${ALIAS_BODIES.waterfall}\n\`\`\`\n`, 'w');
    expect(doc.suspectFences).toBeUndefined();
  });

  it('a typo of an alias suggests the alias spelling', () => {
    const doc = parseDocument('```infr\nnodes: []\n```\n', 't');
    expect(doc.suspectFences?.[0]).toMatchObject({ tag: 'infr', suggestion: 'infra' });
  });
});
