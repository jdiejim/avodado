/**
 * The house CSS — ported verbatim from `resources/doc-studio.jsx`.
 *
 * All output is namespaced under `.docskin` so the stylesheet can coexist with
 * a host page's own styles. Theme switching works by overriding the CSS
 * variables on the `.docskin` root (see {@link themes}).
 *
 * Exported as a single string so it can be inlined into a `<style>` tag in the
 * standalone HTML produced by {@link renderDocument} (or copied verbatim into
 * a static stylesheet).
 */
export const houseCss = `*{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;}
/* Design tokens live on :root so a theme (applied as :root overrides) reaches
   the whole page — body chrome included, not just .docskin content. */
:root{
  --navy:#000000; --navy-tint:#d4d4d4; --blue:#0070f3; --light-blue:#e5f0ff;
  --charcoal:#111111; --slate:#444444; --gray:#888888; --light-gray:#fafafa;
  --rule:#eaeaea; --highlight:#0070f3; --highlight-soft:#e5f0ff;
  --positive:#16a34a; --positive-soft:#e7f6ec; --negative:#e5484d; --negative-soft:#fdeaea;
  --purple:#7c3aed; --purple-soft:#f1ebfe; --teal:#0d9488; --teal-soft:#e0f2f1; --white:#fff;
  --radius:8px;
  --font-display:"Inter","SF Pro Display",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
  --font-body:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
  --font-mono:"Geist Mono","SF Mono",ui-monospace,Menlo,Consolas,"Courier New",monospace;
}
body{background:var(--white);color:var(--charcoal);font-family:var(--font-body);font-size:14px;line-height:1.55;}
.docskin{
  background:var(--white); color:var(--charcoal); font-family:var(--font-body); font-size:14px; line-height:1.55;
  max-width:1180px; margin:0 auto; padding:0 56px 128px;
}
.docskin .cover-bar{height:8px;background:var(--navy);margin:0 -56px 36px;}
.docskin .cover-pad{padding:0 0 40px;margin-bottom:56px;border-bottom:1px solid var(--rule);}
.docskin .cover-meta{display:flex;justify-content:space-between;flex-wrap:wrap;gap:16px;font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--gray);font-weight:600;margin-bottom:32px;}
.docskin .cover-meta .accent{color:var(--highlight);}
.docskin .cover-title{font-family:var(--font-display);font-weight:700;font-size:clamp(32px,4.4vw,50px);line-height:1.1;letter-spacing:-.02em;color:var(--navy);margin:0 0 20px;}
.docskin .cover-sub{font-size:17px;line-height:1.5;color:var(--slate);max-width:820px;margin:0 0 36px;}
.docskin .section{padding:0;margin-bottom:64px;}
.docskin .section > *:last-child{margin-bottom:0;}
.docskin .section-num{font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:var(--highlight);font-weight:700;margin-bottom:8px;}
.docskin .section-head{margin-bottom:28px;padding-bottom:16px;border-bottom:2px solid var(--navy);}
.docskin .section-head .section-title{border-bottom:0;padding-bottom:0;margin-bottom:14px;}
.docskin .section-title{font-family:var(--font-display);font-weight:700;font-size:clamp(24px,3vw,32px);line-height:1.15;letter-spacing:-.015em;color:var(--navy);margin:0 0 14px;padding-bottom:12px;border-bottom:2px solid var(--navy);}
.docskin .section-lede{font-size:14.5px;color:var(--slate);line-height:1.55;max-width:820px;margin:0;}
.docskin .section-block{margin-bottom:64px;}
.docskin .section-block:last-child{margin-bottom:0;}
.docskin .diagram{margin:28px 0 36px;border:1px solid var(--rule);background:var(--white);padding:22px 26px 18px;border-radius:var(--radius);}
.docskin .diagram-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px;padding-bottom:12px;margin-bottom:16px;border-bottom:1px dashed var(--rule);}
.docskin .diagram-tag{font-family:var(--font-mono);font-size:10px;font-weight:700;padding:3px 9px;background:var(--navy);color:var(--white);letter-spacing:.08em;text-transform:uppercase;}
.docskin .diagram-tag.post{background:var(--navy);} .docskin .diagram-tag.get{background:var(--positive);} .docskin .diagram-tag.c4{background:var(--blue);}
.docskin .diagram-title{font-family:var(--font-display);font-weight:700;font-size:16px;color:var(--charcoal);flex:1;}
.docskin .diagram-fignum{font-size:10px;color:var(--gray);text-transform:uppercase;letter-spacing:.1em;font-weight:700;}
.docskin .diagram-desc{font-size:13px;color:var(--slate);margin:0 0 12px;}
.docskin .diagram svg{display:block;margin:0 auto;max-width:100%;height:auto;}
/* sequence */
.docskin .lane-head{fill:var(--navy);} .docskin .lane-head.ext{fill:var(--slate);}
.docskin .lane-head-text{fill:var(--white);font-family:var(--font-body);font-size:12px;font-weight:700;text-anchor:middle;}
.docskin .lane-head-sub{fill:var(--navy-tint);font-family:var(--font-mono);font-size:9px;text-anchor:middle;letter-spacing:.06em;}
.docskin .lane-head-sub.ext{fill:#cbd5e1;}
.docskin .lifeline{stroke:var(--gray);stroke-width:1;stroke-dasharray:3 3;}
.docskin .activation{fill:var(--light-blue);stroke:var(--navy);stroke-width:1;} .docskin .activation.pg{fill:var(--positive-soft);stroke:var(--positive);}
.docskin .msg-line{stroke:var(--charcoal);stroke-width:1.2;fill:none;}
.docskin .msg-line.dashed{stroke-dasharray:5 3;} .docskin .msg-line.err{stroke:var(--negative);stroke-width:1.4;}
.docskin .msg-text{fill:var(--charcoal);font-family:var(--font-mono);font-size:10.5px;}
.docskin .msg-text.em{fill:var(--navy);font-weight:700;} .docskin .msg-text.err{fill:var(--negative);font-weight:700;} .docskin .msg-text.note{fill:var(--gray);font-style:italic;}
.docskin .step-badge{fill:var(--navy);} .docskin .step-badge.err{fill:var(--negative);}
.docskin .step-badge-text{fill:var(--white);font-family:var(--font-mono);font-size:10px;font-weight:700;text-anchor:middle;}
.docskin .seq-steps{margin-top:16px;padding:14px 18px;background:var(--light-gray);border:1px solid var(--rule);}
.docskin .seq-steps-title{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--navy);font-weight:700;margin-bottom:8px;}
.docskin .seq-steps ol{list-style:none;counter-reset:step;padding:0;margin:0;}
.docskin .seq-steps li{counter-increment:step;padding:7px 0 8px 40px;position:relative;border-bottom:1px solid var(--rule);}
.docskin .seq-steps li:last-child{border-bottom:none;}
.docskin .seq-steps li::before{content:counter(step);position:absolute;left:0;top:7px;width:26px;height:20px;background:var(--navy);color:var(--white);font-family:var(--font-mono);font-size:11px;font-weight:700;text-align:center;line-height:20px;border-radius:2px;}
.docskin .seq-steps li.err::before{background:var(--negative);}
.docskin .step-actor{font-family:var(--font-mono);font-size:11px;font-weight:700;color:var(--navy);margin-right:8px;text-transform:uppercase;letter-spacing:.06em;}
.docskin .step-actor.err{color:var(--negative);}
.docskin .step-summary{font-size:13px;color:var(--charcoal);}
/* c4 */
.docskin .c4-name{font-family:var(--font-display);font-size:14px;font-weight:700;}
.docskin .c4-tech{font-family:var(--font-mono);font-size:9.5px;}
.docskin .c4-desc{font-family:var(--font-body);font-size:10px;}
.docskin .c4-chip{font-family:var(--font-body);font-size:8px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;}
.docskin .edge-label{font-family:var(--font-body);font-size:9.5px;fill:var(--slate);text-anchor:middle;}
.docskin .edge-label.err{fill:var(--negative);font-weight:700;}
.docskin .c4-boundary{fill:none;stroke:var(--navy);stroke-width:1.4;stroke-dasharray:8 5;}
.docskin .c4-boundary-label{font-family:var(--font-body);font-size:10px;font-weight:700;fill:var(--navy);letter-spacing:.08em;text-transform:uppercase;}
.docskin .legend{display:flex;flex-wrap:wrap;gap:8px 16px;margin-top:14px;padding-top:12px;border-top:1px dashed var(--rule);}
.docskin .legend .item{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--slate);}
.docskin .legend .sw{width:13px;height:13px;border-radius:3px;}
/* code block */
.docskin .code-block{margin:12px 0 16px;border:1px solid var(--rule);}
.docskin .code-header{display:flex;justify-content:space-between;padding:6px 14px;background:var(--light-gray);font-family:var(--font-mono);font-size:11px;font-weight:700;color:var(--slate);border-bottom:1px solid var(--rule);letter-spacing:.04em;}
.docskin .code-block pre{padding:14px 16px;font-family:var(--font-mono);font-size:12px;line-height:1.55;color:var(--charcoal);overflow-x:auto;background:var(--white);white-space:pre;margin:0;}
.docskin .code-block .kw{color:var(--navy);font-weight:700;} .docskin .code-block .com{color:var(--gray);font-style:italic;}
.docskin .code-block .str{color:var(--positive);} .docskin .code-block .num{color:var(--purple);} .docskin .code-block .fn{color:var(--blue);} .docskin .code-block .ty{color:var(--teal);}
/* er */
.docskin .er-head-text{fill:#fff;font-family:var(--font-display);font-size:13px;font-weight:700;text-anchor:middle;}
.docskin .er-col{font-family:var(--font-mono);font-size:10.5px;fill:var(--charcoal);} .docskin .er-col.dim{fill:var(--gray);}
.docskin .er-key{font-family:var(--font-mono);font-size:9px;font-weight:700;fill:var(--navy);} .docskin .er-key.fk{fill:var(--highlight);}
.docskin .er-rowline{stroke:var(--light-gray);stroke-width:1;}
/* block / state / flow shared text */
.docskin .blk-name{font-family:var(--font-display);font-size:13px;font-weight:700;}
.docskin .blk-tech{font-family:var(--font-mono);font-size:9.5px;}
.docskin .blk-chip{font-family:var(--font-body);font-size:8px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;}
.docskin .grp-label{font-family:var(--font-body);font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;}
.docskin .sm-name{font-family:var(--font-display);font-size:13px;font-weight:700;text-anchor:middle;}
.docskin .fc-label{font-family:var(--font-display);font-size:12px;font-weight:700;text-anchor:middle;}
.docskin .endpoint-card{border:1px solid var(--rule);margin:16px 0;padding:18px 22px;background:var(--white);}
.docskin .endpoint-header{display:flex;align-items:center;gap:12px;margin-bottom:10px;padding-bottom:10px;border-bottom:1px dashed var(--rule);}
.docskin .endpoint-method{font-family:var(--font-mono);font-size:11px;font-weight:700;padding:4px 10px;color:var(--white);letter-spacing:.08em;text-transform:uppercase;}
.docskin .endpoint-method.get{background:var(--positive);} .docskin .endpoint-method.post{background:var(--navy);} .docskin .endpoint-method.patch{background:var(--highlight);} .docskin .endpoint-method.delete{background:var(--negative);} .docskin .endpoint-method.put{background:var(--blue);}
.docskin .endpoint-path{font-family:var(--font-mono);font-size:15px;font-weight:700;color:var(--charcoal);flex:1;}
.docskin .endpoint-status{font-family:var(--font-mono);font-size:11.5px;color:var(--positive);font-weight:700;}
.docskin .endpoint-desc{font-size:13px;color:var(--slate);margin:0 0 8px;}
.docskin .endpoint-card h4{font-size:11px;text-transform:uppercase;letter-spacing:.12em;font-weight:700;color:var(--highlight);margin:14px 0 6px;}
.docskin .endpoint-card ul{margin:0 0 0 20px;} .docskin .endpoint-card li{font-size:13px;margin-bottom:3px;}
.docskin code{font-family:var(--font-mono);font-size:.86em;background:var(--light-gray);padding:2px 6px;border-radius:2px;border:1px solid var(--rule);}
.docskin .transition-table{width:100%;border-collapse:collapse;margin:16px 0 8px;font-size:12px;}
.docskin .transition-table thead{background:var(--navy);color:#fff;}
.docskin .transition-table th{text-align:left;padding:8px 10px;font-size:9.5px;text-transform:uppercase;letter-spacing:.1em;}
.docskin .transition-table td{padding:8px 10px;border-bottom:1px solid var(--rule);vertical-align:top;}
.docskin .pill{display:inline-block;font-family:var(--font-mono);font-size:10px;font-weight:700;padding:2px 7px;border-radius:2px;text-transform:uppercase;}
.docskin .pill-init{background:var(--light-gray);color:var(--slate);border:1px solid var(--rule);}
.docskin .pill-active{background:var(--positive-soft);color:var(--positive);border:1px solid var(--positive);}
.docskin .pill-wait{background:var(--highlight-soft);color:var(--highlight);border:1px solid var(--highlight);}
.docskin .pill-end{background:var(--charcoal);color:#fff;}
/* presentation: comparison table */
.docskin .pres-table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px;}
.docskin .pres-table thead{background:var(--navy);color:#fff;}
.docskin .pres-table th{padding:9px 12px;text-align:left;font-family:var(--font-body);font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;}
.docskin .pres-table th.r,.docskin .pres-table td.r{text-align:right;} .docskin .pres-table th.c,.docskin .pres-table td.c{text-align:center;}
.docskin .pres-table th.hi{background:var(--highlight);}
.docskin .pres-table td{padding:9px 12px;border-bottom:1px solid var(--rule);}
.docskin .pres-table tbody tr:nth-child(even){background:var(--light-gray);}
.docskin .pres-table td.lead{font-weight:700;color:var(--navy);font-family:var(--font-display);}
.docskin .pres-table td.hi{background:var(--highlight-soft);}
.docskin .cell-pos{color:var(--positive);font-weight:700;} .docskin .cell-neg{color:var(--negative);font-weight:700;} .docskin .cell-warn{color:var(--highlight);font-weight:700;} .docskin .cell-muted{color:var(--gray);}
.docskin .badge{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;font-size:12px;font-weight:700;}
.docskin .badge.yes{background:var(--positive-soft);color:var(--positive);} .docskin .badge.no{background:var(--negative-soft);color:var(--negative);}
.docskin .tbl-note{font-size:11px;color:var(--gray);font-style:italic;margin-top:6px;}
/* presentation: stat cards */
.docskin .stat-row{display:flex;flex-wrap:wrap;gap:14px;margin:16px 0;}
.docskin .stat-card{flex:1 1 150px;border:1px solid var(--rule);border-top:3px solid var(--navy);padding:16px 18px;background:var(--white);}
.docskin .stat-value{font-family:var(--font-display);font-size:30px;font-weight:700;color:var(--navy);line-height:1;}
.docskin .stat-label{font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--gray);font-weight:700;margin-top:8px;}
.docskin .stat-delta{font-family:var(--font-mono);font-size:12px;font-weight:700;margin-top:6px;}
.docskin .stat-delta.up{color:var(--positive);} .docskin .stat-delta.down{color:var(--negative);} .docskin .stat-delta.flat{color:var(--gray);}
/* presentation: timeline */
.docskin .tl{position:relative;margin:18px 0;padding-left:8px;}
.docskin .tl::before{content:"";position:absolute;left:9px;top:6px;bottom:6px;width:2px;background:var(--rule);}
.docskin .tl-item{position:relative;padding:0 0 18px 30px;}
.docskin .tl-item:last-child{padding-bottom:0;}
.docskin .tl-dot{position:absolute;left:2px;top:2px;width:16px;height:16px;border-radius:50%;background:var(--white);border:3px solid var(--rule);box-sizing:border-box;}
.docskin .tl-dot.done{background:var(--positive);border-color:var(--positive);} .docskin .tl-dot.current{background:var(--highlight);border-color:var(--highlight);} .docskin .tl-dot.next{border-color:var(--navy);}
.docskin .tl-date{font-family:var(--font-mono);font-size:10.5px;font-weight:700;color:var(--highlight);text-transform:uppercase;letter-spacing:.06em;}
.docskin .tl-label{font-family:var(--font-display);font-size:15px;font-weight:700;color:var(--navy);margin:1px 0 2px;}
.docskin .tl-desc{font-size:12.5px;color:var(--slate);}
/* presentation: quadrant */
.docskin .quad-axis{stroke:var(--charcoal);stroke-width:1.5;}
.docskin .quad-end{font-family:var(--font-body);font-size:10px;font-weight:700;fill:var(--gray);text-transform:uppercase;letter-spacing:.06em;}
.docskin .quad-title{font-family:var(--font-body);font-size:11px;font-weight:700;fill:var(--navy);text-transform:uppercase;letter-spacing:.08em;}
.docskin .quad-pt-label{font-family:var(--font-body);font-size:11px;font-weight:700;fill:var(--charcoal);}
.docskin .toc{margin:18px 0 6px;padding:14px 20px;background:var(--light-gray);border:1px solid var(--rule);border-left:4px solid var(--highlight);}
.docskin .toc-title{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--navy);font-weight:700;margin-bottom:8px;}
.docskin .toc ol{margin:0;padding-left:20px;} .docskin .toc li{font-size:13px;margin-bottom:4px;color:var(--slate);}
.docskin .toc li span{color:var(--gray);font-family:var(--font-mono);font-size:11px;}
/* swimlane */
.docskin .sl-lane-label{font-family:var(--font-display);font-size:12px;font-weight:700;fill:#fff;}
.docskin .sl-step{font-family:var(--font-body);font-size:11px;font-weight:700;text-anchor:middle;}
/* callouts */
.docskin .callout{border:1px solid var(--rule);border-left:4px solid var(--navy);padding:12px 16px;margin:10px 0;}
.docskin .callout.note{border-left-color:var(--navy);background:var(--light-blue);} .docskin .callout.tip{border-left-color:var(--positive);background:var(--positive-soft);} .docskin .callout.warn{border-left-color:var(--highlight);background:var(--highlight-soft);} .docskin .callout.danger{border-left-color:var(--negative);background:var(--negative-soft);}
.docskin .callout-title{font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;font-weight:700;margin-bottom:4px;}
.docskin .callout.note .callout-title{color:var(--navy);} .docskin .callout.tip .callout-title{color:var(--positive);} .docskin .callout.warn .callout-title{color:#b45309;} .docskin .callout.danger .callout-title{color:var(--negative);}
.docskin .callout-body{font-size:13px;color:var(--slate);}
/* prose */
.docskin .prose h2{font-family:var(--font-display);font-weight:700;font-size:clamp(24px,3vw,32px);line-height:1.15;letter-spacing:-.015em;color:var(--navy);margin:40px 0 14px;padding-bottom:12px;border-bottom:2px solid var(--navy);}
.docskin .prose h2:first-child{margin-top:0;}
.docskin .prose h3{font-family:var(--font-display);font-weight:700;font-size:19px;letter-spacing:-.005em;color:var(--navy);margin:36px 0 12px;}
.docskin .prose h4{font-size:11px;text-transform:uppercase;letter-spacing:.12em;font-weight:700;color:var(--highlight);margin:22px 0 8px;}
.docskin .prose p{font-size:14px;color:var(--charcoal);margin:0 0 14px;line-height:1.6;max-width:880px;}
.docskin .prose ul,.docskin .prose ol{margin:0 0 14px 22px;}
.docskin .prose li{font-size:13.5px;color:var(--charcoal);margin-bottom:4px;max-width:880px;line-height:1.55;}
.docskin .prose blockquote{border-left:3px solid var(--highlight);padding:4px 14px;margin:14px 0;color:var(--slate);font-style:italic;font-family:var(--font-display);}
.docskin .prose code{font-family:var(--font-mono);font-size:.86em;background:var(--light-gray);padding:2px 6px;border-radius:2px;color:var(--charcoal);border:1px solid var(--rule);}
.docskin .prose strong{font-weight:700;color:var(--charcoal);}
.docskin .prose em{font-style:italic;}
/* glossary */
.docskin .glossary{margin:10px 0;}
.docskin .glossary .row{display:grid;grid-template-columns:170px 1fr;gap:14px;padding:9px 0;border-bottom:1px solid var(--rule);}
.docskin .glossary dt{font-family:var(--font-mono);font-size:13px;font-weight:700;color:var(--navy);}
.docskin .glossary dd{margin:0;font-size:13px;color:var(--slate);}
/* pros / cons */
.docskin .pc{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:12px 0;}
.docskin .pc-col{border:1px solid var(--rule);padding:14px 16px;}
.docskin .pc-col.pro{border-top:3px solid var(--positive);} .docskin .pc-col.con{border-top:3px solid var(--negative);}
.docskin .pc-head{font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:700;margin-bottom:8px;}
.docskin .pc-col.pro .pc-head{color:var(--positive);} .docskin .pc-col.con .pc-head{color:var(--negative);}
.docskin .pc-item{font-size:13px;color:var(--slate);padding:4px 0 4px 22px;position:relative;}
.docskin .pc-item::before{position:absolute;left:0;top:4px;font-weight:700;}
.docskin .pc-col.pro .pc-item::before{content:"\\2713";color:var(--positive);} .docskin .pc-col.con .pc-item::before{content:"\\2717";color:var(--negative);}
/* current / target */
.docskin .ct{display:flex;align-items:stretch;margin:12px 0;}
.docskin .ct-panel{flex:1;border:1px solid var(--rule);padding:14px 18px;}
.docskin .ct-panel.cur{background:var(--light-gray);} .docskin .ct-panel.tgt{border-top:3px solid var(--navy);}
.docskin .ct-arrow{display:flex;align-items:center;padding:0 14px;color:var(--highlight);font-size:22px;font-weight:700;}
.docskin .ct-label{font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:700;color:var(--gray);margin-bottom:8px;}
.docskin .ct-panel.tgt .ct-label{color:var(--navy);}
.docskin .ct-item{font-size:13px;color:var(--slate);padding:3px 0;}
/* kanban */
.docskin .kanban{display:flex;gap:14px;margin:12px 0;overflow-x:auto;}
.docskin .kan-col{flex:1 1 0;min-width:150px;background:var(--light-gray);border:1px solid var(--rule);}
.docskin .kan-head{background:var(--navy);color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;padding:8px 12px;}
.docskin .kan-card{background:var(--white);border:1px solid var(--rule);border-left:3px solid var(--highlight);margin:8px;padding:9px 11px;}
.docskin .kan-card-title{font-size:13px;font-weight:700;color:var(--charcoal);}
.docskin .kan-card-tag{display:inline-block;font-family:var(--font-mono);font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--gray);margin-top:4px;}
/* pass 2 chart labels */
.docskin .dfd-name{font-family:var(--font-display);font-size:12px;font-weight:700;text-anchor:middle;}
.docskin .dfd-num{font-family:var(--font-mono);font-size:9px;font-weight:700;}
.docskin .gantt-label{font-family:var(--font-body);font-size:11px;fill:var(--charcoal);}
.docskin .gantt-head{font-family:var(--font-mono);font-size:9.5px;fill:var(--gray);text-anchor:middle;}
.docskin .funnel-label{font-family:var(--font-display);font-size:13px;font-weight:700;fill:#fff;text-anchor:middle;}
.docskin .funnel-val{font-family:var(--font-mono);font-size:11px;fill:#fff;text-anchor:middle;opacity:.9;}
.docskin .pyr-label{font-family:var(--font-display);font-size:13px;font-weight:700;fill:#fff;text-anchor:middle;}
.docskin .pyr-desc{font-family:var(--font-body);font-size:10px;fill:#fff;text-anchor:middle;opacity:.85;}
/* indented tree */
.docskin .tree-list{margin:10px 0;font-size:13px;}
.docskin .tree-row{display:flex;align-items:baseline;padding:3px 0;}
.docskin .tree-row .tw{color:var(--gray);margin-right:8px;font-family:var(--font-mono);font-size:11px;}
.docskin .tree-row.branch .tw{color:var(--navy);}
.docskin .tree-row .tlabel{color:var(--charcoal);font-family:var(--font-mono);}
.docskin .tree-row.branch .tlabel{font-weight:700;color:var(--navy);}
.docskin .tree-row .tnote{color:var(--gray);font-size:11px;margin-left:10px;font-family:var(--font-body);font-style:italic;}
/* agenda */
.docskin .agenda{margin:10px 0;}
.docskin .agenda-row{display:grid;grid-template-columns:88px 1fr;gap:14px;padding:10px 0;border-bottom:1px solid var(--rule);}
.docskin .agenda-time{font-family:var(--font-mono);font-size:12px;font-weight:700;color:var(--navy);}
.docskin .agenda-dur{font-family:var(--font-mono);font-size:10px;color:var(--gray);margin-top:2px;}
.docskin .agenda-title{font-family:var(--font-display);font-size:14px;font-weight:700;color:var(--charcoal);}
.docskin .agenda-owner{font-size:10.5px;color:var(--highlight);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-left:8px;}
.docskin .agenda-desc{font-size:12.5px;color:var(--slate);margin-top:2px;}
/* tracker */
.docskin .trk{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;}
.docskin .trk thead{background:var(--navy);color:#fff;} .docskin .trk th{padding:8px 10px;text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;}
.docskin .trk td{padding:8px 10px;border-bottom:1px solid var(--rule);vertical-align:middle;}
.docskin .trk tr.done .trk-task{text-decoration:line-through;color:var(--gray);}
.docskin .st{display:inline-block;font-family:var(--font-mono);font-size:9.5px;font-weight:700;padding:2px 8px;border-radius:10px;text-transform:uppercase;letter-spacing:.04em;}
.docskin .st.todo{background:var(--light-gray);color:var(--slate);border:1px solid var(--rule);} .docskin .st.doing{background:var(--highlight-soft);color:#b45309;} .docskin .st.done{background:var(--positive-soft);color:var(--positive);} .docskin .st.blocked{background:var(--negative-soft);color:var(--negative);}
.docskin .pri{font-family:var(--font-mono);font-size:10px;font-weight:700;} .docskin .pri.high{color:var(--negative);} .docskin .pri.med{color:var(--highlight);} .docskin .pri.low{color:var(--gray);}
/* cluster */
.docskin .cl-head{font-family:var(--font-display);font-size:13px;font-weight:700;fill:#fff;}
.docskin .cl-kind{font-family:var(--font-mono);font-size:9px;fill:#cfe0f3;text-anchor:end;text-transform:uppercase;letter-spacing:.06em;}
/* user story */
.docskin .story{border:1px solid var(--rule);border-left:4px solid var(--navy);padding:18px 22px;margin:12px 0;background:var(--white);}
.docskin .story-stmt{font-family:var(--font-display);font-size:18px;line-height:1.55;color:var(--charcoal);}
.docskin .story-stmt b{color:var(--navy);}
.docskin .story-meta{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;}
.docskin .story-chip{font-family:var(--font-mono);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:3px 9px;border-radius:3px;background:var(--light-gray);color:var(--slate);border:1px solid var(--rule);}
.docskin .ac-title{font-size:10.5px;text-transform:uppercase;letter-spacing:.12em;color:var(--highlight);font-weight:700;margin:16px 0 8px;}
.docskin .ac-item{border:1px solid var(--rule);padding:10px 14px;margin-bottom:8px;background:var(--white);}
.docskin .gwt{display:grid;grid-template-columns:60px 1fr;gap:4px 12px;font-size:13px;}
.docskin .gwt .k{font-family:var(--font-mono);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding-top:1px;}
.docskin .gwt .k.g{color:var(--positive);} .docskin .gwt .k.w{color:var(--navy);} .docskin .gwt .k.t{color:var(--highlight);}
.docskin .gwt .v{color:var(--charcoal);}
.docskin .links-row{display:flex;gap:8px;flex-wrap:wrap;}
.docskin .link-chip{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--navy);border:1px solid var(--navy);background:var(--white);padding:5px 11px;border-radius:20px;cursor:pointer;}
.docskin .link-chip .lt{color:var(--gray);font-family:var(--font-mono);font-size:9px;text-transform:uppercase;letter-spacing:.06em;}
.docskin .footer{margin-top:8px;padding:18px 32px 28px;border-top:2px solid var(--navy);font-size:11px;color:var(--gray);text-transform:uppercase;letter-spacing:.1em;font-weight:700;display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;}
.docskin .footer .accent{color:var(--highlight);}
.docskin .layer-label{font-family:var(--font-display);font-size:13px;font-weight:700;fill:#fff;}
.docskin .uml-name{font-family:var(--font-display);font-size:13px;font-weight:700;text-anchor:middle;fill:#0a3a6e;}
.docskin .uml-stereo{font-family:var(--font-body);font-size:9px;font-style:italic;text-anchor:middle;fill:#6b7280;}
.docskin .uml-row{font-family:var(--font-mono);font-size:10.5px;fill:var(--charcoal);}
.docskin .uml-sep{stroke:#0e54a1;stroke-width:1;}
.docskin .ft-note{font-family:var(--font-mono);font-size:9px;}
.docskin .tree-link{stroke:#9ca3af;stroke-width:1.3;fill:none;}
/* wireframe / UI mockups */
.docskin .wf-h{font-family:var(--font-display);font-size:18px;font-weight:700;}
.docskin .wf-sub{font-family:var(--font-body);font-size:12px;font-weight:600;}
.docskin .wf-btn{font-family:var(--font-body);font-size:11px;font-weight:700;fill:#fff;}
.docskin .wf-ph-text{font-family:var(--font-body);font-size:10px;fill:var(--gray);}
.docskin .wf-status{font-family:var(--font-mono);font-size:9px;fill:var(--charcoal);font-weight:700;}
.docskin .wf-url{font-family:var(--font-mono);font-size:8.5px;fill:var(--gray);}
.docskin .wf-tab{font-family:var(--font-body);font-size:8px;}
.docskin .wf-caption{font-family:var(--font-mono);font-size:10px;fill:var(--gray);letter-spacing:.04em;}
/* parse error */
.docskin .err{font-family:var(--font-mono);font-size:12px;color:var(--negative);background:#fdf2f2;border:1px solid #f3c9c9;padding:8px 12px;margin:12px 0;white-space:pre-wrap;}`;
