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

  it('avo build writes index.html + one page per doc (nested dirs kept)', async () => {
    const tmp = join(tmpdir(), `avo-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(join(tmp, 'docs', 'guides'), { recursive: true });
    writeFileSync(join(tmp, 'docs', 'a.md'), '```meta\ntitle: Doc A\ntag: GUIDE\n```\n');
    writeFileSync(join(tmp, 'docs', 'guides', 'b.md'), '```meta\ntitle: Doc B\n```\n');
    try {
      const { code, stdout } = await runBin(['build'], tmp);
      expect(code).toBe(0);
      expect(stdout).toContain('3 page(s)');
      expect(existsSync(join(tmp, 'dist', 'index.html'))).toBe(true);
      expect(existsSync(join(tmp, 'dist', 'a.html'))).toBe(true);
      expect(existsSync(join(tmp, 'dist', 'guides', 'b.html'))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('avo build --out overrides the output dir and warns (exit 0) on diagnostics', async () => {
    const tmp = join(tmpdir(), `avo-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(join(tmp, 'docs'), { recursive: true });
    // Dangling ref → a warning at build time, not a failure.
    writeFileSync(
      join(tmp, 'docs', 'a.md'),
      '```userstory\nrole: u\nwant: w\nsoThat: t\nlinks:\n  - { ref: "#missing", label: x }\n```\n',
    );
    try {
      const { code, stderr } = await runBin(['build', '--out', 'site'], tmp);
      expect(code).toBe(0);
      expect(stderr).toContain('E_DANGLING_REF');
      expect(existsSync(join(tmp, 'site', 'index.html'))).toBe(true);
      expect(existsSync(join(tmp, 'site', 'a.html'))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('avo html writes a non-empty HTML file', async () => {
    const tmp = join(tmpdir(), `avo-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    const out = join(tmp, 'out.html');
    try {
      const { code } = await runBin(
        ['html', join(RESOURCES, 'avodado-roadmap.md'), '-o', out],
        tmp,
      );
      expect(code).toBe(0);
      expect(existsSync(out)).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('avo mcp prints client setup snippets', async () => {
    const repoRoot = resolve(import.meta.dirname, '../../../..');
    const { code, stdout } = await runBin(['mcp'], repoRoot);
    expect(code).toBe(0);
    expect(stdout).toContain('claude mcp add avodado -- npx -y @avodado/mcp');
    expect(stdout).toContain('"mcpServers"');
    expect(stdout).toContain('"command": "npx"');
    expect(stdout).toContain('Cursor');
  });

  it('avo install cursor installs the skill + Cursor adapter in a scratch dir', async () => {
    const tmp = join(tmpdir(), `avo-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    try {
      const { code, stdout } = await runBin(['install', 'cursor'], tmp);
      expect(code).toBe(0);
      expect(stdout).toContain('Cursor: skill + adapter installed/updated.');
      expect(existsSync(join(tmp, '.cursor/skills/avodado-docs/SKILL.md'))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('the old adapter aliases are gone — `avo claude` is an unknown command', async () => {
    const repoRoot = resolve(import.meta.dirname, '../../../..');
    for (const alias of ['claude', 'cursor', 'copilot', 'github', 'windsurf']) {
      const { code, stderr } = await runBin([alias], repoRoot);
      expect(code, `avo ${alias} must fail`).not.toBe(0);
      expect(stderr).toContain('unknown command');
    }
  });

  it('avo prompt is gone — unknown command, non-zero exit', async () => {
    const repoRoot = resolve(import.meta.dirname, '../../../..');
    const { code, stderr } = await runBin(['prompt'], repoRoot);
    expect(code).not.toBe(0);
    expect(stderr).toContain('unknown command');
  });

  it('avo --help pipes clean: no ANSI escapes, banner line + grouped epilogue', async () => {
    const repoRoot = resolve(import.meta.dirname, '../../../..');
    const { code, stdout } = await runBin(['--help'], repoRoot);
    expect(code).toBe(0);
    // Piped (non-TTY) output must carry no ANSI escape sequences at all.
    // eslint-disable-next-line no-control-regex
    expect(stdout).not.toMatch(/\u001b\[/);
    expect(stdout).toContain('avodado v'); // the plain one-line banner
    // The grouped command epilogue.
    for (const header of ['AUTHOR', 'RENDER', 'PRESENT', 'AI', 'CONFIG']) {
      expect(stdout).toContain(header);
    }
    expect(stdout).toContain('tour');
  });

  it('avo tour (non-TTY / AVO_PLAIN) prints the static 7-chapter walkthrough', async () => {
    const repoRoot = resolve(import.meta.dirname, '../../../..');
    const { code, stdout } = await runBin(['tour'], repoRoot);
    expect(code).toBe(0);
    for (let n = 1; n <= 7; n++) {
      expect(stdout).toContain(`Chapter ${n}/7`);
    }
    // The commands are the star: at least 5 distinct `$ avo …` command lines.
    const avoCmds = new Set(
      stdout
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('$ avo ')),
    );
    expect(avoCmds.size).toBeGreaterThanOrEqual(5);
  });
});
