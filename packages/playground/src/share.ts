/**
 * URL-hash sharing: gzip-compress the markdown, base64url-encode, stash in
 * `#md=…`. Decode on load. Uses the browser-native CompressionStream API
 * (Safari 16.4+, Chrome 80+, Firefox 113+) so we don't pull a gzip lib.
 */

const HASH_KEY = 'md=';

async function gzip(input: string): Promise<Uint8Array> {
  const stream = new Blob([input]).stream().pipeThrough(new CompressionStream('gzip'));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

async function gunzip(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Encodes markdown to a hash fragment (`#md=…`). */
export async function encodeShare(md: string): Promise<string> {
  const gz = await gzip(md);
  return HASH_KEY + toBase64Url(gz);
}

/**
 * Reads markdown from the current URL hash, if any. Returns `null` when the
 * hash is absent or unreadable.
 */
export async function decodeShare(hash: string): Promise<string | null> {
  const idx = hash.indexOf(HASH_KEY);
  if (idx === -1) return null;
  const slice = hash.slice(idx + HASH_KEY.length);
  if (slice.length === 0) return null;
  try {
    return await gunzip(fromBase64Url(slice));
  } catch {
    return null;
  }
}
