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
    // Strip runner color hints (GitHub Actions sets CI=true, which flips
    // picocolors on even for piped output) so assertions are deterministic —
    // the binary's own plain-guard is what we're testing.
    const env: NodeJS.ProcessEnv = { ...process.env, AVO_PLAIN: '1' };
    delete env['CI'];
    delete env['FORCE_COLOR'];
    const child = spawn('node', [BIN, ...args], { cwd, env });
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
  }, 30_000);

  it('avo check resources/orders-api.md exits 0', async () => {
    const repoRoot = resolve(import.meta.dirname, '../../../..');
    const { code } = await runBin(['check', 'resources/orders-api.md'], repoRoot);
    expect(code).toBe(0);
  }, 30_000);

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
  }, 30_000);

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
  }, 30_000);

  it('avo build writes index.html + one page and one deck per doc (nested dirs kept)', async () => {
    const tmp = join(tmpdir(), `avo-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(join(tmp, 'docs', 'guides'), { recursive: true });
    writeFileSync(join(tmp, 'docs', 'a.md'), '```meta\ntitle: Doc A\ntag: GUIDE\n```\n');
    writeFileSync(join(tmp, 'docs', 'guides', 'b.md'), '```meta\ntitle: Doc B\n```\n');
    try {
      const { code, stdout } = await runBin(['build'], tmp);
      expect(code).toBe(0);
      // Decks are reported separately — "page(s)" stays index + one per doc.
      expect(stdout).toContain('3 page(s) + 2 deck(s)');
      expect(existsSync(join(tmp, 'dist', 'index.html'))).toBe(true);
      expect(existsSync(join(tmp, 'dist', 'a.html'))).toBe(true);
      expect(existsSync(join(tmp, 'dist', 'a.slides.html'))).toBe(true);
      expect(existsSync(join(tmp, 'dist', 'guides', 'b.html'))).toBe(true);
      expect(existsSync(join(tmp, 'dist', 'guides', 'b.slides.html'))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

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
  }, 30_000);

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
  }, 30_000);

  it('-v, -V, and --version all print the real version (never the 0.0.0 fallback)', async () => {
    for (const flag of ['-v', '-V', '--version']) {
      const r = await runBin([flag], process.cwd());
      expect(r.code).toBe(0);
      expect(r.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
      expect(r.stdout.trim()).not.toBe('0.0.0');
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
  }, 30_000);

  it('avo install cursor installs the skill + Cursor adapter in a scratch dir', async () => {
    const tmp = join(tmpdir(), `avo-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    try {
      const { code, stdout } = await runBin(['install', 'cursor'], tmp);
      expect(code).toBe(0);
      expect(stdout).toContain('Cursor: skill + adapter installed/updated.');
      // canonical skill + the Cursor rule pointer — no per-tool skill copy
      expect(existsSync(join(tmp, '.avodado/skill/SKILL.md'))).toBe(true);
      expect(existsSync(join(tmp, '.cursor/rules/avodado.mdc'))).toBe(true);
      expect(existsSync(join(tmp, '.cursor/skills'))).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('the old adapter aliases are gone — `avo claude` is an unknown command', async () => {
    const repoRoot = resolve(import.meta.dirname, '../../../..');
    for (const alias of ['claude', 'cursor', 'copilot', 'github', 'windsurf']) {
      const { code, stderr } = await runBin([alias], repoRoot);
      expect(code, `avo ${alias} must fail`).not.toBe(0);
      expect(stderr).toContain('unknown command');
    }
  }, 30_000);

  it('avo prompt is gone — unknown command, non-zero exit', async () => {
    const repoRoot = resolve(import.meta.dirname, '../../../..');
    const { code, stderr } = await runBin(['prompt'], repoRoot);
    expect(code).not.toBe(0);
    expect(stderr).toContain('unknown command');
  }, 30_000);

  it('avo --help pipes clean: no ANSI escapes, banner line + grouped epilogue', async () => {
    const repoRoot = resolve(import.meta.dirname, '../../../..');
    const { code, stdout } = await runBin(['--help'], repoRoot);
    expect(code).toBe(0);
    // Piped (non-TTY) output must carry no ANSI escape sequences at all.
    // eslint-disable-next-line no-control-regex
    expect(stdout).not.toMatch(/\u001b\[/);
    expect(stdout).toContain('avodado v'); // the plain one-line banner
    // The four-group command epilogue.
    for (const header of ['WORK', 'OUTPUT', 'DISCOVER', 'SETUP']) {
      expect(stdout).toContain(header);
    }
    expect(stdout).toContain('explore');
    expect(stdout).toContain('New here? avo explore tour');
    expect(stdout).toContain('avo <file.md>');
    // Hidden compat commands stay out of the command listing.
    for (const hidden of ['preview', 'serve', 'demo', 'catalog', 'design', 'tour', 'block', 'template', 'skill']) {
      expect(stdout, `${hidden} must be hidden from top-level help`).not.toMatch(
        new RegExp(`^  ${hidden} `, 'm'),
      );
    }
    // serve stepped back behind studio: absent from the grouped epilogue too
    // (\b keeps words like "server" out of the assertion).
    expect(stdout).not.toMatch(/\bserve\b/);
  }, 30_000);

  it('bare avo (non-TTY) prints help — in a project dir and outside one', async () => {
    const repoRoot = resolve(import.meta.dirname, '../../../..');
    const tmp = join(tmpdir(), `avo-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    try {
      for (const cwd of [repoRoot, tmp]) {
        const { code, stdout } = await runBin([], cwd);
        expect(code).toBe(0);
        expect(stdout).toContain('Usage: avo');
        expect(stdout).toContain('DISCOVER');
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('avo <file.md> shortcut renders the doc (script-safe: writes, does not open)', async () => {
    const tmp = join(tmpdir(), `avo-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(join(tmp, 'docs'), { recursive: true });
    writeFileSync(join(tmp, 'docs', 'hello.md'), '```meta\ntitle: Hello\n```\n');
    try {
      const { code, stdout } = await runBin(['docs/hello.md'], tmp);
      expect(code).toBe(0);
      const m = /Wrote (\S+\.html)/.exec(stdout);
      expect(m, 'should report the rendered file').not.toBeNull();
      expect(existsSync((m as RegExpExecArray)[1] as string)).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('avo new resolves doc templates, block types, and alias spellings', async () => {
    const tmp = join(tmpdir(), `avo-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    try {
      const adr = await runBin(['new', 'adr'], tmp);
      expect(adr.code).toBe(0);
      expect(adr.stdout).toContain('ADR-NNN');

      const seq = await runBin(['new', 'sequence'], tmp);
      expect(seq.code).toBe(0);
      expect(seq.stdout).toContain('```sequence');

      // alias → canonical template + a one-line note (stderr keeps stdout clean)
      const waterfall = await runBin(['new', 'waterfall'], tmp);
      expect(waterfall.code).toBe(0);
      expect(waterfall.stdout).toContain('```chart');
      expect(waterfall.stderr).toContain('now lives in `chart`');

      // bare + non-TTY lists both sections
      const list = await runBin(['new'], tmp);
      expect(list.code).toBe(0);
      expect(list.stdout).toContain('Doc templates:');
      expect(list.stdout).toContain('Blocks:');

      // -o writes a file
      const out = await runBin(['new', 'adr', '-o', 'docs/decisions/001.md'], tmp);
      expect(out.code).toBe(0);
      expect(existsSync(join(tmp, 'docs/decisions/001.md'))).toBe(true);

      // unknown names fail with a pointer to the picker
      const nope = await runBin(['new', 'nope'], tmp);
      expect(nope.code).toBe(2);
      expect(nope.stderr).toContain('Unknown template or block');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('avo explore: bare lists the four flows; subcommands run (AVO_PLAIN, exit 0)', async () => {
    const tmp = join(tmpdir(), `avo-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    try {
      const bare = await runBin(['explore'], tmp);
      expect(bare.code).toBe(0);
      for (const what of ['demo', 'catalog', 'design', 'tour']) {
        expect(bare.stdout).toContain(what);
      }

      const catalog = await runBin(['explore', 'catalog'], tmp);
      expect(catalog.code).toBe(0);
      expect(catalog.stdout).toContain('block types');

      const design = await runBin(['explore', 'design'], tmp);
      expect(design.code).toBe(0);
      expect(design.stdout).toContain('Design patterns');

      const tour = await runBin(['explore', 'tour'], tmp);
      expect(tour.code).toBe(0);
      expect(tour.stdout).toContain('Chapter 1/7');

      const demo = await runBin(['explore', 'demo', '-o', 'demo.html'], tmp);
      expect(demo.code).toBe(0);
      expect(existsSync(join(tmp, 'demo.html'))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('hidden compat commands still work: demo/catalog/design/tour/block/template/skill', async () => {
    const tmp = join(tmpdir(), `avo-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    try {
      const block = await runBin(['block', 'sequence'], tmp);
      expect(block.code).toBe(0);
      expect(block.stdout).toContain('```sequence');

      const template = await runBin(['template', 'list'], tmp);
      expect(template.code).toBe(0);
      expect(template.stdout).toContain('adr');

      const catalog = await runBin(['catalog'], tmp);
      expect(catalog.code).toBe(0);
      expect(catalog.stdout).toContain('block types');

      const design = await runBin(['design'], tmp);
      expect(design.code).toBe(0);
      expect(design.stdout).toContain('Design patterns');

      const tour = await runBin(['tour'], tmp);
      expect(tour.code).toBe(0);
      expect(tour.stdout).toContain('Chapter 1/7');

      const skill = await runBin(['skill'], tmp);
      expect(skill.code).toBe(0);
      expect(skill.stdout).toContain('Avodado');

      const demo = await runBin(['demo', '-o', 'demo.html'], tmp);
      expect(demo.code).toBe(0);
      expect(existsSync(join(tmp, 'demo.html'))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('avo init -y writes at most 30 files (skill once + pointer stubs)', async () => {
    const tmp = join(tmpdir(), `avo-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    try {
      const { code, stdout } = await runBin(['init', '-y'], tmp);
      expect(code).toBe(0);
      const m = /Created (\d+) file\(s\)/.exec(stdout);
      expect(m).not.toBeNull();
      expect(Number((m as RegExpExecArray)[1])).toBeLessThanOrEqual(30);
      // canonical skill once; stubs where tools have a native skill format
      expect(existsSync(join(tmp, '.avodado/skill/reference/blocks/contract.md'))).toBe(true);
      expect(existsSync(join(tmp, '.claude/skills/avodado-docs/SKILL.md'))).toBe(true);
      expect(existsSync(join(tmp, '.claude/skills/avodado-docs/reference'))).toBe(false);
      expect(existsSync(join(tmp, '.cursor/skills'))).toBe(false);
      expect(existsSync(join(tmp, '.windsurf'))).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('avo sync csv prints a ready-to-paste block fence with the suggestion reason on stderr', async () => {
    const tmp = join(tmpdir(), `avo-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    writeFileSync(join(tmp, 'team.csv'), 'name,role,team\nAda,eng,core\nGrace,pm,growth\n');
    try {
      const { code, stdout, stderr } = await runBin(['sync', 'csv', 'team.csv'], tmp);
      expect(code).toBe(0);
      expect(stdout).toContain('```table');
      expect(stdout).toContain('columns: [name, role, team]');
      expect(stdout).toContain('[Ada, eng, core]');
      // The auto-pick reason rides stderr so piped stdout stays a clean fence.
      expect(stderr).toContain('table');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('avo sync csv --out writes a minimal doc that passes avo check', async () => {
    const tmp = join(tmpdir(), `avo-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    writeFileSync(join(tmp, 'sales.csv'), 'month,units\nJan,4\nFeb,7\n');
    try {
      const out = await runBin(
        ['sync', 'csv', 'sales.csv', '--out', 'docs/sales.md', '--title', 'Sales'],
        tmp,
      );
      expect(out.code).toBe(0);
      expect(out.stdout).toContain('Wrote');
      expect(out.stdout).toContain('avo check: clean');
      expect(existsSync(join(tmp, 'docs/sales.md'))).toBe(true);
      const check = await runBin(['check', 'docs/sales.md'], tmp);
      expect(check.code).toBe(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('avo sync csv auto-detects a status column and emits a statustable', async () => {
    const tmp = join(tmpdir(), `avo-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    writeFileSync(join(tmp, 'tasks.csv'), 'task,status\nShip it,done\nPlan next,todo\n');
    try {
      const { code, stdout, stderr } = await runBin(['sync', 'csv', 'tasks.csv'], tmp);
      expect(code).toBe(0);
      expect(stdout).toContain('```statustable');
      expect(stdout).toContain('status: done');
      expect(stderr).toContain('statustable');
      expect(stderr).toContain('status column');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('avo sync csv exits 1 on a broken CSV (unterminated quote)', async () => {
    const tmp = join(tmpdir(), `avo-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    writeFileSync(join(tmp, 'broken.csv'), 'a,b\n"unclosed,1\n');
    try {
      const { code, stderr } = await runBin(['sync', 'csv', 'broken.csv'], tmp);
      expect(code).toBe(1);
      expect(stderr).toContain('unterminated');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

  it('avo sync csv --delimiter overrides auto-detection', async () => {
    const tmp = join(tmpdir(), `avo-e2e-${randomBytes(6).toString('hex')}`);
    mkdirSync(tmp, { recursive: true });
    // Auto-detect would pick ',' (2 commas vs 1 semicolon on line 1).
    writeFileSync(join(tmp, 'semi.csv'), 'a,b;c,d\n1,2;3,4\n');
    try {
      const forced = await runBin(
        ['sync', 'csv', 'semi.csv', '--delimiter', ';', '--block', 'table'],
        tmp,
      );
      expect(forced.code).toBe(0);
      expect(forced.stdout).toContain('"a,b"'); // one field, not two
      const bad = await runBin(['sync', 'csv', 'semi.csv', '--delimiter', '|'], tmp);
      expect(bad.code).toBe(2);
      expect(bad.stderr).toContain('unknown delimiter');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);

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
  }, 30_000);
});
