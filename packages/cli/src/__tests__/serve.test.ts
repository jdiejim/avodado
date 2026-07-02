import { describe, expect, it } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

const BIN = resolve(import.meta.dirname, '../../dist/bin.js');

const skipIfNotBuilt = !existsSync(BIN);
if (skipIfNotBuilt) {
  console.warn(`[skip] serve e2e — built bin not found at ${BIN}. Run: pnpm build`);
}

/** Waits for the printed URL and extracts the (ephemeral) port. */
function waitForPort(child: ChildProcessWithoutNullStreams): Promise<number> {
  return new Promise((res, rej) => {
    let out = '';
    const timer = setTimeout(
      () => rej(new Error(`serve never printed a port. Output so far:\n${out}`)),
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
      rej(new Error(`serve exited early (code ${String(code)}). Output:\n${out}`));
    });
  });
}

describe.skipIf(skipIfNotBuilt)('avo serve (built bin)', () => {
  it('serves the site from memory, injects live reload, and exits cleanly on SIGINT', async () => {
    const tmp = join(tmpdir(), `avo-serve-${randomBytes(6).toString('hex')}`);
    mkdirSync(join(tmp, 'docs'), { recursive: true });
    writeFileSync(
      join(tmp, 'docs', 'getting-started.md'),
      '```meta\ntitle: Getting started\nsubtitle: A fixture doc\n```\n\nHello from the fixture.\n',
    );

    const child = spawn('node', [BIN, 'serve', '--no-open', '--port', '0'], {
      cwd: tmp,
      env: { ...process.env, AVO_PLAIN: '1' },
    });
    try {
      const port = await waitForPort(child);

      // `/` → the index page.
      const indexRes = await fetch(`http://127.0.0.1:${port}/`);
      expect(indexRes.status).toBe(200);
      const indexHtml = await indexRes.text();
      expect(indexHtml).toContain('Getting started');
      expect(indexHtml).toContain('idx-card');

      // `/<slug>.html` → the doc page, with the injected EventSource script.
      const pageRes = await fetch(`http://127.0.0.1:${port}/getting-started.html`);
      expect(pageRes.status).toBe(200);
      const pageHtml = await pageRes.text();
      expect(pageHtml).toContain(`new EventSource('/__events').onmessage=()=>location.reload()`);
      expect(pageHtml).toContain('Hello from the fixture.');

      // SIGINT → clean exit within 2s.
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
  }, 20_000);
});
