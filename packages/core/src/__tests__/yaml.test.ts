import { describe, expect, it } from 'vitest';
import { parseBlockBody } from '../yaml.js';

describe('parseBlockBody', () => {
  it('parses YAML block bodies', () => {
    const r = parseBlockBody('kind: note\nbody: hi');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ kind: 'note', body: 'hi' });
  });

  it('parses JSON block bodies (YAML is a JSON superset)', () => {
    const r = parseBlockBody('{"kind": "note", "body": "hi"}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ kind: 'note', body: 'hi' });
  });

  it('YAML and JSON produce the same model for an equivalent callout', () => {
    const yaml = parseBlockBody('kind: tip\ntitle: t\nbody: b');
    const json = parseBlockBody('{"kind":"tip","title":"t","body":"b"}');
    expect(yaml.ok && json.ok).toBe(true);
    if (yaml.ok && json.ok) expect(yaml.data).toEqual(json.data);
  });

  it('returns ok with null for an empty body', () => {
    const r = parseBlockBody('');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toBeNull();
  });

  it('returns a structured failure on malformed YAML', () => {
    const r = parseBlockBody('a: [unterminated');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message.length).toBeGreaterThan(0);
  });
});
