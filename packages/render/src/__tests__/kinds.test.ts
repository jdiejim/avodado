/**
 * The exported node-kind lists must stay in sync with the style switches they
 * document: every listed kind gets non-default styling, and the lists are
 * duplicate-free (they feed editor dropdowns verbatim).
 */

import { describe, expect, it } from 'vitest';
import { KNOWN_LOGIC_KINDS, KNOWN_NODE_KINDS } from '../index.js';
import { blockStyle } from '../svg/blockStyle.js';

const DEFAULT_FILL = blockStyle('definitely-not-a-kind').fill;

describe('KNOWN_NODE_KINDS', () => {
  it('every listed kind is styled by blockStyle (not the default)', () => {
    for (const kind of KNOWN_NODE_KINDS) {
      expect(blockStyle(kind).fill, kind).not.toBe(DEFAULT_FILL);
    }
  });

  it('includes the house anchors and has no duplicates', () => {
    expect(KNOWN_NODE_KINDS).toContain('client');
    expect(KNOWN_NODE_KINDS).toContain('service');
    expect(KNOWN_NODE_KINDS).toContain('queue');
    expect(new Set(KNOWN_NODE_KINDS).size).toBe(KNOWN_NODE_KINDS.length);
  });
});

describe('KNOWN_LOGIC_KINDS', () => {
  it('covers the felogic vocabulary without duplicates', () => {
    expect(KNOWN_LOGIC_KINDS).toContain('component');
    expect(KNOWN_LOGIC_KINDS).toContain('repository');
    expect(KNOWN_LOGIC_KINDS).toContain('interface');
    expect(new Set(KNOWN_LOGIC_KINDS).size).toBe(KNOWN_LOGIC_KINDS.length);
  });
});
