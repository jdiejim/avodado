#!/usr/bin/env node
// Builds one self-contained HTML report for a generation-eval run: the
// summary tiles, the per-case table, the findings recorded for the run, and
// every handed-off document rendered by the real renderer inside its own
// frame, with the first-draft diagnostics the agent fixed.
//
//   node evals/generate/report.mjs <project-dir> <run-dir> [<out.html>]
//
// Run score.mjs first; this reads <run-dir>/scores.json and, when present,
// <run-dir>/notes.json — `[{ "title", "text" }]` — the human findings of the
// run (bugs found, fixes shipped). The output has no <html>/<head>/<body>
// wrapper so it publishes as an Artifact unchanged; browsers render it as is.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const core = await import(join(root, 'packages/core/dist/index.js'));
const render = await import(join(root, 'packages/render/dist/index.js'));

const [projectDir, runDir, outArg] = process.argv.slice(2);
if (!projectDir || !runDir) {
  console.error('usage: node evals/generate/report.mjs <project-dir> <run-dir> [<out.html>]');
  process.exit(1);
}
const out = resolve(outArg ?? join(runDir, 'report.html'));
const { summary, rows } = JSON.parse(readFileSync(join(runDir, 'scores.json'), 'utf8'));
const notesPath = join(runDir, 'notes.json');
const notes = existsSync(notesPath) ? JSON.parse(readFileSync(notesPath, 'utf8')) : [];
const runName = resolve(runDir).split('/').pop();
const CHROME = new Set(['meta', 'callout', 'prose', 'divider', 'takeaways']);

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function frameFor(id) {
  const md = readFileSync(join(resolve(projectDir), 'docs', `${id}.md`), 'utf8');
  try {
    return render.renderDocument(core.parseDocument(md, id));
  } catch (e) {
    return `<pre style="color:#9a3f34;padding:2rem">Renderer threw: ${esc(e instanceof Error ? e.message : String(e))}</pre>`;
  }
}

const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n));
const tile = (n, label, tone = '') =>
  `<div class="tile ${tone}"><div class="n">${esc(n)}</div><div class="l">${esc(label)}</div></div>`;
const tag = (t) => `<span class="tag ${esc(t)}">${esc(t)}</span>`;
const codes = (list) => list.map((b) => `<code>${esc(b)}</code>`).join(' ');

const tableRows = rows
  .map((r) => {
    if (r.missing) return `<tr><td>${esc(r.id)}</td><td colspan="9" class="bad">no document written</td></tr>`;
    const structural = r.blocks.filter((b) => !CHROME.has(b));
    return `<tr>
      <td><a href="#doc-${esc(r.id)}">${esc(r.id)}</a><div class="sub">${esc(r.family)}</div></td>
      <td>${tag(r.selection.tag)} <code>${esc(r.selection.primary)}</code><div class="sub">wanted ${codes(r.expected)}</div></td>
      <td class="num ${r.first?.errors ? 'bad' : 'good'}">${r.first ? r.first.errors : '–'}</td>
      <td class="num ${r.final.errors ? 'bad' : 'good'}">${r.final.errors}</td>
      <td class="num">${r.final.warnings}</td>
      <td class="${r.lensCount >= 2 && r.lensCount <= 5 ? '' : 'warn'}"><span class="num">${r.structuralCount}</span> <span class="sub">${r.lensCount} lenses</span><div class="sub">${codes([...new Set(structural)])}</div></td>
      <td class="num">${r.tokens ? k(r.tokens) : '–'}</td>
      <td class="num">${r.tools ?? '–'}</td>
      <td class="num">${r.seconds ? Math.round(r.seconds) + 's' : '–'}</td>
      <td class="${r.renderError ? 'bad' : 'good'}">${r.renderError ? 'threw' : 'ok'}</td>
    </tr>`;
  })
  .join('\n');

