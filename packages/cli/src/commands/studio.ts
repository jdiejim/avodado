/**
 * `avo studio` — local file-bridge server for the visual editor.
 *
 * For editing, this does no server-side rendering: the studio web app
 * (`@avodado/studio`, loaded lazily) renders in the browser and talks to a
 * small JSON API here — list docs, read a doc's raw source, write it back.
 * The Markdown files on disk stay the single source of truth: writes are
 * atomic (temp file + rename), LF-normalized, and guarded by a content hash
 * (`baseHash`) so concurrent edits surface as a 409 instead of silently
 * clobbering each other.
 *
 * The BUILT docs site is also mounted here, under `/site/…` (`/site/` →
 * index, `/site/<slug>.html`, `/site/<slug>.slides.html`): the same
 * in-memory {@link buildSite} pages `avo serve` produces, built lazily on the
 * first `/site` request and invalidated by the same debounced fs events that
 * feed `/__events`. The pages' live-reload script targets `/__events` — the
 * same origin here — so they reload on external changes with zero changes to
 * the page markup. This is what the studio's Site mode iframes.
 *
 * The server binds 127.0.0.1 only — it writes files, so it must never be
 * reachable from the network. `/__events` is the same SSE channel as serve's,
 * but with typed JSON payloads: `{"type":"fs","slug","hash"}` when a doc
 * changes on disk (the studio's own writes are filtered out via a
 * recent-writes map) and `{"type":"meta"}` when theme/config files change.
 * CORS headers are deliberately absent: in production the app is served from
 * this same origin, and in development the Vite proxy forwards `/api` and
 * `/__events` so the browser still sees a same-origin API.
 *
 * {@link runStudio}'s promise resolves only on SIGINT/SIGTERM: `bin.ts` awaits
 * `main()` and then exits, so studio must block until the user stops it.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import open from 'open';
import { parseDocument, validateDocument } from '@avodado/core';
import type { ThemeName } from '@avodado/render';
import { loadConfig } from '../io/config.js';
import { loadDocs } from '../io/files.js';
import { toPdf } from '../io/pdf.js';
import { toPptx } from '../io/pptx.js';
import { globalThemePath, savedThemePath, themeSlug } from '../io/theme.js';
import { loadTheme, studioThemeInfo } from '../io/theme.js';
import { cliVersion } from '../io/version.js';
import { createDocsWatcher, createConfigWatcher } from '../io/watch.js';
import { buildSite, type SiteDoc, type SitePage } from './site.js';

/** Inputs to {@link runStudio}. */
export interface StudioOptions {
  /** Project root. */
  readonly cwd: string;
  /** Port to listen on. `0` = ephemeral (the actual port is printed). */
  readonly port: number;
  /** Open the browser once the server is up. */
  readonly open: boolean;
}

const DEBOUNCE_MS = 150;
const HEARTBEAT_MS = 25_000;
const MAX_BODY_BYTES = 10 * 1024 * 1024;

/** Normalizes CRLF / lone-CR line endings to LF (hashing + writes both use this). */
const normalizeLf = (s: string): string => s.replace(/\r\n?/g, '\n');

/** sha256 hex of an (already LF-normalized) source string. */
const hashOf = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

/** Writes a JSON response. Every API route answers through this. */
function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

/**
 * Buffers a request body up to `limit` bytes. Returns `null` when the cap is
 * exceeded (the rest of the stream is drained so a 413 can still be sent).
 */
function readBody(req: IncomingMessage, limit: number): Promise<Buffer | null> {
  return new Promise((done) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let overflowed = false;
    req.on('data', (chunk: Buffer) => {
      if (overflowed) return; // keep draining, keep nothing
      total += chunk.length;
      if (total > limit) {
        overflowed = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => done(overflowed ? null : Buffer.concat(chunks)));
    req.on('error', () => done(null));
  });
}

/** Result of resolving an `/api/doc/<slug…>` remainder to a path on disk. */
type DocPathResult =
  | { readonly kind: 'ok'; readonly slug: string; readonly abs: string }
  | { readonly kind: 'bad' } // undecodable / empty slug → 400
  | { readonly kind: 'forbidden' }; // escapes the docs dir → 403

/**
 * Decodes a slug (may contain `/`) and resolves it under the docs dir.
 * SECURITY: the resolved path must stay inside `docsDirAbs` — `..` segments,
 * encoded or not, are rejected before any file I/O happens.
 */
function resolveDocPath(docsDirAbs: string, remainder: string): DocPathResult {
  let slug: string;
  try {
    slug = decodeURIComponent(remainder);
  } catch {
    return { kind: 'bad' };
  }
  if (slug === '') return { kind: 'bad' };
  const abs = resolve(join(docsDirAbs, slug + '.md'));
  if (!abs.startsWith(docsDirAbs + sep)) return { kind: 'forbidden' };
  return { kind: 'ok', slug, abs };
}

/** File extension → Content-Type for the bundled studio assets. */
const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.map': 'application/json',
};

