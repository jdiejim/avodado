import { describe, expect, it } from 'vitest';
import { parseDocument, type TypedSegment } from '@avodado/core';
import { blockWeight, renderSlides } from '../parts.js';

/** Parses a single fenced block and returns its typed segment. */
function block(md: string): TypedSegment {
  const seg = parseDocument(md, 'd').segments.find(
    (s): s is TypedSegment => s.kind !== 'markdown',
  );
  if (seg === undefined) throw new Error('no typed segment');
  return seg;
}

const driversMd = (n: number): string =>
  ['```drivers', 'items:', ...Array.from({ length: n }, (_, i) => `  - { title: D${i}, body: some body text, tag: TAG }`), '```'].join('\n');

const tableMd = (n: number): string =>
  ['```table', 'columns: [A, B]', 'rows:', ...Array.from({ length: n }, (_, i) => `  - [a${i}, b${i}]`), '```'].join('\n');

const optionsMd = (n: number): string =>
  [
    '```options',
    'items:',
    ...Array.from(
      { length: n },
      (_, i) =>
        `  - { kicker: "Option ${i}", title: T${i}, how: how it works, pros: [p1, p2], cons: [c1, c2], verdict: OK }`,
    ),
    '```',
  ].join('\n');

const flowMd = (n: number): string =>
  [
    '```flow',
    'nodes:',
    ...Array.from({ length: n }, (_, i) => `  - { id: n${i}, col: ${i + 1}, row: 1, label: N${i} }`),
    'edges:',
    ...Array.from({ length: n - 1 }, (_, i) => `  - { from: n${i}, to: n${i + 1} }`),
    '```',
  ].join('\n');

// A block this heavy is a full-slide exhibit (mirrors HERO_WEIGHT in parts.ts).
const HERO = 8;

describe('blockWeight', () => {
  it('scales card grids with item count (drivers)', () => {
    expect(blockWeight(block(driversMd(2)))).toBeLessThan(HERO);
    expect(blockWeight(block(driversMd(4)))).toBeGreaterThanOrEqual(HERO);
  });

  it('counts options cards plus their pros/cons', () => {
    expect(blockWeight(block(optionsMd(4)))).toBeGreaterThanOrEqual(HERO);
    // 4 cards × (2 + 4 sub-items × 0.4) — big comparison cards dominate a slide
    expect(blockWeight(block(optionsMd(4)))).toBeGreaterThan(blockWeight(block(driversMd(4))));
    expect(blockWeight(block(optionsMd(2)))).toBeLessThan(blockWeight(block(optionsMd(4))));
  });

  it('scales tables with row count', () => {
    expect(blockWeight(block(tableMd(3)))).toBeLessThan(HERO);
    expect(blockWeight(block(tableMd(8)))).toBeGreaterThanOrEqual(HERO);
  });

  it('scales statustables with rows AND nested subtasks (every line is a row)', () => {
    const md = (rows: number, subsOnFirst: number): string =>
      [
        '```statustable',
        'rows:',
        ...Array.from({ length: rows }, (_, i) => {
          const row = `  - cells: [T${i}, U${i}]\n    status: done`;
          if (i !== 0 || subsOnFirst === 0) return row;
          const subs = Array.from(
            { length: subsOnFirst },
            (_, j) => `      - { cells: [S${j}], status: todo }`,
          );
          return `${row}\n    subtasks:\n${subs.join('\n')}`;
        }),
        '```',
      ].join('\n');
    // Same row weighting as table: 3 rows share the stage, 8 rows are a hero…
    expect(blockWeight(block(md(3, 0)))).toBeLessThan(HERO);
    expect(blockWeight(block(md(8, 0)))).toBeGreaterThanOrEqual(HERO);
    // …and subtasks count as lines: 3 parents + 6 subtasks = a 9-line exhibit.
    expect(blockWeight(block(md(3, 6)))).toBeGreaterThanOrEqual(HERO);
    expect(blockWeight(block(md(3, 6)))).toBe(blockWeight(block(md(9, 0))));
  });

  it('scales matrices with row count', () => {
    const matrixMd = (n: number): string =>
      ['```matrix', 'cols: [A, B]', 'rows:', ...Array.from({ length: n }, (_, i) => `  - { label: R${i}, cells: [x, y] }`), '```'].join('\n');
    expect(blockWeight(block(matrixMd(3)))).toBeLessThan(HERO);
    expect(blockWeight(block(matrixMd(7)))).toBeGreaterThanOrEqual(HERO);
  });

  it('scales sequences with actors and messages', () => {
    const seqMd = (actors: number, msgs: number): string =>
      [
        '```sequence',
        'actors:',
        ...Array.from({ length: actors }, (_, i) => `  - { id: a${i}, name: A${i} }`),
        'messages:',
        ...Array.from({ length: msgs }, (_, i) => `  - { from: a0, to: a${(i % (actors - 1)) + 1}, label: m${i} }`),
        '```',
      ].join('\n');
    expect(blockWeight(block(seqMd(2, 3)))).toBeLessThan(HERO);
    expect(blockWeight(block(seqMd(5, 6)))).toBeGreaterThanOrEqual(HERO);
  });

  it('scales node diagrams with node count', () => {
    expect(blockWeight(block(flowMd(3)))).toBeLessThan(HERO);
    expect(blockWeight(block(flowMd(8)))).toBeGreaterThanOrEqual(HERO);
  });

  it('weighs charts by their series — a plotted figure, not a two-item list', () => {
    const lineMd = [
      '```chart',
      'kind: line',
      'labels: [W1, W2, W3]',
      'series:',
      '  - { label: a, values: [1, 2, 3] }',
      '  - { label: b, values: [2, 3, 4] }',
      '```',
    ].join('\n');
    // Two 2-series charts must NOT share one slide (budget 10) — three on one
    // slide was the s59 "tiny chart" bug.
    expect(blockWeight(block(lineMd))).toBeGreaterThan(5);
    const donutMd = [
      '```chart',
      'kind: donut',
      'items:',
      '  - { label: Web, value: 62 }',
      '  - { label: iOS, value: 23 }',
      '  - { label: Android, value: 15 }',
      '```',
    ].join('\n');
    expect(blockWeight(block(donutMd))).toBeGreaterThan(5);
  });
});

