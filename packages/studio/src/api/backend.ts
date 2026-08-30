/**
 * The studio's storage contract.
 *
 * Studio does all of its own work in the browser — parse, validate, render,
 * present. The only thing it needs from the outside is somewhere to keep
 * documents, and this is that seam: five methods, one interface, two (soon
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

/** What the backend says the active theme IS (identity, not resolution). */
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

/** Studio-wide state: version, where docs live, and the active theme. */
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

/** A theme to install (the Theme Generator's output). */
export interface ThemeInput {
  readonly name: string;
  /** Base built-in theme the custom colors/fonts extend. */
  readonly base: string;
  readonly colors: Readonly<Record<string, string>>;
  readonly fonts: Readonly<Record<string, string>>;
  /** `project` → `.avodado/themes`; `global` → `~/.avodado/themes`. */
  readonly scope: 'project' | 'global';
}

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
  saveTheme(input: ThemeInput): Promise<{ slug: string; path: string }>;
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
