#!/usr/bin/env node
// Contrast audit: renders an HTML page headlessly and reports every visible
// text element (HTML and SVG) whose contrast against what is painted behind
// it falls under WCAG AA (4.5:1, or 3:1 for text ≥ 18.66px bold / 24px).
//
//   node packages/render/scripts/contrast-audit.mjs <page.html> [--json] [--min 4.5] [--root <selector>]
//
// `--root` names the container to audit (default `.docskin`); pass `body` to
// audit a whole page, chrome included (site index, deck nav).
//
// Exit code 1 when any failure is found. Groups failures by the nearest
// `section[id]` and the element's class so a renderer owner can act on it.

import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

// Playwright is a dependency of the CLI package (PDF export); borrow it.
const require = createRequire(new URL('../../cli/package.json', import.meta.url));
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const optIdx = (name) => args.indexOf(name);
const optValueAt = new Set(['--min', '--root'].map(optIdx).filter((i) => i >= 0).map((i) => i + 1));
const file = args.find((a, i) => !a.startsWith('--') && !optValueAt.has(i));
if (!file) {
  console.error('usage: contrast-audit.mjs <page.html> [--json] [--min 4.5] [--root <selector>]');
  process.exit(2);
}
const asJson = args.includes('--json');
const minIdx = optIdx('--min');
const MIN = minIdx >= 0 ? Number(args[minIdx + 1]) : 4.5;
const rootIdx = optIdx('--root');
const ROOT = rootIdx >= 0 ? args[rootIdx + 1] : '.docskin';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(pathToFileURL(resolve(file)).href, { waitUntil: 'load' });
await page.waitForTimeout(400);

const failures = await page.evaluate(({ MIN, ROOT }) => {
  const parse = (s) => {
    const m = /rgba?\(([^)]+)\)/.exec(s);
    if (!m) return null;
    const [r, g, b, a = '1'] = m[1].split(',').map((x) => x.trim());
    return { r: +r, g: +g, b: +b, a: +a };
  };
  const over = (fg, bg) => {
    const a = fg.a;
    return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const isSvg = (el) => el.namespaceURI === 'http://www.w3.org/2000/svg';
  const SVG_SHAPES = new Set(['rect', 'path', 'circle', 'ellipse', 'polygon', 'polyline']);
  const paintOf = (el) => {
    const cs = getComputedStyle(el);
    if (isSvg(el)) {
      // Only shapes paint a background; containers (<svg>, <g>) report the
      // default black fill, and a neighbouring <text> is not a surface.
      if (!SVG_SHAPES.has(el.tagName.toLowerCase())) return null;
      const f = parse(cs.fill);
      if (f && f.a > 0 && cs.fill !== 'none') return f;
      return null;
    }
    const bg = parse(cs.backgroundColor);
    return bg && bg.a > 0 ? bg : null;
  };
  // Effective background at a point: walk elementsFromPoint below the text.
  const backgroundAt = (textEl, x, y) => {
    let acc = null;
    // An HTML element's own background is the first layer behind its text.
    if (!isSvg(textEl)) {
      const own = paintOf(textEl);
      if (own) acc = own;
    }
    if (acc && acc.a >= 0.999) return acc;
    const stack = document.elementsFromPoint(x, y);
    for (const el of stack) {
      if (el === textEl || textEl.contains(el)) continue;
      const p = paintOf(el);
      if (!p) continue;
      acc = acc === null ? p : over(acc, p);
      if (acc.a >= 0.999) break;
    }
    return acc ?? { r: 255, g: 255, b: 255, a: 1 };
  };
  const out = [];
  const seen = new Set();
  const nodes = document.querySelectorAll(`${ROOT} *`);
  for (const el of nodes) {
    // Only elements that directly own visible text.
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    if (!ownText) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    const fgRaw = isSvg(el) ? cs.fill : cs.color;
    const fg = parse(fgRaw);
    if (!fg || fg.a === 0) continue;
    // Halo: SVG text with paint-order stroke reads against its stroke color.
    let bg;
    const stroke = isSvg(el) && cs.paintOrder && cs.paintOrder.includes('stroke') ? parse(cs.stroke) : null;
    const x = Math.min(r.left + r.width / 2, innerWidth - 1);
    const y = Math.min(r.top + r.height / 2, innerHeight - 1);
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r2 = el.getBoundingClientRect();
    const px = Math.max(0, Math.min(r2.left + r2.width / 2, innerWidth - 1));
    const py = Math.max(0, Math.min(r2.top + r2.height / 2, innerHeight - 1));
    bg = stroke && stroke.a > 0 && parseFloat(cs.strokeWidth) >= 2 ? over(stroke, backgroundAt(el, px, py)) : backgroundAt(el, px, py);
    const fgEff = over(fg, bg);
    const c = ratio(fgEff, bg);
    const size = parseFloat(cs.fontSize);
    const bold = +cs.fontWeight >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : MIN;
    if (c >= need) continue;
    const section = el.closest('section[id]');
    const key = `${section?.id ?? '-'}|${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').split(' ').filter(Boolean).slice(0, 2).join('.')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      section: section?.id ?? '-',
      block: section?.querySelector('.section-eyebrow, .section-num')?.textContent?.trim() ?? '',
      el: el.tagName.toLowerCase(),
      cls: el.getAttribute('class') ?? '',
      text: el.textContent.trim().slice(0, 40),
      fg: fgRaw,
      bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
      size,
      ratio: Math.round(c * 100) / 100,
      need,
    });
  }
  return out;
}, { MIN, ROOT });

await browser.close();

if (asJson) {
  console.log(JSON.stringify(failures, null, 2));
} else {
  const pad = (s, n) => String(s).padEnd(n);
  for (const f of failures) {
    console.log(`${pad(f.section, 12)} ${pad(f.el + (f.cls ? '.' + f.cls.split(' ')[0] : ''), 28)} ${pad(f.ratio + ':1', 8)} need ${f.need}  ${pad(f.size + 'px', 8)} ${f.fg} on ${f.bg}  "${f.text}"`);
  }
  console.log(`\n${failures.length} text element(s) under ${MIN}:1 (3:1 for large text)`);
}
process.exit(failures.length > 0 ? 1 : 0);
