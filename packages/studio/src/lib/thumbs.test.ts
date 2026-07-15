/**
 * Thumbnail cache behaviour: real pipeline output, global memoisation per
 * (theme, type), and graceful emptiness is never cached as a lie.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { BLOCK_TYPES } from '@avodado/core';
import { clearThumbnailCache, thumbnailCacheSize, thumbnailHtml } from './thumbs.js';

describe('thumbnailHtml', () => {
  beforeEach(() => clearThumbnailCache());

  it('renders a template through the real pipeline (non-empty, docskin-shaped)', () => {
    const html = thumbnailHtml('sequence', 'textbook');
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('<svg'); // shared defs at minimum
  });

  it('memoises globally: same (theme, type) is computed once and reused', () => {
    const a = thumbnailHtml('table', 'textbook');
    expect(thumbnailCacheSize()).toBe(1);
    const b = thumbnailHtml('table', 'textbook');
    expect(b).toBe(a); // same reference — a cache hit, not a re-render
    expect(thumbnailCacheSize()).toBe(1);
  });

  it('keys the memo by theme too', () => {
    thumbnailHtml('table', 'textbook');
    thumbnailHtml('table', 'dark');
    expect(thumbnailCacheSize()).toBe(2);
  });

  it('produces something for every insertable type', () => {
    for (const type of BLOCK_TYPES) {
      if (type === 'meta') continue;
      expect(thumbnailHtml(type, 'textbook').length, type).toBeGreaterThan(0);
    }
    expect(thumbnailCacheSize()).toBe(BLOCK_TYPES.length - 1);
  });
});
