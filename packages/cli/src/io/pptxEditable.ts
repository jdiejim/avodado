/**
 * Editable PowerPoint export (`avo pptx --editable`).
 *
 * Instead of photographing whole slides, this walks the slide model from
 * `renderSlides` and emits NATIVE PowerPoint elements wherever the content is
 * text-shaped: titles, prose, bullet lists, tables, code boxes, callouts,
 * quotes, stats, agendas — and real PowerPoint charts for `chart` blocks.
 * Only genuinely visual blocks (sequence, flow, ERD, C4, …) fall back to a
 * crisp element screenshot placed beside the native text.
 *
 * Fidelity trade-offs vs the image mode (which stays the default): PowerPoint
 * lays text out with the viewer's installed fonts, so slides are *near* the
 * deck's look rather than pixel-identical, and heavily packed slides rely on
 * PowerPoint's own shrink-to-fit. In exchange, every word is editable.
 */

import type { Document } from '@avodado/core';
import {
  renderSlides,
  type RenderPartsOptions,
  type Slide,
  type SlidePart,
} from '@avodado/render';
import type PptxGenJS from 'pptxgenjs';
import { type PdfOptions, launchChromium, loadPlaywright } from './pdf.js';

/** Options for {@link toPptxEditable} — Chromium knobs shared with PDF/PPTX. */
export type PptxEditableOptions = Pick<PdfOptions, 'autoInstallBrowser' | 'log'>;

type PSlide = ReturnType<PptxGenJS['addSlide']>;
type TextRun = { text: string; options?: Record<string, unknown> };

// ── Page geometry (inches, 16:9 = 10 × 5.625) ───────────────────────────────
const PW = 10;
const PH = 5.625;
const MX = 0.55;
const CW = PW - 2 * MX;
const TITLE_Y = 0.28;
const CONTENT_Y = 1.08;
const CONTENT_B = 5.22;
/** Inches per text line at a given point size (incl. leading). */
const lineH = (pt: number): number => (pt * 1.4) / 72;
/** Approx. characters per line at a given point size across `w` inches. */
const cpl = (pt: number, w: number): number => Math.max(8, Math.floor((w * 131) / pt));
const linesFor = (s: string, pt: number, w: number): number =>
  s.split('\n').reduce((a, l) => a + Math.max(1, Math.ceil(l.length / cpl(pt, w))), 0);

// ── Theme → PowerPoint palette ──────────────────────────────────────────────

interface Palette {
  readonly navy: string;
  readonly charcoal: string;
  readonly slate: string;
  readonly gray: string;
  readonly lightGray: string;
  readonly rule: string;
  readonly highlight: string;
  readonly paper: string;
  readonly teal: string;
  readonly purple: string;
  readonly blue: string;
  readonly positive: string;
  readonly negative: string;
  readonly display: string;
  readonly body: string;
  readonly mono: string;
}

/** House defaults (the textbook theme's `:root` values), no `#`. */
const DEFAULTS: Record<string, string> = {
  navy: '233a5e',
  charcoal: '211f1a',
  slate: '4a463d',
  gray: '8a8475',
  'light-gray': 'f2efe6',
  rule: 'e4dccb',
  highlight: '9c4a2f',
  white: 'fcfbf7',
  teal: '2f6f6a',
  purple: '5b4a8a',
  blue: '2f5c8f',
  positive: '2e7d4f',
  negative: 'a63d3d',
};

const HEX_RE = /^#?([0-9a-f]{6})$/i;

