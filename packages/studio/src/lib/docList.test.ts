import { describe, expect, it } from 'vitest';
import { docFolder, editedAgo, groupDocs, topFolder } from './docList.js';
import type { DocListItem } from '../api/client.js';

const doc = (slug: string, title = slug, mtimeMs = 0): DocListItem => ({
  slug,
  file: `${slug}.md`,
  title,
  mtimeMs,
});

describe('topFolder', () => {
  it('is empty for a root slug', () => {
    expect(topFolder('showcase')).toBe('');
  });

  it('is the first segment for nested slugs', () => {
    expect(topFolder('guides/tutorial')).toBe('guides');
    expect(topFolder('guides/deep/nested')).toBe('guides');
  });
});

describe('docFolder', () => {
  it('shows docsDir for root docs', () => {
    expect(docFolder('showcase', 'docs')).toBe('docs');
  });

  it('shows the full dirname under docsDir', () => {
    expect(docFolder('guides/tutorial', 'docs')).toBe('docs/guides');
    expect(docFolder('guides/deep/nested', 'docs')).toBe('docs/guides/deep');
  });
});

describe('groupDocs', () => {
  it('groups by top-level folder, root docs first, folders alphabetical', () => {
    const groups = groupDocs(
      [
        doc('z-root', 'Zeta'),
        doc('guides/tutorial', 'Tutorial'),
        doc('api/orders', 'Orders'),
        doc('a-root', 'Alpha'),
        doc('guides/deep/nested', 'Nested'),
      ],
      'docs',
    );
    expect(groups.map((g) => g.label)).toEqual(['docs', 'docs / api', 'docs / guides']);
    expect(groups[0]?.docs.map((d) => d.slug)).toEqual(['a-root', 'z-root']);
    // Deeper nesting rolls up into its top-level folder.
    expect(groups[2]?.docs.map((d) => d.slug)).toEqual(['guides/deep/nested', 'guides/tutorial']);
  });

  it('sorts docs inside a group by title', () => {
    const groups = groupDocs(
      [doc('b', 'Bravo'), doc('a', 'Zulu'), doc('c', 'Alpha')],
      'docs',
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.docs.map((d) => d.title)).toEqual(['Alpha', 'Bravo', 'Zulu']);
  });

  it('returns no groups for no docs', () => {
    expect(groupDocs([], 'docs')).toEqual([]);
  });
});

describe('editedAgo', () => {
  const now = 1_000_000_000_000;
  it('buckets minutes, hours, days', () => {
    expect(editedAgo(now - 30_000, now)).toBe('just now');
    expect(editedAgo(now - 5 * 60_000, now)).toBe('5m ago');
    expect(editedAgo(now - 3 * 3_600_000, now)).toBe('3h ago');
    expect(editedAgo(now - 2 * 86_400_000, now)).toBe('2d ago');
  });

  it('falls back to a date after ~a month', () => {
    expect(editedAgo(now - 40 * 86_400_000, now)).toMatch(/\d/);
  });
});
