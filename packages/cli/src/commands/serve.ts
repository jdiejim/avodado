/**
 * `avo serve` — zero-dependency local dev server for the docs site.
 *
 * Serves the same site as `avo build`, but from memory: `node:http` routes
 * `/` → index, `/<slug>.html` → page, and `/__events` → a Server-Sent-Events
 * stream that pushes `reload` after every rebuild (each served page carries a
 * tiny injected `EventSource` script — serve only, never in build output).
 *
 * Watching: `fs.watch(docsDir, { recursive: true })` with a per-directory
 * fallback for platforms without recursive watch, plus a non-recursive watch
 * on the project root for `avodado.theme.json(.jsonc)` / `avodado.config.*`.
 * Rebuilds are debounced (150 ms) and never crash the server — a bad save
 * shows an in-page diagnostics banner instead.
 *
 * {@link runServe}'s promise resolves only on SIGINT/SIGTERM: `bin.ts` awaits
 * `main()` and then exits, so serve must block until the user stops it.
 */

import { createServer, type ServerResponse } from 'node:http';
import { watch, readdirSync, existsSync, type FSWatcher } from 'node:fs';
import { join, resolve } from 'node:path';
import open from 'open';
import { parseDocument, type Diagnostic } from '@avodado/core';
import { escapeHtml, type ThemeName } from '@avodado/render';
import { loadConfig } from '../io/config.js';
import { loadDocs } from '../io/files.js';
import { loadTheme } from '../io/theme.js';
import { buildSite, type SiteDoc, type SitePage } from './site.js';

/** Inputs to {@link runServe}. */
export interface ServeOptions {
  /** Project root. */
  readonly cwd: string;
  /** Port to listen on. `0` = ephemeral (the actual port is printed). */
  readonly port: number;
  /** Open the browser once the server is up. */
  readonly open: boolean;
}

const DEBOUNCE_MS = 150;
const HEARTBEAT_MS = 25_000;
const MAX_BANNER_ITEMS = 4;

/** Formats one diagnostic for the in-page banner. */
function fmtDiag(d: Diagnostic): string {
  const loc = d.line !== undefined ? `${d.file}:${d.line}` : d.file;
  return `${loc}  ${d.code}  ${d.message}`;
}

/** Fixed-position banner listing the first few diagnostics (or a fatal error). */
function bannerHtml(diagnostics: readonly Diagnostic[], fatal: string | undefined): string {
  const items = fatal !== undefined ? [fatal] : diagnostics.map(fmtDiag);
  if (items.length === 0) return '';
  const isError = fatal !== undefined || diagnostics.some((d) => d.level === 'error');
  const bg = isError ? '#7f1d1d' : '#78350f';
  const shown = items.slice(0, MAX_BANNER_ITEMS);
  const more = items.length - shown.length;
  const rows = shown.map((t) => `<div>${escapeHtml(t)}</div>`).join('');
  const moreRow = more > 0 ? `<div style="opacity:.75">…and ${more} more</div>` : '';
  return (
    `<div id="avo-diagnostics" style="position:fixed;left:0;right:0;bottom:0;z-index:2147483647;` +
    `background:${bg};color:#fff;font:12px/1.6 ui-monospace,Menlo,Consolas,monospace;` +
    `padding:10px 18px;box-shadow:0 -2px 10px rgba(0,0,0,.3);white-space:pre-wrap;">` +
    `<div style="font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-size:10px;` +
    `opacity:.85;margin-bottom:4px;">avodado — ${isError ? 'errors' : 'warnings'}</div>` +
    rows +
    moreRow +
    `</div>`
  );
}

/** All directories under `root`, including `root` itself (for the watch fallback). */
function walkDirs(root: string): string[] {
  const out: string[] = [root];
  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const p = join(dir, e.name);
      out.push(p);
      walk(p);
    }
  };
  walk(root);
  return out;
}

/**
 * Starts the dev server. The returned promise resolves only after SIGINT or
 * SIGTERM (handlers close the server first), keeping the process alive.
 */
