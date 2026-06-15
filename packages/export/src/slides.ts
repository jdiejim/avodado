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

const DECK_CSS = `
*{box-sizing:border-box;}
html,body{margin:0;height:100%;}
body{background:var(--light-gray);font-family:var(--font-body);color:var(--charcoal);}
.deck{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px 24px 80px;}
/* Every slide is the same 16:9 stage, sized to fit the viewport. A gradient rail
   runs down the left edge (same on every slide). */
.docskin.slide{display:none;width:min(94vw, calc((100vh - 116px) * 16 / 9), 1120px);aspect-ratio:16/9;margin:0 auto;
  padding:26px 40px 24px 50px;border:1px solid var(--rule);border-radius:14px;box-shadow:0 14px 46px rgba(0,0,0,.14);
  overflow:hidden;background:linear-gradient(160deg,var(--navy),var(--purple) 55%,var(--teal)) left top / 12px 100% no-repeat, var(--white);}
.docskin.slide.active{display:flex;flex-direction:column;}
/* Slide header: title top-left, section top-right. */
.slide-hd{flex:0 0 auto;display:flex;justify-content:space-between;align-items:baseline;gap:18px;
  padding-bottom:12px;margin-bottom:14px;border-bottom:1px solid var(--rule);}
.slide-hd-l{font-family:var(--font-display);font-weight:700;font-size:22px;line-height:1.18;color:var(--navy);}
.slide-hd-r{font-family:var(--font-mono);font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--gray);font-weight:700;white-space:nowrap;}
.slide-content{flex:1 1 auto;min-height:0;overflow:auto;}
.docskin.slide .section-head{display:none;}              /* the slide header replaces it */
.docskin.slide .section-block{margin:0;}
.docskin.slide .diagram{margin:0 auto;}
/* Cover (first slide): centered title, no top bar. */
.docskin.slide.slide-cover .slide-content{display:flex;flex-direction:column;justify-content:center;text-align:center;}
.docskin.slide.slide-cover .cover-bar{display:none;}
.docskin.slide.slide-cover .cover-pad{border-bottom:none;padding-bottom:0;margin-bottom:0;}
.docskin.slide.slide-cover .cover-meta{justify-content:center;}
.deck-nav{position:fixed;left:0;right:0;bottom:0;height:60px;display:flex;align-items:center;justify-content:center;
  gap:14px;background:var(--white);border-top:1px solid var(--rule);font-family:var(--font-body);font-size:13px;z-index:10;}
.deck-btn{appearance:none;border:1px solid var(--rule);background:var(--white);color:var(--navy);font-size:18px;line-height:1;
  width:38px;height:34px;border-radius:8px;cursor:pointer;}
.deck-btn:hover{background:var(--light-gray);}
.deck-counter{font-variant-numeric:tabular-nums;color:var(--slate);min-width:54px;text-align:center;}
.deck-sel{max-width:340px;font-family:var(--font-body);font-size:13px;padding:6px 10px;border:1px solid var(--rule);
  border-radius:8px;background:var(--white);color:var(--charcoal);}
@media print{@page{size:landscape;}.deck-nav{display:none;}.deck{display:block;padding:0;}
  .docskin.slide{display:flex!important;width:100%;aspect-ratio:auto;min-height:96vh;border-radius:0;box-shadow:none;page-break-after:always;}}
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
  const { css, themeVars, title, defs, slides } = renderSlides(doc, opts);

  let secNum = 0;
  const slideEls = slides
    .map((sl, i) => {
      const isCover = i === 0 && sl.label === 'Cover';
      let header = '';
      if (!isCover) {
        secNum += 1;
        const nn = String(secNum).padStart(2, '0');
        const heading = sl.title ?? sl.label;
        header =
          `<div class="slide-hd"><div class="slide-hd-l">${esc(heading)}</div>` +
          `<div class="slide-hd-r">${nn} · ${esc(sl.label)}</div></div>`;
      }
      return `<div class="docskin slide${isCover ? ' slide-cover' : ''}">${header}<div class="slide-content">${sl.html}</div></div>`;
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
    defs + // shared SVG markers/filters at the root (always present, never display:none)
    `<div class="deck">${slideEls}</div>` +
    nav +
    `<script>${DECK_JS}</script>` +
    `</body></html>`
  );
}
