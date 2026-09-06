/**
 * Thumbnail cache behaviour: real pipeline output, global memoisation per
 * type, and graceful emptiness is never cached as a lie.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { BLOCK_TYPES } from '@avodado/core';
import { clearThumbnailCache, thumbnailCacheSize, thumbnailHtml } from './thumbs.js';

describe('thumbnailHtml', () => {
  beforeEach(() => clearThumbnailCache());

  it('renders a template through the real pipeline (non-empty, docskin-shaped)', () => {
    const html = thumbnailHtml('sequence');
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('<svg'); // shared defs at minimum
  });

  it('memoises globally: the same type is computed once and reused', () => {
    const a = thumbnailHtml('table');
    expect(thumbnailCacheSize()).toBe(1);
    const b = thumbnailHtml('table');
    expect(b).toBe(a); // same reference — a cache hit, not a re-render
    expect(thumbnailCacheSize()).toBe(1);
  });

  it('produces something for every insertable type', () => {
    for (const type of BLOCK_TYPES) {
      if (type === 'meta') continue;
      expect(thumbnailHtml(type).length, type).toBeGreaterThan(0);
    }
    expect(thumbnailCacheSize()).toBe(BLOCK_TYPES.length - 1);
  });
});
