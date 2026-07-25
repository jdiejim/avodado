import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { renderBenchmark } from '../blocks/benchmark.js';

/** The rendered slots of one row, in column order, as `text` + won flag. */
function row(html: string, ri: number): Array<{ text: string; best: boolean }> {
  const tr = parse(html).querySelectorAll('tbody tr')[ri];
  if (tr === undefined) throw new Error(`no row ${ri}`);
  return tr.querySelectorAll('.bm-slot').map((slot) => ({
    text: slot.querySelector('.bm-val')?.text ?? '',
    best: slot.classNames.includes('bm-best'),
  }));
}

const SUBJECTS = [
  { label: 'Ours', featured: true },
  { label: 'Vendor A' },
  { label: 'Vendor B', tone: 'muted' as const },
];

describe('benchmark', () => {
  it('derives the best value per row from the numbers inside the cells', () => {
    const html = renderBenchmark({
      subjects: SUBJECTS,
      rows: [{ label: 'Accuracy', cells: ['82.4%', '79.1%', '74.8%'] }],
    });
    expect(row(html, 0).map((s) => s.best)).toEqual([true, false, false]);
    // Units and currency don't stop the comparison.
    const money = renderBenchmark({
      subjects: SUBJECTS,
      rows: [{ label: 'Cost', better: 'low', cells: ['$0.21', '$0.90', '$0.18'] }],
    });
    expect(money.includes('bm-best')).toBe(true);
    expect(row(money, 0).map((s) => s.best)).toEqual([false, false, true]);
  });

  it('`better: none` highlights nothing; a tie highlights both', () => {
    const none = renderBenchmark({
      subjects: SUBJECTS,
      rows: [{ label: 'Index size', better: 'none', cells: ['112 GB', '98 GB', '150 GB'] }],
    });
    expect(none).not.toContain('bm-best');

    const tie = renderBenchmark({
      subjects: SUBJECTS,
      rows: [{ label: 'Recall', cells: ['90%', '90%', '80%'] }],
    });
    expect(row(tie, 0).map((s) => s.best)).toEqual([true, true, false]);
  });

  it('compares each variant line on its own and captions the values', () => {
    const html = renderBenchmark({
      subjects: SUBJECTS,
      rows: [
        {
          label: 'Reasoning',
          variants: ['no tools', 'with tools'],
          cells: [
            ['56.3%', '64.7%'],
            ['56.5%', '63.9%'],
            [],
          ],
        },
      ],
    });
    const slots = row(html, 0);
    // 3 subjects × 2 lines, column-major.
    expect(slots).toHaveLength(6);
    expect(slots.map((s) => s.text)).toEqual(['56.3%', '64.7%', '56.5%', '63.9%', '—', '—']);
    // Vendor A wins "no tools", we win "with tools" — per line, not per row.
    expect(slots.map((s) => s.best)).toEqual([false, true, true, false, false, false]);
    expect(html).toContain('>no tools<');
    // A subject that didn't run the benchmark gets no condition caption.
    expect((html.match(/>with tools</g) ?? []).length).toBe(2);
  });

  it('`best: true` forces a highlight a number cannot win', () => {
    const html = renderBenchmark({
      subjects: SUBJECTS,
      rows: [{ label: 'Support', cells: [{ value: 'named engineer', best: true }, 'email', 'email'] }],
    });
    expect(row(html, 0).map((s) => s.best)).toEqual([true, false, false]);
  });

  it('marks the featured column and tones each subject’s win', () => {
    const html = renderBenchmark({
      subjects: SUBJECTS,
      rows: [
        { label: 'A', cells: ['9', '1', '1'] },
        { label: 'B', cells: ['1', '1', '9'] },
      ],
    });
    const root = parse(html);
    // The featured column carries the outline class on the head + every cell.
    expect(root.querySelectorAll('.bm-feat')).toHaveLength(3);
    // Our win tints with the accent, the muted subject's win stays gray.
    expect(html).toContain('bm-best bm-accent');
    expect(html).toContain('bm-best bm-muted');
  });

  it('renders a missing cell as an em dash and keeps the note above the value', () => {
    const html = renderBenchmark({
      subjects: [{ label: 'Ours' }, { label: 'Theirs' }],
      rows: [{ label: 'Health', cells: [{ value: '66.0%', note: 'preview build' }] }],
      metricLabel: 'Eval',
      note: 'Single region.',
    });
    expect(row(html, 0).map((s) => s.text)).toEqual(['66.0%', '—']);
    expect(html).toContain('<span class="bm-note">preview build</span>');
    expect(html).toContain('>Eval<');
    expect(html).toContain('class="bm-foot"');
  });
});
