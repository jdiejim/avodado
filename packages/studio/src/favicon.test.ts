import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FAVICON_DATA_URI } from '@avodado/render';

describe('favicon', () => {
  it('index.html carries the exact brand favicon from @avodado/render', () => {
    const html = readFileSync(resolve(import.meta.dirname, '../index.html'), 'utf8');
    expect(html).toContain(`href="${FAVICON_DATA_URI}"`);
  });
});