const docSections = rows
  .filter((r) => !r.missing)
  .map((r) => {
    const firstDiags = (r.first?.diagnostics ?? [])
      .map((d) => `<li><code>${esc(d.code)}</code> line ${esc(d.line)} — ${esc(d.message)}</li>`)
      .join('');
    const finalDiags = r.final.diagnostics
      .map((d) => `<li><code>${esc(d.code)}</code> ${esc(d.level)} line ${esc(d.line)} — ${esc(d.message)}</li>`)
      .join('');
    return `<section class="doc" id="doc-${esc(r.id)}">
      <h2>${esc(r.id)} <span class="sub">${esc(r.family)}</span></h2>
      <p class="req">“${esc(r.request)}”</p>
      <p class="meta">
        ${tag(r.selection.tag)} primary <code>${esc(r.selection.primary)}</code> ·
        first write ${r.first ? `${r.first.errors} error(s)` : 'not captured'} ·
        handed off with ${r.final.errors} error(s), ${r.final.warnings} warning(s) ·
        ${r.blocks.length} blocks, ${(r.bytes / 1024).toFixed(1)} KB
        ${r.tokens ? `· ${k(r.tokens)} tokens` : ''} ${r.tools ? `· ${r.tools} tool calls` : ''} ${r.seconds ? `· ${Math.round(r.seconds)}s` : ''}
      </p>
      ${firstDiags ? `<details><summary>First-draft errors the agent then fixed (${r.first.errors})</summary><ul>${firstDiags}</ul></details>` : ''}
      ${finalDiags ? `<details open><summary>Diagnostics still open on the handed-off doc</summary><ul>${finalDiags}</ul></details>` : ''}
      <iframe title="${esc(r.id)}" srcdoc="${esc(frameFor(r.id))}" loading="lazy"></iframe>
    </section>`;
  })
  .join('\n');

const notesHtml =
  notes.length > 0
    ? `<section class="notes"><h2>Findings</h2><ol>${notes
        .map((n) => `<li><strong>${esc(n.title)}</strong> ${esc(n.text)}</li>`)
        .join('')}</ol></section>`
    : '';

