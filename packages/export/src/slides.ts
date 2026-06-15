/**
 * Slides export — turns a document into a self-contained presentation deck:
 * one slide for the cover and one per section, with keyboard / button / jump
 * navigation. Each slide is a `.docskin` card with a coloured right edge.
 *
 * The output is a single HTML file with inline CSS + a tiny vanilla-JS
 * controller (no runtime dependency), so it opens straight in a browser.
 */

import type { Document } from '@avodado/core';
import { renderSlides, type RenderPartsOptions } from '@avodado/render';

const ESC: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

// Right-edge accent colors, cycled per slide for a bit of rhythm.
const ACCENTS = [
  'var(--navy)',
  'var(--highlight)',
  'var(--positive)',
  'var(--purple)',
  'var(--teal)',
  'var(--blue)',
];

const DECK_CSS = `
*{box-sizing:border-box;}
html,body{margin:0;height:100%;}
body{background:var(--light-gray);font-family:var(--font-body);color:var(--charcoal);}
.deck{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:34px 48px 96px;}
.docskin.slide{display:none;width:100%;max-width:1000px;margin:0;padding:34px 48px 40px;background:var(--white);
  border:1px solid var(--rule);border-right:10px solid var(--navy);border-radius:12px;
  box-shadow:0 14px 46px rgba(0,0,0,.14);max-height:calc(100vh - 130px);overflow:auto;}
.docskin.slide.active{display:block;}
.docskin.slide .section-block{margin:0;}
.deck-nav{position:fixed;left:0;right:0;bottom:0;height:60px;display:flex;align-items:center;justify-content:center;
  gap:14px;background:var(--white);border-top:1px solid var(--rule);font-family:var(--font-body);font-size:13px;z-index:10;}
.deck-btn{appearance:none;border:1px solid var(--rule);background:var(--white);color:var(--navy);font-size:18px;line-height:1;
  width:38px;height:34px;border-radius:8px;cursor:pointer;}
.deck-btn:hover{background:var(--light-gray);}
.deck-counter{font-variant-numeric:tabular-nums;color:var(--slate);min-width:54px;text-align:center;}
.deck-sel{max-width:340px;font-family:var(--font-body);font-size:13px;padding:6px 10px;border:1px solid var(--rule);
  border-radius:8px;background:var(--white);color:var(--charcoal);}
@media print{.deck-nav{display:none;}.docskin.slide{display:block;page-break-after:always;box-shadow:none;max-height:none;}}
`;

const DECK_JS = `(function(){
  var slides=[].slice.call(document.querySelectorAll('.slide'));
  if(!slides.length)return;
  var jump=document.getElementById('deck-jump'),cur=document.getElementById('deck-cur');
  var i=0;
  function show(n){
    i=Math.max(0,Math.min(slides.length-1,n));
    for(var k=0;k<slides.length;k++)slides[k].classList.toggle('active',k===i);
    cur.textContent=i+1; jump.value=String(i); slides[i].scrollTop=0;
    history.replaceState(null,'','#'+(i+1));
  }
  document.getElementById('deck-prev').onclick=function(){show(i-1);};
  document.getElementById('deck-next').onclick=function(){show(i+1);};
  jump.onchange=function(){show(parseInt(jump.value,10)||0);};
  document.addEventListener('keydown',function(e){
    if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' ')show(i+1);
    else if(e.key==='ArrowLeft'||e.key==='PageUp')show(i-1);
    else if(e.key==='Home')show(0); else if(e.key==='End')show(slides.length-1);
  });
  var h=parseInt((location.hash||'').replace('#',''),10);
  show(isNaN(h)?0:h-1);
})();`;

/**
 * Renders a {@link Document} to a self-contained slide-deck HTML string.
 *
 * @param doc - The parsed document.
 * @param opts - Optional theme + variable overrides.
 */
export function toSlides(doc: Document, opts: RenderPartsOptions = {}): string {
  const { css, themeVars, title, slides } = renderSlides(doc, opts);

  const slideEls = slides
    .map((sl, i) => {
      const accent = ACCENTS[i % ACCENTS.length] ?? 'var(--navy)';
      return `<div class="docskin slide" style="border-right-color:${accent}">${sl.html}</div>`;
    })
    .join('');

  const options = slides
    .map((sl, i) => {
      const n = String(i + 1).padStart(2, '0');
      const label = sl.title ?? sl.label;
      return `<option value="${i}">${n} · ${esc(label)}</option>`;
    })
    .join('');

  const nav =
    `<div class="deck-nav">` +
    `<button class="deck-btn" id="deck-prev" aria-label="Previous">‹</button>` +
    `<select class="deck-sel" id="deck-jump">${options}</select>` +
    `<span class="deck-counter"><b id="deck-cur">1</b> / ${slides.length}</span>` +
    `<button class="deck-btn" id="deck-next" aria-label="Next">›</button>` +
    `</div>`;

  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${esc(title)}</title>` +
    `<style>${css}</style>` +
    `<style>:root{${themeVars}}</style>` +
    `<style>${DECK_CSS}</style>` +
    `</head><body>` +
    `<div class="deck">${slideEls}</div>` +
    nav +
    `<script>${DECK_JS}</script>` +
    `</body></html>`
  );
}
