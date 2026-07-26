/**
 * Slide-deck assembly — turns a document into a self-contained presentation
 * deck: one slide for the cover and one per section, with keyboard / button /
 * jump navigation. Each slide is a `.docskin` card with a coloured right edge.
 *
 * The output is a single HTML file with inline CSS + a tiny vanilla-JS
 * controller (no runtime dependency), so it opens straight in a browser.
 * Pure string-building on top of {@link renderSlides} — browser-safe, no I/O.
 */

import type { Document } from '@avodado/core';
import { renderSlides, type RenderPartsOptions } from './parts.js';

const ESC: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

const DECK_CSS = `
*{box-sizing:border-box;}
html,body{margin:0;height:100%;}
body{background:var(--light-gray);font-family:var(--font-body);color:var(--charcoal);}
.deck{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px 24px 80px;}
/* Every slide is the same 16:9 stage, sized to fit the viewport. A gradient rail
   runs down the left edge (same on every slide). */
.docskin.slide{display:none;position:relative;width:min(94vw, calc((100vh - 116px) * 16 / 9), 1120px);aspect-ratio:16/9;margin:0 auto;
  padding:26px 40px 24px 50px;border:1px solid var(--rule);border-radius:14px;box-shadow:0 14px 46px rgba(0,0,0,.14);
  overflow:hidden;background:var(--white);}
/* Static gradient rail (derived from the active theme's accent colors). */
.docskin.slide::before{content:"";position:absolute;left:0;top:0;bottom:0;width:12px;
  background:linear-gradient(180deg,var(--navy),var(--purple),var(--teal),var(--blue),var(--highlight));}
.docskin.slide.active{display:flex;flex-direction:column;}
/* Slide header: title top-left, section top-right, hairline rule beneath. */
.slide-hd{flex:0 0 auto;display:flex;justify-content:space-between;align-items:baseline;gap:18px;
  margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid var(--rule);}
.slide-hd-l{font-family:var(--font-display);font-weight:700;font-size:25px;line-height:1.15;letter-spacing:-.01em;color:var(--navy);}
.slide-hd-r{font-family:var(--font-mono);font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--gray);font-weight:700;white-space:nowrap;}
/* Text on a stage reads at presentation scale with a comfortable measure —
   never stretched edge to edge. */
.docskin.slide .slide-inner p{font-size:16.5px;line-height:1.65;max-width:62ch;}
.docskin.slide .slide-inner li{font-size:15.5px;line-height:1.6;max-width:58ch;}
.docskin.slide .slide-inner .section-lede{font-size:17px;max-width:60ch;}
/* Content is scaled to fit the slide (JS), so there's no scrolling. */
.slide-content{flex:1 1 auto;min-height:0;overflow:hidden;display:flex;align-items:center;justify-content:center;}
/* Heavier slides (stacked blocks / lots of prose) sit at the top; light ones stay
   centered. A heading marker ({top}/{center}/{bottom}) forces alignment. */
.slide-content.sl-top{align-items:flex-start;}
.slide-content.sl-bottom{align-items:flex-end;}
/* Shrink-wrap the content so fit() can scale small blocks UP to fill the slide
   (a full-width inner could only ever be scaled down). max-width keeps wide
   diagrams/tables within the slide. */
.slide-inner{display:inline-block;width:auto;max-width:100%;transform-origin:center center;}
.slide-content.sl-top .slide-inner,.slide-content.sl-bottom .slide-inner{width:100%;}
/* The transform origin must match the flex alignment: a top-aligned inner
   scaling toward its own center keeps its layout-box top and slides its
   CONTENT down by (1-s)*H/2 — tall content ended up clipped at the stage
   bottom while empty space sat above. */
.slide-content.sl-top .slide-inner{transform-origin:top center;}
.slide-content.sl-bottom .slide-inner{transform-origin:bottom center;}
/* A divider is a full-width band — never shrink-wrap its slide. */
.slide-inner:has(.dvd){width:100%;}
/* auto-fit card grids (drivers/options) need the full stage width — inside a
   shrink-wrapped inner they collapse to fewer columns and wrap lopsidedly. */
.slide-inner:has(.dv-grid),.slide-inner:has(.op-grid){width:100%;}
/* Tall TEXT lists (checklists, takeaways, steps, glossaries, long prose
   lists) break into columns on the stage — horizontal space instead of one
   skinny centered strip that fit() would shrink. The deck JS adds the class
   by item count: 4+ → two columns, 8+ → three. */
/* display:block beats the containers' own flex-column (multicol is ignored on
   flex boxes); .docskin.slide outweighs the house .docskin .ls-list rules. */
.docskin.slide .sl-cols-2{display:block;columns:2;column-gap:40px;width:100%;}
.docskin.slide .sl-cols-3{display:block;columns:3;column-gap:34px;width:100%;}
.docskin.slide .sl-cols-2>*,.docskin.slide .sl-cols-3>*{break-inside:avoid;margin-bottom:12px;}
.slide-inner:has(.sl-cols-2),.slide-inner:has(.sl-cols-3){width:100%;}
/* Code owns the stage width — a shrink-wrapped <pre> read at 0.5x; full-width
   it only ever scales for height. */
.docskin.slide .slide-inner:has(pre){width:100%;}
/* Code presents at presentation scale: the type starts big (16px vs the doc's
   12.5px) and the fitter scales DOWN only if it must — so every code slide
   shows the largest readable type that fits the stage. Gallery cards keep
   their compact grid size. */
.docskin.slide .code-block pre{font-size:16px;line-height:1.5;padding:18px 22px;}
.docskin.slide .code-block{margin:10px 0;}
.docskin.slide .code-header{font-size:12px;padding:9px 16px;}
/* A tall lone snippet splits into a two-column spread (deck JS) — half the
   height, so the type stays at presentation size and fills the stage. */
.sl-code-cols{display:grid;grid-template-columns:1fr 1fr;gap:14px;width:100%;align-items:start;}
.sl-code-cols .code-block{margin:0;}
/* Columns are narrower than the longest line — wrap instead of clipping
   (slides can't scroll horizontally). */
.sl-code-cols pre{white-space:pre-wrap;word-break:break-word;}
/* A lone short prose fragment (a hero exhibit's intro that spilled to its own
   slide) reads as a deliberate STATEMENT — larger, centered, measured. */
.docskin.slide .sl-statement .prose p{font-size:21px;line-height:1.6;max-width:46ch;margin-left:auto;margin-right:auto;text-align:center;color:var(--slate);}
/* Consulting split layout ({split} heading marker): message left, exhibit right. */
.slide-content.sl-split .slide-inner{display:grid;grid-template-columns:2fr 3fr;gap:38px;align-items:center;width:100%;}
.sl-msg{display:flex;flex-direction:column;gap:8px;min-width:0;}
.docskin.slide .sl-msg p{font-size:17.5px;line-height:1.6;max-width:none;}
.docskin.slide .sl-msg li{font-size:16px;max-width:none;}
.sl-exhibit{min-width:0;}
.sl-exhibit .diagram{margin:0;}
/* Slide footer: doc title left, page number right. */
.slide-ft{flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;gap:12px;
  margin-top:14px;padding-top:10px;border-top:1px solid var(--rule);
  font-family:var(--font-mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--gray);}
.docskin.slide .section-head{display:none;}              /* the slide header replaces it */
.docskin.slide .section-block{margin:0;}
.docskin.slide .diagram{margin:0 auto;}
/* Diagrams shed their page-card chrome on the stage — the slide IS the card,
   so a bordered box inside it reads as clutter. The tag pill and fig number
   drop too (the slide header already names the block); the diagram's own
   title stays when it has one, at presentation scale. */
.docskin.slide .diagram{border:none;background:transparent;padding:0;box-shadow:none;border-radius:0;}
.docskin.slide .diagram-head{border-bottom:none;padding-bottom:0;margin-bottom:12px;}
.docskin.slide .diagram-tag,.docskin.slide .diagram-fignum{display:none;}
.docskin.slide .diagram-head:not(:has(.diagram-title)){display:none;}
.docskin.slide .diagram-title{font-size:19px;}
/* A benchmark table on the stage is the exhibit: it claims the full width, and
   its rows tighten so the fitter has less height to scale away — the numbers
   are the whole point, they stay big. */
.docskin.slide .slide-inner:has(.benchmark){width:100%;}
.docskin.slide .benchmark{margin:0;}
.docskin.slide .bm-slot{padding:8px 10px;}
.docskin.slide .bm-table td.bm-metric{padding:8px 16px 8px 2px;}
.docskin.slide .bm-table th.bm-subj,.docskin.slide .bm-table th.bm-metric{padding-top:2px;padding-bottom:10px;}
.docskin.slide .bm-val{font-size:16.5px;}
.docskin.slide .bm-row-label{font-size:15px;}
.docskin.slide .bm-table th.bm-subj{font-size:16.5px;}
/* ── The legibility floor ───────────────────────────────────────────────────
   A page is read at 40cm, so the library sets its eyebrows, chips, captions
   and secondary values at 9–11px. A stage is read from across a room, and the
   fitter can only shrink an exhibit further — measured across a deck of one
   block per slide, those labels were arriving at 5–8px.
   Every non-SVG label that measured under 12px is listed here, at 12.5px:
   still clearly secondary next to 15–16px body text, still legible after a
   0.8 scale-down. Re-derive the list by walking a one-block-per-slide deck
   and collecting classes whose computed font-size is under 12px.
   SVG diagram labels are deliberately absent — their wrap widths are computed
   against the current size and baked into the viewBox, so they move as their
   own change, per diagram. */
/* eyebrows, kickers, and the small labels that name a value */
.docskin.slide :is(.a-label,.ac-title,.accent,.agenda-dur,.agenda-owner,.al-foot-label,
.am-area-label,.bm-metric,.bm-subj-sub,.callout-title,.cp-result-kicker,.ct-label,.ctx-idx,
.ctx-num,.dd-label,.dv-sub,.dvd-kicker-text,.env-g-label,.env-r-label,.ep-section,.hm-bound,
.k,.kan-head,.layer-kicker,.layer-src,.mx-corner,.op-kicker,.pa-sec-label,.pa-tool,.pc-head,
.pr-kicker,.pr-label,.pt-cat,.pt-kicker,.pt-label,.section-num,.slo-v-label,.sp-label,.sp-step,
.st-ac-label,.stat-label,.stp-code-head,.stt-status-h,.swot-label,.tem-role,.tl-date,.ts-spec){font-size:12.5px;}
/* chips, pills, and status tokens */
.docskin.slide :is(.am-tile,.cg-tag,.cg-type,.dv-tag,.inv-status,.inv-tag,.kan-card-tag,
.op-verdict,.pill,.pl-hex,.rk-sev,.rk-status,.sc-weight,.sc-winner,.st-chip,.story-chip,
.stt-pill,.tr-chip){font-size:12.5px;}
/* notes, captions, and secondary values */
.docskin.slide :is(.am-area-desc,.bm-cap,.dd-ex,.dd-sign,.ep-auth,.ep-req,.item,.okr-owner,
.okr-pct,.op-how,.pl-usage,.pr-var,.pull-attr,.rk-meta,.rk-owner,.sc-note,.slo-caption,
.slo-window,.st-id,.tbl-note,.tr-io-label,.tr-mono,.ts-note,
.cover-meta,.edge-step,.jr-emotion-label,.stt-key){font-size:12.5px;}
/* ── Tabular exhibits present at full width ─────────────────────────────────
   Every table in the library is already width:100% — but .slide-inner
   shrink-wraps (so the fitter can scale a lone small block UP), which means
   100% resolves against the table's own intrinsic width. A three-row table
   came out at 27% of the stage, and the fitter's 1.47× cap could not rescue
   it. Hand the inner the whole stage instead and take the size from type
   rather than from transform: a table laid out at 16px beats a 13px table
   scaled 1.5×, because the scale enlarges the hairlines and shadows too. */
.docskin.slide .slide-inner:has(table),
.docskin.slide .slide-inner:has(.heatmap),
.docskin.slide .slide-inner:has(.glossary){width:100%;}
.docskin.slide :is(.pres-table,.mx-grid,.sc-table,.stt-table,.trk,.bm-table){font-size:18px;}
.docskin.slide :is(.pres-table,.sc-table,.stt-table,.trk) :is(th,td){padding-top:11px;padding-bottom:11px;}
.docskin.slide :is(.pres-table,.mx-grid,.sc-table,.stt-table,.trk,.bm-table) thead :is(th,td){font-size:12.5px;}
.docskin.slide .sc-foot td{font-size:12.5px;}
.docskin.slide .mx-cell{font-size:16px;}
/* Their page-card chrome goes the way the diagrams' did — the slide is the card. */
.docskin.slide :is(.mx-scroll,.sc-scroll,.hm-scroll,.bm-scroll){border:none;box-shadow:none;padding:0;background:transparent;}
.docskin.slide .hm-cell{font-size:14px;min-height:40px;}
.docskin.slide .hm-col{font-size:13px;}
.docskin.slide .glossary .row{grid-template-columns:240px 1fr;padding:11px 0;}
.docskin.slide :is(.glossary dt,.glossary dd){font-size:16px;}
/* ── Card and list exhibits take the stage width too ────────────────────────
   Same lesson as the tables, for the blocks built from HTML rather than a
   viewBox. Shrink-wrapped, they sit at their page width and the fitter's
   text cap (1.06) can barely enlarge them: a checklist covered 30% of the
   stage, a status board 52%. Diagrams and images keep the shrink-wrap — an
   SVG scales cleanly, a card layout would rather have the room. */
.docskin.slide .slide-inner:has(:is(.anatomy,.cg-rail,.ct,.dodont,.envelope,.kanban,
.layer-stack,.list-block,.okr,.pc,.prompt,.slo,.spec,.stat-row,.stories,.story,
.team,.trace)){width:100%;}
/* A pull quote and a big number are hero TEXT — width was never what they were
   missing. They keep the shrink-wrap (so the fitter can still enlarge them) and
   the quote reads at statement size instead of page size. */
.docskin.slide .pull-text{font-size:22px;line-height:1.4;}
/* ── Stacked cards go across the stage ──────────────────────────────────────
   On a page a list of cards runs down the column, which on a 16:9 stage is the
   worst possible shape: it drives the fitter's scale down AND leaves the width
   unused. Across the stage they stay whole and stay legible. auto-fit keeps
   the call automatic — as many as fit at a readable width, then wrap — and
   matches how the drivers and options blocks already lay their cards out.
   The row is only right while the cards stay whole: past the wrap point they
   fall to a second row rather than shrinking below the minimum. */
.docskin.slide :is(.slo-list,.okr-list,.st-list,.env-steps,.tr-list){display:grid;align-items:stretch;}
.docskin.slide .slo-list{grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px;}
.docskin.slide .okr-list{grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:16px;}
.docskin.slide .st-list{grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;}
.docskin.slide .env-steps{grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;}
.docskin.slide .tr-list{grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:12px;}
/* Cover (first slide): centered title, no top bar. */
.docskin.slide.slide-cover .slide-content{text-align:center;}
.docskin.slide.slide-cover .slide-inner{width:100%;}
.docskin.slide.slide-cover .cover-sub{margin:0 auto;}
.docskin.slide.slide-cover .cover-meta{margin-bottom:24px;}
/* A divider that owns its slide is the title card: center the band's content
   block on the stage with no leftover doc margins. */
.docskin.slide .slide-inner:has(.dvd) .section-block{margin:0;}
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
  // SVGs with only a viewBox have no intrinsic size — inside a shrink-wrapped
  // slide they'd collapse to the 300px browser default. Pin their natural size
  // so fit() can scale them properly (max-width:100% still caps overflow).
  [].slice.call(document.querySelectorAll('.slide svg[viewBox]:not([width])')).forEach(function(sv){
    var vb=sv.viewBox&&sv.viewBox.baseVal;
    if(vb&&vb.width&&vb.height){sv.setAttribute('width',vb.width);sv.setAttribute('height',vb.height);}
  });
  // Tall text lists flow into stage columns (see .sl-cols-* in the CSS):
  // count-based so short lists keep their single column.
  [].slice.call(document.querySelectorAll(
    '.slide .ls-list,.slide .tk-list,.slide .steps,.slide .faq,.slide .glossary,'+
    '.slide .agenda,.slide .spec,.slide .inv-list,.slide .rk-list,'+
    '.slide .slide-inner .prose > ul,.slide .slide-inner .prose > ol'
  )).forEach(function(el){
    var n=el.children.length;
    if(n>=8)el.classList.add('sl-cols-3');
    else if(n>=4)el.classList.add('sl-cols-2');
  });
  // A slide whose only exhibit is ONE tall code block reads at half scale —
  // split the snippet into a two-column spread instead (top-down, left column
  // first, like a printed listing). Only when the highlight spans balance, so
  // markup never tears.
  [].slice.call(document.querySelectorAll('.slide')).forEach(function(sl){
    var inner=sl.querySelector('.slide-inner');
    if(!inner)return;
    var blocks=inner.querySelectorAll('.code-block');
    if(blocks.length!==1)return;
    var pre=blocks[0].querySelector('pre');
    if(!pre)return;
    var lines=pre.innerHTML.split('\\n');
    if(lines.length<18)return;
    var mid=Math.ceil(lines.length/2);
    var a=lines.slice(0,mid).join('\\n'),c=lines.slice(mid).join('\\n');
    var balanced=function(s){return (s.match(/<span/g)||[]).length===(s.match(/<\\/span/g)||[]).length;};
    if(!balanced(a)||!balanced(c))return;
    var clone=blocks[0].cloneNode(true);
    pre.innerHTML=a;
    clone.querySelector('pre').innerHTML=c;
    var wrap=document.createElement('div');
    wrap.className='sl-code-cols';
    blocks[0].parentNode.insertBefore(wrap,blocks[0]);
    wrap.appendChild(blocks[0]);
    wrap.appendChild(clone);
  });
  // Prose-only slides with little text are section STATEMENTS — style them
  // as such instead of leaving a small centered fragment.
  [].slice.call(document.querySelectorAll('.slide')).forEach(function(sl){
    var inner=sl.querySelector('.slide-inner');
    if(!inner)return;
    var hasBlock=inner.querySelector('.section-block,.diagram,pre,table,.dvd,svg,img');
    var text=(inner.textContent||'').trim();
    if(!hasBlock&&text.length>0&&text.length<520)inner.classList.add('sl-statement');
  });
  var jump=document.getElementById('deck-jump'),cur=document.getElementById('deck-cur');
  var i=0;
  function fit(slide){
    var inner=slide.querySelector('.slide-inner'),content=slide.querySelector('.slide-content');
    if(!inner||!content)return;
    inner.style.transform='none';
    // getBoundingClientRect reflects the real rendered size (incl. SVG diagrams),
    // unlike scrollHeight which under-reports for inline SVG → content got clipped.
    var r=inner.getBoundingClientRect();
    if(!r.width||!r.height)return;
    // Scale to fit BOTH axes; allow enlarging small content a little so a lone
    // block isn't lost. Text-only slides barely scale up (enlarged prose reads
    // badly); slides with a visual get the gentle ~1.5x cap.
    var visual=inner.querySelector('svg,.diagram,table,pre,.gl-grid,.wf-row,img');
    var cap=visual?1.5:1.08;
    var s=Math.min(cap, content.clientWidth/r.width, content.clientHeight/r.height)*0.98;
    inner.style.transform='scale('+s+')';
  }
  function show(n){
    i=Math.max(0,Math.min(slides.length-1,n));
    for(var k=0;k<slides.length;k++)slides[k].classList.toggle('active',k===i);
    cur.textContent=i+1; jump.value=String(i);
    fit(slides[i]);
    // A deck embedded with <iframe srcdoc> has an opaque origin, where
    // replaceState throws a SecurityError. The hash is a convenience, not the
    // navigation itself, so an embedded deck simply goes without it.
    try{history.replaceState(null,'','#'+(i+1));}catch(e){}
  }
  document.getElementById('deck-prev').onclick=function(){show(i-1);};
  document.getElementById('deck-next').onclick=function(){show(i+1);};
  jump.onchange=function(){show(parseInt(jump.value,10)||0);};
  document.addEventListener('keydown',function(e){
    if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' ')show(i+1);
    else if(e.key==='ArrowLeft'||e.key==='PageUp')show(i-1);
    else if(e.key==='Home')show(0); else if(e.key==='End')show(slides.length-1);
  });
  window.addEventListener('resize',function(){fit(slides[i]);});
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
      // Self-titling slides carry no header bar: a lone DIVIDER names itself
      // (the PART band is the title — a stale section heading above it reads
      // wrong), and an untitled prose statement needs no "Slide" label.
      const onlyDivider =
        sl.html.includes('"dvd') &&
        (sl.html.match(/section-block/g) ?? []).length === 1 &&
        !sl.html.includes('class="prose"');
      const untitled = sl.title === undefined && sl.label === 'Slide';
      let header = '';
      if (!isCover) {
        secNum += 1;
        const nn = String(secNum).padStart(2, '0');
        const heading = sl.title ?? sl.label;
        if (!onlyDivider && !untitled) {
          header =
            `<div class="slide-hd"><div class="slide-hd-l">${esc(heading)}</div>` +
            `<div class="slide-hd-r">${nn} · ${esc(sl.label)}</div></div>`;
        }
      }
      const alignCls = sl.align === 'top' ? ' sl-top' : sl.align === 'bottom' ? ' sl-bottom' : '';
      const layoutCls = sl.layout === 'split' ? ' sl-split' : '';
      const footer = isCover
        ? ''
        : `<div class="slide-ft"><span>${esc(title)}</span><span>${i + 1} / ${slides.length}</span></div>`;
      return `<div class="docskin slide${isCover ? ' slide-cover' : ''}">${header}<div class="slide-content${alignCls}${layoutCls}"><div class="slide-inner">${sl.html}</div></div>${footer}</div>`;
    })
    .join('');

  const options = slides
    .map((sl, i) => {
      const n = String(i + 1).padStart(2, '0');
      // A divider-only slide is its own title card — list it by the band's
      // title (e.g. "Prompting well"), not the preceding section's heading.
      const dvdTitle = /class="dvd-title"[^>]*>([^<]+)</.exec(sl.html)?.[1];
      const label = dvdTitle ?? sl.title ?? sl.label;
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