describe('renderSlides', () => {
  it('one slide per heading for light sections', () => {
    const md = [
      '```meta',
      'title: T',
      '```',
      '',
      '## One',
      '',
      'short prose',
      '',
      '## Two',
      '',
      '```callout',
      'tone: tip',
      'body: hi',
      '```',
    ].join('\n');
    const { slides } = renderSlides(parseDocument(md, 'd'));
    // cover + One + Two
    expect(slides.length).toBe(3);
    expect(slides[1]?.title).toBe('One');
    expect(slides[2]?.title).toBe('Two');
  });

  it('paginates a heavy heading across multiple slides (same title)', () => {
    const big = (n: number): string =>
      ['```list', 'style: number', 'items:', ...Array.from({ length: n }, (_, i) => `  - { lead: Item ${i} }`), '```'].join(
        '\n',
      );
    const md = ['```meta', 'title: T', '```', '', '## Heavy', '', big(9), '', big(9), '', big(9)].join('\n');
    const { slides } = renderSlides(parseDocument(md, 'd'));
    const heavy = slides.filter((s) => s.title === 'Heavy');
    // three big lists shouldn't all land on one slide
    expect(heavy.length).toBeGreaterThan(1);
  });

  it('hero rule: intro prose and a heavy block split onto separate slides', () => {
    const intro = [
      'Three requirements drive everything we build here, and each one shapes the access model:',
      '',
      '- **Read access per site:** read-only access to an app, scoped to the sites a user belongs to.',
      '- **Roles as groups:** anything beyond read is a role, provisioned through governance.',
      '- **Permissions differ across apps:** the same role does different things in different apps.',
    ].join('\n');
    const md = ['```meta', 'title: T', '```', '', '## Needs', '', intro, '', driversMd(4)].join('\n');
    const { slides } = renderSlides(parseDocument(md, 'd'));
    const needs = slides.filter((s) => s.title === 'Needs');
    expect(needs.length).toBe(2);
    expect(needs[0]?.html).toContain('Three requirements');
    expect(needs[0]?.html).not.toContain('dv-grid');
    expect(needs[1]?.html).toContain('dv-grid');
    expect(needs[1]?.html).not.toContain('Three requirements');
  });

  it('hero rule: content after a hero exhibit spills to the next slide', () => {
    const md = [
      '```meta', 'title: T', '```', '', '## Needs', '', driversMd(4), '',
      '```callout', 'tone: tip', 'body: afterthought', '```',
    ].join('\n');
    const { slides } = renderSlides(parseDocument(md, 'd'));
    const needs = slides.filter((s) => s.title === 'Needs');
    expect(needs.length).toBe(2);
    expect(needs[0]?.html).toContain('dv-grid');
    expect(needs[0]?.html).not.toContain('afterthought');
    expect(needs[1]?.html).toContain('afterthought');
  });

  it('hero rule: a one-line lede rides along above a moderate hero exhibit', () => {
    const md = ['```meta', 'title: T', '```', '', '## Journey', '', 'The whole journey, request to gated app:', '', flowMd(8)].join('\n');
    const { slides } = renderSlides(parseDocument(md, 'd'));
    const j = slides.filter((s) => s.title === 'Journey');
    expect(j.length).toBe(1);
    expect(j[0]?.html).toContain('The whole journey');
  });

  it('hero rule: an oversized exhibit stands alone even with a one-line lede', () => {
    const md = ['```meta', 'title: T', '```', '', '## Options', '', 'We explored four approaches:', '', optionsMd(4)].join('\n');
    const { slides } = renderSlides(parseDocument(md, 'd'));
    const o = slides.filter((s) => s.title === 'Options');
    expect(o.length).toBe(2);
    expect(o[0]?.html).toContain('We explored four approaches');
    expect(o[0]?.html).not.toContain('op-grid');
    expect(o[1]?.html).toContain('op-grid');
  });

  it('{split} slides never paginate, even with a hero-weight block', () => {
    const longProse =
      'A long message column that would normally push the exhibit onto its own slide. '.repeat(4);
    const md = ['```meta', 'title: T', '```', '', '## Split {split}', '', longProse, '', optionsMd(4)].join('\n');
    const { slides } = renderSlides(parseDocument(md, 'd'));
    const s = slides.filter((sl) => sl.title === 'Split');
    expect(s.length).toBe(1);
    expect(s[0]?.layout).toBe('split');
    expect(s[0]?.html).toContain('sl-msg');
    expect(s[0]?.html).toContain('op-grid');
  });
});
