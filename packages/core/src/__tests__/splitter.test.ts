import { describe, expect, it } from 'vitest';
import { splitMarkdown } from '../splitter.js';

describe('splitMarkdown', () => {
  it('returns a single prose segment for plain Markdown', () => {
    const segs = splitMarkdown('# Title\n\nSome prose.\n');
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ kind: 'markdown', line: 1 });
  });

  it('splits prose and a typed callout block', () => {
    const md = '## Intro\n\nA paragraph.\n\n```callout\nkind: note\nbody: hi\n```\n\nMore prose.\n';
    const segs = splitMarkdown(md);
    expect(segs).toHaveLength(3);
    expect(segs[0]).toMatchObject({ kind: 'markdown' });
    expect(segs[1]).toMatchObject({ kind: 'callout', line: 5, raw: 'kind: note\nbody: hi' });
    expect(segs[2]).toMatchObject({ kind: 'markdown' });
  });

  it('captures 1-based line numbers for blocks', () => {
    const md = '```meta\ntitle: Hi\n```\n';
    const segs = splitMarkdown(md);
    expect(segs[0]).toMatchObject({ kind: 'meta', line: 1 });
  });

  it('falls through unknown fence tags to prose (e.g. ```ts)', () => {
    const md = 'Some prose.\n\n```ts\nconst x = 1;\n```\n';
    const segs = splitMarkdown(md);
    expect(segs).toHaveLength(1);
    expect(segs[0]?.kind).toBe('markdown');
    if (segs[0]?.kind === 'markdown') {
      expect(segs[0].text).toContain('```ts');
      expect(segs[0].text).toContain('const x = 1;');
    }
  });

  it('normalises CRLF and CR line endings', () => {
    const crlf = '```callout\r\nkind: tip\r\n```\r\n';
    const segs = splitMarkdown(crlf);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ kind: 'callout', raw: 'kind: tip', line: 1 });
  });

  it('handles all nine block types as openers', () => {
    const md = [
      '```meta\ntitle: a\n```',
      '```callout\nbody: b\n```',
      '```table\ncolumns: [a]\n```',
      '```sequence\nactors: [a]\n```',
      '```erd\nentities: []\n```',
      '```userstory\nrole: r\n```',
      '```timeline\nitems: []\n```',
      '```kanban\nnow: []\n```',
      '```tracker\nitems: []\n```',
    ].join('\n\n');
    const segs = splitMarkdown(md);
    expect(segs.map((s) => s.kind)).toEqual([
      'meta',
      'callout',
      'table',
      'sequence',
      'erd',
      'userstory',
      'timeline',
      'kanban',
      'tracker',
    ]);
  });

  it('treats an unclosed block as extending to EOF', () => {
    const md = '```callout\nkind: note\nbody: this never closes\n';
    const segs = splitMarkdown(md);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ kind: 'callout' });
    if (segs[0]?.kind === 'callout') {
      expect(segs[0].raw).toContain('this never closes');
    }
  });
});
