/**
 * `avo compare [family]` — one page with EVERY block rendered both ways:
 * document mode (the styled page card) beside slide mode (a real one-slide
 * deck in an iframe, running the actual deck CSS + fitter), so you can see
 * exactly how a block translates from page to stage. A Doc / Slide / Both
 * toggle switches the layout.
 *
 * Examples come from the bundled showcase doc (`avo demo`) — first example
 * per block type, optionally filtered to one family.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import open from 'open';
import { parseDocument, BLOCK_DESCRIPTIONS } from '@avodado/core';
import { escapeHtml, houseCss, renderDocumentSegments, toSlides } from '@avodado/render';
import { templatesDir } from './init.js';
import { filterDemoSource } from './demo.js';
import { DEMO_FAMILIES, familyBlocks, type DemoFamily } from './catalog.js';
import type { SingleResult } from './single.js';

interface Example {
  readonly kind: string;
  /** Doc-mode HTML for the block (rendered segment, shares the page CSS). */
  readonly docHtml: string;
  /** A complete one-slide deck for the iframe (real deck CSS + fitter). */
  readonly deckHtml: string;
}

/** Tweaks injected into each mini deck so the lone slide fills its iframe. */
const DECK_TWEAKS =
  '<style>' +
  '.deck-nav{display:none!important}' +
  '.slide-ft{display:none!important}' + // the mini doc has no meta — "UNTITLED" is noise
  '.deck{padding:14px 0!important}' +
  '.docskin.slide{width:min(96vw,calc((100vh - 28px) * 16 / 9))!important}' +
  '</style>';

