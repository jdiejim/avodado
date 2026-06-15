import { describe, expect, it } from 'vitest';
import { levenshtein, closest } from '../suggest.js';

describe('levenshtein', () => {
  it('is 0 for identical strings', () => {
    expect(levenshtein('abc', 'abc')).toBe(0);
  });
  it('handles empty strings', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });
  it('counts single edits', () => {
    expect(levenshtein('kitten', 'sitten')).toBe(1); // substitute
    expect(levenshtein('sittin', 'sitting')).toBe(1); // insert
    expect(levenshtein('sequnce', 'sequence')).toBe(1); // insert
  });
  it('counts multiple edits', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });
});

describe('closest', () => {
  const blocks = ['sequence', 'state', 'erd', 'table', 'tracker'];

  it('returns the nearest candidate within distance', () => {
    expect(closest('sequnce', blocks)).toEqual(['sequence']);
    expect(closest('tabel', blocks)).toEqual(['table']);
  });

  it('is case-insensitive', () => {
    expect(closest('Sequence', blocks)).toEqual(['sequence']);
  });

  it('returns nothing when nothing is close enough', () => {
    expect(closest('zzzzzzz', blocks)).toEqual([]);
  });

  it('orders by distance then alphabetically', () => {
    // both 'state' and 'table' are distance 2-ish from 'tate'
    const out = closest('tate', ['state', 'table', 'tracker'], 2);
    expect(out[0]).toBe('state');
  });

  it('caps at 3 results', () => {
    expect(closest('aaa', ['aab', 'aac', 'aad', 'aae'], 2).length).toBeLessThanOrEqual(3);
  });
});
