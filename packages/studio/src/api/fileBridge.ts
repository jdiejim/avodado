/**
 * The `avo studio` file bridge — documents are `docs/*.md` on your disk.
 *
 * Typed fetch wrappers over the local JSON API. The server owns hashing: every
 * read/write returns the sha256 `hash` of the LF-normalised source, and the
 * client threads it back as `baseHash` on save so the server can detect
 * concurrent edits (409 + the current content).
 */

import type {
  DocListItem,
  DocPayload,
  SaveConflict,
  SaveResult,
  StudioBackend,
  StudioMeta,
  ThemeInput,
} from './backend.js';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Fetches server meta (version, docs dir, configured theme + overrides). */
export function fetchMeta(): Promise<StudioMeta> {
  return getJson<StudioMeta>('/api/meta');
}

/** Fetches the doc list. */
export function fetchDocs(): Promise<DocListItem[]> {
  return getJson<DocListItem[]>('/api/docs');
}

/** Fetches one doc's LF-normalised source + content hash. */
export function fetchDoc(slug: string): Promise<DocPayload> {
  return getJson<DocPayload>(`/api/doc/${encodeURIComponent(slug)}`);
}

/**
 * Saves a doc. `baseHash` is the hash of the source this edit started from —
 * omit it to create a new file. `force` overrides a stale `baseHash`.
 *
 * @returns `{ ok: true, hash }` on success, `{ ok: false, conflict }` on 409.
 */
export async function saveDoc(
  slug: string,
  source: string,
  baseHash?: string,
  force = false,
): Promise<SaveResult> {
  const url = `/api/doc/${encodeURIComponent(slug)}${force ? '?force=1' : ''}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(baseHash !== undefined ? { source, baseHash } : { source }),
  });
  if (res.status === 409) {
    const conflict = (await res.json()) as SaveConflict;
    return { ok: false, conflict };
  }
  if (!res.ok) throw new Error(`save ${slug} → HTTP ${res.status}`);
  const body = (await res.json()) as { hash: string; mtimeMs: number };
  return { ok: true, hash: body.hash, mtimeMs: body.mtimeMs };
}

/**
 * Writes a generated theme file to disk via the file bridge and returns its
 * slug. The server watcher then broadcasts a meta change, so the picker picks
 * it up. Throws with the server's message on failure.
 */
export async function saveTheme(input: ThemeInput): Promise<{ slug: string; path: string }> {
  const res = await fetch('/api/theme', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    let message = `theme install failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body.error === 'string') message = body.error;
    } catch {
      /* non-JSON error */
    }
    throw new Error(message);
  }
  return (await res.json()) as { slug: string; path: string };
}

/** The local-files backend, as used by `avo studio`. */
export const fileBridge: StudioBackend = {
  kind: 'file-bridge',
  hasServer: true,
  fetchMeta,
  fetchDocs,
  fetchDoc,
  saveDoc,
  saveTheme,
};
