import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchDoc, saveDoc } from './fileBridge.js';

function mockFetch(status: number, body: unknown): ReturnType<typeof vi.fn> {
  const fn = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('fetchDoc', () => {
  it('returns source + hash and URL-encodes the slug', async () => {
    const fn = mockFetch(200, { source: '# hi\n', hash: 'h1', mtimeMs: 1 });
    const doc = await fetchDoc('guides/a b');
    expect(doc.hash).toBe('h1');
    expect(fn).toHaveBeenCalledWith('/api/doc/guides%2Fa%20b');
  });

  it('throws on HTTP errors', async () => {
    mockFetch(500, {});
    await expect(fetchDoc('x')).rejects.toThrow('HTTP 500');
  });
});

describe('saveDoc', () => {
  it('sends baseHash and returns the new hash on 200', async () => {
    const fn = mockFetch(200, { hash: 'h2', mtimeMs: 2 });
    const res = await saveDoc('guide', 'src', 'h1');
    expect(res).toEqual({ ok: true, hash: 'h2', mtimeMs: 2 });
    const [url, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/doc/guide');
    expect(JSON.parse(String(init.body))).toEqual({ source: 'src', baseHash: 'h1' });
  });

  it('omits baseHash entirely when creating', async () => {
    const fn = mockFetch(200, { hash: 'h1', mtimeMs: 1 });
    await saveDoc('new-doc', 'src');
    const [, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ source: 'src' });
  });

  it('returns the conflict payload on 409 without throwing', async () => {
    mockFetch(409, { currentHash: 'hX', currentSource: 'theirs' });
    const res = await saveDoc('guide', 'src', 'stale');
    expect(res).toEqual({ ok: false, conflict: { currentHash: 'hX', currentSource: 'theirs' } });
  });

  it('appends ?force=1 when forcing', async () => {
    const fn = mockFetch(200, { hash: 'h3', mtimeMs: 3 });
    await saveDoc('guide', 'src', 'stale', true);
    const [url] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/doc/guide?force=1');
  });
});
