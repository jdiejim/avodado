import { describe, expect, it } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { get } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';

const BIN = resolve(import.meta.dirname, '../../dist/bin.js');

const skipIfNotBuilt = !existsSync(BIN);
if (skipIfNotBuilt) {
  console.warn(`[skip] studio e2e — built bin not found at ${BIN}. Run: pnpm build`);
}

const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

const FIXTURE_DOC =
  '```meta\ntitle: Getting started\nsubtitle: A fixture doc\n```\n\nHello from the fixture.\n';

/** Waits for the printed URL and extracts the (ephemeral) port. */
function waitForPort(child: ChildProcessWithoutNullStreams): Promise<number> {
  return new Promise((res, rej) => {
    let out = '';
    const timer = setTimeout(
      () => rej(new Error(`studio never printed a port. Output so far:\n${out}`)),
      10_000,
    );
    child.stdout.on('data', (b: Buffer) => {
      out += b.toString('utf8');
      const m = /localhost:(\d+)/.exec(out);
      if (m !== null) {
        clearTimeout(timer);
        res(Number(m[1]));
      }
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      rej(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      rej(new Error(`studio exited early (code ${String(code)}). Output:\n${out}`));
    });
  });
}

interface Studio {
  readonly tmp: string;
  readonly port: number;
  readonly child: ChildProcessWithoutNullStreams;
  /** SIGINT the server, assert a clean (code 0) exit, remove the tmp project. */
  stop(): Promise<void>;
}

/** Scaffolds a tmp project with one fixture doc and spawns `avo studio` on it. */
async function startStudio(opts?: {
  /** Extra scaffolding inside the tmp project before the server starts. */
  before?: (tmp: string) => void;
  /** Isolate global theme state: HOME points at `<tmp>/home` (pre-created). */
  isolateHome?: boolean;
}): Promise<Studio> {
  const tmp = join(tmpdir(), `avo-studio-${randomBytes(6).toString('hex')}`);
  mkdirSync(join(tmp, 'docs'), { recursive: true });
  writeFileSync(join(tmp, 'docs', 'getting-started.md'), FIXTURE_DOC);
  opts?.before?.(tmp);

  const env: NodeJS.ProcessEnv = { ...process.env, AVO_PLAIN: '1' };
  delete env['CI'];
  delete env['FORCE_COLOR'];
  if (opts?.isolateHome === true) {
    mkdirSync(join(tmp, 'home', '.avodado'), { recursive: true });
    env['HOME'] = join(tmp, 'home');
  }
  const child = spawn('node', [BIN, 'studio', '--no-open', '--port', '0'], { cwd: tmp, env });
  try {
    const port = await waitForPort(child);
    return {
      tmp,
      port,
      child,
      stop: async (): Promise<void> => {
        try {
          const started = Date.now();
          const exit = new Promise<number | null>((res) => child.once('close', res));
          child.kill('SIGINT');
          const code = await exit;
          expect(Date.now() - started).toBeLessThanOrEqual(2_000);
          expect(code).toBe(0);
        } finally {
          if (child.exitCode === null) child.kill('SIGKILL');
          rmSync(tmp, { recursive: true, force: true });
        }
      },
    };
  } catch (err) {
    if (child.exitCode === null) child.kill('SIGKILL');
    rmSync(tmp, { recursive: true, force: true });
    throw err;
  }
}

const api = (port: number, path: string): string => `http://127.0.0.1:${port}${path}`;

describe.skipIf(skipIfNotBuilt)('avo studio (built bin)', () => {
  it('GET /api/meta and /api/docs describe the project', async () => {
    const s = await startStudio();
    try {
      const metaRes = await fetch(api(s.port, '/api/meta'));
      expect(metaRes.status).toBe(200);
      const meta = (await metaRes.json()) as { version: string; docsDir: string };
      expect(meta.version).toMatch(/^\d+\.\d+\.\d+/);
      // '0.0.0' is cliVersion()'s can't-find-my-package fallback — seeing it
      // means the version walk broke (as it did after the avodado rename).
      expect(meta.version).not.toBe('0.0.0');
      expect(meta.docsDir).toBe('docs');

      const docsRes = await fetch(api(s.port, '/api/docs'));
      expect(docsRes.status).toBe(200);
      const docs = (await docsRes.json()) as Array<{
        slug: string;
        file: string;
        title: string;
        mtimeMs: number;
      }>;
      expect(docs).toHaveLength(1);
      expect(docs[0]).toMatchObject({
        slug: 'getting-started',
        file: join('docs', 'getting-started.md'),
        title: 'Getting started',
      });
      expect(docs[0]?.mtimeMs).toBeGreaterThan(0);
    } finally {
      await s.stop();
    }
  }, 20_000);

  it('GET /api/doc/<slug> returns source + stable hash; missing slug 404s', async () => {
    const s = await startStudio();
    try {
      const res = await fetch(api(s.port, '/api/doc/getting-started'));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { source: string; hash: string; mtimeMs: number };
      expect(body.source).toBe(FIXTURE_DOC);
      expect(body.hash).toBe(sha256(FIXTURE_DOC));

      const missing = await fetch(api(s.port, '/api/doc/nope'));
      expect(missing.status).toBe(404);
      expect(((await missing.json()) as { error: string }).error).toBeTruthy();
    } finally {
      await s.stop();
    }
  }, 20_000);

  it('PUT with the correct baseHash writes atomically and GET agrees', async () => {
    const s = await startStudio();
    try {
      const edited = FIXTURE_DOC + '\nAn edit from the studio.\n';
      const res = await fetch(api(s.port, '/api/doc/getting-started'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: edited, baseHash: sha256(FIXTURE_DOC) }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { hash: string; mtimeMs: number };
      expect(body.hash).toBe(sha256(edited));

      // The file on disk is the source of truth — check it directly…
      expect(readFileSync(join(s.tmp, 'docs', 'getting-started.md'), 'utf8')).toBe(edited);
      // …and a fresh GET agrees.
      const after = (await (await fetch(api(s.port, '/api/doc/getting-started'))).json()) as {
        source: string;
        hash: string;
      };
      expect(after.source).toBe(edited);
      expect(after.hash).toBe(body.hash);
    } finally {
      await s.stop();
    }
  }, 20_000);

  it('PUT with a stale baseHash 409s with the current state; ?force=1 overrides', async () => {
    const s = await startStudio();
    try {
      const mine = FIXTURE_DOC + '\nMine.\n';
      const stale = await fetch(api(s.port, '/api/doc/getting-started'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: mine, baseHash: sha256('something else entirely') }),
      });
      expect(stale.status).toBe(409);
      const conflict = (await stale.json()) as { currentHash: string; currentSource: string };
      expect(conflict.currentHash).toBe(sha256(FIXTURE_DOC));
      expect(conflict.currentSource).toBe(FIXTURE_DOC);

      const forced = await fetch(api(s.port, '/api/doc/getting-started?force=1'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: mine, baseHash: sha256('something else entirely') }),
      });
      expect(forced.status).toBe(200);
      expect(readFileSync(join(s.tmp, 'docs', 'getting-started.md'), 'utf8')).toBe(mine);
    } finally {
      await s.stop();
    }
  }, 20_000);

  it('PUT to a new nested slug (no baseHash) creates the file and its directories', async () => {
    const s = await startStudio();
    try {
      const source = '```meta\ntitle: Deep doc\n```\n\nBorn in the studio.\n';
      const res = await fetch(api(s.port, '/api/doc/guides/advanced/deep'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      });
      expect(res.status).toBe(200);
      const file = join(s.tmp, 'docs', 'guides', 'advanced', 'deep.md');
      expect(existsSync(file)).toBe(true);
      expect(readFileSync(file, 'utf8')).toBe(source);
    } finally {
      await s.stop();
    }
  }, 20_000);

  it('rejects path traversal out of the docs dir', async () => {
    const s = await startStudio();
    try {
      const secret = `top secret ${randomBytes(8).toString('hex')}`;
      writeFileSync(join(s.tmp, 'secret.md'), secret);
      // %2f keeps the ../ segments inside a single path component on the wire.
      const res = await fetch(api(s.port, '/api/doc/..%2f..%2fsecret'));
      expect(res.status).not.toBe(200);
      expect([400, 403, 404]).toContain(res.status);
      expect(await res.text()).not.toContain(secret);

      const put = await fetch(api(s.port, '/api/doc/..%2fescaped'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'nope' }),
      });
      expect(put.status).toBe(403);
      expect(existsSync(join(s.tmp, 'escaped.md'))).toBe(false);
    } finally {
      await s.stop();
    }
  }, 20_000);

  it('POST /api/export/pdf validates input (GET → 405, missing html → 400)', async () => {
    // The happy path launches Chromium — covered by pdf.test.ts, gated on the
    // browser being installed. Here we only assert the route's guards, which
    // never touch Playwright.
    const s = await startStudio();
    try {
      const wrongMethod = await fetch(api(s.port, '/api/export/pdf'));
      expect(wrongMethod.status).toBe(405);

      const badBody = await fetch(api(s.port, '/api/export/pdf'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notHtml: true }),
      });
      expect(badBody.status).toBe(400);
      expect(((await badBody.json()) as { error: string }).error).toMatch(/html/i);
    } finally {
      await s.stop();
    }
  }, 20_000);

  it('POST /api/theme writes a theme file (and validates name/base/method)', async () => {
    const s = await startStudio();
    try {
      const ok = await fetch(api(s.port, '/api/theme'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Sunset Vibes',
          base: 'minimal',
          colors: { primary: '#ff5722', accent: '#ffc107' },
          fonts: { display: 'Georgia, serif' },
          scope: 'project',
        }),
      });
      expect(ok.status).toBe(200);
      const body = (await ok.json()) as { slug: string; path: string };
      expect(body.slug).toBe('sunset-vibes');

      // The file lands in the project's .avodado/themes with a friendly shape.
      const themePath = join(s.tmp, '.avodado', 'themes', 'sunset-vibes.theme.json');
      expect(existsSync(themePath)).toBe(true);
      const theme = JSON.parse(readFileSync(themePath, 'utf8')) as {
        name: string;
        theme: string;
        colors: Record<string, string>;
      };
      expect(theme).toMatchObject({ name: 'Sunset Vibes', theme: 'minimal' });
      expect(theme.colors.primary).toBe('#ff5722');

      // Guards: wrong method, missing name, bad base.
      expect((await fetch(api(s.port, '/api/theme'))).status).toBe(405);
      const noName = await fetch(api(s.port, '/api/theme'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base: 'minimal' }),
      });
      expect(noName.status).toBe(400);
      const badBase = await fetch(api(s.port, '/api/theme'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'X', base: 'not-a-theme' }),
      });
      expect(badBase.status).toBe(400);
    } finally {
      await s.stop();
    }
  }, 20_000);

  it('streams a typed fs event over /__events when a doc changes on disk', async () => {
    const s = await startStudio();
    try {
      const events = await new Promise<string>((res, rej) => {
        const timer = setTimeout(() => rej(new Error(`no fs event. Stream so far:\n${buf}`)), 5_000);
        let buf = '';
        const req = get(api(s.port, '/__events'), (stream) => {
          stream.on('data', (b: Buffer) => {
            buf += b.toString('utf8');
            if (buf.includes(':connected') && !buf.includes('"type"')) {
              // Connected — now edit the doc externally (an "outside" writer).
              writeFileSync(join(s.tmp, 'docs', 'getting-started.md'), FIXTURE_DOC + '\nMore.\n');
            }
            if (buf.includes('"type":"fs"')) {
              clearTimeout(timer);
              req.destroy();
              res(buf);
            }
          });
        });
        req.on('error', () => {
          /* destroyed on purpose once the event arrives */
        });
      });
      expect(events).toContain('"type":"fs"');
      expect(events).toContain('"slug":"getting-started"');
      expect(events).toContain(`"hash":"${sha256(FIXTURE_DOC + '\nMore.\n')}"`);
    } finally {
      await s.stop();
    }
  }, 20_000);

  const EMBER_THEME =
    JSON.stringify({ name: 'Ember', theme: 'dark', colors: { primary: '#ff5a1f', paper: '#1a1412' } }) + '\n';

  it('GET /api/meta resolves an installed theme referenced by name and lists saved themes', async () => {
    const s = await startStudio({
      isolateHome: true,
      before: (tmp) => {
        mkdirSync(join(tmp, '.avodado', 'themes'), { recursive: true });
        writeFileSync(join(tmp, '.avodado', 'themes', 'ember.theme.json'), EMBER_THEME);
        writeFileSync(join(tmp, 'avodado.theme.json'), '{ "theme": "ember" }\n');
      },
    });
    try {
      const meta = (await (await fetch(api(s.port, '/api/meta'))).json()) as {
        theme?: string;
        themeVars?: Record<string, string>;
        active?: { kind: string; id?: string; name?: string };
        savedThemes?: Array<{ slug: string; name: string; scope: string; theme?: string; themeVars?: Record<string, string> }>;
      };
      // The reference resolves to the saved theme's base + vars…
      expect(meta.theme).toBe('dark');
      expect(meta.themeVars?.['--navy']).toBe('#ff5a1f');
      expect(meta.themeVars?.['--white']).toBe('#1a1412');
      // …meta says WHICH theme is active…
      expect(meta.active).toMatchObject({ kind: 'saved', id: 'ember', name: 'Ember' });
      // …and lists it (resolved) for the studio picker.
      const ember = meta.savedThemes?.find((t) => t.slug === 'ember');
      expect(ember).toMatchObject({ name: 'Ember', scope: 'project', theme: 'dark' });
      expect(ember?.themeVars?.['--navy']).toBe('#ff5a1f');
    } finally {
      await s.stop();
    }
  }, 20_000);

  it('streams {"type":"meta"} for project, installed, and global theme changes', async () => {
    const s = await startStudio({ isolateHome: true });
    try {
      // A tiny SSE meta-event counter: waitFor(n) resolves once ≥ n arrived.
      let count = 0;
      const listeners = new Set<() => void>();
      let onConnected!: () => void;
      const ready = new Promise<void>((r) => (onConnected = r));
      const req = get(api(s.port, '/__events'), (stream) => {
        stream.on('data', (b: Buffer) => {
          const text = b.toString('utf8');
          if (text.includes(':connected')) onConnected();
          const n = text.split('"type":"meta"').length - 1;
          if (n > 0) {
            count += n;
            for (const l of [...listeners]) l();
          }
        });
      });
      req.on('error', () => {
        /* destroyed on purpose at the end */
      });
      const waitFor = (target: number, label: string): Promise<void> =>
        new Promise((res, rej) => {
          const timer = setTimeout(
            () => rej(new Error(`${label}: got ${count} meta events, wanted ${target}`)),
            8_000,
          );
          const check = (): void => {
            if (count >= target) {
              clearTimeout(timer);
              listeners.delete(check);
              res();
            }
          };
          listeners.add(check);
          check();
        });
      await ready;

      // 1. `avo theme <name>` writes the project's avodado.theme.json.
      writeFileSync(join(s.tmp, 'avodado.theme.json'), '{ "theme": "dark" }\n');
      await waitFor(1, 'project theme change');

      // 2. `avo theme install --local` creates .avodado/themes/ + a file —
      // the dir did not exist when the watcher started.
      const after = count;
      mkdirSync(join(s.tmp, '.avodado', 'themes'), { recursive: true });
      writeFileSync(join(s.tmp, '.avodado', 'themes', 'ember.theme.json'), EMBER_THEME);
      await waitFor(after + 1, 'local theme install');

      // 3. `avo theme <name> --global` writes ~/.avodado/avodado.theme.json.
      const after2 = count;
      writeFileSync(join(s.tmp, 'home', '.avodado', 'avodado.theme.json'), '{ "theme": "soft" }\n');
      await waitFor(after2 + 1, 'global theme change');

      req.destroy();
    } finally {
      await s.stop();
    }
  }, 30_000);

  it('mounts the built site under /site/ — index, doc page, and deck, with live reload', async () => {
    const s = await startStudio();
    try {
      // /site/ → the index card grid, carrying the live-reload script that
      // points at /__events (same origin here — no page changes needed).
      const index = await fetch(api(s.port, '/site/'));
      expect(index.status).toBe(200);
      const indexHtml = await index.text();
      expect(indexHtml).toContain('idx-grid');
      expect(indexHtml).toContain('getting-started.html');
      expect(indexHtml).toContain("new EventSource('/__events')");

      // /site/<slug>.html → the doc page with sidebar nav + Doc|Slides toggle.
      const page = await fetch(api(s.port, '/site/getting-started.html'));
      expect(page.status).toBe(200);
      const pageHtml = await page.text();
      expect(pageHtml).toContain('Getting started');
      expect(pageHtml).toContain('site-nav');
      expect(pageHtml).toContain('view-toggle');
      expect(pageHtml).toContain('getting-started.slides.html'); // deck link is relative
      expect(pageHtml).toContain("new EventSource('/__events')");

      // /site/<slug>.slides.html → the companion deck with the back pill.
      const deck = await fetch(api(s.port, '/site/getting-started.slides.html'));
      expect(deck.status).toBe(200);
      const deckHtml = await deck.text();
      expect(deckHtml).toContain('deck-doc-link');
      expect(deckHtml).toContain("new EventSource('/__events')");

      // Unknown site paths 404 without touching the SPA fallback.
      expect((await fetch(api(s.port, '/site/nope.html'))).status).toBe(404);
    } finally {
      await s.stop();
    }
  }, 20_000);

  it('site pages rebuild after a docs change on disk (debounced invalidation)', async () => {
    const s = await startStudio();
    try {
      // Prime the lazy cache first.
      const before = await (await fetch(api(s.port, '/site/getting-started.html'))).text();
      expect(before).not.toContain('Edited for the site test.');

      writeFileSync(
        join(s.tmp, 'docs', 'getting-started.md'),
        FIXTURE_DOC + '\nEdited for the site test.\n',
      );
      // The invalidation is debounced fs-event driven — poll, bounded.
      let after = '';
      for (let i = 0; i < 40 && !after.includes('Edited for the site test.'); i++) {
        await new Promise((r) => setTimeout(r, 250));
        after = await (await fetch(api(s.port, '/site/getting-started.html'))).text();
      }
      expect(after).toContain('Edited for the site test.');
    } finally {
      await s.stop();
    }
  }, 20_000);

  it('nested slugs stay under /site/ with relative links back to the root', async () => {
    const s = await startStudio();
    try {
      const source = '```meta\ntitle: Deep guide\n```\n\nNested content.\n';
      const put = await fetch(api(s.port, '/api/doc/guides/deep'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      });
      expect(put.status).toBe(200);

      // Poll: the PUT lands through the same debounced invalidation path.
      let html = '';
      for (let i = 0; i < 40; i++) {
        const res = await fetch(api(s.port, '/site/guides/deep.html'));
        if (res.status === 200) {
          html = await res.text();
          break;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      expect(html).toContain('Deep guide');
      // Nav links climb back to the site root relatively — they stay under /site/.
      expect(html).toContain('href="../index.html"');
      // The deck sibling is a plain basename link (same directory).
      expect(html).toContain('deep.slides.html');
      expect((await fetch(api(s.port, '/site/guides/deep.slides.html'))).status).toBe(200);
    } finally {
      await s.stop();
    }
  }, 30_000);

  it('serves the studio app at / (or the fallback page when assets are missing)', async () => {
    // @avodado/studio ships built static assets; when its dist is present the
    // server must serve the real app, and degrade to a fallback page otherwise
    // — never a 500, and the API stays usable either way.
    const studioDist = resolve(
      import.meta.dirname,
      '../../node_modules/@avodado/studio/dist/app/index.html',
    );
    const s = await startStudio();
    try {
      const res = await fetch(api(s.port, '/'));
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html.toLowerCase()).toContain('studio');
      if (existsSync(studioDist)) {
        // The built SPA, not the fallback: it loads its bundled script.
        expect(html).toContain('<script');
      }
      expect((await fetch(api(s.port, '/api/meta'))).status).toBe(200);
    } finally {
      await s.stop(); // stop() also asserts the clean SIGINT exit (code 0)
    }
  }, 20_000);
});
