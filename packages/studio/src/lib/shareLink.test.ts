import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildShareUrl, decodeShare, encodeShare, readShareUrl, SHARE_LIMIT } from './shareLink.js';

/**
 * The real showcase — the biggest document the project ships. Read by path
 * rather than by package: studio depends inward on core/render only, and this
 * test has no business adding the CLI to that graph.
 */
function showcase(): string {
  return readFileSync(
    join(import.meta.dirname, '../../../cli/templates/demo.md'),
    'utf8',
  );
}

const DOC = [
  '```meta',
  'title: Checkout',
  '```',
  '',
  '## p95 is three systems',
  '',
  '```sequence',
  'messages:',
  '  - client -> api: POST /orders',
  '```',
].join('\n');

describe('share links', () => {
  it('round-trips a document', async () => {
    expect(await decodeShare(await encodeShare(DOC))).toBe(DOC);
  });

  it('round-trips the whole showcase, and compresses it hard', async () => {
    const source = showcase();
    const payload = await encodeShare(source);
    expect(await decodeShare(payload)).toBe(source);
    // The showcase is every block type at once — far larger than a real doc.
    // Even so the payload should be a fraction of the source.
    expect(payload.length).toBeLessThan(source.length / 2);
  });

  it('keeps a normal document well inside the URL limit', async () => {
    expect((await encodeShare(DOC)).length).toBeLessThan(SHARE_LIMIT);
  });

  it('normalises CRLF, so Windows and macOS produce the same link', async () => {
    expect(await encodeShare('a\r\nb\r\n')).toBe(await encodeShare('a\nb\n'));
  });

  it('survives non-ASCII intact', async () => {
    const text = '# Ünïcode — 中文 · emoji 🥑\n';
    expect(await decodeShare(await encodeShare(text))).toBe(text);
  });

  it('builds and reads a link, carrying the present flag', async () => {
    const url = await buildShareUrl('https://studio.avodado.dev/', DOC, { present: true });
    const read = await readShareUrl(url);
    expect(read?.source).toBe(DOC);
    expect(read?.present).toBe(true);
  });

  it('defaults to the editor, not the deck', async () => {
    const url = await buildShareUrl('https://studio.avodado.dev/', DOC);
    expect((await readShareUrl(url))?.present).toBe(false);
  });

  it('keeps the payload in the fragment, which never reaches a server', async () => {
    const url = new URL(await buildShareUrl('https://studio.avodado.dev/', DOC));
    expect(url.hash.startsWith('#d=')).toBe(true);
    expect(url.search).toBe('');
  });

  it('reads a plain studio URL as "no shared document"', async () => {
    expect(await readShareUrl('https://studio.avodado.dev/')).toBeNull();
    expect(await readShareUrl('https://studio.avodado.dev/#')).toBeNull();
  });

  it('rejects a corrupt payload rather than opening an empty document', async () => {
    await expect(readShareUrl('https://studio.avodado.dev/#d=not-a-real-payload')).rejects.toThrow();
  });
});
