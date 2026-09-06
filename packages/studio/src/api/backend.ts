/**
 * The studio's storage contract.
 *
 * Studio does all of its own work in the browser — parse, validate, render,
 * present. The only thing it needs from the outside is somewhere to keep
 * documents, and this is that seam: four methods, one interface, two (soon
 * three) implementations.
 *
 *   - `fileBridge`  — `avo studio`'s local JSON API over your `docs/*.md`.
 *   - `memoryVault` — in-tab storage, for the hosted studio with no server.
 *
 * A networked backend (documents in a database) is the next implementation and
 * needs nothing above this file to change.
 *
 * Everything above this module talks to {@link StudioBackend} and never to
 * `fetch`, so hosting the studio is a matter of choosing a different
 * implementation at boot rather than rewriting the app.
 */

/** Studio-wide state: version and where docs live. */
export interface StudioMeta {
  readonly version: string;
  readonly docsDir: string;
}

/** One entry of the document list. */
export interface DocListItem {
  readonly slug: string;
  readonly file: string;
  readonly title: string;
  readonly mtimeMs: number;
  /**
   * `avo check` error count of the doc as stored (warnings excluded) — the
   * rail dots and the All-documents Status column. Absent on older servers;
   * consumers show nothing rather than a fake "pass".
   */
  readonly errorCount?: number;
}

/** One document's LF-normalised source and its content hash. */
export interface DocPayload {
  readonly source: string;
  readonly hash: string;
  readonly mtimeMs: number;
}

/** What came back when a save's `baseHash` turned out to be stale. */
export interface SaveConflict {
  readonly currentHash: string;
  readonly currentSource: string;
}

/** A save either lands, or loses to a concurrent edit. */
export type SaveResult =
  | { readonly ok: true; readonly hash: string; readonly mtimeMs: number }
  | { readonly ok: false; readonly conflict: SaveConflict };

/** Where documents live for this session. */
export interface StudioBackend {
  readonly kind: 'file-bridge' | 'vault';
  /**
   * True when a real server is behind the backend. Gates the features that
   * can only exist there: file-change events, Chromium exports (PDF and
   * PowerPoint) and the built site. The hosted studio keeps everything the
   * browser can do on its own and hides the rest rather than offering
   * buttons that fail.
   */
  readonly hasServer: boolean;
  fetchMeta(): Promise<StudioMeta>;
  fetchDocs(): Promise<DocListItem[]>;
  fetchDoc(slug: string): Promise<DocPayload>;
  /**
   * `baseHash` is the hash of the source this edit started from — omit it to
   * create a document, and pass `force` to overwrite a stale base.
   */
  saveDoc(slug: string, source: string, baseHash?: string, force?: boolean): Promise<SaveResult>;
}

/**
 * The content hash both backends agree on: SHA-256 of the LF-normalised
 * source, hex-encoded.
 *
 * The file bridge computes this server-side and the vault computes it here,
 * but they have to produce the same string for the same text or the
 * stale-`baseHash` conflict check silently stops working.
 */
export async function hashSource(source: string): Promise<string> {
  const normalised = source.replace(/\r\n/g, '\n');
  const bytes = new TextEncoder().encode(normalised);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