/** First font family of a CSS stack, unquoted — PowerPoint takes one name. */
function firstFamily(stack: string | undefined, fallback: string): string {
  const first = (stack ?? '').split(',')[0]?.trim().replace(/^["']|["']$/g, '') ?? '';
  return first === '' ? fallback : first;
}

/** Parses the theme-variable declaration string into a PowerPoint palette. */
function paletteFrom(themeVars: string): Palette {
  const vars: Record<string, string> = {};
  for (const decl of themeVars.split(';')) {
    const i = decl.indexOf(':');
    if (i === -1) continue;
    const k = decl.slice(0, i).trim().replace(/^--/, '');
    vars[k] = decl.slice(i + 1).trim();
  }
  const color = (k: string): string => {
    const m = HEX_RE.exec(vars[k] ?? '');
    return m?.[1]?.toLowerCase() ?? DEFAULTS[k] ?? '333333';
  };
  return {
    navy: color('navy'),
    charcoal: color('charcoal'),
    slate: color('slate'),
    gray: color('gray'),
    lightGray: color('light-gray'),
    rule: color('rule'),
    highlight: color('highlight'),
    paper: color('white'),
    teal: color('teal'),
    purple: color('purple'),
    blue: color('blue'),
    positive: color('positive'),
    negative: color('negative'),
    display: firstFamily(vars['font-display'], 'Inter'),
    body: firstFamily(vars['font-body'], 'Inter'),
    mono: firstFamily(vars['font-mono'], 'Menlo'),
  };
}

// ── Inline Markdown → text runs ─────────────────────────────────────────────

/** `**bold**`, `*em*`, `` `code` ``, `[t](url)` → styled runs; rest plain. */
function inlineRuns(s: string, pal: Palette, base: Record<string, unknown> = {}): TextRun[] {
  const runs: TextRun[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let at = 0;
  for (let m = re.exec(s); m !== null; m = re.exec(s)) {
    if (m.index > at) runs.push({ text: s.slice(at, m.index), options: { ...base } });
    if (m[2] !== undefined) runs.push({ text: m[2], options: { ...base, bold: true } });
    else if (m[3] !== undefined) runs.push({ text: m[3], options: { ...base, italic: true } });
    else if (m[4] !== undefined)
      runs.push({ text: m[4], options: { ...base, fontFace: pal.mono, color: pal.highlight } });
    else if (m[5] !== undefined && m[6] !== undefined)
      runs.push({
        text: m[5],
        options: { ...base, color: pal.blue, underline: true, hyperlink: { url: m[6] } },
      });
    at = m.index + m[0].length;
  }
  if (at < s.length) runs.push({ text: s.slice(at), options: { ...base } });
  return runs.length > 0 ? runs : [{ text: s, options: { ...base } }];
}

/** Strips inline Markdown markers for width estimation. */
const plain = (s: string): string =>
  s.replace(/\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g, '$1$2$3').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

// ── Pieces: measure once, draw at an assigned frame ─────────────────────────

interface Frame {
  readonly x: number;
  readonly y: number;
  readonly w: number;
}

interface Piece {
  /** Natural height in inches at the frame width it was measured for. */
  readonly h: number;
  draw(ps: PSlide, f: Frame, fontScale: number): void;
}

interface BuildCtx {
  readonly pal: Palette;
  readonly pres: PptxGenJS;
  /** Screenshot for an image-fallback part, keyed `slide:part`. */
  readonly shots: ReadonlyMap<string, { data: string; aspect: number }>;
  readonly key: string;
}

const fs = (pt: number, scale: number): number => Math.max(8, Math.round(pt * scale * 10) / 10);

// ── Prose ───────────────────────────────────────────────────────────────────

function buildProse(text: string, w: number, pal: Palette): Piece {
  // Paragraph blocks split on blank lines; `- ` lines become bullets and
  // `###` headings become bold lead-ins. Inline markers become styled runs.
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p !== '');
  const runs: TextRun[] = [];
  let h = 0;
  for (const para of paras) {
    const lines = para.split('\n');
    for (const line of lines) {
      const bullet = /^[-*]\s+/.test(line);
      const head = /^#{3,6}\s+/.test(line);
      const body = line.replace(/^[-*]\s+|^#{3,6}\s+/, '');
      const base: Record<string, unknown> = {
        breakLine: true,
        ...(bullet ? { bullet: { characterCode: '2022', indent: 12 } } : {}),
        ...(head ? { bold: true } : {}),
      };
      const sub = inlineRuns(body, pal, {});
      sub.forEach((r, i) => {
        r.options = { ...base, ...r.options, breakLine: i === sub.length - 1 };
        if (bullet && i > 0) delete (r.options as Record<string, unknown>)['bullet'];
      });
      runs.push(...sub);
      h += linesFor(plain(body), 14, bullet ? w - 0.25 : w) * lineH(14);
    }
    h += 0.09; // paragraph spacing
  }
  return {
    h,
    draw: (ps, f, s) =>
      ps.addText(runs as PptxGenJS.TextProps[], {
        x: f.x,
        y: f.y,
        w: f.w,
        h: Math.max(0.3, h * s),
        fontSize: fs(14, s),
        fontFace: pal.body,
        color: pal.charcoal,
        valign: 'top',
        paraSpaceAfter: 6 * s,
        fit: 'shrink',
      }),
  };
}

// ── Native block builders ───────────────────────────────────────────────────

type Rec = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const arr = (v: unknown): Rec[] => (Array.isArray(v) ? (v.filter((x) => x !== null) as Rec[]) : []);

/** Simple bulleted rows: each row = lead (bold) + rest, one paragraph per item. */
function bulletPiece(
  rows: ReadonlyArray<{ lead?: string; rest?: string; num?: string }>,
  w: number,
  pal: Palette,
  opts: { title?: string } = {},
): Piece {
  const runs: TextRun[] = [];
  let h = 0.05;
  if (opts.title !== undefined && opts.title !== '') {
    runs.push({ text: opts.title, options: { bold: true, breakLine: true, fontSize: 15, color: pal.navy } });
    h += lineH(15) + 0.06;
  }
  for (const r of rows) {
    const bullet: Rec =
      r.num !== undefined ? {} : { bullet: { characterCode: '2022', indent: 12 } };
    if (r.num !== undefined)
      runs.push({ text: `${r.num}  `, options: { bold: true, color: pal.highlight, ...bullet } });
    if (r.lead !== undefined && r.lead !== '')
      runs.push({ text: r.lead, options: { bold: true, ...(r.num === undefined ? bullet : {}) } });
    const rest = r.rest ?? '';
    const leadEmpty = (r.lead ?? '') === '' && r.num === undefined;
    runs.push({
      text: rest === '' ? ' ' : (r.lead !== undefined && r.lead !== '' ? ` — ${rest}` : rest),
      options: { breakLine: true, color: pal.slate, ...(leadEmpty ? bullet : {}) },
    });
    h += Math.max(1, linesFor(`${r.lead ?? ''} ${rest}`, 13.5, w - 0.3)) * lineH(13.5) + 0.045;
  }
  return {
    h,
    draw: (ps, f, s) =>
      ps.addText(runs as PptxGenJS.TextProps[], {
        x: f.x,
        y: f.y,
        w: f.w,
        h: Math.max(0.3, h * s),
        fontSize: fs(13.5, s),
        fontFace: pal.body,
        color: pal.charcoal,
        valign: 'top',
        paraSpaceAfter: 5 * s,
        fit: 'shrink',
      }),
  };
}

function buildCallout(d: Rec, w: number, pal: Palette): Piece {
  const tone = str(d['tone']);
  const accent =
    tone === 'warn' ? pal.highlight : tone === 'danger' ? pal.negative : tone === 'success' ? pal.positive : tone === 'tip' ? pal.teal : pal.blue;
  const title = str(d['title']);
  const body = str(d['body']);
  const textH =
    (title !== '' ? lineH(14) : 0) + linesFor(plain(body), 13, w - 0.55) * lineH(13);
  const h = textH + 0.42;
  return {
    h,
    draw: (ps, f, s) => {
      const bh = Math.max(0.5, h * s);
      ps.addShape('rect', { x: f.x, y: f.y, w: f.w, h: bh, fill: { color: pal.lightGray } });
      ps.addShape('rect', { x: f.x, y: f.y, w: 0.055, h: bh, fill: { color: accent } });
      const runs: TextRun[] = [];
      if (title !== '') runs.push({ text: title, options: { bold: true, breakLine: true, color: pal.navy } });
      runs.push(...inlineRuns(body, pal).map((r, i, a) => ({ ...r, options: { ...r.options, breakLine: i === a.length - 1 } })));
      ps.addText(runs as PptxGenJS.TextProps[], {
        x: f.x + 0.18, y: f.y + 0.1, w: f.w - 0.36, h: bh - 0.2,
        fontSize: fs(13, s), fontFace: pal.body, color: pal.charcoal, valign: 'middle', fit: 'shrink',
      });
    },
  };
}

function buildPullquote(d: Rec, w: number, pal: Palette): Piece {
  const text = str(d['text']);
  const by = str(d['attribution']);
  const h = linesFor(plain(text), 20, w - 0.6) * lineH(20) + (by !== '' ? lineH(12) + 0.1 : 0) + 0.3;
  return {
    h,
    draw: (ps, f, s) => {
      const runs: TextRun[] = [
        { text: `“${text}”`, options: { italic: true, breakLine: true, fontSize: fs(20, s), color: pal.navy, fontFace: pal.display } },
      ];
      if (by !== '') runs.push({ text: `— ${by}`, options: { fontSize: fs(12, s), color: pal.gray } });
      ps.addText(runs as PptxGenJS.TextProps[], {
        x: f.x + 0.3, y: f.y, w: f.w - 0.6, h: Math.max(0.4, h * s),
        fontFace: pal.display, align: 'center', valign: 'middle', fit: 'shrink',
      });
    },
  };
}

function buildDivider(d: Rec, w: number, pal: Palette): Piece {
  const kicker = str(d['kicker']);
  const title = str(d['title']);
  const subtitle = str(d['subtitle']);
  const h = 1.7;
  return {
    h,
    draw: (ps, f, s) => {
      const runs: TextRun[] = [];
      if (kicker !== '')
        runs.push({ text: kicker.toUpperCase(), options: { breakLine: true, fontSize: fs(12, s), fontFace: pal.mono, color: pal.highlight, charSpacing: 3 } });
      runs.push({ text: title, options: { breakLine: true, bold: true, fontSize: fs(32, s), color: pal.navy, fontFace: pal.display } });
      if (subtitle !== '') runs.push({ text: subtitle, options: { fontSize: fs(14, s), color: pal.slate } });
      ps.addText(runs as PptxGenJS.TextProps[], {
        x: f.x, y: f.y, w: f.w, h: h * s, align: 'center', valign: 'middle', paraSpaceAfter: 8 * s, fit: 'shrink',
      });
    },
  };
}

function buildCode(d: Rec, w: number, pal: Palette): Piece {
  // Snippets: the flat `code:`/`session:` form plus the blocks[] form. Two
  // snippets sit side by side (like the deck); more stack.
  const snips: Array<{ title: string; code: string }> = [];
  const flat = str(d['code']) !== '' ? str(d['code']) : str(d['session']);
  if (flat !== '') snips.push({ title: str(d['lang']), code: flat });
  for (const b of arr(d['blocks'])) {
    const code = str(b['code']) !== '' ? str(b['code']) : str(b['session']);
    if (code !== '') snips.push({ title: str(b['title']) !== '' ? str(b['title']) : str(b['lang']), code });
  }
  const twoUp = snips.length === 2;
  const colW = twoUp ? (w - 0.25) / 2 : w;
  const boxH = (code: string): number => linesFor(code, 11, colW - 0.3) * lineH(11) + 0.42;
  const h = twoUp
    ? Math.max(boxH(snips[0]?.code ?? ''), boxH(snips[1]?.code ?? ''))
    : snips.reduce((a, sn) => a + boxH(sn.code) + 0.14, 0);
  return {
    h: Math.max(h, 0.6),
    draw: (ps, f, s) => {
      let y = f.y;
      snips.forEach((sn, i) => {
        const x = twoUp ? f.x + i * (colW + 0.25) : f.x;
        const bh = Math.max(0.5, boxH(sn.code) * s);
        ps.addShape('roundRect', { x, y, w: colW, h: bh, fill: { color: '1c2230' }, rectRadius: 0.06 });
        if (sn.title !== '')
          ps.addText(sn.title, { x: x + 0.12, y: y + 0.04, w: colW - 0.24, h: 0.22, fontSize: fs(8.5, s), fontFace: pal.mono, color: '8f9bb3', align: 'right' });
        ps.addText(sn.code, {
          x: x + 0.15, y: y + 0.2, w: colW - 0.3, h: bh - 0.28,
          fontSize: fs(11, s), fontFace: pal.mono, color: 'e8ecf5', valign: 'top', fit: 'shrink', lineSpacingMultiple: 1.15,
        });
        if (!twoUp) y += bh + 0.14 * s;
      });
    },
  };
}

function buildTable(d: Rec, w: number, pal: Palette): Piece {
  const cols = (Array.isArray(d['columns']) ? d['columns'] : []).map((c: unknown) =>
    typeof c === 'string' ? c : str((c as Rec)['label']),
  );
  const rows = (Array.isArray(d['rows']) ? d['rows'] : []) as unknown[][];
  const cellText = (c: unknown): string =>
    typeof c === 'object' && c !== null ? str((c as Rec)['v']) : str(c);
  const cellTone = (c: unknown): string | undefined => {
    const tone = typeof c === 'object' && c !== null ? str((c as Rec)['tone']) : '';
    return tone === 'pos' ? pal.positive : tone === 'neg' ? pal.negative : tone === 'warn' ? pal.highlight : tone === 'muted' ? pal.gray : undefined;
  };
  const h = (rows.length + 1) * 0.32 + 0.1;
  return {
    h,
    draw: (ps, f, s) => {
      const header = cols.map((c) => ({
        text: c,
        options: { bold: true, color: 'ffffff', fill: { color: pal.navy }, fontSize: fs(11, s) },
      }));
      const body = rows.map((r, ri) =>
        r.map((c) => ({
          text: cellText(c),
          options: {
            fontSize: fs(11.5, s),
            color: cellTone(c) ?? pal.charcoal,
            fill: { color: ri % 2 === 1 ? pal.lightGray : 'ffffff' },
          },
        })),
      );
      ps.addTable([header, ...body] as PptxGenJS.TableRow[], {
        x: f.x, y: f.y, w: f.w,
        fontFace: pal.body,
        border: { pt: 0.5, color: pal.rule },
        valign: 'middle',
        autoPage: false,
      });
    },
  };
}

function buildStats(d: Rec, w: number, pal: Palette): Piece {
  const stats = arr(d['stats']);
  const h = 1.1;
  return {
    h,
    draw: (ps, f, s) => {
      const n = Math.max(1, stats.length);
      const bw = (f.w - 0.2 * (n - 1)) / n;
      stats.forEach((st, i) => {
        const x = f.x + i * (bw + 0.2);
        const trend = str(st['trend']);
        const deltaColor = trend === 'down' ? pal.negative : trend === 'up' ? pal.positive : pal.gray;
        ps.addShape('roundRect', { x, y: f.y, w: bw, h: h * s, fill: { color: pal.lightGray }, rectRadius: 0.05 });
        const runs: TextRun[] = [
          { text: str(st['value']), options: { bold: true, breakLine: true, fontSize: fs(24, s), color: pal.navy, fontFace: pal.display } },
          { text: str(st['label']).toUpperCase(), options: { fontSize: fs(8.5, s), color: pal.gray, charSpacing: 2, breakLine: str(st['delta']) !== '' } },
        ];
        if (str(st['delta']) !== '')
          runs.push({ text: str(st['delta']), options: { bold: true, fontSize: fs(10, s), color: deltaColor } });
        ps.addText(runs as PptxGenJS.TextProps[], { x: x + 0.08, y: f.y, w: bw - 0.16, h: h * s, align: 'center', valign: 'middle', fit: 'shrink' });
      });
    },
  };
}

/** Native PowerPoint chart for bar / line / area / donut; null → screenshot. */
function buildChart(d: Rec, w: number, pal: Palette, pres: PptxGenJS): Piece | null {
  const kind = str(d['kind']) === '' ? 'bar' : str(d['kind']);
  const type =
    kind === 'bar' ? 'bar' : kind === 'line' ? 'line' : kind === 'area' ? 'area' : kind === 'donut' ? 'doughnut' : null;
  if (type === null) return null;
  const labels = (Array.isArray(d['labels']) ? d['labels'] : []).map(str);
  const series = arr(d['series']);
  const items = arr(d['items']).length > 0 ? arr(d['items']) : arr(d['stages']);
  let data: Array<{ name: string; labels: string[]; values: number[] }>;
  if (series.length > 0 && labels.length > 0) {
    data = series.map((sr) => ({
      name: str(sr['label']),
      labels,
      values: (Array.isArray(sr['values']) ? sr['values'] : []).map((v) => Number(v) || 0),
    }));
  } else if (items.length > 0) {
    data = [{ name: str(d['title']) === '' ? 'Series' : str(d['title']), labels: items.map((it) => str(it['label'])), values: items.map((it) => Number(it['value']) || 0) }];
  } else {
    return null;
  }
  const h = 2.9;
  return {
    h,
    draw: (ps, f, s) => {
      ps.addChart(pres.ChartType[type as 'bar'], data, {
        x: f.x, y: f.y, w: f.w, h: Math.max(1.4, h * s),
        chartColors: [pal.navy, pal.highlight, pal.teal, pal.purple, pal.blue],
        showLegend: data.length > 1 || type === 'doughnut',
        legendPos: 'b',
        catAxisLabelFontSize: 9,
        valAxisLabelFontSize: 9,
        legendFontSize: 9,
        dataLabelFontSize: 9,
        showValue: false,
        barGapWidthPct: 40,
        ...(type === 'doughnut' ? { holeSize: 60 } : {}),
      });
    },
  };
}

function buildImage(ctx: BuildCtx, w: number): Piece | null {
  const shot = ctx.shots.get(ctx.key);
  if (shot === undefined) return null;
  const h = w * shot.aspect;
  return {
    h,
    draw: (ps, f, s) => {
      // Preserve aspect: scale the box down, keep it centered in the frame.
      let iw = f.w;
      let ih = h;
      if (s < 1) {
        ih = h * s;
        iw = ih / shot.aspect;
      }
      ps.addImage({ data: shot.data, x: f.x + (f.w - iw) / 2, y: f.y, w: iw, h: ih });
    },
  };
}

// ── Part → piece dispatch ───────────────────────────────────────────────────

/** Block types that render natively; anything else becomes a screenshot. */
function buildBlock(part: SlidePart, w: number, ctx: BuildCtx): Piece | null {
  const d = (part.data ?? {}) as Rec;
  const pal = ctx.pal;
  const rows = (items: Rec[], lead: (r: Rec) => string, rest: (r: Rec) => string, num?: boolean): Piece =>
    bulletPiece(
      items.map((r, i) => ({ lead: lead(r), rest: rest(r), ...(num === true ? { num: `${i + 1}.` } : {}) })),
      w,
      pal,
      { title: str(d['title']) },
    );
  switch (part.type) {
    case 'callout':
      return buildCallout(d, w, pal);
    case 'pullquote':
      return buildPullquote(d, w, pal);
    case 'divider':
      return buildDivider(d, w, pal);
    case 'code':
      return buildCode(d, w, pal);
    case 'table':
      return buildTable(d, w, pal);
    case 'stats':
      return buildStats(d, w, pal);
    case 'chart':
      return buildChart(d, w, pal, ctx.pres) ?? buildImage(ctx, w);
    case 'list':
      return rows(arr(d['items']), (r) => str(r['lead']), (r) => str(r['text']));
    case 'takeaways':
      return rows(arr(d['items']), (r) => str(r['text']), (r) => str(r['detail']));
    case 'steps':
      return rows(arr(d['items']), (r) => str(r['title']), (r) => str(r['body']), true);
    case 'faq':
      return rows(arr(d['items']), (r) => str(r['q']), (r) => str(r['a']));
    case 'glossary':
      return rows(arr(d['terms']), (r) => str(r['term']), (r) => str(r['def']));
    case 'agenda':
      return rows(
        arr(d['items']),
        (r) => [str(r['time']), str(r['duration'])].filter((x) => x !== '').join(' · '),
        (r) => [str(r['title']), str(r['desc'])].filter((x) => x !== '').join(' — '),
      );
    default:
      return buildImage(ctx, w);
  }
}

// ── Diagram screenshots (only for non-native parts) ─────────────────────────

const SHOT_WIDTH = 1040;

function shotShell(html: string, css: string, themeVars: string, defs: string, paper: string): string {
  return (
    `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>` +
    `<style>:root{${themeVars}}</style>` +
    `<style>body{margin:0;padding:20px;background:#${paper};width:${SHOT_WIDTH}px}</style></head>` +
    `<body>${defs}<div class="docskin" id="shot">${html}</div></body></html>`
  );
}

/** True if this part will need a screenshot instead of native elements. */
function needsShot(part: SlidePart): boolean {
  if (part.kind !== 'block') return false;
  const native = new Set([
    'callout', 'pullquote', 'divider', 'code', 'table', 'stats',
    'list', 'takeaways', 'steps', 'faq', 'glossary', 'agenda',
  ]);
  if (native.has(part.type ?? '')) return false;
  if (part.type === 'chart') {
    // Only radar/waterfall/funnel (or data-less) charts fall back to images.
    const d = (part.data ?? {}) as Rec;
    const kind = str(d['kind']) === '' ? 'bar' : str(d['kind']);
    const hasData = arr(d['series']).length > 0 || arr(d['items']).length > 0 || arr(d['stages']).length > 0;
    return !['bar', 'line', 'area', 'donut'].includes(kind) || !hasData;
  }
  return true;
}

// ── The exporter ────────────────────────────────────────────────────────────

/** CJS/ESM interop: unwrap however many `default`s the bundler nested. */
async function loadPptxGen(): Promise<typeof PptxGenJS> {
  let mod: unknown = await import('pptxgenjs');
  while (typeof mod === 'object' && mod !== null && 'default' in mod) {
    mod = (mod as { default: unknown }).default;
  }
  return mod as typeof PptxGenJS;
}

/**
 * Renders a document to an EDITABLE `.pptx`: native text, bullets, tables,
 * code boxes and charts, with screenshots only for diagram blocks. Chromium
 * is only launched when the document actually contains diagram blocks.
 */
export async function toPptxEditable(
  doc: Document,
  renderOpts: RenderPartsOptions = {},
  opts: PptxEditableOptions = {},
): Promise<Uint8Array> {
  const model = renderSlides(doc, renderOpts);
  const pal = paletteFrom(model.themeVars);

  // 1 · Screenshot pass — one Chromium page reused for every diagram part.
  const shots = new Map<string, { data: string; aspect: number }>();
  const wanted: Array<{ key: string; html: string }> = [];
  model.slides.forEach((sl, si) =>
    (sl.parts ?? []).forEach((p, pi) => {
      if (needsShot(p)) wanted.push({ key: `${si}:${pi}`, html: p.html });
    }),
  );
  if (wanted.length > 0) {
    const pw = await loadPlaywright();
    const browser = await launchChromium(pw, opts);
    try {
      const page = await browser.newPage({
        viewport: { width: SHOT_WIDTH + 40, height: 1400 },
        deviceScaleFactor: 2,
      });
      for (const item of wanted) {
        await page.setContent(shotShell(item.html, model.css, model.themeVars, model.defs, pal.paper), {
          waitUntil: 'networkidle',
        });
        const el = page.locator('#shot');
        const box = await el.boundingBox();
        const png = await el.screenshot({ type: 'png' });
        const aspect = box !== null && box.width > 0 ? box.height / box.width : 0.6;
        shots.set(item.key, { data: `image/png;base64,${png.toString('base64')}`, aspect });
      }
    } finally {
      await browser.close();
    }
  }

  // 2 · Assemble the presentation.
  const Pptx = await loadPptxGen();
  const pres = new Pptx();
  pres.layout = 'LAYOUT_16x9';
  if (model.title !== '') pres.title = model.title;

  model.slides.forEach((sl, si) => {
    const ps = pres.addSlide();
    ps.background = { color: pal.paper };
    const isCover = si === 0 && sl.label === 'Cover';
    if (isCover) {
      drawCover(ps, doc, pal);
      return;
    }
    drawContentSlide(ps, sl, si, model.slides.length, model.title, pal, pres, shots);
  });

  const out = (await pres.write({ outputType: 'nodebuffer' })) as Buffer;
  return new Uint8Array(out);
}

function drawCover(ps: PSlide, doc: Document, pal: Palette): void {
  const meta = (doc.meta ?? {}) as Rec;
  ps.addShape('rect', { x: 0, y: 0, w: 0.12, h: PH, fill: { color: pal.navy } });
  const runs: TextRun[] = [
    { text: ['DOCUMENT', str(meta['tag']).toUpperCase()].filter((s) => s !== '').join('   ·   '), options: { breakLine: true, fontSize: 11, fontFace: pal.mono, color: pal.highlight, charSpacing: 3 } },
    { text: str(meta['title']), options: { bold: true, breakLine: true, fontSize: 36, color: pal.navy, fontFace: pal.display } },
  ];
  if (str(meta['subtitle']) !== '')
    runs.push({ text: str(meta['subtitle']), options: { fontSize: 14, color: pal.slate } });
  ps.addText(runs as PptxGenJS.TextProps[], {
    x: 1, y: 1.3, w: PW - 2, h: PH - 2.6, align: 'center', valign: 'middle', paraSpaceAfter: 12, fit: 'shrink',
  });
  ps.addNotes(str(meta['title']));
}

function drawContentSlide(
  ps: PSlide,
  sl: Slide,
  si: number,
  total: number,
  deckTitle: string,
  pal: Palette,
  pres: PptxGenJS,
  shots: ReadonlyMap<string, { data: string; aspect: number }>,
): void {
  const parts = sl.parts ?? [];
  // A lone divider is its own title card; untitled prose needs no chrome.
  const onlyDivider = parts.length === 1 && parts[0]?.type === 'divider';
  const untitled = sl.title === undefined && sl.label === 'Slide';
  const bare = onlyDivider || untitled;

  let top = CONTENT_Y;
  if (!bare) {
    const heading = sl.title ?? sl.label;
    const nn = String(si).padStart(2, '0');
    ps.addText(heading, {
      x: MX, y: TITLE_Y, w: CW - 1.6, h: 0.55,
      fontSize: 21, bold: true, color: pal.navy, fontFace: pal.display, valign: 'middle', fit: 'shrink',
    });
    ps.addText(`${nn} · ${sl.label.toUpperCase()}`, {
      x: PW - MX - 1.6, y: TITLE_Y, w: 1.6, h: 0.55,
      fontSize: 8.5, fontFace: pal.mono, color: pal.gray, align: 'right', valign: 'middle', charSpacing: 2,
    });
    ps.addShape('rect', { x: MX, y: 0.94, w: CW, h: 0.012, fill: { color: pal.rule } });
  } else {
    top = 0.6;
  }
  // Footer
  ps.addText(deckTitle.toUpperCase(), {
    x: MX, y: PH - 0.34, w: CW - 1, h: 0.25, fontSize: 7.5, fontFace: pal.mono, color: pal.gray, charSpacing: 2,
  });
  ps.addText(`${si + 1} / ${total}`, {
    x: PW - MX - 1, y: PH - 0.34, w: 1, h: 0.25, fontSize: 7.5, fontFace: pal.mono, color: pal.gray, align: 'right',
  });
  ps.addNotes(sl.title ?? sl.label);

  // Frames: full width, or message-left / exhibit-right for split slides.
  const regions: Array<{ frame: Frame; parts: SlidePart[]; keyOf: (p: SlidePart) => string }> =
    sl.layout === 'split'
      ? [
          { frame: { x: MX, y: top, w: 3.85 }, parts: parts.filter((p) => p.kind !== 'block'), keyOf: keyFn(sl, si) },
          { frame: { x: MX + 4.15, y: top, w: CW - 4.15 }, parts: parts.filter((p) => p.kind === 'block'), keyOf: keyFn(sl, si) },
        ]
      : [{ frame: { x: MX, y: top, w: CW }, parts: [...parts], keyOf: keyFn(sl, si) }];

  for (const region of regions) {
    const avail = CONTENT_B - region.frame.y;
    const pieces: Array<{ piece: Piece }> = [];
    for (const p of region.parts) {
      const ctx: BuildCtx = { pal, pres, shots, key: region.keyOf(p) };
      const piece =
        p.kind === 'prose' ? buildProse(p.text ?? '', region.frame.w, pal) : buildBlock(p, region.frame.w, ctx);
      if (piece !== null) pieces.push({ piece });
    }
    const gap = 0.18;
    const natural = pieces.reduce((a, p) => a + p.piece.h, 0) + gap * Math.max(0, pieces.length - 1);
    const scale = natural > avail ? Math.max(0.55, avail / natural) : 1;
    const used = natural * scale;
    // Vertical alignment mirrors the deck: centered unless the slide is packed.
    const align = sl.align ?? 'center';
    let y =
      align === 'top' ? region.frame.y : align === 'bottom' ? CONTENT_B - used : region.frame.y + Math.max(0, (avail - used) / 2);
    for (const { piece } of pieces) {
      piece.draw(ps, { x: region.frame.x, y, w: region.frame.w }, scale);
      y += piece.h * scale + gap * scale;
    }
  }
}

/** Stable screenshot key for a part: its index within the slide's parts. */
function keyFn(sl: Slide, si: number): (p: SlidePart) => string {
  return (p) => `${si}:${(sl.parts ?? []).indexOf(p)}`;
}
