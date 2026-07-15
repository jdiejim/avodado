import { describe, expect, it } from 'vitest';
import { IMPORTERS, importerForFile } from '../index.js';

describe('importer registry', () => {
  it('lists csv as a block importer and openapi as a document importer', () => {
    const csv = IMPORTERS.find((i) => i.id === 'csv');
    const openapi = IMPORTERS.find((i) => i.id === 'openapi');
    expect(csv?.kind).toBe('block');
    expect(csv?.extensions).toEqual(['.csv']);
    expect(openapi?.kind).toBe('document');
    expect(openapi?.extensions).toEqual(['.yaml', '.yml', '.json']);
  });

  it('importerForFile routes by extension, case-insensitively', () => {
    expect(importerForFile('data.csv')?.id).toBe('csv');
    expect(importerForFile('DATA.CSV')?.id).toBe('csv');
    expect(importerForFile('spec.yaml')?.id).toBe('openapi');
    expect(importerForFile('spec.YML')?.id).toBe('openapi');
    expect(importerForFile('spec.json')?.id).toBe('openapi');
  });

  it('returns null for unclaimed or missing extensions', () => {
    expect(importerForFile('notes.md')).toBeNull();
    expect(importerForFile('archive.tar.gz')).toBeNull();
    expect(importerForFile('Makefile')).toBeNull();
  });
});
