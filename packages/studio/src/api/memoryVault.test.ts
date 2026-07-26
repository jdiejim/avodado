import { beforeEach, describe, expect, it } from 'vitest';
import { hashSource } from './backend.js';
import { memoryVault, resetVault } from './memoryVault.js';

describe('memoryVault', () => {
  beforeEach(() => {
    resetVault();
  });

  it('has no server behind it', () => {
    expect(memoryVault.hasServer).toBe(false);
    expect(memoryVault.kind).toBe('vault');
  });

  it('seeds a welcome document so a first visit has something to edit', async () => {
    const docs = await memoryVault.fetchDocs();
    expect(docs).toHaveLength(1);
    expect(docs[0]?.title).toBe('Welcome to Avodado');
  });

  // Boot calls fetchMeta and fetchDocs concurrently — seeding once must not
  // let the loser of that race see an empty vault.
  it('seeds exactly once when meta and docs are fetched together', async () => {
    const [, docs] = await Promise.all([memoryVault.fetchMeta(), memoryVault.fetchDocs()]);
    expect(docs).toHaveLength(1);
    expect(await memoryVault.fetchDocs()).toHaveLength(1);
  });

  it('round-trips a saved document', async () => {
    const res = await memoryVault.saveDoc('notes', '# hi\n');
    expect(res.ok).toBe(true);
    const doc = await memoryVault.fetchDoc('notes');
    expect(doc.source).toBe('# hi\n');
    expect(doc.hash).toBe(await hashSource('# hi\n'));
  });

  it('normalises CRLF the way the file bridge does', async () => {
    await memoryVault.saveDoc('crlf', 'a\r\nb\r\n');
    const doc = await memoryVault.fetchDoc('crlf');
    expect(doc.source).toBe('a\nb\n');
  });

  it('titles a document from its meta, falling back to the slug', async () => {
    await memoryVault.saveDoc('titled', '```meta\ntitle: Rollout plan\n```\n');
    await memoryVault.saveDoc('bare', 'no meta block here\n');
    const docs = await memoryVault.fetchDocs();
    expect(docs.find((d) => d.slug === 'titled')?.title).toBe('Rollout plan');
    expect(docs.find((d) => d.slug === 'bare')?.title).toBe('bare');
  });

  it('rejects a save whose base hash is stale, and reports the current source', async () => {
    const first = await memoryVault.saveDoc('race', 'one\n');
    if (!first.ok) throw new Error('setup failed');
    await memoryVault.saveDoc('race', 'two\n', first.hash);

    const late = await memoryVault.saveDoc('race', 'three\n', first.hash);
    expect(late.ok).toBe(false);
    if (late.ok) throw new Error('expected a conflict');
    expect(late.conflict.currentSource).toBe('two\n');
  });

  it('lets a forced save overwrite a stale base', async () => {
    const first = await memoryVault.saveDoc('force', 'one\n');
    if (!first.ok) throw new Error('setup failed');
    await memoryVault.saveDoc('force', 'two\n', first.hash);

    expect((await memoryVault.saveDoc('force', 'three\n', first.hash, true)).ok).toBe(true);
    expect((await memoryVault.fetchDoc('force')).source).toBe('three\n');
  });

  it('throws for a document this session never had', async () => {
    await expect(memoryVault.fetchDoc('gone')).rejects.toThrow(/gone/);
  });

  it('reports a saved theme back through meta', async () => {
    await memoryVault.saveTheme({
      name: 'House Style',
      base: 'slate',
      colors: { '--avo-accent': '#0f766e' },
      fonts: {},
      scope: 'project',
    });
    const meta = await memoryVault.fetchMeta();
    expect(meta.theme).toBe('slate');
    expect(meta.savedThemes?.[0]).toMatchObject({ slug: 'house-style', name: 'House Style' });
    expect(meta.themeVars).toEqual({ '--avo-accent': '#0f766e' });
  });

  it('says where documents live, so the UI can be honest about it', async () => {
    expect((await memoryVault.fetchMeta()).docsDir).toBe('This browser tab');
  });
});
