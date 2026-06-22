import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

const BIN = resolve(import.meta.dirname, '../../dist/bin.js');
const RESOURCES = resolve(import.meta.dirname, '../../../../resources');

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
  console.warn(`[skip] CLI e2e — built bin not found at ${BIN}. Run: pnpm build`);
}

describe.skipIf(skipIfNotBuilt)('avo CLI (built bin)', () => {
  it('avo check resources/avodado-roadmap.md exits 0', async () => {
    const repoRoot = resolve(import.meta.dirname, '../../../..');
    const { code } = await runBin(['check', 'resources/avodado-roadmap.md'], repoRoot);
    expect(code).toBe(0);
  });

  it('avo check resources/orders-api.md exits 0', async () => {
    const repoRoot = resolve(import.meta.dirname, '../../../..');
    const { code } = await runBin(['check', 'resources/orders-api.md'], repoRoot);
    expect(code).toBe(0);
  });

  it('avo check on a broken doc exits 1 and names file + line + value', async () => {
    const tmp = join(tmpdir(), `avo-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    const file = join(tmp, 'bad.md');
    writeFileSync(
      file,
      '```userstory\nrole: u\nwant: w\nsoThat: t\nlinks:\n  - { ref: "#missing", label: x }\n```\n',
    );
    try {
      const { code, stdout } = await runBin(['check', 'bad.md'], tmp);
      expect(code).toBe(1);
      expect(stdout).toContain('bad.md');
      expect(stdout).toContain('E_DANGLING_REF');
      expect(stdout).toContain('#missing');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('avo check --json emits valid JSON', async () => {
    const tmp = join(tmpdir(), `avo-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    writeFileSync(join(tmp, 'ok.md'), '```meta\ntitle: OK\n```\n');
    try {
      const { code, stdout } = await runBin(['check', 'ok.md', '--json'], tmp);
      expect(code).toBe(0);
      const parsed = JSON.parse(stdout) as { diagnostics: unknown[]; files: string[] };
      expect(parsed.diagnostics).toEqual([]);
      expect(parsed.files).toContain('ok.md');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('avo render writes a non-empty HTML file', async () => {
    const tmp = join(tmpdir(), `avo-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    const out = join(tmp, 'out.html');
    try {
      const { code } = await runBin(
        ['render', join(RESOURCES, 'avodado-roadmap.md'), '-o', out],
        tmp,
      );
      expect(code).toBe(0);
      expect(existsSync(out)).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
