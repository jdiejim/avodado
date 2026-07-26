/**
 * The backend the app talks to — chosen once, at boot.
 *
 * Studio ships in two shapes from one build tree: `avo studio`, where
 * documents are your `docs/*.md` behind a local file bridge, and the hosted
 * studio, where they live in the browser's own storage. Both satisfy
 * {@link StudioBackend}, so everything above this module is identical.
 *
 * The default is the file bridge, so the CLI is unaffected by anything here;
 * the hosted build opts in with `VITE_STUDIO_BACKEND=vault`.
 */

import type {
  DocListItem,
  DocPayload,
  SaveResult,
  StudioBackend,
  StudioMeta,
  ThemeInput,
} from './backend.js';
import { memoryVault } from './memoryVault.js';
import { fileBridge } from './fileBridge.js';

export type {
  ActiveThemeMeta,
  DocListItem,
  DocPayload,
  SaveConflict,
  SaveResult,
  StudioBackend,
  StudioMeta,
  SavedThemeMeta,
  ThemeInput,
} from './backend.js';

/** The active backend for this session. */
export const backend: StudioBackend =
  (import.meta.env?.['VITE_STUDIO_BACKEND'] as string | undefined) === 'vault'
    ? memoryVault
    : fileBridge;

/**
 * True when a server sits behind the documents. Gates file-change events and
 * the exports that need Chromium — see {@link StudioBackend.hasServer}.
 */
export const hasServer = backend.hasServer;

export function fetchMeta(): Promise<StudioMeta> {
  return backend.fetchMeta();
}

export function fetchDocs(): Promise<DocListItem[]> {
  return backend.fetchDocs();
}

export function fetchDoc(slug: string): Promise<DocPayload> {
  return backend.fetchDoc(slug);
}

export function saveDoc(
  slug: string,
  source: string,
  baseHash?: string,
  force = false,
): Promise<SaveResult> {
  return backend.saveDoc(slug, source, baseHash, force);
}

export function saveTheme(input: ThemeInput): Promise<{ slug: string; path: string }> {
  return backend.saveTheme(input);
}

/**
 * Stores a document that arrived from outside — today, a share link.
 *
 * Backend-agnostic on purpose: in the hosted studio this lands in the vault,
 * and in `avo studio` it becomes a real file in `docs/`, which is exactly what
 * someone opening a colleague's link locally would want.
 *
 * @param hint - Preferred slug (a title, usually). Sanitised, and suffixed
 *   until it doesn't collide with something already there.
 */
export async function importDoc(source: string, hint = 'shared'): Promise<string> {
  const base =
    hint
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'shared';
  const taken = new Set((await backend.fetchDocs()).map((d) => d.slug));
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  const res = await backend.saveDoc(slug, source);
  if (!res.ok) throw new Error('could not store the shared document');
  return slug;
}
