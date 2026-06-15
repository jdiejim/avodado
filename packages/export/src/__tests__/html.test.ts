import { describe, expect, it } from 'vitest';
import { parseDocument } from '@avodado/core';
import { renderDocument } from '@avodado/render';
import { toHtml } from '../html.js';
import { roadmap } from './fixtures.js';

describe('toHtml', () => {
  it('delegates to @avodado/render — byte-equal output', () => {
    const doc = parseDocument(roadmap(), 'avodado-roadmap');
    expect(toHtml(doc)).toBe(renderDocument(doc));
  });
});
