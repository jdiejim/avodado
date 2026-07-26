/**
 * Share links — a whole document, inside a URL.
 *
 * The hosted studio has no server to store anything on, so a share link
 * carries its own payload: the source, deflated and base64url'd into the URL
 * fragment. That has three properties worth the trouble — there is nothing to
 * host, nothing to expire, and the fragment never reaches a server, so sharing
 * a document with a colleague doesn't upload it to us.
 *
 * The same codec is what a CI preview comment would use, which is why it lives
 * on its own with no studio imports: `CompressionStream` is available in
 * browsers and in Node 18+, so the CLI and a GitHub Action can build the exact
 * links the studio reads.
 *
 * Practical size: a typical document deflates to 1–3 KB of base64, well inside
 * every browser's URL limit. {@link SHARE_LIMIT} is the point past which a link
 * stops being safe to paste into chat clients that truncate.
 */

/** Beyond this many characters of payload, warn rather than silently produce a link that may be cut. */
export const SHARE_LIMIT = 8000;

/** The fragment key carrying the document. */
const KEY = 'd';

/**
 * Runs bytes through a compression stream.
 *
 * Typed against `CompressionStream`'s own shape rather than
 * `TransformStream<Uint8Array, Uint8Array>`: its writable side accepts any
 * `BufferSource`, which is wider than `Uint8Array` and so not assignable.
 */
async function pipe(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const blob = new Blob([bytes as BlobPart]);
  const out = blob.stream().pipeThrough(stream as ReadableWritablePair<Uint8Array, BufferSource>);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Base64url — URL-safe, unpadded. Chunked so a big document can't blow the call stack. */
function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Compresses a document into the opaque payload a share link carries. */
export async function encodeShare(source: string): Promise<string> {
  const bytes = new TextEncoder().encode(source.replace(/\r\n/g, '\n'));
  return toBase64Url(await pipe(bytes, new CompressionStream('deflate-raw')));
}

/** Restores a document from a share payload. Throws on anything malformed. */
export async function decodeShare(payload: string): Promise<string> {
  const bytes = await pipe(fromBase64Url(payload), new DecompressionStream('deflate-raw'));
  return new TextDecoder().decode(bytes);
}

/**
 * Builds the link to hand someone.
 *
 * @param base - Where the studio lives, e.g. `https://studio.avodado.dev/`.
 * @param present - Open straight into the deck instead of the editor.
 */
export async function buildShareUrl(
  base: string,
  source: string,
  opts: { readonly present?: boolean; readonly title?: string } = {},
): Promise<string> {
  const url = new URL(base);
  if (opts.present === true) url.searchParams.set('present', '1');
  // The title rides in the query only as a hint for link previews; the real
  // title is inside the document.
  if (opts.title !== undefined && opts.title !== '') url.searchParams.set('t', opts.title);
  url.hash = `${KEY}=${await encodeShare(source)}`;
  return url.toString();
}

/** What a share link asks the studio to do. */
export interface SharedDoc {
  readonly source: string;
  readonly present: boolean;
  readonly title?: string;
}

/**
 * Reads a share link, if the URL is one.
 *
 * @returns `null` when there's no payload — the ordinary case of just opening
 *   the studio — and throws only when a payload is present but unreadable.
 */
export async function readShareUrl(href: string): Promise<SharedDoc | null> {
  const url = new URL(href);
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  const payload = new URLSearchParams(hash).get(KEY);
  if (payload === null || payload === '') return null;
  const title = url.searchParams.get('t');
  return {
    source: await decodeShare(payload),
    present: url.searchParams.get('present') === '1',
    ...(title !== null && title !== '' ? { title } : {}),
  };
}
