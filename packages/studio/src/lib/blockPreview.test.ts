/**
 * Edit-Sheet support: one-block preview rendering and best-effort mapping of
 * diagnostics onto top-level YAML fields.
 */

import { describe, expect, it } from 'vitest';
import { buildBlockSource, mapDiagnosticsToFields, previewBlock } from './blockPreview.js';

describe('buildBlockSource', () => {
  it('wraps a raw body in fences', () => {
    expect(buildBlockSource('callout', 'tone: note')).toBe('```callout\ntone: note\n```\n');
    expect(buildBlockSource('callout', '')).toBe('```callout\n```\n');
  });
});

describe('previewBlock', () => {
  it('renders a valid draft to HTML with no diagnostics', () => {
    const p = previewBlock('callout', 'tone: note\ntitle: Hi\nbody: There.', 'textbook');
    expect(p.seg?.kind).toBe('callout');
    expect(p.seg?.parseError).toBeUndefined();
    expect(p.html).toContain('Hi');
    expect(p.diagnostics).toEqual([]);
  });

  it('surfaces a YAML parse error as a segment parseError + diagnostic', () => {
    const p = previewBlock('callout', 'tone: [unclosed', 'textbook');
    expect(p.seg?.parseError).toBeDefined();
    expect(p.diagnostics.some((d) => d.code === 'E_PARSE_YAML')).toBe(true);
  });

  it('surfaces schema violations as diagnostics without crashing the render', () => {
    const p = previewBlock('callout', 'tone: shouty\ntitle: Hi', 'textbook');
    expect(p.diagnostics.length).toBeGreaterThan(0);
  });

  it('renders the meta block as the cover', () => {
    const p = previewBlock('meta', 'title: My doc\nsubtitle: Sub.', 'textbook');
    expect(p.html).toContain('My doc');
    expect(p.html).toContain('cover-title');
  });
});

describe('mapDiagnosticsToFields', () => {
  const raw = 'tone: shouty\ntitle: Hi\nbody: There.';

  it('attributes a diagnostic to the top-level key owning its line', () => {
    // Body line 1 (`tone:`) is doc line 2 of the one-block source.
    const { byField, rest } = mapDiagnosticsToFields(raw, [
      { file: 'f', line: 2, level: 'error', code: 'E_SCHEMA', message: 'bad tone' },
    ]);
    expect(byField.get('tone')?.[0]?.message).toBe('bad tone');
    expect(rest).toEqual([]);
  });

  it('multi-line values stay with their key', () => {
    const multi = 'items:\n  - a\n  - b\ntitle: X';
    const { byField } = mapDiagnosticsToFields(multi, [
      { file: 'f', line: 3, level: 'warn', code: 'E_SCHEMA', message: 'bad item' },
    ]);
    expect(byField.get('items')?.length).toBe(1);
  });

  it('line-less or fence-line diagnostics fall to the rest strip', () => {
    const { byField, rest } = mapDiagnosticsToFields(raw, [
      { file: 'f', level: 'error', code: 'E_SCHEMA', message: 'no line' },
      { file: 'f', line: 1, level: 'error', code: 'E_SCHEMA', message: 'fence line' },
    ]);
    expect(byField.size).toBe(0);
    expect(rest.length).toBe(2);
  });
});
