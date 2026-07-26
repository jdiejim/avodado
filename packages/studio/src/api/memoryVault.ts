/**
 * The memory vault — documents live in the tab, and there is no server.
 *
 * This is what the hosted studio runs on for now: the same editor, the same
 * renderer, the same edit ops, with the file bridge swapped for a Map. Nothing
 * leaves the machine, which is what lets the hosted studio open with no
 * account, no upload and no privacy conversation.
 *
 * **Documents do not survive a reload.** That is deliberate for this step —
 * a share link carries its own document, so nothing is lost that wasn't
 * already in a URL, and durable storage is the *next* backend rather than a
 * thing to half-build twice. Whatever that ends up being (Mongo behind an
 * API), it implements {@link StudioBackend} and nothing above this file moves.
 *
 * The one subtlety worth keeping is hashing. The file bridge has the server
 * hash every read and write so a stale `baseHash` can be detected; the vault
 * does the same with {@link hashSource}, so the conflict path stays exercised
 * and a networked backend inherits a client that already handles it.
 */

import { parseDocument } from '@avodado/core';
import {
  hashSource,
  type DocListItem,
  type DocPayload,
  type SaveResult,
  type StudioBackend,
  type StudioMeta,
  type ThemeInput,
} from './backend.js';

/** A stored document. `title` is derived on write so listing stays cheap. */
interface VaultDoc {
  readonly slug: string;
  readonly source: string;
  readonly hash: string;
  readonly mtimeMs: number;
  readonly title: string;
}

const docs = new Map<string, VaultDoc>();
const prefs = new Map<string, unknown>();

/** The document's own title, falling back to the slug — as the server does. */
function titleOf(source: string, slug: string): string {
  try {
    return parseDocument(source, slug).meta?.title ?? slug;
  } catch {
    /* an unparseable doc still lists — the slug stands in for the title */
    return slug;
  }
}

/** The document the vault opens with, so a first visit has something to edit. */
const WELCOME_SLUG = 'welcome';
const WELCOME = `\`\`\`meta
title: Welcome to Avodado
subtitle: Every document here is Markdown with typed, validated blocks.
tag: START HERE
\`\`\`

## Blocks are typed, so they can be checked

Prose stays plain Markdown. Anything visual is a typed block — edit the YAML
and the document redraws as you type.

\`\`\`sequence
title: What happens when you edit
actors:
  - { id: you, name: You }
  - { id: studio, name: Studio }
  - { id: core, name: avodado core }
messages:
  - you -> studio: change a block
  - studio -> core: parse and validate
  - core --> studio: diagnostics
  - studio --> you: redraw
\`\`\`

\`\`\`callout
tone: warn
title: This document lives in the tab
body: Nothing is uploaded — and nothing is stored yet either, so use **Share** to keep a copy. The whole document travels inside the link.
\`\`\`
`;

/**
 * The in-flight (or finished) seed.
 *
 * A promise rather than a `done` flag on purpose: boot calls `fetchMeta` and
 * `fetchDocs` concurrently, so a flag set before the write lands lets the
 * second call skip a seed that hasn't happened yet and report zero documents.
 * Every entry point awaits this same promise instead.
 */
let seeding: Promise<void> | null = null;

/** Seeds the welcome document once per session. */
function seedIfEmpty(): Promise<void> {
  seeding ??= docs.size > 0 ? Promise.resolve() : writeDoc(WELCOME_SLUG, WELCOME).then(() => {});
  return seeding;
}

async function writeDoc(slug: string, source: string): Promise<VaultDoc> {
  const normalised = source.replace(/\r\n/g, '\n');
  const doc: VaultDoc = {
    slug,
    source: normalised,
    hash: await hashSource(normalised),
    mtimeMs: Date.now(),
    title: titleOf(normalised, slug),
  };
  docs.set(slug, doc);
  return doc;
}

/** Version of the hosted app, for the stale-tab guard. Build-time constant. */
const VERSION = (import.meta.env?.['VITE_STUDIO_VERSION'] as string | undefined) ?? 'web';

async function fetchMeta(): Promise<StudioMeta> {
  await seedIfEmpty();
  const theme = prefs.get('theme') as string | undefined;
  const themeVars = prefs.get('themeVars') as Record<string, string> | undefined;
  const savedThemes = (prefs.get('savedThemes') as StudioMeta['savedThemes']) ?? [];
  return {
    version: VERSION,
    docsDir: 'This browser tab',
    ...(theme !== undefined ? { theme } : {}),
    ...(themeVars !== undefined ? { themeVars } : {}),
    active: theme !== undefined ? { kind: 'builtin', id: theme } : { kind: 'none' },
    savedThemes,
  };
}

async function fetchDocs(): Promise<DocListItem[]> {
  await seedIfEmpty();
  return [...docs.values()]
    .map((d) => ({ slug: d.slug, file: `${d.slug}.md`, title: d.title, mtimeMs: d.mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

async function fetchDoc(slug: string): Promise<DocPayload> {
  await seedIfEmpty();
  const doc = docs.get(slug);
  if (doc === undefined) throw new Error(`${slug} is not open in this session`);
  return { source: doc.source, hash: doc.hash, mtimeMs: doc.mtimeMs };
}

async function saveDoc(
  slug: string,
  source: string,
  baseHash?: string,
  force = false,
): Promise<SaveResult> {
  const current = docs.get(slug);
  // Same rule as the server: an edit that started from a hash the store no
  // longer holds has lost a race with another writer.
  if (!force && current !== undefined && baseHash !== undefined && current.hash !== baseHash) {
    return { ok: false, conflict: { currentHash: current.hash, currentSource: current.source } };
  }
  const written = await writeDoc(slug, source);
  return { ok: true, hash: written.hash, mtimeMs: written.mtimeMs };
}

/**
 * "Installs" a theme by remembering it. There is no `.avodado/themes` to write
 * to here, so the vault keeps the generated theme alongside the documents and
 * reports it through {@link fetchMeta} exactly as the file bridge reports a
 * saved one.
 */
async function saveTheme(input: ThemeInput): Promise<{ slug: string; path: string }> {
  const slug =
    input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'custom';
  const saved = (prefs.get('savedThemes') as StudioMeta['savedThemes']) ?? [];
  const entry = {
    slug,
    name: input.name,
    scope: 'project' as const,
    theme: input.base,
    themeVars: { ...input.colors, ...input.fonts },
  };
  prefs.set('savedThemes', [...saved.filter((t) => t.slug !== slug), entry]);
  prefs.set('theme', input.base);
  prefs.set('themeVars', entry.themeVars);
  return Promise.resolve({ slug, path: 'this session' });
}

/** Clears the vault — test seam. */
export function resetVault(): void {
  docs.clear();
  prefs.clear();
  seeding = null;
}

/** The no-server backend behind the hosted studio. */
export const memoryVault: StudioBackend = {
  kind: 'vault',
  hasServer: false,
  fetchMeta,
  fetchDocs,
  fetchDoc,
  saveDoc,
  saveTheme,
};
