import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES } from '../types.js';
import {
  BLOCK_TEMPLATES,
  BLOCK_DESCRIPTIONS,
  BLOCK_FAMILY,
  BLOCK_FAMILIES,
  BLOCK_LABELS,
  familyBlocks,
  isBlockFamily,
  templateBody,
} from '../blocks/catalog.js';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';

describe('BLOCK_TEMPLATES', () => {
  it('every template is a single fenced block of its own type that validates clean', () => {
    for (const type of BLOCK_TYPES) {
      const template = BLOCK_TEMPLATES[type];
      expect(template.startsWith('```' + type + '\n'), `${type} opening fence`).toBe(true);
      expect(template.endsWith('\n```\n'), `${type} closing fence`).toBe(true);
      const doc = parseDocument(template, type);
      expect(doc.segments).toHaveLength(1);
      expect(doc.segments[0]?.kind).toBe(type);
      expect(validateDocument(doc, `${type}.md`)).toEqual([]);
    }
  });
});

describe('templateBody', () => {
  it("returns exactly the block's raw body (fences stripped, no trailing newline)", () => {
    for (const type of BLOCK_TYPES) {
      const doc = parseDocument(BLOCK_TEMPLATES[type], type);
      const seg = doc.segments[0];
      if (seg === undefined || seg.kind === 'markdown') throw new Error('template must be a block');
      expect(templateBody(type), type).toBe(seg.raw);
    }
  });
});

describe('block families', () => {
  it('BLOCK_FAMILIES and BLOCK_FAMILY agree and cover every type', () => {
    const ids = BLOCK_FAMILIES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const type of BLOCK_TYPES) {
      expect(ids, `family of ${type}`).toContain(BLOCK_FAMILY[type]);
      expect(BLOCK_DESCRIPTIONS[type].length).toBeGreaterThan(0);
    }
    // Every type appears in exactly one family listing.
    const all = BLOCK_FAMILIES.flatMap((f) => familyBlocks(f.id));
    expect(all.sort()).toEqual([...BLOCK_TYPES].sort());
  });

  it('isBlockFamily guards family ids', () => {
    expect(isBlockFamily('architecture')).toBe(true);
    expect(isBlockFamily('nope')).toBe(false);
  });
});

describe('BLOCK_LABELS', () => {
  it('covers every type with a non-empty human name', () => {
    for (const type of BLOCK_TYPES) {
      const label = BLOCK_LABELS[type];
      expect(typeof label, type).toBe('string');
      expect(label.trim().length, type).toBeGreaterThan(0);
      // Human names start with an uppercase letter or an acronym/symbol, never lowercase.
      expect(/^[a-z]/.test(label), `${type} label "${label}" starts lowercase`).toBe(false);
    }
    expect(Object.keys(BLOCK_LABELS).sort()).toEqual([...BLOCK_TYPES].sort());
  });
});