/** Builds the comparison page from a showcase source (first example per type). */
export function buildComparePage(source: string, family?: DemoFamily): string {
  const filtered = family !== undefined ? filterDemoSource(source, family) : source;
  const doc = parseDocument(filtered, 'compare');

  const examples = new Map<string, Example>();
  let defs = '';
  for (const seg of doc.segments) {
    if (seg.kind === 'markdown' || seg.kind === 'meta' || examples.has(seg.kind)) continue;
    const miniSrc = '```' + seg.kind + '\n' + seg.raw + '\n```\n';
    const mini = parseDocument(miniSrc, `cmp-${seg.kind}`);
    const parts = renderDocumentSegments(mini);
    defs = parts.defs;
    const deckHtml = toSlides(mini).replace('</body>', `${DECK_TWEAKS}</body>`);
    examples.set(seg.kind, { kind: seg.kind, docHtml: parts.segments[0]?.html ?? '', deckHtml });
  }

  // Family sections in catalog order; only types the showcase actually has.
  const sections = DEMO_FAMILIES.map((fam) => {
    const types = familyBlocks(fam.id).filter((t) => examples.has(t));
    if (types.length === 0) return '';
    const rows = types
      .map((t) => {
        const ex = examples.get(t);
        if (ex === undefined) return '';
        const desc = (BLOCK_DESCRIPTIONS as Record<string, string>)[t] ?? '';
        return (
          `<section class="cmp-row" id="block-${t}">` +
          `<div class="cmp-head"><h3><code>${escapeHtml(t)}</code></h3><p>${escapeHtml(desc)}</p></div>` +
          `<div class="cmp-panels">` +
          `<div class="cmp-panel cmp-doc"><div class="cmp-tag">DOC</div><div class="docskin cmp-card">${ex.docHtml}</div></div>` +
          `<div class="cmp-panel cmp-slide"><div class="cmp-tag">SLIDE</div>` +
          `<iframe class="cmp-stage" title="${escapeHtml(t)} on a slide" srcdoc="${escapeHtml(ex.deckHtml)}"></iframe></div>` +
          `</div></section>`
        );
      })
      .join('');
    return `<h2 class="cmp-fam" id="fam-${fam.id}">${escapeHtml(fam.label)}</h2>${rows}`;
  }).join('');

  const nav = DEMO_FAMILIES.filter((f) => familyBlocks(f.id).some((t) => examples.has(t)))
    .map((f) => `<a href="#fam-${f.id}">${escapeHtml(f.label)}</a>`)
    .join('');

  const chrome = `
body{margin:0;background:#eceadf;}
.cmp-bar{position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:18px;flex-wrap:wrap;
  padding:12px 28px;background:#fcfbf7;border-bottom:1px solid #e4dccb;font-family:Inter,-apple-system,sans-serif;}
.cmp-bar h1{font-size:15px;margin:0;color:#233a5e;}
.cmp-bar nav{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;}
.cmp-bar nav a{color:#4a463d;text-decoration:none;}
.cmp-bar nav a:hover{color:#9c4a2f;}
.cmp-toggle{margin-left:auto;display:flex;gap:0;border:1px solid #e4dccb;border-radius:8px;overflow:hidden;}
.cmp-toggle button{border:0;background:#fcfbf7;padding:6px 14px;font-size:12px;font-weight:600;color:#4a463d;cursor:pointer;}
.cmp-toggle button.on{background:#233a5e;color:#fff;}
.cmp-wrap{max-width:1560px;margin:0 auto;padding:26px 28px 80px;font-family:Inter,-apple-system,sans-serif;}
.cmp-fam{font-size:22px;color:#233a5e;margin:44px 0 6px;padding-bottom:8px;border-bottom:2px solid #233a5e;}
.cmp-row{margin:26px 0 38px;}
.cmp-head{display:flex;align-items:baseline;gap:14px;margin-bottom:10px;}
.cmp-head h3{margin:0;font-size:16px;}
.cmp-head h3 code{background:#233a5e;color:#fff;padding:3px 10px;border-radius:6px;font-size:13px;}
.cmp-head p{margin:0;font-size:13px;color:#8a8475;}
.cmp-panels{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start;}
body[data-view="doc"] .cmp-slide{display:none;} body[data-view="doc"] .cmp-panels{grid-template-columns:1fr;}
body[data-view="slide"] .cmp-doc{display:none;} body[data-view="slide"] .cmp-panels{grid-template-columns:1fr;}
.cmp-tag{font-size:10px;font-weight:700;letter-spacing:.12em;color:#8a8475;margin-bottom:6px;}
.cmp-card{background:#fcfbf7;border:1px solid #e4dccb;border-radius:12px;padding:18px 22px;
  max-height:560px;overflow:auto;}
.cmp-stage{width:100%;aspect-ratio:16/9;border:1px solid #e4dccb;border-radius:12px;background:#eceadf;display:block;}
@media (max-width:1100px){.cmp-panels{grid-template-columns:1fr;}}
`;

  const toggleJs =
    `var b=document.body;document.querySelectorAll('.cmp-toggle button').forEach(function(btn){` +
    `btn.onclick=function(){b.dataset.view=btn.dataset.v;` +
    `document.querySelectorAll('.cmp-toggle button').forEach(function(x){x.classList.toggle('on',x===btn)});};});`;

  const title = family !== undefined ? `Blocks — doc vs slide (${family})` : 'Blocks — doc vs slide';
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${escapeHtml(title)}</title>` +
    `<style>${houseCss}</style><style>${chrome}</style></head>` +
    `<body data-view="both">` +
    `<div class="cmp-bar"><h1>${escapeHtml(title)}</h1><nav>${nav}</nav>` +
    `<div class="cmp-toggle">` +
    `<button data-v="both" class="on">Both</button>` +
    `<button data-v="doc">Doc</button>` +
    `<button data-v="slide">Slide</button>` +
    `</div></div>` +
    defs +
    `<div class="cmp-wrap">${sections}</div>` +
    `<script>${toggleJs}</script>` +
    `</body></html>`
  );
}

/** Builds the compare page from the bundled showcase and writes/opens it. */
export async function runCompare(opts: {
  readonly family?: DemoFamily;
  /** Absolute output path — disables preview. */
  readonly output?: string;
  readonly preview?: boolean;
}): Promise<SingleResult> {
  const source = await readFile(join(templatesDir(), 'demo.md'), 'utf8');
  const html = buildComparePage(source, opts.family);

  let outputAbs: string;
  if (opts.output !== undefined) {
    outputAbs = opts.output;
  } else {
    const dir = join(tmpdir(), 'avodado-compare');
    await mkdir(dir, { recursive: true });
    outputAbs = join(dir, opts.family === undefined ? 'compare.html' : `compare-${opts.family}.html`);
  }
  await writeFile(outputAbs, html, 'utf8');
  const doOpen = opts.output === undefined && opts.preview !== false;
  if (doOpen) await open(outputAbs);
  return { output: outputAbs, bytes: html.length, opened: doOpen };
}
