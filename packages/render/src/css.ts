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
  /* Default = "textbook": warm cream paper, deep academic navy, terracotta accent,
     classic serif display + body. Bigger headings for a printed-page feel. */
  --navy:#233a5e; --navy-tint:#c4d0e2; --blue:#2f5c8f; --light-blue:#e8eef6;
  --charcoal:#211f1a; --slate:#4a463d; --gray:#8a8475; --light-gray:#f2efe6;
  --rule:#e4dccb; --highlight:#9c4a2f; --highlight-soft:#f3e4dc;
  --positive:#3f7d4e; --positive-soft:#e3efe2; --negative:#a13b2e; --negative-soft:#f4e0db;
  --purple:#5b4a8a; --purple-soft:#ebe6f3; --teal:#2f6f6a; --teal-soft:#e0eeec; --white:#fcfbf7;
  --radius:6px;
  --font-display:"Inter","SF Pro Display",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
  --font-body:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
  --font-mono:"SF Mono",ui-monospace,Menlo,Consolas,"Courier New",monospace;
}
body{background:var(--white);color:var(--charcoal);font-family:var(--font-body);font-size:15px;line-height:1.6;}
.docskin{
  background:var(--white); color:var(--charcoal); font-family:var(--font-body); font-size:15px; line-height:1.6;
  max-width:1180px; margin:0 auto; padding:0 56px 128px;
}
.docskin .cover-bar{height:8px;background:var(--navy);margin:0 -56px 36px;}
.docskin .cover-pad{padding:0 0 40px;margin-bottom:56px;border-bottom:1px solid var(--rule);}
.docskin .cover-logo{display:block;height:52px;width:auto;max-width:260px;margin:0 0 28px;}
.docskin .cover-meta{display:flex;justify-content:space-between;flex-wrap:wrap;gap:16px;font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--gray);font-weight:600;margin-bottom:32px;}
.docskin .cover-meta .accent{color:var(--highlight);}
.docskin .cover-title{font-family:var(--font-display);font-weight:700;font-size:clamp(40px,5.2vw,62px);line-height:1.08;letter-spacing:-.015em;color:var(--navy);margin:0 0 22px;}
.docskin .cover-sub{font-size:19px;line-height:1.55;color:var(--slate);max-width:860px;margin:0 0 36px;}
.docskin .section{padding:0;margin-bottom:64px;}
.docskin .section > *:last-child{margin-bottom:0;}
.docskin .section-num{font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:var(--highlight);font-weight:700;margin-bottom:8px;}
.docskin .section-head{margin-bottom:28px;padding-bottom:16px;border-bottom:2px solid var(--navy);}
.docskin .section-head .section-title{border-bottom:0;padding-bottom:0;margin-bottom:14px;}
.docskin .section-title{font-family:var(--font-display);font-weight:700;font-size:clamp(28px,3.6vw,40px);line-height:1.15;letter-spacing:-.01em;color:var(--navy);margin:0 0 14px;padding-bottom:12px;border-bottom:2px solid var(--navy);}
.docskin .section-lede{font-size:15.5px;color:var(--slate);line-height:1.6;max-width:860px;margin:0;}
.docskin .section-block{margin-bottom:64px;scroll-margin-top:16px;}
.docskin .section-block:last-child{margin-bottom:0;}
.docskin .block-anchor{position:relative;display:block;height:0;scroll-margin-top:16px;}
.docskin .diagram{margin:28px 0 36px;border:1px solid var(--rule);background:var(--white);padding:24px 28px 20px;border-radius:10px;box-shadow:0 1px 2px rgba(0,0,0,.03),0 8px 20px -14px rgba(0,0,0,.10);}
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
/* numbered edge steps (dense diagrams): circled numerals on arrows + legend below */
.docskin .edge-steps{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:12px;padding-top:10px;border-top:1px solid var(--rule);}
.docskin .edge-step{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--slate);}
.docskin .edge-step b{flex:none;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;border:1px solid var(--charcoal);color:var(--charcoal);font-family:var(--font-mono);font-size:10px;font-weight:700;background:var(--white);}
.docskin .edge-step.err{color:var(--negative);}
.docskin .edge-step.err b{border-color:var(--negative);color:var(--negative);}
.docskin .c4-boundary{fill:none;stroke:var(--navy);stroke-width:1.4;stroke-dasharray:8 5;}
.docskin .c4-boundary-label{font-family:var(--font-body);font-size:10px;font-weight:700;fill:var(--navy);letter-spacing:.08em;text-transform:uppercase;}
.docskin .legend{display:flex;flex-wrap:wrap;gap:8px 16px;margin-top:14px;padding-top:12px;border-top:1px dashed var(--rule);}
.docskin .legend .item{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--slate);}
.docskin .legend .sw{width:13px;height:13px;border-radius:3px;}
/* code block */
/* Code surfaces are a dark editor theme everywhere (code block, gallery, sequence). */
.docskin pre{background:#15171e;color:#cdd3de;padding:18px 20px;font-family:var(--font-mono);font-size:12.5px;line-height:1.65;overflow-x:auto;white-space:pre;margin:0;-moz-tab-size:2;tab-size:2;}
.docskin pre .kw{color:#c678dd;font-weight:600;} .docskin pre .com{color:#6b7385;font-style:italic;}
.docskin pre .str{color:#98c379;} .docskin pre .num{color:#d19a66;} .docskin pre .fn{color:#61afef;} .docskin pre .ty{color:#e5c07b;}
.docskin .code-block{margin:14px 0 18px;border-radius:9px;overflow:hidden;border:1px solid #2a2f3a;box-shadow:0 2px 12px rgba(0,0,0,.16);}
.docskin .code-header{display:flex;justify-content:space-between;align-items:center;padding:9px 16px;background:#0f1116;color:#8b93a7;font-family:var(--font-mono);font-size:11px;font-weight:600;letter-spacing:.04em;border-bottom:1px solid #2a2f3a;}
/* macOS-style traffic lights on full code blocks (not the tighter gallery cards). */
.docskin .code-block>.code-header::before{content:"";flex:none;width:11px;height:11px;border-radius:50%;background:#ff5f56;box-shadow:17px 0 0 #ffbd2e,34px 0 0 #27c93f;margin-right:42px;}
.docskin .code-block>pre{border-radius:0;}
/* er */
.docskin .er-head-text{fill:var(--navy);font-family:var(--font-display);font-size:13px;font-weight:700;text-anchor:middle;}
.docskin .er-col{font-family:var(--font-mono);font-size:10.5px;fill:var(--charcoal);} .docskin .er-col.dim{fill:var(--gray);}
.docskin .er-key{font-family:var(--font-mono);font-size:9px;font-weight:700;fill:var(--navy);} .docskin .er-key.pk{fill:var(--highlight);} .docskin .er-key.fk{fill:var(--navy);}
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
.docskin .toc{margin:18px 0 6px;padding:14px 20px;background:var(--light-gray);border:1px solid var(--rule);border-left:4px solid var(--highlight);border-radius:0 var(--radius) var(--radius) 0;}
.docskin .toc-title{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--navy);font-weight:700;margin-bottom:8px;}
.docskin .toc ol{margin:0;padding-left:20px;} .docskin .toc li{font-size:13px;margin-bottom:4px;color:var(--slate);}
.docskin .toc li span{color:var(--gray);font-family:var(--font-mono);font-size:11px;}
/* swimlane */
.docskin .sl-lane-label{font-family:var(--font-display);font-size:12px;font-weight:700;fill:#fff;}
.docskin .sl-step{font-family:var(--font-body);font-size:11px;font-weight:700;text-anchor:middle;}
/* callouts */
.docskin .callout{border:1px solid var(--rule);border-left:4px solid var(--navy);padding:14px 18px;margin:14px 0;border-radius:0 var(--radius) var(--radius) 0;}
.docskin .callout.note{border-left-color:var(--navy);background:var(--light-blue);} .docskin .callout.tip{border-left-color:var(--positive);background:var(--positive-soft);} .docskin .callout.warn{border-left-color:var(--highlight);background:var(--highlight-soft);} .docskin .callout.danger{border-left-color:var(--negative);background:var(--negative-soft);} .docskin .callout.success{border-left-color:var(--positive);background:var(--positive-soft);}
.docskin .callout-title{font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;font-weight:700;margin-bottom:4px;}
.docskin .callout.note .callout-title{color:var(--navy);} .docskin .callout.tip .callout-title{color:var(--positive);} .docskin .callout.warn .callout-title{color:#b45309;} .docskin .callout.danger .callout-title{color:var(--negative);} .docskin .callout.success .callout-title{color:var(--positive);}
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
.docskin .kan-card{background:var(--white);border:1px solid var(--rule);border-left:3px solid var(--highlight);margin:8px;padding:9px 11px;border-radius:0 var(--radius) var(--radius) 0;}
.docskin .kan-card-title{font-size:13px;font-weight:700;color:var(--charcoal);}
.docskin .kan-card-tag{display:inline-block;font-family:var(--font-mono);font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--gray);margin-top:4px;}
/* pass 2 chart labels */
.docskin .dfd-name{font-family:var(--font-display);font-size:12px;font-weight:700;text-anchor:middle;}
.docskin .dfd-num{font-family:var(--font-mono);font-size:9px;font-weight:700;}
.docskin .gantt-label{font-family:var(--font-body);font-size:11px;fill:var(--charcoal);}
.docskin .gantt-head{font-family:var(--font-mono);font-size:9.5px;fill:var(--gray);text-anchor:middle;}
.docskin .pyr-label{font-family:var(--font-display);font-size:12.5px;font-weight:700;fill:var(--white);text-anchor:middle;}
.docskin .pyr-desc{font-family:var(--font-body);font-size:10px;fill:var(--white);text-anchor:middle;opacity:.85;}
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
.docskin .story{border:1px solid var(--rule);border-left:4px solid var(--navy);padding:18px 22px;margin:12px 0;background:var(--white);border-radius:0 var(--radius) var(--radius) 0;}
.docskin .story-stmt{font-family:var(--font-display);font-size:18px;line-height:1.55;color:var(--charcoal);}
.docskin .story-stmt b{color:var(--navy);}
.docskin .story-meta{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;}
.docskin .story-chip{font-family:var(--font-mono);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:3px 9px;border-radius:3px;background:var(--light-gray);color:var(--slate);border:1px solid var(--rule);}
.docskin .story-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;}
.docskin .story-title{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-right:auto;}
.docskin .story-chip.pts{background:var(--navy);color:var(--white);border-color:var(--navy);}
.docskin .ac-title{font-size:10.5px;text-transform:uppercase;letter-spacing:.12em;color:var(--highlight);font-weight:700;margin:16px 0 8px;}
.docskin .ac-item{border:1px solid var(--rule);padding:10px 14px;margin-bottom:8px;background:var(--white);}
.docskin .gwt{display:grid;grid-template-columns:60px 1fr;gap:4px 12px;font-size:13px;}
.docskin .gwt .k{font-family:var(--font-mono);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding-top:1px;}
.docskin .gwt .k.g{color:var(--positive);} .docskin .gwt .k.w{color:var(--navy);} .docskin .gwt .k.t{color:var(--highlight);}
.docskin .gwt .v{color:var(--charcoal);}
.docskin .links-row{display:flex;gap:8px;flex-wrap:wrap;}
.docskin .link-chip{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--navy);border:1px solid var(--navy);background:var(--white);padding:5px 11px;border-radius:20px;cursor:pointer;}
.docskin .link-chip .lt{color:var(--gray);font-family:var(--font-mono);font-size:9px;text-transform:uppercase;letter-spacing:.06em;}
a.link-chip,a.st-link{text-decoration:none;color:inherit;}
a.link-chip:hover,a.st-link:hover{text-decoration:underline;}
.docskin .footer{margin-top:8px;padding:18px 32px 28px;border-top:2px solid var(--navy);font-size:11px;color:var(--gray);text-transform:uppercase;letter-spacing:.1em;font-weight:700;display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;}
.docskin .footer .accent{color:var(--highlight);}
.docskin .layer-label{font-family:var(--font-body);font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;}
.docskin .uml-name{font-family:var(--font-display);font-size:12px;font-weight:700;text-anchor:middle;fill:var(--navy);}
.docskin .uml-stereo{font-family:var(--font-body);font-size:8.5px;font-style:italic;text-anchor:middle;fill:var(--gray);}
.docskin .uml-row{font-family:var(--font-mono);font-size:9.5px;fill:var(--charcoal);}
.docskin .uml-sep{stroke:var(--rule);stroke-width:1;}
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
.docskin .err{font-family:var(--font-mono);font-size:12px;color:var(--negative);background:#fdf2f2;border:1px solid #f3c9c9;padding:8px 12px;margin:12px 0;white-space:pre-wrap;}
/* endpoint (API reference card) */
.docskin .endpoint{border:1px solid var(--rule);border-radius:var(--radius);margin:18px 0;overflow:hidden;background:var(--white);}
.docskin .ep-head{display:flex;align-items:center;gap:12px;padding:11px 16px;background:var(--light-gray);border-bottom:1px solid var(--rule);flex-wrap:wrap;}
.docskin .ep-method{font-family:var(--font-mono);font-size:12px;font-weight:700;color:#fff;padding:3px 10px;border-radius:5px;letter-spacing:.05em;}
.docskin .ep-method.get{background:var(--positive);} .docskin .ep-method.post{background:var(--blue);} .docskin .ep-method.put{background:var(--highlight);} .docskin .ep-method.patch{background:var(--highlight);} .docskin .ep-method.delete{background:var(--negative);} .docskin .ep-method.head,.docskin .ep-method.options{background:var(--gray);}
.docskin .ep-path{font-family:var(--font-mono);font-size:14px;font-weight:600;color:var(--charcoal);}
.docskin .ep-auth{margin-left:auto;font-family:var(--font-mono);font-size:11px;font-weight:600;color:var(--slate);background:var(--white);border:1px solid var(--rule);padding:3px 9px;border-radius:20px;}
.docskin .ep-body{padding:6px 16px 14px;}
.docskin .ep-title{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin:10px 0 2px;}
.docskin .ep-desc{font-size:13.5px;color:var(--slate);margin:4px 0 0;line-height:1.55;}
.docskin .ep-section{font-size:10.5px;text-transform:uppercase;letter-spacing:.09em;color:var(--gray);font-weight:700;margin:16px 0 6px;}
.docskin .ep-table{width:100%;border-collapse:collapse;font-size:13px;}
.docskin .ep-table th{text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--gray);font-weight:700;padding:4px 8px;border-bottom:1px solid var(--rule);}
.docskin .ep-table td{padding:6px 8px;border-bottom:1px solid var(--rule);vertical-align:top;color:var(--charcoal);}
.docskin .ep-name{font-family:var(--font-mono);font-weight:600;color:var(--navy);white-space:nowrap;}
.docskin .ep-type{font-family:var(--font-mono);color:var(--slate);font-size:12px;}
.docskin .ep-req{font-family:var(--font-body);font-size:9px;font-weight:700;text-transform:uppercase;color:var(--negative);letter-spacing:.04em;}
.docskin .ep-status{font-family:var(--font-mono);font-weight:700;font-size:12px;padding:1px 8px;border-radius:5px;}
.docskin .ep-status.ep-2xx{background:var(--positive-soft);color:var(--positive);} .docskin .ep-status.ep-3xx{background:var(--light-blue);color:var(--blue);} .docskin .ep-status.ep-4xx{background:var(--highlight-soft);color:var(--highlight);} .docskin .ep-status.ep-5xx{background:var(--negative-soft);color:var(--negative);}
.docskin .ep-ex{font-family:var(--font-mono);font-size:12px;line-height:1.5;color:var(--charcoal);background:var(--light-gray);border:1px solid var(--rule);border-radius:var(--radius);padding:10px 12px;margin:4px 0 0;overflow-x:auto;white-space:pre;}
.docskin .j-key{color:var(--blue);} .docskin .j-str{color:var(--positive);} .docskin .j-num{color:var(--purple);} .docskin .j-kw{color:var(--highlight);font-weight:600;}
/* pullquote */
.docskin .pull{margin:28px 0;padding:18px 24px;background:var(--light-blue);border-left:4px solid var(--navy);border-radius:0 var(--radius) var(--radius) 0;}
.docskin .pull-text{font-family:var(--font-display);font-size:18px;line-height:1.45;color:var(--charcoal);max-width:840px;}
.docskin .pull-attr{margin-top:10px;font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--navy);font-weight:700;}
/* layers (numbered layer stack) */
.docskin .layer-stack{margin:22px 0;border:1px solid var(--rule);border-radius:var(--radius);overflow:hidden;}
.docskin .layer{display:grid;grid-template-columns:48px 168px 1fr;border-bottom:1px solid var(--rule);}
.docskin .layer:last-child{border-bottom:none;}
.docskin .layer-num{background:var(--navy);color:var(--white);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-size:20px;font-weight:700;}
.docskin .layer-meta{background:var(--light-blue);padding:13px 15px;border-right:1px solid var(--rule);}
.docskin .layer-kicker{font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--navy);font-weight:700;margin-bottom:4px;}
.docskin .layer-title{font-family:var(--font-display);font-size:14px;font-weight:700;color:var(--navy);}
.docskin .layer-src{font-family:var(--font-mono);font-size:10px;color:var(--gray);margin-top:4px;}
.docskin .layer-q{font-family:var(--font-display);font-size:12px;font-style:italic;color:var(--highlight);margin-top:8px;line-height:1.35;}
.docskin .layer-body{padding:13px 18px;font-size:13px;line-height:1.55;color:var(--charcoal);}
/* matrix (role × resource capability grid) */
.docskin .matrix{margin:22px 0;}
.docskin .mx-title{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .mx-desc{font-size:13px;color:var(--slate);margin:2px 0 10px;line-height:1.5;}
.docskin .mx-scroll{overflow-x:auto;border:1px solid var(--rule);border-radius:var(--radius);}
.docskin .mx-grid{border-collapse:collapse;width:100%;font-size:13px;}
.docskin .mx-grid th,.docskin .mx-grid td{padding:9px 13px;text-align:center;border-bottom:1px solid var(--rule);border-right:1px solid var(--rule);}
.docskin .mx-grid tr:last-child th,.docskin .mx-grid tr:last-child td{border-bottom:none;}
.docskin .mx-grid th:last-child,.docskin .mx-grid td:last-child{border-right:none;}
.docskin .mx-grid thead th{background:var(--light-blue);color:var(--navy);font-size:11px;text-transform:uppercase;letter-spacing:.06em;font-weight:700;}
.docskin .mx-corner{background:var(--navy)!important;color:var(--white)!important;text-align:left;}
.docskin .mx-row{text-align:left;background:var(--light-gray);color:var(--charcoal);font-weight:700;white-space:nowrap;}
.docskin .mx-cell{font-family:var(--font-mono);font-size:12px;font-weight:600;}
.docskin .mx-cell.m-full{background:var(--positive-soft);color:var(--positive);}
.docskin .mx-cell.m-some{background:var(--highlight-soft);color:var(--highlight);}
.docskin .mx-cell.m-none{color:var(--gray);}
/* anatomy (anatomy of a structured string) */
.docskin .anatomy{margin:24px 0;}
.docskin .a-title{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .a-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .a-string{font-family:var(--font-mono);font-size:22px;font-weight:700;text-align:center;padding:14px;background:var(--light-gray);border:1px solid var(--rule);border-radius:var(--radius);overflow-x:auto;white-space:nowrap;}
.docskin .a-sep{color:var(--gray);margin:0 2px;font-weight:400;}
.docskin .a-cards{display:flex;flex-wrap:wrap;align-items:stretch;gap:0;margin-top:14px;justify-content:center;}
.docskin .a-card{flex:1 1 140px;min-width:120px;max-width:240px;background:var(--white);border:1px solid var(--rule);border-radius:var(--radius);padding:10px 13px;}
.docskin .a-card-sep{align-self:center;font-family:var(--font-mono);font-size:18px;font-weight:700;color:var(--gray);padding:0 8px;}
.docskin .a-label{font-size:9px;text-transform:uppercase;letter-spacing:.1em;font-weight:700;margin-bottom:5px;}
.docskin .a-value{font-family:var(--font-mono);font-size:14px;font-weight:600;color:var(--charcoal);word-break:break-word;}
.docskin .a-note{font-size:12px;color:var(--slate);margin-top:5px;line-height:1.45;}
.docskin .a-seg-1,.docskin .a-label.a-seg-1{color:var(--blue);}
.docskin .a-seg-2,.docskin .a-label.a-seg-2{color:var(--positive);}
.docskin .a-seg-3,.docskin .a-label.a-seg-3{color:var(--highlight);}
.docskin .a-seg-4,.docskin .a-label.a-seg-4{color:var(--purple);}
/* composition (layered gates intersected into a result) */
.docskin .composition{margin:24px 0;}
.docskin .cp-title{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .cp-desc-top{font-size:13px;color:var(--slate);margin:2px 0 14px;line-height:1.5;}
.docskin .cp-row{display:flex;flex-wrap:wrap;align-items:stretch;gap:0;}
.docskin .cp-gate{flex:1 1 150px;min-width:140px;background:var(--white);border:1px solid var(--rule);border-top:3px solid var(--navy);border-radius:11px;padding:0 0 12px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.04),0 10px 24px -12px rgba(0,0,0,.13);display:flex;flex-direction:column;}
.docskin .cp-gate-head{padding:10px 14px 8px;border-bottom:1px solid var(--rule);background:var(--light-gray);}
.docskin .cp-gate-kicker{font-size:9px;text-transform:uppercase;letter-spacing:.12em;font-weight:700;color:var(--navy);margin-bottom:3px;}
.docskin .cp-gate-label{font-family:var(--font-display);font-weight:700;font-size:14px;color:var(--navy);line-height:1.2;}
.docskin .cp-desc{font-size:12px;color:var(--slate);margin:8px 14px 0;line-height:1.45;flex:1;}
.docskin .cp-gate-src{font-family:var(--font-mono);font-size:9.5px;color:var(--gray);margin:8px 14px 0;}
.docskin .cp-g1{border-top-color:var(--navy);} .docskin .cp-g1 .cp-gate-kicker,.docskin .cp-g1 .cp-gate-label{color:var(--navy);}
.docskin .cp-g2{border-top-color:var(--blue);} .docskin .cp-g2 .cp-gate-kicker,.docskin .cp-g2 .cp-gate-label{color:var(--blue);}
.docskin .cp-g3{border-top-color:var(--highlight);} .docskin .cp-g3 .cp-gate-kicker,.docskin .cp-g3 .cp-gate-label{color:var(--highlight);}
.docskin .cp-g4{border-top-color:var(--purple);} .docskin .cp-g4 .cp-gate-kicker,.docskin .cp-g4 .cp-gate-label{color:var(--purple);}
.docskin .cp-op,.docskin .cp-eq{align-self:center;font-family:var(--font-display);font-size:26px;font-weight:700;color:var(--gray);padding:0 12px;}
.docskin .cp-result{flex:1 1 150px;min-width:140px;align-self:stretch;background:var(--positive-soft);border:1px solid var(--positive);border-radius:11px;padding:14px;display:flex;flex-direction:column;justify-content:center;}
.docskin .cp-result-kicker{font-size:9px;text-transform:uppercase;letter-spacing:.12em;font-weight:700;color:var(--positive);margin-bottom:4px;}
.docskin .cp-result-label{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);line-height:1.2;}
/* drivers (factor card grid) */
.docskin .drivers{margin:24px 0;}
.docskin .dv-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .dv-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .dv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;}
.docskin .dv-card{border:1px solid var(--rule);border-top:3px solid var(--navy);border-radius:11px;background:var(--white);padding:18px 16px;text-align:center;box-shadow:0 1px 2px rgba(0,0,0,.04),0 10px 24px -12px rgba(0,0,0,.13);}
.docskin .dv-icon{width:38px;height:38px;margin:0 auto 10px;display:block;color:var(--navy);}
.docskin .dv-title{font-family:var(--font-display);font-size:14px;font-weight:700;color:var(--navy);line-height:1.25;margin-bottom:6px;}
.docskin .dv-sub{font-size:11.5px;line-height:1.45;color:var(--slate);}
.docskin .dv-tag{margin-top:8px;font-family:var(--font-mono);font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--navy);text-transform:uppercase;}
.docskin .dv-navy{border-top-color:var(--navy);} .docskin .dv-navy .dv-icon,.docskin .dv-navy .dv-title{color:var(--navy);}
.docskin .dv-blue{border-top-color:var(--blue);} .docskin .dv-blue .dv-icon{color:var(--blue);}
.docskin .dv-teal{border-top-color:var(--teal);} .docskin .dv-teal .dv-icon{color:var(--teal);}
.docskin .dv-green{border-top-color:var(--positive);} .docskin .dv-green .dv-icon{color:var(--positive);}
.docskin .dv-amber{border-top-color:var(--highlight);} .docskin .dv-amber .dv-icon{color:var(--highlight);}
.docskin .dv-purple{border-top-color:var(--purple);} .docskin .dv-purple .dv-icon{color:var(--purple);}
.docskin .dv-red{border-top-color:var(--negative);} .docskin .dv-red .dv-icon{color:var(--negative);}
.docskin .dv-gray{border-top-color:var(--gray);} .docskin .dv-gray .dv-icon{color:var(--gray);}
/* options (approaches explored) */
.docskin .options{margin:24px 0;}
.docskin .op-headline{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .op-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .op-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;align-items:stretch;}
.docskin .op-card{border:1px solid var(--rule);border-radius:11px;background:var(--white);overflow:hidden;display:flex;flex-direction:column;}
.docskin .op-card.is-chosen{border:2px solid var(--positive);box-shadow:0 2px 12px rgba(31,151,71,.16);}
.docskin .op-head{padding:12px 14px 10px;color:var(--white);}
.docskin .op-h-neutral{background:var(--gray);} .docskin .op-h-rejected{background:var(--gray);} .docskin .op-h-viable{background:var(--blue);} .docskin .op-h-warn{background:var(--highlight);} .docskin .op-h-chosen{background:var(--positive);}
.docskin .op-kicker{display:block;font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.9;margin-bottom:4px;}
.docskin .op-title{font-family:var(--font-display);font-size:14px;font-weight:700;line-height:1.25;}
.docskin .op-how{padding:9px 14px;font-size:11.5px;color:var(--charcoal);background:var(--light-gray);border-bottom:1px solid var(--rule);line-height:1.45;}
.docskin .op-body{padding:10px 14px 12px;flex:1;}
.docskin .op-list{list-style:none;margin:0 0 8px;padding:0;}
.docskin .op-list li{position:relative;padding-left:18px;font-size:12px;line-height:1.5;color:var(--charcoal);margin-bottom:5px;}
.docskin .op-list li::before{position:absolute;left:0;top:0;font-weight:700;}
.docskin .op-pros li::before{content:"\\2713";color:var(--positive);}
.docskin .op-cons li::before{content:"\\2717";color:var(--negative);}
.docskin .op-verdict{margin:0 14px 14px;padding:7px 8px;border-radius:5px;font-size:10px;font-weight:700;text-align:center;letter-spacing:.04em;text-transform:uppercase;}
.docskin .op-v-rejected,.docskin .op-v-neutral{background:var(--light-gray);color:var(--gray);border:1px solid var(--rule);}
.docskin .op-v-viable{background:var(--light-blue);color:var(--navy);border:1px solid var(--rule);}
.docskin .op-v-warn{background:var(--highlight-soft);color:var(--highlight);border:1px solid var(--highlight);}
.docskin .op-v-chosen{background:var(--positive-soft);color:var(--positive);border:1px solid var(--positive);}
/* spec (labelled spec sheet) */
.docskin .spec{margin:22px 0;}
.docskin .sp-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .sp-desc{font-size:13px;color:var(--slate);margin:2px 0 10px;line-height:1.5;}
.docskin .sp-grid{display:grid;grid-template-columns:140px 1fr;border:1px solid var(--rule);border-left-width:4px;border-left-color:var(--navy);border-radius:6px;overflow:hidden;background:var(--white);}
.docskin .sp-label{background:var(--light-gray);font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--navy);padding:12px 16px;border-bottom:1px solid var(--rule);display:flex;align-items:center;}
.docskin .sp-val{padding:12px 16px;font-size:13px;line-height:1.5;color:var(--charcoal);border-bottom:1px solid var(--rule);}
.docskin .sp-grid > .sp-label:nth-last-child(2),.docskin .sp-grid > .sp-val:last-child{border-bottom:none;}
.docskin .sp-flow{display:flex;flex-wrap:wrap;align-items:center;gap:6px;}
.docskin .sp-step{background:var(--light-blue);border:1px solid var(--rule);border-radius:4px;padding:4px 9px;font-size:11px;font-weight:600;color:var(--navy);white-space:nowrap;}
.docskin .sp-arrow{color:var(--gray);font-weight:700;}
.docskin .sp-blue{border-left-color:var(--blue);} .docskin .sp-blue .sp-label{color:var(--blue);}
.docskin .sp-teal{border-left-color:var(--teal);} .docskin .sp-teal .sp-label{color:var(--teal);}
.docskin .sp-green{border-left-color:var(--positive);} .docskin .sp-green .sp-label{color:var(--positive);}
.docskin .sp-amber{border-left-color:var(--highlight);} .docskin .sp-amber .sp-label{color:var(--highlight);}
.docskin .sp-purple{border-left-color:var(--purple);} .docskin .sp-purple .sp-label{color:var(--purple);}
.docskin .sp-red{border-left-color:var(--negative);} .docskin .sp-red .sp-label{color:var(--negative);}
.docskin .sp-gray{border-left-color:var(--gray);} .docskin .sp-gray .sp-label{color:var(--gray);}
/* list (fancy bullet list — accent / check / icon / number styles) */
.docskin .list-block{--ls-accent:var(--navy);--ls-soft:var(--light-blue);margin:22px 0;}
.docskin .ls-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .ls-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .ls-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px;}
.docskin .ls-item{display:flex;align-items:flex-start;gap:12px;}
.docskin .ls-body{display:flex;flex-direction:column;gap:2px;min-width:0;}
.docskin .ls-lead{font-weight:700;color:var(--charcoal);line-height:1.35;}
.docskin .ls-text{font-size:13px;color:var(--slate);line-height:1.5;}
.docskin .ls-mark{flex:none;display:flex;align-items:center;justify-content:center;}
.docskin .ls-style-accent .ls-item{border-left:3px solid var(--ls-accent);padding:1px 0 1px 14px;}
.docskin .ls-style-accent .ls-bar{display:none;}
.docskin .ls-check{width:22px;height:22px;border-radius:50%;font-size:13px;font-weight:700;background:var(--positive-soft);color:var(--positive);}
.docskin .ls-check.ls-off{background:var(--light-gray);color:var(--gray);}
.docskin .ls-num{width:24px;height:24px;border-radius:50%;font-family:var(--font-mono);font-size:12px;font-weight:700;background:var(--ls-accent);color:var(--white);}
.docskin .ls-icon{width:26px;height:26px;border-radius:7px;background:var(--ls-soft);color:var(--ls-accent);}
.docskin .ls-icon svg{width:16px;height:16px;}
.docskin .ls-navy{--ls-accent:var(--navy);--ls-soft:var(--light-blue);}
.docskin .ls-blue{--ls-accent:var(--blue);--ls-soft:var(--light-blue);}
.docskin .ls-teal{--ls-accent:var(--teal);--ls-soft:var(--teal-soft);}
.docskin .ls-green{--ls-accent:var(--positive);--ls-soft:var(--positive-soft);}
.docskin .ls-amber{--ls-accent:var(--highlight);--ls-soft:var(--highlight-soft);}
.docskin .ls-purple{--ls-accent:var(--purple);--ls-soft:var(--purple-soft);}
.docskin .ls-red{--ls-accent:var(--negative);--ls-soft:var(--negative-soft);}
.docskin .ls-gray{--ls-accent:var(--gray);--ls-soft:var(--light-gray);}
/* stories (collapsible user-story backlog) */
.docskin .stories{margin:22px 0;}
.docskin .st-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .st-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .st-list{display:flex;flex-direction:column;gap:8px;}
.docskin .st-item{border:1px solid var(--rule);border-radius:11px;background:var(--white);overflow:hidden;}
.docskin .st-summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;padding:12px 14px;}
.docskin .st-summary::-webkit-details-marker{display:none;}
.docskin .st-caret{flex:none;width:0;height:0;border-left:5px solid var(--gray);border-top:4px solid transparent;border-bottom:4px solid transparent;transition:transform .15s;}
.docskin details[open]>.st-summary .st-caret{transform:rotate(90deg);}
.docskin .st-sum-main{display:flex;align-items:center;gap:8px;flex:1;min-width:0;}
.docskin .st-id{font-family:var(--font-mono);font-size:11px;font-weight:700;color:var(--navy);background:var(--light-blue);padding:1px 6px;border-radius:4px;}
.docskin .st-sum-title{font-weight:700;color:var(--charcoal);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.docskin .st-chips{display:flex;gap:6px;flex:none;}
.docskin .st-chip{font-family:var(--font-mono);font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;letter-spacing:.03em;white-space:nowrap;}
.docskin .st-points{background:var(--purple-soft);color:var(--purple);}
.docskin .st-prio{background:var(--highlight-soft);color:var(--highlight);}
.docskin .st-tag{background:var(--light-gray);color:var(--slate);}
.docskin .st-body{padding:2px 14px 14px 30px;border-top:1px solid var(--rule);}
.docskin .st-narr{margin:12px 0 8px;color:var(--slate);line-height:1.55;font-size:14px;}
.docskin .st-ac-label{font-family:var(--font-mono);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--gray);margin:10px 0 4px;}
.docskin .st-ac{margin:0;padding-left:18px;color:var(--slate);font-size:13px;line-height:1.5;}
.docskin .st-ac li{margin:3px 0;}
.docskin .st-links{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}
.docskin .st-link{font-family:var(--font-mono);font-size:11px;color:var(--blue);background:var(--light-blue);padding:2px 8px;border-radius:4px;}
/* pattern (design-pattern reference card) */
.docskin .pattern{margin:22px 0;border:1px solid var(--rule);border-radius:10px;background:var(--white);overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.04),0 10px 24px -12px rgba(0,0,0,.13);}
.docskin .pt-header{display:flex;align-items:center;gap:10px;padding:13px 18px;background:var(--navy);color:var(--white);}
.docskin .pt-kicker{font-family:var(--font-mono);font-size:10px;font-weight:700;letter-spacing:.12em;opacity:.82;}
.docskin .pt-name{font-family:var(--font-display);font-weight:700;font-size:17px;}
.docskin .pt-cat{margin-left:auto;font-family:var(--font-mono);font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:rgba(255,255,255,.16);padding:3px 9px;border-radius:10px;}
.docskin .pt-rows{display:flex;flex-direction:column;}
.docskin .pt-row{display:grid;grid-template-columns:130px 1fr;gap:14px;padding:12px 18px;border-top:1px solid var(--rule);}
.docskin .pt-row:first-child{border-top:none;}
.docskin .pt-label{font-family:var(--font-mono);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--gray);padding-top:2px;}
.docskin .pt-value{color:var(--charcoal);line-height:1.55;font-size:14px;}
.docskin .pt-chips{display:flex;flex-wrap:wrap;gap:6px;}
.docskin .pt-chip{font-size:12px;background:var(--light-gray);color:var(--slate);padding:2px 9px;border-radius:10px;}
.docskin .pt-parts{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px;}
.docskin .pt-parts li{display:flex;gap:8px;align-items:baseline;}
.docskin .pt-pname{font-weight:700;color:var(--navy);font-size:13px;}
.docskin .pt-prole{color:var(--slate);font-size:13px;}
.docskin .pt-cons{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.docskin .pt-cons-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px;font-size:13px;line-height:1.45;}
.docskin .pt-cons-list li{display:flex;gap:6px;}
.docskin .pt-sign{font-weight:700;flex:none;}
.docskin .pt-pro .pt-sign{color:var(--positive);}
.docskin .pt-con .pt-sign{color:var(--negative);}
/* gallery (responsive grid of code / note cards) */
.docskin .gallery{margin:22px 0;}
.docskin .gl-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .gl-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .gl-grid{display:grid;grid-template-columns:repeat(var(--gl-cols,2),minmax(0,1fr));gap:14px;align-items:start;}
@media(max-width:680px){.docskin .gl-grid{grid-template-columns:1fr;}}
.docskin .gl-cell{min-width:0;}
.docskin .gl-cell .diagram{margin:0;}
.docskin .gl-cell .gl-card-title{padding:0 0 6px;}
.docskin .gl-cell .gl-cap{padding:8px 2px 0;}
.docskin .gl-card{border:1px solid var(--rule);border-radius:11px;background:var(--white);overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.04),0 10px 24px -12px rgba(0,0,0,.13);display:flex;flex-direction:column;min-width:0;}
.docskin .gl-card>.code-header{border-radius:0;}
.docskin .gl-card>pre{margin:0;border:none;border-radius:0;font-size:11.5px;line-height:1.55;padding:13px 15px;flex:1;}
.docskin .gl-card-title{font-family:var(--font-display);font-weight:700;font-size:13px;color:var(--navy);padding:11px 13px 0;}
.docskin .gl-cap{font-size:12px;color:var(--slate);padding:9px 13px 11px;line-height:1.45;}
.docskin .gl-navy{border-top:3px solid var(--navy);} .docskin .gl-blue{border-top:3px solid var(--blue);}
.docskin .gl-teal{border-top:3px solid var(--teal);} .docskin .gl-green{border-top:3px solid var(--positive);}
.docskin .gl-amber{border-top:3px solid var(--highlight);} .docskin .gl-purple{border-top:3px solid var(--purple);}
.docskin .gl-red{border-top:3px solid var(--negative);} .docskin .gl-gray{border-top:3px solid var(--gray);}
/* chart (bar / line / area / donut) */
.docskin .chart-axis{stroke:var(--rule);stroke-width:1;}
.docskin .chart-label{font-family:var(--font-mono);font-size:9.5px;fill:var(--gray);text-anchor:middle;}
.docskin .chart-tick{font-family:var(--font-mono);font-size:9px;fill:var(--gray);text-anchor:end;}
.docskin .chart-val{font-family:var(--font-mono);font-size:8.5px;fill:var(--gray);text-anchor:middle;}
.docskin .chart-total{font-family:var(--font-display);font-size:22px;font-weight:700;fill:var(--charcoal);text-anchor:middle;}
.docskin .chart-total-label{font-family:var(--font-mono);font-size:9px;font-weight:700;fill:var(--gray);text-anchor:middle;letter-spacing:.1em;}
/* figure (an image with a caption) */
.docskin .fig{margin:22px 0;border:1px solid var(--rule);border-radius:11px;background:var(--white);padding:14px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 10px 24px -12px rgba(0,0,0,.13);}
.docskin .fig-img{display:block;max-width:100%;height:auto;border-radius:6px;margin:0 auto;}
.docskin .fig-cap{font-size:13px;color:var(--slate);margin-top:10px;line-height:1.5;}
/* diff (unified diff on the dark editor surface) */
.docskin .diff-pre{padding:14px 0;}
.docskin .df-line{display:block;padding:0 20px;color:#cdd3de;}
.docskin .df-add{background:rgba(63,185,80,.15);color:#7ee787;}
.docskin .df-del{background:rgba(248,81,73,.15);color:#ffa198;}
.docskin .df-hunk{color:#8b949e;font-style:italic;}
/* steps (numbered how-to / runbook stepper) */
.docskin .steps{margin:22px 0;}
.docskin .stp-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .stp-desc{font-size:13px;color:var(--slate);margin:2px 0 14px;line-height:1.5;}
.docskin .stp-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;}
.docskin .stp-item{position:relative;display:flex;align-items:flex-start;gap:14px;padding:0 0 22px;}
.docskin .stp-item:last-child{padding-bottom:0;}
.docskin .stp-item::before{content:"";position:absolute;left:12px;top:28px;bottom:2px;width:2px;background:var(--rule);}
.docskin .stp-item:last-child::before{display:none;}
.docskin .stp-num{flex:none;position:relative;z-index:1;width:26px;height:26px;border-radius:50%;background:var(--navy);color:var(--white);font-family:var(--font-mono);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;}
.docskin .stp-body{flex:1;min-width:0;padding-top:3px;}
.docskin .stp-title{font-weight:700;font-size:14px;color:var(--charcoal);line-height:1.35;}
.docskin .stp-text{font-size:13px;color:var(--slate);margin:4px 0 0;line-height:1.55;max-width:760px;}
.docskin .stp-code{margin:10px 0 0;border-radius:8px;overflow:hidden;border:1px solid #2a2f3a;box-shadow:0 1px 2px rgba(0,0,0,.04),0 10px 24px -12px rgba(0,0,0,.13);}
.docskin .stp-code-head{padding:6px 14px;background:#0f1116;color:#8b93a7;font-family:var(--font-mono);font-size:10.5px;font-weight:600;letter-spacing:.04em;border-bottom:1px solid #2a2f3a;}
.docskin .stp-code pre{font-size:12px;line-height:1.6;padding:12px 16px;}
.docskin .stp-code pre code{background:transparent;border:none;padding:0;border-radius:0;font-size:inherit;color:inherit;}
.docskin .stp-note{font-size:12px;color:var(--gray);font-style:italic;margin:8px 0 0;line-height:1.5;}
/* faq (Q&A accordions, native details) */
.docskin .faq{margin:22px 0;}
.docskin .fq-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .fq-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .fq-list{display:flex;flex-direction:column;gap:8px;}
.docskin .fq-item{border:1px solid var(--rule);border-radius:11px;background:var(--white);overflow:hidden;}
.docskin .fq-summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;padding:13px 16px;}
.docskin .fq-summary::-webkit-details-marker{display:none;}
.docskin .fq-caret{flex:none;width:0;height:0;border-left:5px solid var(--gray);border-top:4px solid transparent;border-bottom:4px solid transparent;transition:transform .15s;}
.docskin details[open]>.fq-summary .fq-caret{transform:rotate(90deg);}
.docskin .fq-q{font-weight:700;color:var(--charcoal);line-height:1.4;}
.docskin .fq-a{padding:2px 16px 14px 31px;border-top:1px solid var(--rule);font-size:14px;color:var(--slate);line-height:1.6;}
.docskin .fq-a p{margin:10px 0 0;max-width:780px;}
/* envelope (back-of-envelope capacity math) */
.docskin .envelope{margin:22px 0;}
.docskin .env-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .env-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .env-card{border:1px solid var(--rule);border-radius:11px;background:var(--white);padding:18px 22px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 10px 24px -12px rgba(0,0,0,.13);}
.docskin .env-givens{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 24px;padding-bottom:16px;margin-bottom:14px;border-bottom:1px solid var(--rule);}
.docskin .env-g-label{font-family:var(--font-mono);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--gray);margin-bottom:2px;}
.docskin .env-g-value{font-size:15px;font-weight:700;color:var(--charcoal);}
.docskin .env-steps{display:flex;flex-direction:column;gap:9px;}
.docskin .env-step{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;}
.docskin .env-s-label{flex:0 0 150px;font-size:13px;color:var(--slate);}
.docskin .env-s-calc{font-family:var(--font-mono);font-size:12.5px;color:var(--charcoal);background:var(--light-gray);border:1px solid var(--rule);border-radius:5px;padding:2px 8px;}
.docskin .env-s-arrow{color:var(--gray);font-weight:700;}
.docskin .env-s-result{font-family:var(--font-mono);font-size:13px;font-weight:700;color:var(--navy);}
.docskin .env-result{margin-top:16px;padding:12px 16px;background:var(--light-blue);border-left:4px solid var(--navy);border-radius:0 8px 8px 0;}
.docskin .env-r-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:var(--navy);margin-bottom:2px;}
.docskin .env-r-value{font-family:var(--font-display);font-size:18px;font-weight:700;color:var(--navy);line-height:1.25;}
/* slo (service-level objectives with error budgets) */
.docskin .slo{margin:22px 0;}
.docskin .slo-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .slo-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .slo-list{display:flex;flex-direction:column;gap:12px;}
.docskin .slo-item{border:1px solid var(--rule);border-radius:11px;background:var(--white);padding:14px 18px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 10px 24px -12px rgba(0,0,0,.13);}
.docskin .slo-top{display:flex;align-items:center;gap:10px;}
.docskin .slo-name{font-family:var(--font-display);font-weight:700;font-size:14px;color:var(--charcoal);flex:1;min-width:0;}
.docskin .slo-window{font-family:var(--font-mono);font-size:10px;font-weight:700;color:var(--slate);background:var(--light-gray);border:1px solid var(--rule);border-radius:10px;padding:2px 8px;white-space:nowrap;}
.docskin .slo-sli{font-size:12.5px;color:var(--slate);margin:3px 0 0;line-height:1.5;}
.docskin .slo-vals{display:flex;gap:26px;margin-top:9px;}
.docskin .slo-val{display:flex;flex-direction:column;gap:1px;}
.docskin .slo-v-label{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--gray);}
.docskin .slo-v-num{font-family:var(--font-mono);font-size:14px;font-weight:700;color:var(--charcoal);}
.docskin .slo-v-num.slo-ok{color:var(--positive);}
.docskin .slo-v-num.slo-bad{color:var(--negative);}
.docskin .slo-budget{margin-top:10px;}
.docskin .slo-track{height:8px;border-radius:4px;background:var(--light-gray);overflow:hidden;}
.docskin .slo-fill{height:100%;border-radius:4px;}
.docskin .slo-fill.slo-b-ok{background:var(--positive);}
.docskin .slo-fill.slo-b-warn{background:var(--highlight);}
.docskin .slo-fill.slo-b-hot{background:var(--negative);}
.docskin .slo-caption{font-family:var(--font-mono);font-size:11px;color:var(--gray);margin-top:5px;}
/* terminal (a shell session on the dark surface) */
.docskin .terminal-block{border-radius:11px;}
.docskin .tm-pre{line-height:1.7;}
.docskin .tm-line{display:block;}
.docskin .tm-prompt{color:var(--positive);font-weight:700;}
.docskin .tm-cmd-text{color:#cdd3de;font-weight:700;}
.docskin .tm-comment{color:#8b949e;font-style:italic;}
.docskin .tm-out{color:#9aa3ad;}
/* swot (strengths / weaknesses / opportunities / threats 2x2) */
.docskin .swot{margin:22px 0;}
.docskin .swot-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .swot-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .swot-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;}
@media(max-width:680px){.docskin .swot-grid{grid-template-columns:1fr;}}
.docskin .swot-quad{border:1px solid var(--rule);border-top:3px solid var(--navy);border-radius:10px;padding:13px 16px 14px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 10px 24px -12px rgba(0,0,0,.13);}
.docskin .swot-label{font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;font-weight:700;margin-bottom:7px;}
.docskin .swot-list{list-style:none;margin:0;padding:0;}
.docskin .swot-item{position:relative;font-size:13px;color:var(--charcoal);line-height:1.5;padding:2px 0 2px 14px;}
.docskin .swot-item::before{content:"";position:absolute;left:0;top:11px;width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.55;}
.docskin .swot-s{border-top-color:var(--positive);background:var(--positive-soft);}
.docskin .swot-s .swot-label{color:var(--positive);} .docskin .swot-s .swot-item::before{background:var(--positive);}
.docskin .swot-w{border-top-color:var(--negative);background:var(--negative-soft);}
.docskin .swot-w .swot-label{color:var(--negative);} .docskin .swot-w .swot-item::before{background:var(--negative);}
.docskin .swot-o{border-top-color:var(--blue);background:var(--light-blue);}
.docskin .swot-o .swot-label{color:var(--blue);} .docskin .swot-o .swot-item::before{background:var(--blue);}
.docskin .swot-t{border-top-color:var(--highlight);background:var(--highlight-soft);}
.docskin .swot-t .swot-label{color:var(--highlight);} .docskin .swot-t .swot-item::before{background:var(--highlight);}
/* funnel (conversion funnel bands) */
.docskin .fn-label{fill:#fff;font-family:var(--font-display);font-size:13px;font-weight:700;text-anchor:middle;}
.docskin .fn-value{fill:#fff;font-family:var(--font-mono);font-size:11px;font-weight:700;text-anchor:middle;opacity:.92;}
.docskin .fn-desc{fill:#fff;font-family:var(--font-body);font-size:9.5px;text-anchor:middle;opacity:.85;}
.docskin .fn-chip-bg{fill:var(--light-gray);stroke:var(--rule);stroke-width:1;}
.docskin .fn-chip{fill:var(--gray);font-family:var(--font-mono);font-size:10px;font-weight:700;text-anchor:middle;}
/* okr (objectives + key results) */
.docskin .okr{margin:22px 0;}
.docskin .okr-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .okr-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .okr-list{display:flex;flex-direction:column;gap:12px;}
.docskin .okr-item{border:1px solid var(--rule);border-radius:11px;background:var(--white);padding:14px 18px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 10px 24px -12px rgba(0,0,0,.13);}
.docskin .okr-top{display:flex;align-items:baseline;gap:10px;margin-bottom:10px;}
.docskin .okr-objective{font-family:var(--font-display);font-weight:700;font-size:14.5px;color:var(--charcoal);flex:1;min-width:0;}
.docskin .okr-owner{font-family:var(--font-mono);font-size:10px;font-weight:700;color:var(--slate);background:var(--light-gray);border:1px solid var(--rule);border-radius:10px;padding:2px 8px;white-space:nowrap;}
.docskin .okr-krs{display:flex;flex-direction:column;gap:8px;}
.docskin .okr-kr-text{font-size:13px;color:var(--charcoal);line-height:1.45;}
.docskin .okr-kr-bar{display:flex;align-items:center;gap:10px;margin-top:3px;}
.docskin .okr-track{flex:1;height:7px;border-radius:4px;background:var(--light-gray);overflow:hidden;}
.docskin .okr-fill{height:100%;border-radius:4px;}
.docskin .okr-fill.okr-b-ok{background:var(--positive);}
.docskin .okr-fill.okr-b-warn{background:var(--highlight);}
.docskin .okr-fill.okr-b-bad{background:var(--negative);}
.docskin .okr-fill.okr-b-plain{background:var(--navy);}
.docskin .okr-pct{flex:none;font-family:var(--font-mono);font-size:11px;font-weight:700;color:var(--slate);min-width:34px;text-align:right;}
/* persona (user persona cards) */
.docskin .persona{margin:22px 0;}
.docskin .pa-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .pa-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .pa-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:start;}
@media(max-width:680px){.docskin .pa-grid{grid-template-columns:1fr;}}
.docskin .pa-card{--pa-accent:var(--navy);--pa-soft:var(--light-blue);border:1px solid var(--rule);border-radius:11px;background:var(--white);padding:16px 18px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 10px 24px -12px rgba(0,0,0,.13);}
.docskin .pa-id{display:flex;align-items:center;gap:12px;}
.docskin .pa-avatar{flex:none;width:42px;height:42px;border-radius:50%;background:var(--pa-accent);color:#fff;font-family:var(--font-display);font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center;letter-spacing:.02em;}
.docskin .pa-name{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);line-height:1.25;}
.docskin .pa-role{font-size:12px;color:var(--gray);margin-top:1px;}
.docskin .pa-quote{font-family:var(--font-display);font-style:italic;font-size:13px;color:var(--slate);line-height:1.5;margin:12px 0 0;padding:2px 0 2px 12px;border-left:3px solid var(--pa-accent);}
.docskin .pa-section{margin-top:12px;}
.docskin .pa-sec-label{font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;font-weight:700;color:var(--gray);margin-bottom:4px;}
.docskin .pa-list{list-style:none;margin:0;padding:0;}
.docskin .pa-li{position:relative;font-size:12.5px;color:var(--charcoal);line-height:1.5;padding:1px 0 1px 14px;}
.docskin .pa-li::before{content:"";position:absolute;left:0;top:9px;width:5px;height:5px;border-radius:50%;background:var(--pa-accent);opacity:.55;}
.docskin .pa-goals .pa-li::before{background:var(--positive);opacity:.8;}
.docskin .pa-frustrations .pa-li::before{background:var(--negative);opacity:.8;}
.docskin .pa-tools{display:flex;flex-wrap:wrap;gap:6px;}
.docskin .pa-tool{font-family:var(--font-mono);font-size:10.5px;font-weight:600;color:var(--slate);background:var(--light-gray);border:1px solid var(--rule);border-radius:4px;padding:2px 8px;}
.docskin .pa-navy{--pa-accent:var(--navy);--pa-soft:var(--light-blue);}
.docskin .pa-blue{--pa-accent:var(--blue);--pa-soft:var(--light-blue);}
.docskin .pa-teal{--pa-accent:var(--teal);--pa-soft:var(--teal-soft);}
.docskin .pa-green{--pa-accent:var(--positive);--pa-soft:var(--positive-soft);}
.docskin .pa-amber{--pa-accent:var(--highlight);--pa-soft:var(--highlight-soft);}
.docskin .pa-purple{--pa-accent:var(--purple);--pa-soft:var(--purple-soft);}
.docskin .pa-red{--pa-accent:var(--negative);--pa-soft:var(--negative-soft);}
.docskin .pa-gray{--pa-accent:var(--gray);--pa-soft:var(--light-gray);}
/* changelog (release history on a vertical rail) */
.docskin .changelog{margin:22px 0;}
.docskin .cg-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .cg-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .cg-rail{position:relative;padding-left:26px;}
.docskin .cg-rail::before{content:"";position:absolute;left:7px;top:8px;bottom:8px;width:2px;background:var(--rule);}
.docskin .cg-release{position:relative;padding-bottom:20px;}
.docskin .cg-release:last-child{padding-bottom:0;}
.docskin .cg-dot{position:absolute;left:-25px;top:4px;width:12px;height:12px;border-radius:50%;background:var(--navy);border:2px solid var(--white);box-shadow:0 0 0 1px var(--rule);}
.docskin .cg-dot-breaking{background:var(--negative);}
.docskin .cg-rel-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:7px;}
.docskin .cg-version{font-family:var(--font-mono);font-size:12.5px;font-weight:700;color:var(--navy);background:var(--light-blue);border-radius:5px;padding:2px 9px;}
.docskin .cg-version.cg-v-breaking{background:var(--negative-soft);color:var(--negative);}
.docskin .cg-date{font-size:12px;color:var(--gray);}
.docskin .cg-tag{font-family:var(--font-mono);font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--slate);background:var(--light-gray);border:1px solid var(--rule);border-radius:10px;padding:2px 8px;}
.docskin .cg-tag-breaking{color:var(--negative);background:var(--negative-soft);border-color:var(--negative);}
.docskin .cg-items{display:flex;flex-direction:column;gap:5px;}
.docskin .cg-item{display:flex;align-items:baseline;gap:9px;}
.docskin .cg-type{flex:none;font-family:var(--font-mono);font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;border-radius:4px;padding:1px 7px;}
.docskin .cg-t-added{background:var(--positive-soft);color:var(--positive);}
.docskin .cg-t-changed{background:var(--light-blue);color:var(--blue);}
.docskin .cg-t-fixed{background:var(--highlight-soft);color:var(--highlight);}
.docskin .cg-t-removed{background:var(--light-gray);color:var(--gray);}
.docskin .cg-t-security{background:var(--negative-soft);color:var(--negative);}
.docskin .cg-text{font-size:13px;color:var(--charcoal);line-height:1.5;}
/* team (compact people cards) */
.docskin .team{margin:22px 0;}
.docskin .tem-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .tem-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .tem-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;align-items:stretch;}
@media(max-width:900px){.docskin .tem-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}
@media(max-width:680px){.docskin .tem-grid{grid-template-columns:1fr;}}
.docskin .tem-card{--tem-accent:var(--navy);border:1px solid var(--rule);border-radius:11px;background:var(--white);padding:16px 16px 14px;text-align:center;box-shadow:0 1px 2px rgba(0,0,0,.04),0 10px 24px -12px rgba(0,0,0,.13);}
.docskin .tem-avatar{width:40px;height:40px;border-radius:50%;background:var(--tem-accent);color:#fff;font-family:var(--font-display);font-size:14px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;letter-spacing:.02em;margin-bottom:9px;}
.docskin .tem-name{font-family:var(--font-display);font-weight:700;font-size:14px;color:var(--charcoal);line-height:1.3;}
.docskin .tem-role{font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;color:var(--gray);margin-top:2px;}
.docskin .tem-focus{font-size:12.5px;color:var(--slate);line-height:1.45;margin-top:6px;}
.docskin .tem-navy{--tem-accent:var(--navy);}
.docskin .tem-blue{--tem-accent:var(--blue);}
.docskin .tem-teal{--tem-accent:var(--teal);}
.docskin .tem-green{--tem-accent:var(--positive);}
.docskin .tem-amber{--tem-accent:var(--highlight);}
.docskin .tem-purple{--tem-accent:var(--purple);}
.docskin .tem-red{--tem-accent:var(--negative);}
.docskin .tem-gray{--tem-accent:var(--gray);}
/* waterfall (budget cascade) */
.docskin .wfl-label{font-family:var(--font-body);font-size:13.5px;fill:var(--charcoal);}
.docskin .wfl-value{font-family:var(--font-mono);font-size:11.5px;font-weight:700;fill:var(--slate);}
.docskin .wfl-total-label{font-family:var(--font-display);font-size:12px;font-weight:700;fill:#fff;letter-spacing:.06em;}
.docskin .wfl-budget-line{stroke:var(--negative);stroke-width:1.4;stroke-dasharray:5 4;}
.docskin .wfl-budget-label{font-family:var(--font-mono);font-size:10px;font-weight:700;fill:var(--negative);}
.docskin rect.wfl-chip-under{fill:var(--positive-soft);stroke:var(--positive);stroke-width:1;}
.docskin rect.wfl-chip-over{fill:var(--negative-soft);stroke:var(--negative);stroke-width:1;}
.docskin .wfl-chip{font-family:var(--font-mono);font-size:10px;font-weight:700;text-anchor:middle;}
.docskin text.wfl-chip-under{fill:var(--positive);}
.docskin text.wfl-chip-over{fill:var(--negative);}
/* heatmap (numeric grid with an intensity ramp) */
.docskin .heatmap{margin:22px 0;}
.docskin .hm-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .hm-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .hm-scroll{overflow-x:auto;border:1px solid var(--rule);border-radius:11px;background:var(--white);padding:14px 16px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 10px 24px -12px rgba(0,0,0,.13);}
.docskin .hm-grid{display:grid;gap:4px;min-width:0;}
.docskin .hm-corner{min-width:0;}
.docskin .hm-col{font-family:var(--font-mono);font-size:11px;font-weight:700;color:var(--gray);text-align:center;align-self:end;padding-bottom:2px;white-space:nowrap;}
.docskin .hm-rowlabel{font-size:12px;font-weight:600;color:var(--charcoal);text-align:right;align-self:center;padding-right:8px;white-space:nowrap;}
.docskin .hm-cell{font-family:var(--font-mono);font-size:11px;font-weight:600;color:var(--charcoal);border-radius:6px;min-height:32px;display:flex;align-items:center;justify-content:center;}
.docskin .hm-cell.hm-dark{color:#fff;}
.docskin .hm-cell.hm-blank{background:var(--light-gray);}
.docskin .hm-legend{display:flex;align-items:center;gap:10px;margin-top:12px;}
.docskin .hm-bound{font-family:var(--font-mono);font-size:10.5px;font-weight:700;color:var(--gray);white-space:nowrap;}
.docskin .hm-ramp{flex:1;max-width:220px;height:8px;border-radius:4px;background:linear-gradient(90deg,#eef3f9,#0e54a1);}
/* scorecard (weighted decision matrix) */
.docskin .scorecard{margin:22px 0;}
.docskin .sc-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .sc-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .sc-scroll{overflow-x:auto;border:1px solid var(--rule);border-radius:10px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 10px 24px -12px rgba(0,0,0,.13);}
.docskin .sc-table{width:100%;border-collapse:collapse;font-size:13px;background:var(--white);}
.docskin .sc-table thead th{background:var(--navy);color:#fff;padding:10px 12px;text-align:left;font-family:var(--font-body);font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;vertical-align:top;}
.docskin .sc-table th.c,.docskin .sc-table td.c{text-align:center;}
.docskin .sc-table thead th.sc-win{background:var(--positive);}
.docskin .sc-table td{padding:9px 12px;border-bottom:1px solid var(--rule);}
.docskin .sc-crit{font-weight:600;color:var(--charcoal);}
.docskin .sc-weight{display:inline-block;font-family:var(--font-mono);font-size:9.5px;font-weight:700;color:var(--navy);background:var(--light-blue);border-radius:8px;padding:1px 7px;margin-left:8px;}
.docskin .sc-score{font-family:var(--font-mono);font-weight:600;}
.docskin .sc-note{display:block;font-size:11px;font-weight:400;color:rgba(255,255,255,.8);text-transform:none;letter-spacing:0;margin-top:3px;}
.docskin .sc-winner{display:inline-block;font-family:var(--font-mono);font-size:8.5px;font-weight:700;letter-spacing:.08em;color:var(--positive);background:var(--positive-soft);border-radius:8px;padding:1px 7px;margin-left:8px;vertical-align:middle;}
.docskin .sc-foot td{border-bottom:none;border-top:2px solid var(--navy);font-family:var(--font-mono);font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--slate);}
.docskin .sc-foot td.sc-total{font-size:14px;color:var(--charcoal);letter-spacing:0;}
.docskin .sc-foot td.sc-total.sc-win{background:var(--positive-soft);color:var(--positive);}
/* risk (risk register row-cards) */
.docskin .risk{margin:22px 0;}
.docskin .rk-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .rk-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .rk-list{display:flex;flex-direction:column;gap:10px;}
.docskin .rk-item{border:1px solid var(--rule);border-radius:11px;background:var(--white);padding:12px 16px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 10px 24px -12px rgba(0,0,0,.13);}
.docskin .rk-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.docskin .rk-sev{flex:none;font-family:var(--font-mono);font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;border-radius:10px;padding:2px 9px;}
.docskin .rk-sev-critical{background:var(--negative);color:#fff;}
.docskin .rk-sev-high{background:var(--negative-soft);color:var(--negative);}
.docskin .rk-sev-medium{background:var(--highlight-soft);color:var(--highlight);}
.docskin .rk-sev-low{background:var(--positive-soft);color:var(--positive);}
.docskin .rk-risk{font-family:var(--font-display);font-weight:700;font-size:13.5px;color:var(--charcoal);flex:1;min-width:0;}
.docskin .rk-chips{display:flex;align-items:center;gap:6px;flex:none;margin-left:auto;}
.docskin .rk-owner{font-family:var(--font-mono);font-size:10px;font-weight:700;color:var(--slate);background:var(--light-gray);border:1px solid var(--rule);border-radius:10px;padding:2px 8px;white-space:nowrap;}
.docskin .rk-status{font-family:var(--font-mono);font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;border-radius:10px;padding:2px 8px;white-space:nowrap;}
.docskin .rk-st-open{background:var(--highlight-soft);color:#b45309;}
.docskin .rk-st-mitigating{background:var(--light-blue);color:var(--blue);}
.docskin .rk-st-accepted{background:var(--light-gray);color:var(--slate);border:1px solid var(--rule);}
.docskin .rk-st-closed{background:var(--positive-soft);color:var(--positive);}
.docskin .rk-meta{font-family:var(--font-mono);font-size:11px;font-weight:600;color:var(--gray);margin-top:4px;}
.docskin .rk-mitigation{font-size:12.5px;color:var(--slate);margin:5px 0 0;line-height:1.5;}
.docskin .rk-mit-label{font-weight:700;color:var(--charcoal);}
/* palette (colour-token swatches) */
.docskin .palette{margin:22px 0;}
.docskin .pl-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .pl-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .pl-grid{display:grid;grid-template-columns:repeat(var(--pl-cols,4),minmax(0,1fr));gap:14px;align-items:start;}
@media(max-width:900px){.docskin .pl-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}
@media(max-width:680px){.docskin .pl-grid{grid-template-columns:1fr;}}
.docskin .pl-card{border:1px solid var(--rule);border-radius:10px;background:var(--white);overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.04),0 10px 24px -12px rgba(0,0,0,.13);}
.docskin .pl-swatch{height:64px;border-radius:8px 8px 0 0;display:flex;align-items:flex-end;padding:6px 9px;}
.docskin .pl-hex{font-family:var(--font-mono);font-size:10.5px;font-weight:600;letter-spacing:.02em;}
.docskin .pl-meta{padding:9px 11px 11px;border-top:1px solid var(--rule);}
.docskin .pl-name{font-weight:700;font-size:13px;color:var(--charcoal);line-height:1.3;}
.docskin .pl-usage{font-size:11.5px;color:var(--slate);margin-top:2px;line-height:1.45;}
/* typescale (live type specimen) */
.docskin .typescale{margin:22px 0;}
.docskin .ts-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .ts-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .ts-row{display:flex;align-items:center;gap:18px;padding:12px 0;border-bottom:1px solid var(--rule);}
.docskin .ts-row:last-child{border-bottom:none;}
.docskin .ts-meta{flex:0 0 160px;min-width:0;}
.docskin .ts-name{font-weight:700;font-size:12.5px;color:var(--charcoal);line-height:1.3;}
.docskin .ts-spec{font-family:var(--font-mono);font-size:10.5px;color:var(--gray);margin-top:2px;}
.docskin .ts-note{font-size:11px;color:var(--slate);margin-top:2px;line-height:1.4;}
.docskin .ts-sample{flex:1;min-width:0;color:var(--charcoal);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.docskin .ts-f-display{font-family:var(--font-display);}
.docskin .ts-f-body{font-family:var(--font-body);}
.docskin .ts-f-mono{font-family:var(--font-mono);}
/* dodont (do / don't guideline cards) */
.docskin .dodont{margin:22px 0;}
.docskin .dd-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .dd-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .dd-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:start;}
@media(max-width:680px){.docskin .dd-grid{grid-template-columns:1fr;}}
.docskin .dd-card{border:1px solid var(--rule);border-radius:11px;background:var(--white);overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.04),0 10px 24px -12px rgba(0,0,0,.13);}
.docskin .dd-band{display:flex;align-items:center;gap:8px;padding:9px 14px;}
.docskin .dd-do .dd-band{background:var(--positive-soft);}
.docskin .dd-dont .dd-band{background:var(--negative-soft);}
.docskin .dd-sign{flex:none;width:18px;height:18px;border-radius:50%;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;}
.docskin .dd-do .dd-sign{background:var(--positive);}
.docskin .dd-dont .dd-sign{background:var(--negative);}
.docskin .dd-label{font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;font-weight:700;}
.docskin .dd-do .dd-label{color:var(--positive);}
.docskin .dd-dont .dd-label{color:var(--negative);}
.docskin .dd-list{padding:11px 14px 14px;display:flex;flex-direction:column;gap:9px;}
.docskin .dd-item{position:relative;padding-left:14px;}
.docskin .dd-item::before{content:"";position:absolute;left:0;top:8px;width:5px;height:5px;border-radius:50%;}
.docskin .dd-do .dd-item::before{background:var(--positive);}
.docskin .dd-dont .dd-item::before{background:var(--negative);}
.docskin .dd-text{font-size:13px;color:var(--charcoal);line-height:1.5;}
.docskin .dd-ex{display:inline-block;font-family:var(--font-mono);font-size:11.5px;color:var(--slate);background:var(--light-gray);border:1px solid var(--rule);border-radius:6px;padding:3px 8px;margin-top:4px;}
/* inventory (component / feature status board) */
.docskin .inventory{margin:22px 0;}
.docskin .inv-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .inv-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .inv-row{display:flex;align-items:flex-start;gap:12px;padding:9px 0;border-bottom:1px solid var(--rule);}
.docskin .inv-row:last-child{border-bottom:none;}
.docskin .inv-main{flex:1;min-width:0;}
.docskin .inv-top{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;}
.docskin .inv-name{font-weight:700;font-size:13.5px;color:var(--charcoal);line-height:1.35;}
.docskin .inv-tag{font-family:var(--font-mono);font-size:9.5px;font-weight:600;color:var(--slate);background:var(--light-gray);border:1px solid var(--rule);border-radius:4px;padding:1px 6px;}
.docskin .inv-note{font-size:12px;color:var(--slate);margin-top:1px;line-height:1.45;}
.docskin .inv-status{flex:none;font-family:var(--font-mono);font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;border-radius:10px;padding:2px 9px;margin-top:1px;white-space:nowrap;}
.docskin .inv-st-stable{background:var(--positive-soft);color:var(--positive);}
.docskin .inv-st-beta{background:var(--light-blue);color:var(--navy);}
.docskin .inv-st-experimental{background:var(--purple-soft);color:var(--purple);}
.docskin .inv-st-deprecated{background:var(--negative-soft);color:var(--negative);}
.docskin .inv-st-planned{background:var(--light-gray);color:var(--gray);border:1px solid var(--rule);}
/* algorithms & data structures (array / linkedlist / bintree / hashmap) */
.docskin .ds-idx{font-family:var(--font-mono);font-size:9.5px;fill:var(--gray);text-anchor:middle;}
.docskin .ds-val{font-family:var(--font-mono);font-size:13px;font-weight:600;text-anchor:middle;}
.docskin .ds-ptr{font-family:var(--font-mono);font-size:11px;font-weight:700;fill:var(--navy);text-anchor:middle;}
.docskin .ds-window{fill:none;stroke:var(--navy);stroke-width:2;stroke-dasharray:6 4;}
.docskin .ds-window-label{font-family:var(--font-mono);font-size:10px;font-weight:700;fill:var(--navy);letter-spacing:.04em;}
.docskin .ds-empty{font-family:var(--font-mono);font-size:11px;fill:var(--gray);font-style:italic;}
.docskin .ll-link{fill:none;stroke:var(--charcoal);stroke-width:1.4;}
.docskin .ll-null{font-family:var(--font-mono);font-size:15px;font-weight:700;fill:var(--gray);}
.docskin .bt-edge{stroke:var(--charcoal);stroke-width:1.4;}
.docskin .bt-val{font-family:var(--font-mono);font-size:12.5px;font-weight:600;text-anchor:middle;}
.docskin .hsh-idx{font-family:var(--font-mono);font-size:11px;font-weight:700;fill:var(--slate);text-anchor:middle;}
.docskin .hsh-nil{font-family:var(--font-mono);font-size:12px;fill:var(--gray);}
.docskin .hsh-link{fill:none;stroke:var(--gray);stroke-width:1.2;}
.docskin .hsh-key{font-family:var(--font-mono);font-size:11px;font-weight:600;text-anchor:middle;}
.docskin .hsh-more{font-family:var(--font-mono);font-size:10.5px;fill:var(--gray);font-style:italic;}
/* agentloop (agent-loop diagram, SVG) */
.docskin .al-edge{stroke:var(--charcoal);stroke-width:1.2;fill:none;}
.docskin .al-edge.dashed{stroke:var(--gray);stroke-dasharray:5 3;}
.docskin .al-lbl{font-family:var(--font-mono);font-size:10px;font-weight:700;fill:var(--slate);letter-spacing:.04em;}
.docskin .al-name{font-family:var(--font-display);font-size:14px;font-weight:700;}
.docskin .al-chip{font-family:var(--font-mono);font-size:9.5px;font-weight:700;letter-spacing:.02em;}
.docskin .al-note{font-family:var(--font-body);font-size:10.5px;fill:var(--slate);}
.docskin .al-env{font-family:var(--font-display);font-size:12px;font-weight:700;}
.docskin .al-tool-name{font-family:var(--font-mono);font-size:11.5px;font-weight:700;fill:var(--teal);}
.docskin .al-tool-desc{font-family:var(--font-body);font-size:10px;fill:var(--slate);}
.docskin .al-more{font-family:var(--font-mono);font-size:10px;fill:var(--gray);font-style:italic;}
.docskin .al-mem{font-family:var(--font-display);font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;}
.docskin .al-mem-item{font-family:var(--font-body);font-size:10px;fill:var(--slate);}
.docskin .al-foot{margin-top:14px;padding-top:12px;border-top:1px dashed var(--rule);font-size:12.5px;color:var(--slate);}
.docskin .al-foot-label{font-family:var(--font-mono);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--gray);margin-right:6px;}
/* trace (agent / session execution transcript) */
.docskin .trace{margin:22px 0;}
.docskin .tr-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .tr-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .tr-list{display:flex;flex-direction:column;}
.docskin .tr-turn{position:relative;padding:0 0 16px 0;}
.docskin .tr-turn::before{content:"";position:absolute;left:14px;top:24px;bottom:-2px;width:1px;background:var(--rule);}
.docskin .tr-turn:last-child{padding-bottom:0;}
.docskin .tr-turn:last-child::before{display:none;}
.docskin .tr-chip{display:inline-block;font-family:var(--font-mono);font-size:9.5px;font-weight:700;letter-spacing:.08em;padding:2px 9px;border-radius:10px;margin-bottom:6px;position:relative;z-index:1;}
.docskin .tr-user>.tr-chip{background:var(--light-blue);color:var(--navy);}
.docskin .tr-assistant>.tr-chip{background:#ede9fe;color:#7c3aed;}
.docskin .tr-tool>.tr-chip{background:var(--teal-soft);color:var(--teal);}
.docskin .tr-system>.tr-chip{background:var(--light-gray);color:var(--gray);border:1px solid var(--rule);}
.docskin .tr-card{margin-left:28px;border:1px solid var(--rule);border-radius:10px;background:var(--white);padding:12px 16px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 10px 24px -12px rgba(0,0,0,.13);}
.docskin .tr-think{font-size:12px;font-style:italic;color:var(--gray);border-left:2px dotted var(--gray);padding-left:10px;margin-bottom:8px;white-space:pre-wrap;line-height:1.55;}
.docskin .tr-text{font-size:13.5px;color:var(--charcoal);line-height:1.6;white-space:pre-wrap;}
.docskin .tr-think+.tr-text{margin-top:2px;}
.docskin .tr-tool-name{font-family:var(--font-mono);font-size:12.5px;font-weight:700;color:var(--teal);margin-bottom:6px;}
.docskin .tr-io{display:flex;align-items:baseline;gap:8px;margin:4px 0;}
.docskin .tr-io-label{flex:none;font-family:var(--font-mono);font-size:10px;font-weight:700;color:var(--gray);}
.docskin .tr-mono{font-family:var(--font-mono);font-size:11.5px;color:var(--charcoal);background:var(--light-gray);border:1px solid var(--rule);border-radius:5px;padding:2px 8px;white-space:pre-wrap;min-width:0;}
.docskin .tr-io+.tr-text{margin-top:8px;}
/* prompt (prompt anatomy with variable highlighting) */
.docskin .prompt{margin:22px 0;}
.docskin .pr-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .pr-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .pr-list{display:flex;flex-direction:column;gap:10px;}
.docskin .pr-seg{border:1px solid var(--rule);border-radius:10px;background:var(--white);overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.04),0 10px 24px -12px rgba(0,0,0,.13);}
.docskin .pr-kicker{font-family:var(--font-mono);font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:8px 16px 0;}
.docskin .pr-system>.pr-kicker{color:var(--gray);}
.docskin .pr-user>.pr-kicker{color:var(--navy);}
.docskin .pr-assistant>.pr-kicker{color:#7c3aed;}
.docskin .pr-tool>.pr-kicker{color:var(--teal);}
.docskin .pr-label{font-family:var(--font-body);font-weight:600;font-size:11px;letter-spacing:0;text-transform:none;color:var(--slate);margin-left:6px;}
.docskin .pr-text{font-family:var(--font-mono);font-size:12.5px;line-height:1.65;color:var(--charcoal);background:var(--light-gray);border-top:1px solid var(--rule);padding:12px 16px;margin-top:8px;white-space:pre-wrap;}
.docskin .pr-var{font-family:var(--font-mono);background:var(--highlight-soft);color:var(--highlight);border-radius:4px;padding:0 4px;font-weight:600;}
.docskin .pr-vars{display:flex;flex-direction:column;gap:5px;margin-top:12px;padding-top:12px;border-top:1px dashed var(--rule);}
.docskin .pr-var-row{display:flex;align-items:baseline;gap:10px;}
.docskin .pr-var-row .pr-var{font-size:11.5px;}
.docskin .pr-var-desc{font-size:12px;color:var(--slate);line-height:1.45;}
/* context (context-window token budget, SVG) */
.docskin .ctx-window-label{font-family:var(--font-mono);font-size:10.5px;font-weight:700;fill:var(--slate);letter-spacing:.04em;}
.docskin .ctx-seg-label{font-family:var(--font-mono);font-size:11px;font-weight:700;fill:#fff;}
.docskin .ctx-free-label{font-family:var(--font-mono);font-size:11px;font-weight:600;fill:var(--gray);}
.docskin .ctx-boundary{stroke:var(--negative);stroke-width:1.4;stroke-dasharray:5 4;}
.docskin rect.ctx-chip-bg{fill:var(--negative-soft);stroke:var(--negative);stroke-width:1;}
.docskin text.ctx-chip{font-family:var(--font-mono);font-size:9.5px;font-weight:700;fill:var(--negative);}
.docskin .ctx-legend{display:flex;flex-direction:column;gap:6px;margin-top:14px;padding-top:12px;border-top:1px dashed var(--rule);}
.docskin .ctx-row{display:flex;align-items:baseline;gap:9px;font-size:12.5px;color:var(--charcoal);}
.docskin .ctx-dot{flex:none;width:11px;height:11px;border-radius:3px;align-self:center;}
.docskin .ctx-idx{flex:none;font-family:var(--font-mono);font-size:10px;font-weight:700;color:var(--gray);}
.docskin .ctx-label{font-weight:700;}
.docskin .ctx-num{font-family:var(--font-mono);font-size:11px;color:var(--slate);white-space:nowrap;}
.docskin .ctx-note{font-size:12px;color:var(--slate);}
/* archmap (target-architecture capability map) */
.docskin .archmap{margin:22px 0;}
.docskin .am-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .am-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .am-grid{display:grid;grid-template-columns:repeat(var(--am-cols,3),minmax(0,1fr));gap:10px;align-items:stretch;}
@media(max-width:900px){.docskin .am-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}
@media(max-width:680px){.docskin .am-grid{grid-template-columns:1fr;}}
.docskin .am-area{--am-accent:var(--navy);--am-soft:var(--light-blue);background:var(--am-soft);border:1px solid var(--am-accent);border-color:color-mix(in srgb,var(--am-accent) 40%,transparent);border-radius:10px;padding:12px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 10px 24px -12px rgba(0,0,0,.13);}
.docskin .am-area-label{font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;font-weight:700;color:var(--am-accent);margin-bottom:2px;}
.docskin .am-area-desc{font-size:11.5px;color:var(--slate);line-height:1.45;}
.docskin .am-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:6px;margin-top:8px;}
.docskin .am-tile{background:var(--white);border:1px solid var(--rule);border-radius:6px;padding:6px 8px;font-size:11.5px;line-height:1.35;color:var(--charcoal);text-align:center;}
.docskin .am-t-target{background:var(--light-blue);border:1px dashed var(--navy);}
.docskin .am-t-new{background:var(--positive-soft);border-color:var(--positive);}
.docskin .am-t-gap{background:var(--negative-soft);border:1px dashed var(--negative);}
.docskin .am-t-deprecated{background:var(--light-gray);color:var(--gray);opacity:.7;}
.docskin .am-navy{--am-accent:var(--navy);--am-soft:var(--light-blue);}
.docskin .am-blue{--am-accent:var(--blue);--am-soft:var(--light-blue);}
.docskin .am-teal{--am-accent:var(--teal);--am-soft:var(--teal-soft);}
.docskin .am-green{--am-accent:var(--positive);--am-soft:var(--positive-soft);}
.docskin .am-amber{--am-accent:var(--highlight);--am-soft:var(--highlight-soft);}
.docskin .am-purple{--am-accent:var(--purple);--am-soft:var(--purple-soft);}
.docskin .am-red{--am-accent:var(--negative);--am-soft:var(--negative-soft);}
.docskin .am-gray{--am-accent:var(--gray);--am-soft:var(--light-gray);}
.docskin .am-sw-current{background:var(--white);border:1px solid var(--rule);}
.docskin .am-sw-target{background:var(--light-blue);border:1px dashed var(--navy);}
.docskin .am-sw-new{background:var(--positive-soft);border:1px solid var(--positive);}
.docskin .am-sw-gap{background:var(--negative-soft);border:1px dashed var(--negative);}
.docskin .am-sw-deprecated{background:var(--light-gray);border:1px solid var(--rule);opacity:.7;}
/* divider (full-width section-break band) */
.docskin .dvd{--dvd-accent:var(--navy);--dvd-soft:var(--light-blue);margin:22px 0;width:100%;min-height:180px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:36px 28px;text-align:center;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);background:color-mix(in srgb,var(--dvd-soft) 45%,transparent);}
.docskin .dvd-kicker{display:flex;align-items:center;gap:12px;}
.docskin .dvd-kicker-text{font-family:var(--font-mono);font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--dvd-accent);}
.docskin .dvd-rule{width:36px;height:1px;background:var(--dvd-accent);opacity:.55;}
.docskin .dvd-title{font-family:var(--font-display);font-weight:700;font-size:34px;line-height:1.15;letter-spacing:-.01em;color:var(--charcoal);max-width:820px;}
.docskin .dvd-subtitle{font-size:15px;color:var(--slate);line-height:1.55;max-width:680px;margin:0;}
.docskin .dvd-navy{--dvd-accent:var(--navy);--dvd-soft:var(--light-blue);}
.docskin .dvd-blue{--dvd-accent:var(--blue);--dvd-soft:var(--light-blue);}
.docskin .dvd-teal{--dvd-accent:var(--teal);--dvd-soft:var(--teal-soft);}
.docskin .dvd-green{--dvd-accent:var(--positive);--dvd-soft:var(--positive-soft);}
.docskin .dvd-amber{--dvd-accent:var(--highlight);--dvd-soft:var(--highlight-soft);}
.docskin .dvd-purple{--dvd-accent:var(--purple);--dvd-soft:var(--purple-soft);}
.docskin .dvd-red{--dvd-accent:var(--negative);--dvd-soft:var(--negative-soft);}
.docskin .dvd-gray{--dvd-accent:var(--gray);--dvd-soft:var(--light-gray);}
/* bignumber (one hero metric at presentation scale) */
.docskin .bn{--bn-accent:var(--navy);margin:22px 0;width:100%;display:flex;flex-direction:column;align-items:center;gap:8px;padding:30px 24px;text-align:center;}
.docskin .bn-value-row{display:flex;align-items:baseline;justify-content:center;gap:14px;flex-wrap:wrap;}
.docskin .bn-value{font-family:var(--font-display);font-weight:700;font-size:clamp(56px,10vw,84px);line-height:1;letter-spacing:-.02em;color:var(--bn-accent);}
.docskin .bn-delta{display:inline-flex;align-items:baseline;gap:5px;font-family:var(--font-mono);font-size:15px;font-weight:700;color:var(--bn-accent);}
.docskin .bn-arrow{color:var(--gray);font-size:12px;}
.docskin .bn-label{font-family:var(--font-display);font-weight:700;font-size:18px;color:var(--charcoal);line-height:1.35;max-width:720px;}
.docskin .bn-context{font-size:13.5px;color:var(--slate);line-height:1.5;max-width:640px;margin:0;}
.docskin .bn-navy{--bn-accent:var(--navy);} .docskin .bn-blue{--bn-accent:var(--blue);}
.docskin .bn-teal{--bn-accent:var(--teal);} .docskin .bn-green{--bn-accent:var(--positive);}
.docskin .bn-amber{--bn-accent:var(--highlight);} .docskin .bn-purple{--bn-accent:var(--purple);}
.docskin .bn-red{--bn-accent:var(--negative);} .docskin .bn-gray{--bn-accent:var(--gray);}
/* takeaways (numbered closing-slide rows) */
.docskin .tk{--tk-accent:var(--navy);margin:22px 0;width:100%;}
.docskin .tk-title{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:14px;}
.docskin .tk-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:18px;}
.docskin .tk-item{display:flex;align-items:flex-start;gap:16px;padding-bottom:18px;border-bottom:1px solid var(--rule);}
.docskin .tk-item:last-child{padding-bottom:0;border-bottom:none;}
.docskin .tk-num{flex:none;width:30px;height:30px;border-radius:50%;border:2px solid var(--tk-accent);background:var(--white);color:var(--tk-accent);font-family:var(--font-mono);font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;}
.docskin .tk-body{flex:1;min-width:0;padding-top:3px;}
.docskin .tk-text{font-family:var(--font-display);font-weight:700;font-size:17px;color:var(--charcoal);line-height:1.35;}
.docskin .tk-detail{font-size:13.5px;color:var(--slate);margin:5px 0 0;line-height:1.55;max-width:760px;}
.docskin .tk-navy{--tk-accent:var(--navy);} .docskin .tk-blue{--tk-accent:var(--blue);}
.docskin .tk-teal{--tk-accent:var(--teal);} .docskin .tk-green{--tk-accent:var(--positive);}
.docskin .tk-amber{--tk-accent:var(--highlight);} .docskin .tk-purple{--tk-accent:var(--purple);}
.docskin .tk-red{--tk-accent:var(--negative);} .docskin .tk-gray{--tk-accent:var(--gray);}`;
