#!/usr/bin/env node
// Scores write-eval runs: `avo check --json` on each doc + usage.json.
//
//   node evals/write/score.mjs <run-dir> [<run-dir> ...]
//
// Copies each doc into a throwaway docs root so `avo check` sees it alone,
// then counts errors, warnings, typed blocks, and mermaid fences.

import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const bin = join(root, 'packages/cli/dist/bin.js');

function checkDoc(md) {
  const dir = mkdtempSync(join(tmpdir(), 'avo-write-eval-'));
  try {
    writeFileSync(join(dir, 'avodado.config.json'), JSON.stringify({ docsDir: 'docs' }));
    execFileSync('mkdir', ['-p', join(dir, 'docs')]);
    writeFileSync(join(dir, 'docs', 'doc.md'), md);
    let out = '';
    try {
      out = execFileSync('node', [bin, 'check', '--json'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (e) {
      out = e.stdout?.toString() ?? '';
    }
    let diags = [];
    try {
      const parsed = JSON.parse(out);
      diags = Array.isArray(parsed) ? parsed : (parsed.diagnostics ?? parsed.files?.flatMap((f) => f.diagnostics ?? []) ?? []);
    } catch {
      diags = [{ code: 'E_SCORER', severity: 'error', message: 'could not parse avo check --json output' }];
    }
    const sev = (d) => d.severity ?? (String(d.code ?? '').startsWith('E_') ? 'error' : 'warning');
    return {
      errors: diags.filter((d) => sev(d) === 'error'),
      warnings: diags.filter((d) => sev(d) !== 'error'),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function countFences(md) {
  const all = md.match(/^```[A-Za-z][\w-]*\s*$/gm) ?? [];
  const mermaid = all.filter((l) => /^```mermaid/.test(l)).length;
  return { blocks: all.length, mermaid };
}

const pad = (s, n) => String(s).padEnd(n);
for (const dir of process.argv.slice(2)) {
  const usagePath = join(dir, 'usage.json');
  const usage = existsSync(usagePath) ? JSON.parse(readFileSync(usagePath, 'utf8')) : {};
  console.log(`\n== ${dir}`);
  console.log(`  ${pad('id', 18)} ${pad('err', 5)} ${pad('warn', 5)} ${pad('blocks', 7)} ${pad('mermaid', 8)} ${pad('tokens', 8)} tools  codes`);
  let te = 0, tw = 0, tb = 0, tm = 0, tt = 0;
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
    const id = f.replace(/\.md$/, '');
    const md = readFileSync(join(dir, f), 'utf8');
    const { errors, warnings } = checkDoc(md);
    const { blocks, mermaid } = countFences(md);
    const u = usage[id] ?? {};
    te += errors.length; tw += warnings.length; tb += blocks; tm += mermaid; tt += u.tokens ?? 0;
    const codes = [...new Set([...errors, ...warnings].map((d) => d.code))].join(',');
    console.log(`  ${pad(id, 18)} ${pad(errors.length, 5)} ${pad(warnings.length, 5)} ${pad(blocks, 7)} ${pad(mermaid, 8)} ${pad(u.tokens ?? '-', 8)} ${pad(u.tools ?? '-', 5)}  ${codes}`);
  }
  console.log(`  ${pad('TOTAL', 18)} ${pad(te, 5)} ${pad(tw, 5)} ${pad(tb, 7)} ${pad(tm, 8)} ${pad(tt, 8)}`);
}
