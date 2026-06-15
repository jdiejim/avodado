import { describe, expect, it } from 'vitest';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { BLOCK_TYPES, parseDocument, validateDocument } from '@avodado/core';
import { templateFor, writeNewDoc } from '../commands/new.js';

describe('templateFor', () => {
  it('every block type template parses + validates clean', () => {
    for (const type of BLOCK_TYPES) {
      const md = templateFor(type);
      const doc = parseDocument(md, 'tmpl');
      const diags = validateDocument(doc, `tmpl/${type}.md`);
      expect(diags, `template for ${type} should validate`).toEqual([]);
    }
  });
});

describe('writeNewDoc', () => {
  it('writes a doc to the given path', async () => {
    const root = join(tmpdir(), `avo-new-${randomBytes(6).toString('hex')}`);
    await mkdir(root, { recursive: true });
    try {
      const path = await writeNewDoc({ cwd: root, type: 'callout', out: 'docs/x.md' });
      const content = await readFile(path, 'utf8');
      expect(content).toContain('```callout');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