/** Shown at `/` when the optional `@avodado/studio` assets aren't installed. */
const FALLBACK_HTML =
  '<!doctype html><html><head><meta charset="utf-8"><title>Avodado Studio</title></head>' +
  '<body style="font:16px/1.6 system-ui,sans-serif;max-width:38rem;margin:4rem auto;padding:0 1rem;">' +
  '<h1>Avodado Studio</h1>' +
  '<p>The studio web app (<code>@avodado/studio</code>) is not installed, so there is ' +
  'nothing to show here. Reinstall <code>@avodado/cli</code> to get the bundled assets.</p>' +
  '<p>The file-bridge API is still running: <code>/api/meta</code>, <code>/api/docs</code>, ' +
  '<code>/api/doc/&lt;slug&gt;</code> and the <code>/__events</code> stream all work.</p>' +
  '</body></html>';

/**
 * Starts the studio file-bridge server. The returned promise resolves only
 * after SIGINT or SIGTERM (handlers close the server first), keeping the
 * process alive.
 */
export async function runStudio(opts: StudioOptions): Promise<void> {
  const config = await loadConfig(opts.cwd);
  const docsDirAbs = resolve(opts.cwd, config.docsDir);
  /** slug → hash of the studio's own last write, so its fs echo isn't rebroadcast. */
  const recentWrites = new Map<string, string>();

  // The studio web app is an optional add-on (wired as a real dependency in a
  // later workstream): import it lazily, once, and degrade to a fallback page
  // — never a crash — when it's absent. `null` = tried and failed.
  let assetsRootPromise: Promise<string | null> | undefined;
  const assetsRoot = (): Promise<string | null> => {
    assetsRootPromise ??= import('@avodado/studio')
      .then((mod) => resolve(mod.assetsPath()))
      .catch(() => null);
    return assetsRootPromise;
  };

  // ── Built site (Site mode) ─────────────────────────────────────────────────
  // Lazy: nothing is rendered until the first /site request; after that the
  // page map is reused until a docs/theme fs event invalidates it. A rebuild
  // that throws (e.g. a half-saved doc) keeps serving the last good site.
  let sitePages: ReadonlyMap<string, SitePage> | null = null; // last good build
  let siteFresh = false; // false = rebuild before the next /site response
  let siteBuild: Promise<ReadonlyMap<string, SitePage>> | null = null;

  const rebuildSite = async (): Promise<ReadonlyMap<string, SitePage>> => {
    const files = await loadDocs([`${config.docsDir}/**/*.md`], opts.cwd, config.docsDir);
    const docs: SiteDoc[] = files.map((f) => ({
      slug: f.slug,
      file: f.file,
      doc: parseDocument(f.source, f.slug),
    }));
    const { theme, themeVars } = loadTheme(opts.cwd);
    const site = buildSite(docs, {
      ...(theme !== undefined ? { theme: theme as ThemeName } : {}),
      ...(themeVars !== undefined ? { themeVars } : {}),
      liveReload: true, // the script hits /__events — same origin here
      richIndex: config.richIndex, // on by default; config `false` opts out
    });
    const next = new Map<string, SitePage>();
    for (const p of site.pages) next.set(p.path, p);
    return next;
  };

  const getSitePages = (): Promise<ReadonlyMap<string, SitePage>> => {
    if (siteFresh && sitePages !== null) return Promise.resolve(sitePages);
    siteBuild ??= rebuildSite()
      .then((pages) => {
        sitePages = pages;
        siteFresh = true;
        return pages;
      })
      .catch((err: unknown) => {
        // Keep the last good site on a bad save; only fail with nothing built.
        if (sitePages !== null) return sitePages;
        throw err;
      })
      .finally(() => {
        siteBuild = null;
      });
    return siteBuild;
  };

  const invalidateSite = (): void => {
    siteFresh = false;
  };

  // ── SSE ────────────────────────────────────────────────────────────────────
  const sseClients = new Set<ServerResponse>();
  const broadcast = (payload: unknown): void => {
    const line = `data: ${JSON.stringify(payload)}\n\n`;
    for (const c of sseClients) c.write(line);
  };

  // ── Watching ───────────────────────────────────────────────────────────────
  let docsDebounce: NodeJS.Timeout | undefined;
  let metaDebounce: NodeJS.Timeout | undefined;
  const pendingPaths = new Set<string>();
  let pendingUnattributed = false;

  /** Debounced fan-out of one fs-event batch: per-file events where the
   * watcher gave a filename, one bare `{type:"fs"}` where it didn't. */
  const flushDocsEvents = async (): Promise<void> => {
    docsWatcher.resync(); // fallback mode: pick up newly created directories
    // Any docs change — including the studio's own writes, which are filtered
    // from the SSE broadcast below — makes the built site stale.
    invalidateSite();
    const paths = [...pendingPaths];
    const unattributed = pendingUnattributed;
    pendingPaths.clear();
    pendingUnattributed = false;
    for (const abs of paths) {
      const slug = relative(docsDirAbs, abs).split(sep).join('/').replace(/\.md$/i, '');
      let hash: string | undefined;
      try {
        hash = hashOf(normalizeLf(await readFile(abs, 'utf8')));
      } catch {
        /* deleted or unreadable → event without a hash; the client refetches */
      }
      if (hash !== undefined && recentWrites.get(slug) === hash) {
        recentWrites.delete(slug); // our own PUT echoing back through fs.watch
        continue;
      }
      broadcast({ type: 'fs', slug, ...(hash !== undefined ? { hash } : {}) });
    }
    if (unattributed) broadcast({ type: 'fs' });
  };

  const onDocsEvent = (absPath?: string): void => {
    if (absPath === undefined) pendingUnattributed = true;
    else if (/\.md$/i.test(absPath)) pendingPaths.add(absPath);
    // Non-.md paths (temp files, new directories) emit nothing, but still
    // schedule a flush so the fallback watcher re-walks for new directories.
    if (docsDebounce !== undefined) clearTimeout(docsDebounce);
    docsDebounce = setTimeout(() => void flushDocsEvents(), DEBOUNCE_MS);
  };

  const onMetaEvent = (): void => {
    if (metaDebounce !== undefined) clearTimeout(metaDebounce);
    metaDebounce = setTimeout(() => {
      invalidateSite(); // theme/config changes restyle every site page
      broadcast({ type: 'meta' });
    }, DEBOUNCE_MS);
  };

  const docsWatcher = createDocsWatcher(docsDirAbs, onDocsEvent);
  const configWatcher = createConfigWatcher(opts.cwd, onMetaEvent);

  // ── API routes ─────────────────────────────────────────────────────────────

  const handleMeta = (res: ServerResponse): void => {
    // Reload per request so theme edits reflect without a restart. Beyond the
    // resolved theme/themeVars, the payload says WHICH theme is active
    // (built-in / saved / custom + name) and lists every saved theme with its
    // resolved base + vars, so the studio picker can show and preview them.
    sendJson(res, 200, {
      version: cliVersion(),
      docsDir: config.docsDir,
      ...studioThemeInfo(opts.cwd),
    });
  };

  /**
   * Doc-list metadata cache, keyed by file mtime: a list request re-reads and
   * re-stats every doc (that already happened for titles) but parses and
   * validates only the docs whose mtime changed since the last list. So the
   * per-doc `errorCount` costs one parse+validate per CHANGED doc, not per
   * request.
   */
  const docListCache = new Map<string, { mtimeMs: number; title: string; errorCount: number }>();

  const handleDocs = async (res: ServerResponse): Promise<void> => {
    const files = await loadDocs([`${config.docsDir}/**/*.md`], opts.cwd, config.docsDir);
    const seen = new Set<string>();
    const docs = await Promise.all(
      files.map(async (f) => {
        const st = await stat(f.absolute);
        seen.add(f.slug);
        let entry = docListCache.get(f.slug);
        if (entry === undefined || entry.mtimeMs !== st.mtimeMs) {
          let title = f.slug;
          let errorCount = 0;
          try {
            const doc = parseDocument(f.source, f.slug);
            title = doc.meta?.title ?? f.slug;
            errorCount = validateDocument(doc, f.file).filter((d) => d.level === 'error').length;
          } catch {
            /* an unparseable doc still lists (slug as title) — and IS broken */
            errorCount = 1;
          }
          entry = { mtimeMs: st.mtimeMs, title, errorCount };
          docListCache.set(f.slug, entry);
        }
        return {
          slug: f.slug,
          file: f.file,
          title: entry.title,
          mtimeMs: st.mtimeMs,
          errorCount: entry.errorCount,
        };
      }),
    );
    for (const slug of [...docListCache.keys()]) {
      if (!seen.has(slug)) docListCache.delete(slug); // deleted docs drop out
    }
    sendJson(res, 200, docs);
  };

  const handleDocGet = async (res: ServerResponse, abs: string): Promise<void> => {
    if (!existsSync(abs)) {
      sendJson(res, 404, { error: 'document not found' });
      return;
    }
    const [raw, st] = await Promise.all([readFile(abs, 'utf8'), stat(abs)]);
    const source = normalizeLf(raw);
    sendJson(res, 200, { source, hash: hashOf(source), mtimeMs: st.mtimeMs });
  };

  const handleDocPut = async (
    req: IncomingMessage,
    res: ServerResponse,
    slug: string,
    abs: string,
    force: boolean,
  ): Promise<void> => {
    const body = await readBody(req, MAX_BODY_BYTES);
    if (body === null) {
      sendJson(res, 413, { error: `body exceeds ${MAX_BODY_BYTES} bytes` });
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(body.toString('utf8'));
    } catch {
      sendJson(res, 400, { error: 'invalid JSON body' });
      return;
    }
    if (parsed === null || typeof parsed !== 'object') {
      sendJson(res, 400, { error: 'body must be a JSON object' });
      return;
    }
    const { source: rawSource, baseHash } = parsed as { source?: unknown; baseHash?: unknown };
    if (typeof rawSource !== 'string') {
      sendJson(res, 400, { error: 'missing "source" (string)' });
      return;
    }
    if (baseHash !== undefined && typeof baseHash !== 'string') {
      sendJson(res, 400, { error: '"baseHash" must be a string when present' });
      return;
    }

    const source = normalizeLf(rawSource);
    if (existsSync(abs)) {
      // Update path: clients should always send baseHash here; omitting it
      // overwrites unconditionally (the documented creation path degenerates
      // to last-writer-wins).
      const currentSource = normalizeLf(await readFile(abs, 'utf8'));
      const currentHash = hashOf(currentSource);
      if (baseHash !== undefined && baseHash !== currentHash && !force) {
        sendJson(res, 409, { currentHash, currentSource });
        return;
      }
    } else if (baseHash !== undefined && !force) {
      // The client edited a doc that has since vanished — that's a conflict
      // too, not a silent recreate. `?force=1` recreates it.
      sendJson(res, 409, { error: 'file no longer exists on disk (use ?force=1 to recreate)' });
      return;
    }

    // Atomic write: temp file in the same dir + rename, so a crash mid-write
    // never leaves a half-saved doc, and watchers see exactly one change.
    await mkdir(dirname(abs), { recursive: true });
    const tmp = join(dirname(abs), `.${basename(abs)}.${randomBytes(6).toString('hex')}.tmp`);
    await writeFile(tmp, source, 'utf8');
    await rename(tmp, abs);

    const hash = hashOf(source);
    recentWrites.set(slug, hash);
    const st = await stat(abs);
    sendJson(res, 200, { hash, mtimeMs: st.mtimeMs });
  };

  // ── Chromium exports (POST /api/export/pdf | /api/export/pptx) ─────────────
  // The studio renders the doc to themed HTML in the browser and POSTs it here
  // (page HTML for PDF, deck HTML for PowerPoint); we run it through headless
  // Chromium and stream the bytes back. Chromium is downloaded on the first
  // export (one time) — hence the loopback-only server is the natural place
  // for it. Failures (Playwright/Chromium missing) surface as a 500 with a
  // readable message the studio shows as a toast.
  const chromiumExport =
    (convert: (html: string) => Promise<Uint8Array>, contentType: string) =>
    async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      const body = await readBody(req, MAX_BODY_BYTES);
      if (body === null) {
        sendJson(res, 413, { error: `body exceeds ${MAX_BODY_BYTES} bytes` });
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(body.toString('utf8'));
      } catch {
        sendJson(res, 400, { error: 'invalid JSON body' });
        return;
      }
      const html = (parsed as { html?: unknown } | null)?.html;
      if (typeof html !== 'string') {
        sendJson(res, 400, { error: 'missing "html" (string)' });
        return;
      }
      try {
        const bytes = await convert(html);
        res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
        res.end(Buffer.from(bytes));
      } catch (err) {
        sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
      }
    };
  const handleExportPdf = chromiumExport(
    (html) => toPdf(html, { autoInstallBrowser: true, log: (m) => console.log(m) }),
    'application/pdf',
  );
  const handleExportPptx = chromiumExport(
    (html) => toPptx(html, { autoInstallBrowser: true, log: (m) => console.log(m) }),
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  );

  // ── Theme install (POST /api/theme) ───────────────────────────────────────
  // The Theme Generator posts a friendly theme (name, base, colors, fonts); we
  // write it as `<slug>.theme.json` into the project's `.avodado/themes` (or
  // `~/.avodado/themes` for scope=global). The config watcher then broadcasts a
  // meta change, so the studio's theme picker shows it without a reload.
  const THEME_BASES = new Set(['textbook', 'minimal', 'soft', 'dark', 'teal', 'slate']);
  const stringMap = (v: unknown): Record<string, string> => {
    const out: Record<string, string> = {};
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      for (const [k, val] of Object.entries(v)) {
        if (typeof val === 'string' && val.trim() !== '') out[k] = val;
      }
    }
    return out;
  };

  const handleThemePost = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const body = await readBody(req, MAX_BODY_BYTES);
    if (body === null) {
      sendJson(res, 413, { error: `body exceeds ${MAX_BODY_BYTES} bytes` });
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(body.toString('utf8'));
    } catch {
      sendJson(res, 400, { error: 'invalid JSON body' });
      return;
    }
    const p = parsed as { name?: unknown; base?: unknown; colors?: unknown; fonts?: unknown; scope?: unknown };
    const name = typeof p.name === 'string' ? p.name.trim() : '';
    if (name === '') return sendJson(res, 400, { error: 'missing "name" (string)' });
    const base = typeof p.base === 'string' ? p.base : '';
    if (!THEME_BASES.has(base)) return sendJson(res, 400, { error: `"base" must be one of ${[...THEME_BASES].join(', ')}` });
    const slug = themeSlug(name);
    if (slug === '') return sendJson(res, 400, { error: 'name has no usable characters for a filename' });

    const colors = stringMap(p.colors);
    const fonts = stringMap(p.fonts);
    const themeFile = {
      name,
      theme: base,
      ...(Object.keys(colors).length > 0 ? { colors } : {}),
      ...(Object.keys(fonts).length > 0 ? { fonts } : {}),
    };
    const scope = p.scope === 'global' ? 'global' : 'project';
    const abs = scope === 'global' ? globalThemePath(slug) : savedThemePath(opts.cwd, slug);
    try {
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, `${JSON.stringify(themeFile, null, 2)}\n`, 'utf8');
      sendJson(res, 200, { slug, path: abs });
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  };

  // ── Built site pages (/site/…) ─────────────────────────────────────────────

  const handleSite = async (res: ServerResponse, pathname: string): Promise<void> => {
    let rel: string;
    try {
      rel = decodeURIComponent(pathname.slice('/site/'.length));
    } catch {
      rel = '';
    }
    const path = rel === '' ? 'index.html' : rel;
    const pages = await getSitePages();
    const page = pages.get(path);
    if (page === undefined) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404 — no page at ${pathname}\n`);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(page.html);
  };

  // ── Static studio assets (SPA) ─────────────────────────────────────────────

  const handleStatic = async (res: ServerResponse, pathname: string): Promise<void> => {
    const root = await assetsRoot();
    let rel: string;
    try {
      rel = decodeURIComponent(pathname).replace(/^\/+/, '');
    } catch {
      rel = '';
    }
    const isAsset = extname(rel) !== '';
    if (root === null) {
      // Assets not installed: the SPA shell degrades to a hint page, asset
      // URLs 404 — and the API keeps working either way.
      if (isAsset) {
        sendJson(res, 404, { error: 'studio assets not installed' });
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(FALLBACK_HTML);
      return;
    }
    // SPA fallback: any extensionless path serves index.html (client routing).
    const target = isAsset ? resolve(join(root, rel)) : join(root, 'index.html');
    if (isAsset && !target.startsWith(root + sep)) {
      sendJson(res, 403, { error: 'forbidden' });
      return;
    }
    try {
      const content = await readFile(target);
      const type = MIME[extname(target).toLowerCase()] ?? 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      res.end(content);
    } catch {
      sendJson(res, 404, { error: 'not found' });
    }
  };

  // ── Dispatch ───────────────────────────────────────────────────────────────

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const method = req.method ?? 'GET';
    const rawUrl = req.url ?? '/';
    const q = rawUrl.indexOf('?');
    const pathname = q === -1 ? rawUrl : rawUrl.slice(0, q);
    const query = new URLSearchParams(q === -1 ? '' : rawUrl.slice(q + 1));

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (pathname === '/__events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store',
        Connection: 'keep-alive',
      });
      res.write(':connected\n\n');
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    if (pathname === '/api/meta') {
      if (method !== 'GET') return sendJson(res, 405, { error: 'method not allowed' });
      return handleMeta(res);
    }
    if (pathname === '/api/docs') {
      if (method !== 'GET') return sendJson(res, 405, { error: 'method not allowed' });
      return handleDocs(res);
    }
    if (pathname === '/api/export/pdf') {
      if (method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' });
      return handleExportPdf(req, res);
    }
    if (pathname === '/api/export/pptx') {
      if (method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' });
      return handleExportPptx(req, res);
    }
    if (pathname === '/api/theme') {
      if (method !== 'POST') return sendJson(res, 405, { error: 'method not allowed' });
      return handleThemePost(req, res);
    }
    if (pathname.startsWith('/api/doc/')) {
      const hit = resolveDocPath(docsDirAbs, pathname.slice('/api/doc/'.length));
      if (hit.kind === 'bad') return sendJson(res, 400, { error: 'invalid slug' });
      if (hit.kind === 'forbidden') return sendJson(res, 403, { error: 'forbidden' });
      if (method === 'GET') return handleDocGet(res, hit.abs);
      if (method === 'PUT') {
        return handleDocPut(req, res, hit.slug, hit.abs, query.get('force') === '1');
      }
      return sendJson(res, 405, { error: 'method not allowed' });
    }
    if (pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'unknown API route' });

    if (method !== 'GET' && method !== 'HEAD') {
      return sendJson(res, 405, { error: 'method not allowed' });
    }
    // The built docs site rides under /site/ — before the SPA fallback, which
    // would otherwise swallow the extensionless /site/ path as index.html.
    if (pathname === '/site' || pathname.startsWith('/site/')) {
      return handleSite(res, pathname);
    }
    return handleStatic(res, pathname);
  };

  const server = createServer((req, res) => {
    // A bad request must never take the server down: unexpected errors become
    // a 500 (or just close the response if headers already went out).
    void handle(req, res).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      if (!res.headersSent) sendJson(res, 500, { error: message });
      else res.end();
    });
  });

  const heartbeat = setInterval(() => {
    for (const c of sseClients) c.write(':heartbeat\n\n');
  }, HEARTBEAT_MS);
  heartbeat.unref();

  // ── Listen + lifecycle ─────────────────────────────────────────────────────
  // Loopback only: this server writes files, so it must never listen on 0.0.0.0.
  await new Promise<void>((ready, fail) => {
    server.once('error', fail);
    server.listen(opts.port, '127.0.0.1', () => {
      server.removeListener('error', fail);
      ready();
    });
  });
  const address = server.address();
  const port = address !== null && typeof address === 'object' ? address.port : opts.port;
  const url = `http://localhost:${port}`;
  console.log(`Studio at ${url}  (Ctrl-C to stop)`);
  console.log(`Editing ${config.docsDir}/ — the files stay the source of truth`);
  if (opts.open) await open(url);

  await new Promise<void>((done) => {
    let closed = false;
    const shutdown = (): void => {
      if (closed) return;
      closed = true;
      if (docsDebounce !== undefined) clearTimeout(docsDebounce);
      if (metaDebounce !== undefined) clearTimeout(metaDebounce);
      clearInterval(heartbeat);
      docsWatcher.close();
      configWatcher.close();
      for (const c of sseClients) c.end();
      server.close(() => done());
      server.closeAllConnections();
      // Safety net: resolve even if a straggling socket stalls `close`.
      setTimeout(done, 1_000).unref();
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
}
