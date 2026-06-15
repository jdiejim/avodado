import { describe, expect, it } from 'vitest';
import { locateYamlPath } from '../yaml.js';

describe('locateYamlPath', () => {
  it('locates a nested scalar inside a flow mapping', () => {
    const raw = 'messages:\n  - { from: A, kind: bogus }';
    const loc = locateYamlPath(raw, ['messages', 0, 'kind']);
    expect(loc).toBeDefined();
    expect(loc?.line).toBe(2);
    // `bogus` begins after "  - { from: A, kind: "
    expect(loc?.column).toBe(22);
    expect(loc?.endColumn).toBe(27);
  });

  it('locates a top-level scalar', () => {
    const raw = 'tone: oops';
    const loc = locateYamlPath(raw, ['tone']);
    expect(loc).toMatchObject({ line: 1, column: 7 });
  });

  it('locates a block-style nested value', () => {
    const raw = 'items:\n  - label: a\n    status: bad';
    const loc = locateYamlPath(raw, ['items', 0, 'status']);
    expect(loc?.line).toBe(3);
  });

  it('returns the containing node when the path is a mapping', () => {
    const raw = 'messages:\n  - { from: A }';
    const loc = locateYamlPath(raw, ['messages', 0]);
    expect(loc?.line).toBe(2);
  });

  it('returns undefined for an unresolvable path', () => {
    expect(locateYamlPath('a: 1', ['nope', 'deep'])).toBeUndefined();
  });

  it('never throws on a malformed body (best-effort, may return undefined)', () => {
    // Robustness contract: validate() falls back to the fence line if this
    // returns undefined, so it must degrade gracefully rather than throw.
    expect(() => locateYamlPath('a: [unclosed', ['a'])).not.toThrow();
    expect(() => locateYamlPath(': : :', ['x'])).not.toThrow();
  });
});