const html = `<title>Chiltepin Generation Eval</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
  :root { --paper:#f7f6f2; --paper-2:#efede8; --ink:#1f2430; --muted:#4f5868; --soft:#646d7b; --rule:rgba(31,36,48,.14); --rule-solid:#807b70; --accent:#b04a25; --good:#2f6b4f; --bad:#9a3f34; --warn:#8a6d1a; --frame:#fbfaf7; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --paper:#17191e; --paper-2:#1f2229; --ink:#e8e6e1; --muted:#b1b7c3; --soft:#9aa2b0; --rule:rgba(232,230,225,.14); --rule-solid:#6b6f78; --accent:#d9683d; --good:#7fcda5; --bad:#e6958a; --warn:#d9b95c; --frame:#1f2229; } }
  :root[data-theme="dark"] { --paper:#17191e; --paper-2:#1f2229; --ink:#e8e6e1; --muted:#b1b7c3; --soft:#9aa2b0; --rule:rgba(232,230,225,.14); --rule-solid:#6b6f78; --accent:#d9683d; --good:#7fcda5; --bad:#e6958a; --warn:#d9b95c; --frame:#1f2229; }
  body { margin:0; padding-block:32px 72px; padding-inline:20px; background:var(--paper); color:var(--ink); font:14px/1.55 Inter, system-ui, -apple-system, sans-serif; }
  main { max-width:1180px; margin:0 auto; }
  h1 { font-size:26px; font-weight:600; letter-spacing:-.01em; margin:0 0 6px; text-wrap:balance; }
  h2 { font-size:17px; font-weight:600; margin:0 0 6px; text-wrap:balance; }
  .eyebrow { font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--soft); font-weight:600; margin:0 0 10px; }
  .lede { color:var(--muted); margin:0 0 24px; max-width:68ch; }
  .tiles { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin:0 0 28px; }
  @media (max-width:760px) { .tiles { grid-template-columns:repeat(2,1fr); } }
  .tile { border:1px solid var(--rule); border-radius:6px; padding:12px 14px; background:var(--paper-2); }
  .tile .n { font-size:26px; font-weight:600; font-variant-numeric:tabular-nums; letter-spacing:-.01em; }
  .tile .l { color:var(--muted); font-size:12px; margin-top:2px; }
  .tile.good .n { color:var(--good); } .tile.bad .n { color:var(--bad); } .tile.warn .n { color:var(--warn); }
  .codes { color:var(--muted); margin:-12px 0 24px; font-size:13px; }
  .wrap { overflow-x:auto; border:1px solid var(--rule); border-radius:6px; }
  table { border-collapse:collapse; width:100%; font-size:13px; min-width:860px; }
  th, td { text-align:left; padding:9px 12px; border-bottom:1px solid var(--rule); vertical-align:top; }
  th { color:var(--soft); font-weight:600; font-size:11px; letter-spacing:.08em; text-transform:uppercase; background:var(--paper-2); }
  tr:last-child td { border-bottom:0; }
  td.good { color:var(--good); } td.bad, .bad { color:var(--bad); font-weight:600; } td.warn { color:var(--warn); }
  .num { font-variant-numeric:tabular-nums; }
  .sub { color:var(--soft); font-size:11.5px; margin-top:2px; font-weight:400; }
  code { font:12px/1.4 "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace; background:var(--paper-2); border:1px solid var(--rule); padding:0 5px; border-radius:3px; }
  .tag { display:inline-block; font-size:10.5px; letter-spacing:.06em; text-transform:uppercase; font-weight:600; padding:1px 7px; border-radius:999px; border:1px solid var(--rule-solid); color:var(--muted); }
  .tag.ok { color:var(--good); border-color:var(--good); } .tag.weak { color:var(--warn); border-color:var(--warn); } .tag.TRAP, .tag.off { color:var(--bad); border-color:var(--bad); }
  .notes { margin:36px 0 8px; padding:18px 20px; border-left:3px solid var(--accent); background:var(--paper-2); border-radius:0 6px 6px 0; }
  .notes ol { margin:8px 0 0; padding-left:20px; } .notes li { margin:6px 0; max-width:80ch; } .notes strong { font-weight:600; }
  section.doc { margin-top:44px; padding-top:24px; border-top:1px solid var(--rule); }
  .req { color:var(--muted); font-style:italic; margin:0 0 6px; max-width:80ch; }
  .meta { color:var(--soft); font-size:12.5px; margin:0 0 10px; }
  details { margin:8px 0; font-size:13px; } details ul { margin:6px 0 0 18px; padding:0; } summary { cursor:pointer; color:var(--muted); }
  iframe { width:100%; height:820px; border:1px solid var(--rule-solid); border-radius:6px; background:var(--frame); }
  a { color:var(--accent); } a:focus-visible, summary:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  @media (max-width:640px) { .tile .n { font-size:22px; } iframe { height:560px; } }
</style>
<main>
<p class="eyebrow">Run ${esc(runName)} · ${summary.answered} of ${summary.cases} scenarios</p>
<h1>Chiltepin Generation Eval</h1>
<p class="lede">One fresh agent per request, the installed skill, and the real CLI through <code>npx -y chiltepin</code>. The agent picks blocks, looks each up with <code>chiltepin block</code>, writes, checks, and fixes. Every document below is the handed-off file rendered by the shipped renderer.</p>
<div class="tiles">
  ${tile(`${summary.selectionScore}/${summary.answered}`, 'right block chosen', summary.selectionScore === summary.answered ? 'good' : 'warn')}
  ${tile(summary.traps, 'keyword traps hit', summary.traps === 0 ? 'good' : 'bad')}
  ${tile(`${summary.firstCleanDocs}/${summary.answered}`, 'clean on the first write', summary.firstCleanDocs === summary.answered ? 'good' : 'warn')}
  ${tile(`${summary.finalCleanDocs}/${summary.answered}`, 'clean at handoff', summary.finalCleanDocs === summary.answered ? 'good' : 'bad')}
  ${tile(summary.renderFailures, 'renderer failures', summary.renderFailures === 0 ? 'good' : 'bad')}
  ${tile(`${summary.inBudget}/${summary.answered}`, 'within 2–5 lenses', summary.inBudget === summary.answered ? 'good' : 'warn')}
  ${tile(summary.tokensMean ? k(summary.tokensMean) : '–', 'mean tokens per doc')}
  ${tile(summary.secondsMean ? summary.secondsMean + 's' : '–', 'mean wall time')}
</div>
${summary.firstErrorCodes.length ? `<p class="codes">First-write error codes: ${summary.firstErrorCodes.map(([c, n]) => `<code>${esc(c)}</code> ×${n}`).join(' · ')}</p>` : ''}
<div class="wrap"><table>
<thead><tr><th>case</th><th>selection</th><th>1st errors</th><th>final errors</th><th>warnings</th><th>structural blocks</th><th>tokens</th><th>tools</th><th>time</th><th>render</th></tr></thead>
<tbody>${tableRows}</tbody></table></div>
${notesHtml}
${docSections}
</main>
`;
writeFileSync(out, html);
console.log(`wrote ${out} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
