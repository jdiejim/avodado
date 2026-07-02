/**
 * Slides assurance gate — e2e over the built bin (same spawn pattern as
 * e2e.test.ts). The slides machinery (fit/split/footers/pagination) has no
 * other automated coverage of a full render, so these tests render the real
 * showcase deck and a family demo deck and assert deck shape + no parse errors.
 */

import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

const BIN = resolve(import.meta.dirname, '../../dist/bin.js');
const DEMO_MD = resolve(import.meta.dirname, '../../templates/demo.md');

function runBin(
  args: readonly string[],
  cwd: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((res, rej) => {
    const child = spawn('node', [BIN, ...args], {
      cwd,
      env: { ...process.env, AVO_PLAIN: '1' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (b: Buffer) => (stdout += b.toString('utf8')));
    child.stderr.on('data', (b: Buffer) => (stderr += b.toString('utf8')));
    child.on('error', rej);
    child.on('close', (code) => res({ code: code ?? -1, stdout, stderr }));
  });
}

const skipIfNotBuilt = !existsSync(BIN);
if (skipIfNotBuilt) {
  console.warn(`[skip] slides gate — built bin not found at ${BIN}. Run: pnpm build`);
}

describe.skipIf(skipIfNotBuilt)('slides gate (built bin)', () => {
  it('avo slides on the full demo doc renders a complete, clean deck', async () => {
    const tmp = join(tmpdir(), `avo-slides-gate-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    const out = join(tmp, 'demo.slides.html');
    try {
      const { code } = await runBin(['slides', DEMO_MD, '-o', out], tmp);
      expect(code).toBe(0);
      const html = readFileSync(out, 'utf8');
      const slideCount = (html.match(/class="docskin slide/g) ?? []).length;
      expect(slideCount, 'the showcase deck should be a full deck').toBeGreaterThanOrEqual(60);
      expect(html).toContain('slide-ft'); // per-slide footers present
      // `parse error:` is the rendered `.err` div text — the CSS comment
      // `/* parse error */` (always present) has no colon.
      expect(html).not.toContain('parse error:');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('avo demo agentic -s renders the agentic family as a clean deck', async () => {
    const tmp = join(tmpdir(), `avo-slides-gate-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    const out = join(tmp, 'agentic.slides.html');
    try {
      const { code } = await runBin(['demo', 'agentic', '-s', '-o', out, '--no-open'], tmp);
      expect(code).toBe(0);
      const html = readFileSync(out, 'utf8');
      expect(html).toContain('AGENT'); // the agentloop frame tag
      const slideCount = (html.match(/class="docskin slide/g) ?? []).length;
      expect(slideCount, 'cover + one slide per agentic block').toBeGreaterThanOrEqual(4);
      expect(html).not.toContain('parse error:');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
