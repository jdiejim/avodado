/**
 * The exported node-kind lists must stay in sync with the skin they
 * document: every listed kind gets an eyebrow chip, and the lists are
 * duplicate-free (they feed editor dropdowns verbatim).
 */

import { describe, expect, it } from 'vitest';
import { KNOWN_LOGIC_KINDS, KNOWN_NODE_KINDS } from '../index.js';
import { nodeSkin } from '../svg/blockStyle.js';

describe('KNOWN_NODE_KINDS', () => {
  it('every listed kind has a skin chip (the eyebrow the skin names it by)', () => {
    for (const kind of KNOWN_NODE_KINDS) {
      expect(nodeSkin(kind).chip, kind).not.toBe('');
    }
    expect(nodeSkin(undefined).chip).toBe('');
    expect(nodeSkin('external').dashed).toBe(true);
    expect(nodeSkin('db').fill).toBe('paper-2');
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
