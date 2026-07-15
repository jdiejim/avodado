/**
 * Typed fetch wrappers over the `avo studio` file-bridge API.
 *
 * The server owns hashing: every read/write returns the sha256 `hash` of the
 * LF-normalised source, and the client threads it back as `baseHash` on save
 * so the server can detect concurrent edits (409 + the current content).
 */

/** What the server says the active theme IS (identity, not resolution). */
export interface ActiveThemeMeta {
  /** `builtin` (a base theme), `saved` (a saved custom), `custom` (unmatched overrides), or `none`. */
  readonly kind: 'builtin' | 'saved' | 'custom' | 'none';
  /** Built-in name or saved slug, when known. */
  readonly id?: string;
  /** Display name for a saved/custom theme, when known. */
  readonly name?: string;
}

/** One saved (installed) theme: identity + its resolved base/vars for preview. */
export interface SavedThemeMeta {
  readonly slug: string;
  readonly name: string;
  readonly scope: 'global' | 'project';
  readonly theme?: string;
  readonly themeVars?: Readonly<Record<string, string>>;
}

/** `GET /api/meta` response. */
export interface StudioMeta {
  readonly version: string;
  readonly docsDir: string;
  /** Resolved base theme of the ACTIVE theme (a built-in name), if configured. */
  readonly theme?: string;
  /** Resolved CSS-variable overrides of the active theme. */
  readonly themeVars?: Readonly<Record<string, string>>;
  /** Identity of the active theme. Absent on older servers. */
  readonly active?: ActiveThemeMeta;
  /** Every saved theme, for the picker. Absent on older servers. */
  readonly savedThemes?: readonly SavedThemeMeta[];
}

/** One entry of `GET /api/docs`. */
export interface DocListItem {
  readonly slug: string;
  readonly file: string;
  readonly title: string;
  readonly mtimeMs: number;
}

/** `GET /api/doc/<slug>` response. */
export interface DocPayload {
  readonly source: string;
  readonly hash: string;
  readonly mtimeMs: number;
}

/** The 409 payload when a save's `baseHash` is stale. */
export interface SaveConflict {
  readonly currentHash: string;
  readonly currentSource: string;
}

/** Result of a `PUT /api/doc/<slug>` — success or a stale-base conflict. */
export type SaveResult =
  | { readonly ok: true; readonly hash: string; readonly mtimeMs: number }
  | { readonly ok: false; readonly conflict: SaveConflict };

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
