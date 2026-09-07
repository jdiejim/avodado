#!/usr/bin/env node
// Scores one or more selection-eval runs against requests.yaml.
//
//   node evals/selection/score.mjs <run-dir> [<run-dir> ...]
//
// A run dir holds any number of *.json files, each a JSON array of
//   { id, primary, blocks: [{ type, why, rejected }] }
// as produced by an agent following PROMPT.md. Prints one table per run and,
// with two or more runs, a side-by-side delta.

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, '../../packages/core/package.json'));
const YAML = require('yaml');

const requests = YAML.parse(readFileSync(join(here, 'requests.yaml'), 'utf8'));
const byId = new Map(requests.map((r) => [r.id, r]));

function loadRun(dir) {
  const out = new Map();
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'usage.json')) {
    const arr = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    if (!Array.isArray(arr)) continue;
    for (const a of arr) out.set(a.id, a);
  }
  return out;
}

function scoreOne(req, ans) {
  if (!ans) return { score: 0, tag: 'MISSING', primary: '-', justified: false };
  const p = String(ans.primary ?? '').trim();
  const justified = Array.isArray(ans.blocks) && ans.blocks.every((b) => typeof b.rejected === 'string' && b.rejected.trim().length > 0);
  if (req.expected.includes(p)) return { score: 1, tag: 'ok', primary: p, justified };
  if ((req.acceptable ?? []).includes(p)) return { score: 0.5, tag: 'weak', primary: p, justified };
  if ((req.wrong ?? []).includes(p)) return { score: 0, tag: 'TRAP', primary: p, justified };
  return { score: 0, tag: 'off', primary: p, justified };
}

/**
 * Structural distinctness: two DIFFERENT requests that produce the same
 * ordered list of block types were templated, not designed. Reports the
 * colliding pairs and the fraction of answered requests whose structure is
 * unique. Prose-only blocks (meta, callout, prose, divider) are stripped
 * first — every doc opens the same way, and that is not templating.
 */
const CHROME = new Set(['meta', 'callout', 'prose', 'divider', 'takeaways']);

function structureOf(ans) {
  if (!Array.isArray(ans?.blocks)) return null;
  const sig = ans.blocks
    .map((b) => String(b.type ?? '').trim())
    .filter((t) => t.length > 0 && !CHROME.has(t));
  return sig.length > 0 ? sig.join('>') : null;
}

function distinctness(answers) {
  const byStructure = new Map();
  for (const r of requests) {
    const s = structureOf(answers.get(r.id));
    if (s === null) continue;
    if (!byStructure.has(s)) byStructure.set(s, []);
    byStructure.get(s).push(r.id);
  }
  const answered = [...byStructure.values()].reduce((n, ids) => n + ids.length, 0);
  const collisions = [...byStructure.entries()].filter(([, ids]) => ids.length > 1);
  const templated = collisions.reduce((n, [, ids]) => n + ids.length, 0);
  return {
    answered,
    unique: byStructure.size,
    templated,
    collisions: collisions.map(([sig, ids]) => ({ sig, ids })),
  };
}

function scoreRun(dir) {
  const answers = loadRun(dir);
  const rows = requests.map((r) => ({ id: r.id, ...scoreOne(r, answers.get(r.id)) }));
  const total = rows.reduce((s, r) => s + r.score, 0);
  const traps = rows.filter((r) => r.tag === 'TRAP').length;
  const justified = rows.filter((r) => r.justified).length;
  return { dir, rows, total, traps, justified, distinct: distinctness(answers) };
}

const runs = process.argv.slice(2).map(scoreRun);
if (runs.length === 0) {
  console.error('usage: node evals/selection/score.mjs <run-dir> [...]');
  process.exit(1);
}

const pad = (s, n) => String(s).padEnd(n);
for (const run of runs) {
  console.log(`\n== ${run.dir}`);
  for (const r of run.rows) console.log(`  ${pad(r.id, 20)} ${pad(r.tag, 8)} ${pad(r.primary, 12)} ${r.justified ? '' : 'no-rejected-alt'}`);
  console.log(`  score ${run.total}/${requests.length}  traps ${run.traps}  justified ${run.justified}/${requests.length}`);
  const d = run.distinct;
  console.log(
    `  structure ${d.unique} distinct of ${d.answered} answered · ${d.templated} in a colliding shape`,
  );
  for (const c of d.collisions) console.log(`    same shape: ${c.ids.join(' + ')}  [${c.sig}]`);
}

if (runs.length > 1) {
  console.log('\n== side by side');
  console.log(`  ${pad('id', 20)} ${runs.map((r) => pad(r.dir.split('/').pop(), 14)).join('')}`);
  for (let i = 0; i < requests.length; i++) {
    const id = requests[i].id;
    console.log(`  ${pad(id, 20)} ${runs.map((r) => pad(`${r.rows[i].tag}:${r.rows[i].primary}`, 14)).join('')}`);
  }
  console.log(`  ${pad('TOTAL', 20)} ${runs.map((r) => pad(`${r.total}/${requests.length} t${r.traps}`, 14)).join('')}`);
}