export async function runServe(opts: ServeOptions): Promise<void> {
  const config = await loadConfig(opts.cwd);
  const docsDirAbs = resolve(opts.cwd, config.docsDir);

  const state: {
    pages: ReadonlyMap<string, SitePage>;
    diagnostics: readonly Diagnostic[];
    fatal: string | undefined;
  } = { pages: new Map(), diagnostics: [], fatal: undefined };

  const rebuild = async (): Promise<void> => {
    try {
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
        liveReload: true,
      });
      const next = new Map<string, SitePage>();
      for (const p of site.pages) next.set(p.path, p);
      state.pages = next;
      state.diagnostics = site.diagnostics;
      state.fatal = undefined;
    } catch (err) {
      // Never crash on a bad save — keep the last good site and show a banner.
      state.fatal = err instanceof Error ? err.message : String(err);
    }
  };
  await rebuild();

  // ── HTTP server ────────────────────────────────────────────────────────────
  const sseClients = new Set<ServerResponse>();

  const server = createServer((req, res) => {
    const url = (req.url ?? '/').split('?')[0] ?? '/';

    if (url === '/__events') {
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

    let path: string;
    try {
      path = url === '/' ? 'index.html' : decodeURIComponent(url.replace(/^\//, ''));
    } catch {
      path = 'index.html';
    }
    const page = state.pages.get(path);
    if (page === undefined) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404 — no page at ${url}\n`);
      return;
    }
    // Diagnostics banner rides on every page while problems exist.
    const banner = bannerHtml(state.diagnostics, state.fatal);
    const html = banner === '' ? page.html : page.html.replace('<body>', `<body>\n${banner}`);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(html);
  });

  const heartbeat = setInterval(() => {
    for (const c of sseClients) c.write(':heartbeat\n\n');
  }, HEARTBEAT_MS);
  heartbeat.unref();

  const broadcastReload = (): void => {
    for (const c of sseClients) c.write('data: reload\n\n');
  };

  // ── Watching ───────────────────────────────────────────────────────────────
  const dirWatchers = new Map<string, FSWatcher>();
  let rootWatcher: FSWatcher | undefined;
  let projectWatcher: FSWatcher | undefined;
  let usingFallback = false;
  let debounce: NodeJS.Timeout | undefined;

  const onFsEvent = (): void => {
    if (debounce !== undefined) clearTimeout(debounce);
    debounce = setTimeout(() => {
      void (async () => {
        await rebuild();
        if (usingFallback) syncDirWatchers();
        broadcastReload();
      })();
    }, DEBOUNCE_MS);
  };

  /** Per-directory fallback: one non-recursive watcher per subdir, re-walked
   * after every rebuild so new directories get picked up. */
  const syncDirWatchers = (): void => {
    const dirs = new Set(walkDirs(docsDirAbs));
    for (const [dir, w] of dirWatchers) {
      if (!dirs.has(dir)) {
        w.close();
        dirWatchers.delete(dir);
      }
    }
    for (const dir of dirs) {
      if (dirWatchers.has(dir)) continue;
      try {
        const w = watch(dir, onFsEvent);
        w.on('error', () => dirWatchers.delete(dir));
        dirWatchers.set(dir, w);
      } catch {
        /* directory vanished between walk and watch — the next re-walk catches up */
      }
    }
  };

  if (existsSync(docsDirAbs)) {
    try {
      rootWatcher = watch(docsDirAbs, { recursive: true }, onFsEvent);
      // An async watcher error (e.g. the dir vanished) must not crash serve.
      rootWatcher.on('error', () => {
        rootWatcher = undefined;
        usingFallback = true;
        syncDirWatchers();
      });
    } catch {
      // ERR_FEATURE_UNAVAILABLE_ON_PLATFORM (recursive watch unsupported).
      usingFallback = true;
      syncDirWatchers();
    }
  }
  // Theme/config files live at the project root: watch it non-recursively and
  // filter, so files created after startup are covered too.
  try {
    projectWatcher = watch(opts.cwd, (_event, filename) => {
      if (filename === null) return;
      if (/^avodado\.(theme|config)\./.test(filename)) onFsEvent();
    });
    projectWatcher.on('error', () => {
      projectWatcher = undefined;
    });
  } catch {
    /* a project root we can't watch → theme edits need a restart; docs still reload */
  }

  // ── Listen + lifecycle ─────────────────────────────────────────────────────
  await new Promise<void>((ready, fail) => {
    server.once('error', fail);
    server.listen(opts.port, () => {
      server.removeListener('error', fail);
      ready();
    });
  });
  const address = server.address();
  const port = address !== null && typeof address === 'object' ? address.port : opts.port;
  const url = `http://localhost:${port}`;
  console.log(`Serving ${config.docsDir}/ at ${url}  (Ctrl-C to stop)`);
  if (opts.open) await open(url);

  await new Promise<void>((done) => {
    let closed = false;
    const shutdown = (): void => {
      if (closed) return;
      closed = true;
      if (debounce !== undefined) clearTimeout(debounce);
      clearInterval(heartbeat);
      rootWatcher?.close();
      projectWatcher?.close();
      for (const w of dirWatchers.values()) w.close();
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
