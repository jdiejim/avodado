#!/usr/bin/env node
// Scores a generation-eval run.
//
//   node evals/generate/score.mjs <project-dir> <run-dir>
//
// <project-dir>/docs/<id>.md      final docs (what the agent handed off)
// <run-dir>/first/<id>.md         first drafts, copied before any `chiltepin check`
// <run-dir>/usage.json            { "<id>": { tokens, tools, seconds } }
//
// Writes <run-dir>/scores.json and prints a table. Every number comes from
// the real CLI (`chiltepin check --json`) or the real renderer, never from a guess.

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const bin = join(root, 'packages/cli/dist/bin.js');
const require = createRequire(join(root, 'packages/core/package.json'));
const YAML = require('yaml');
const core = await import(join(root, 'packages/core/dist/index.js'));
const render = await import(join(root, 'packages/render/dist/index.js'));

const cases = YAML.parse(readFileSync(join(here, 'cases.yaml'), 'utf8'));
const CHROME = new Set(['meta', 'callout', 'prose', 'divider', 'takeaways']);

/** `chiltepin check --json` over one doc in a throwaway project. */
function checkDoc(md) {
  const dir = mkdtempSync(join(tmpdir(), 'chiltepin-gen-eval-'));
  try {
    writeFileSync(join(dir, 'chiltepin.config.json'), JSON.stringify({ docsDir: 'docs' }));
    mkdirSync(join(dir, 'docs'));
    writeFileSync(join(dir, 'docs', 'doc.md'), md);
    let out = '';
    try {
      out = execFileSync('node', [bin, 'check', '--json'], {
        cwd: dir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch (e) {
      out = e.stdout?.toString() ?? '';
    }
    const diags = JSON.parse(out).diagnostics ?? [];
    return {
      errors: diags.filter((d) => d.level === 'error'),
      warnings: diags.filter((d) => d.level !== 'error'),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Renders the doc; a throw is a renderer bug, recorded as such. */
function renderDoc(md, slug) {
  const doc = core.parseDocument(md, slug);
  try {
    return { html: render.renderDocument(doc), error: undefined, doc };
  } catch (e) {
    return { html: undefined, error: e instanceof Error ? e.message : String(e), doc };
  }
}

function blocksOf(doc) {
  return doc.segments.filter((s) => s.kind !== 'markdown').map((s) => s.kind);
}

function selection(c, blocks) {
  const structural = blocks.filter((b) => !CHROME.has(b));
  const hit = (list) => structural.find((b) => list.includes(b));
  if (hit(c.expected)) return { score: 1, tag: 'ok', primary: hit(c.expected) };
  if (hit(c.acceptable ?? [])) return { score: 0.5, tag: 'weak', primary: hit(c.acceptable) };
  if (hit(c.wrong ?? [])) return { score: 0, tag: 'TRAP', primary: hit(c.wrong) };
  return { score: 0, tag: 'off', primary: structural[0] ?? '-' };
}

const [projectDir, runDir] = process.argv.slice(2).map((p) => resolve(p));
if (!projectDir || !runDir) {
  console.error('usage: node evals/generate/score.mjs <project-dir> <run-dir>');
  process.exit(1);
}
const usagePath = join(runDir, 'usage.json');
const usage = existsSync(usagePath) ? JSON.parse(readFileSync(usagePath, 'utf8')) : {};

const rows = [];
for (const c of cases) {
  const finalPath = join(projectDir, 'docs', `${c.id}.md`);
  const firstPath = join(runDir, 'first', `${c.id}.md`);
  if (!existsSync(finalPath)) {
    rows.push({ id: c.id, family: c.family, request: c.request, missing: true });
    continue;
  }
  const finalMd = readFileSync(finalPath, 'utf8');
  const firstMd = existsSync(firstPath) ? readFileSync(firstPath, 'utf8') : undefined;
  const final = checkDoc(finalMd);
  const first = firstMd !== undefined ? checkDoc(firstMd) : undefined;
  const rendered = renderDoc(finalMd, c.id);
  const blocks = blocksOf(rendered.doc);
  const structural = blocks.filter((b) => !CHROME.has(b));
  const sel = selection(c, blocks);
  const u = usage[c.id] ?? {};
  rows.push({
    id: c.id,
    family: c.family,
    request: c.request,
    expected: c.expected,
    selection: sel,
    blocks,
    structuralCount: structural.length,
    lensCount: new Set(structural).size,
    bytes: Buffer.byteLength(finalMd),
    first: first && {
      errors: first.errors.length,
      warnings: first.warnings.length,
      codes: [...new Set(first.errors.map((d) => d.code))],
      diagnostics: first.errors.map((d) => ({ line: d.line, code: d.code, message: d.message })),
    },
    final: {
      errors: final.errors.length,
      warnings: final.warnings.length,
      codes: [...new Set([...final.errors, ...final.warnings].map((d) => d.code))],
      diagnostics: [...final.errors, ...final.warnings].map((d) => ({
        level: d.level,
        line: d.line,
        code: d.code,
        message: d.message,
      })),
    },
    renderError: rendered.error,
    tokens: u.tokens,
    tools: u.tools,
    seconds: u.seconds,
  });
}

const scored = rows.filter((r) => !r.missing);
const summary = {
  cases: cases.length,
  answered: scored.length,
  selectionScore: scored.reduce((s, r) => s + r.selection.score, 0),
  traps: scored.filter((r) => r.selection.tag === 'TRAP').length,
  firstCleanDocs: scored.filter((r) => r.first && r.first.errors === 0).length,
  finalCleanDocs: scored.filter((r) => r.final.errors === 0).length,
  renderFailures: scored.filter((r) => r.renderError !== undefined).length,
  inBudget: scored.filter((r) => r.lensCount >= 2 && r.lensCount <= 5).length,
  tokensMean: Math.round(
    scored.filter((r) => r.tokens).reduce((s, r) => s + r.tokens, 0) /
      Math.max(1, scored.filter((r) => r.tokens).length),
  ),
  secondsMean: Math.round(
    scored.filter((r) => r.seconds).reduce((s, r) => s + r.seconds, 0) /
      Math.max(1, scored.filter((r) => r.seconds).length),
  ),
  firstErrorCodes: Object.entries(
    scored.flatMap((r) => r.first?.codes ?? []).reduce((m, c) => ((m[c] = (m[c] ?? 0) + 1), m), {}),
  ).sort((a, b) => b[1] - a[1]),
};

writeFileSync(join(runDir, 'scores.json'), JSON.stringify({ summary, rows }, null, 2) + '\n');

const pad = (s, n) => String(s ?? '-').padEnd(n);
console.log(
  `  ${pad('id', 20)} ${pad('sel', 6)} ${pad('primary', 10)} ${pad('1st err', 8)} ${pad('fin err', 8)} ${pad('warn', 5)} ${pad('blocks', 7)} ${pad('tokens', 8)} ${pad('tools', 6)} ${pad('sec', 5)} render`,
);
for (const r of rows) {
  if (r.missing) {
    console.log(`  ${pad(r.id, 20)} MISSING`);
    continue;
  }
  console.log(
    `  ${pad(r.id, 20)} ${pad(r.selection.tag, 6)} ${pad(r.selection.primary, 10)} ${pad(r.first?.errors, 8)} ${pad(r.final.errors, 8)} ${pad(r.final.warnings, 5)} ${pad(r.structuralCount, 7)} ${pad(r.tokens, 8)} ${pad(r.tools, 6)} ${pad(r.seconds, 5)} ${r.renderError ? 'FAIL' : 'ok'}`,
  );
}
console.log(
  `\n  selection ${summary.selectionScore}/${summary.answered} · traps ${summary.traps} · first-write clean ${summary.firstCleanDocs}/${summary.answered} · final clean ${summary.finalCleanDocs}/${summary.answered} · render failures ${summary.renderFailures} · in 2–5 lens budget ${summary.inBudget}/${summary.answered} · mean tokens ${summary.tokensMean} · mean ${summary.secondsMean}s`,
);
if (summary.firstErrorCodes.length > 0) {
  console.log(`  first-write error codes: ${summary.firstErrorCodes.map(([c, n]) => `${c}×${n}`).join('  ')}`);
}
