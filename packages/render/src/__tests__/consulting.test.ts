import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { parseDocument } from '@avodado/core';
import { renderHarvey } from '../blocks/harvey.js';
import { renderScqa } from '../blocks/scqa.js';
import { toSlides } from '../deck.js';

describe('harvey', () => {
  const FIT = {
    columns: ['Kafka', 'SQS', 'RabbitMQ'],
    rows: [
      { label: 'Throughput', ratings: [4, 2, 3], weight: 2 },
      { label: 'Ops burden', ratings: [1, 4, 3], weight: 2 },
      { label: 'Cost', ratings: [2, 4] },
    ],
    recommend: 'SQS',
  };

  it('draws a ball per rating, filled in proportion', () => {
    const root = parse(renderHarvey(FIT));
    // 3 rows × 3 columns, minus the one rating that was not supplied.
    expect(root.querySelectorAll('td.hv-cell svg')).toHaveLength(8);
    // A 4-of-4 is a solid disc (ring + fill), a partial is a wedge path.
    const html = renderHarvey({ columns: ['A'], rows: [{ label: 'x', ratings: [4] }] });
    expect(parse(html).querySelectorAll('td.hv-cell circle')).toHaveLength(2);
    const half = renderHarvey({ columns: ['A'], rows: [{ label: 'x', ratings: [2] }] });
    expect(half).toContain('<path d="M');
  });

  it('reads a missing rating as not assessed, not as zero', () => {
    const html = renderHarvey(FIT);
    expect(html).toContain('hv-na');
    // The empty ball (rating 0) and the dash are different marks.
    const zero = renderHarvey({ columns: ['A'], rows: [{ label: 'x', ratings: [0] }] });
    expect(zero).not.toContain('hv-na');
  });

  it('computes the weighted footer, so the recommendation can be checked', () => {
    const root = parse(renderHarvey(FIT));
    const totals = root.querySelectorAll('.hv-foot td').slice(1).map((t) => Number(t.text));
    // Kafka 4×2 + 1×2 + 2 = 12 · SQS 2×2 + 4×2 + 4 = 16 · Rabbit 3×2 + 3×2 + 0 = 12
    expect(totals).toEqual([12, 16, 12]);
    const lead = root.querySelectorAll('.hv-foot td.hv-lead');
    expect(lead).toHaveLength(1);
    expect(Number(lead[0]?.text)).toBe(16);
  });

  it('marks the recommended column in the head and its cells', () => {
    const html = renderHarvey(FIT);
    expect(html).toContain('RECOMMENDED');
    // Header + one cell per row + the total.
    expect((html.match(/hv-is-rec/g) ?? []).length).toBe(1 + FIT.rows.length + 1);
  });

  it('labels the ends of the scale when asked', () => {
    const html = renderHarvey({ ...FIT, scale: ['poor', 'excellent'] });
    expect(html).toContain('>poor<');
    expect(html).toContain('>excellent<');
  });
});

describe('scqa', () => {
  const SUMMARY = {
    situation: 'We process 12k orders a day.',
    complication: 'p95 crossed 2s in March.',
    question: 'Where does the quarter go?',
    answer: 'Move capture off the request path.',
    because: ['74% of p95', 'No schema change'],
  };

  it('numbers the setup and gives the answer the card', () => {
    const root = parse(renderScqa(SUMMARY));
    expect(root.querySelectorAll('.sq-row')).toHaveLength(3);
    expect(root.querySelectorAll('.sq-num').map((n) => n.text)).toEqual(['1', '2', '3']);
    expect(root.querySelector('.sq-answer')?.text).toContain('Move capture off');
    expect(root.querySelectorAll('.sq-because li')).toHaveLength(2);
  });

  it('keeps Minto order however the YAML was written', () => {
    const scrambled = renderScqa({
      answer: SUMMARY.answer,
      question: SUMMARY.question,
      situation: SUMMARY.situation,
      complication: SUMMARY.complication,
    });
    const labels = parse(scrambled)
      .querySelectorAll('.sq-row .sq-label')
      .map((l) => l.text);
    expect(labels).toEqual(['Situation', 'Complication', 'Question']);
  });

  it('renders an answer on its own — the recommendation is the point', () => {
    const html = renderScqa({ answer: 'Ship it.' });
    expect(parse(html).querySelectorAll('.sq-row')).toHaveLength(0);
    expect(html).toContain('Ship it.');
  });
});

describe('slide text', () => {
  const DOC = [
    '```meta',
    'title: Deck',
    '```',
    '',
    '## Move capture off the request path',
    '',
    '```stats',
    'lede: p95 crossed 2s in March and conversion fell with it.',
    'stats:',
    '  - { value: "2.4s", label: p95 }',
    '```',
  ].join('\n');

  it('pins a block lede under the slide title as the supporting line', () => {
    const html = toSlides(parseDocument(DOC, 'deck'));
    const header = parse(html).querySelector('.slide-hd-l');
    expect(header?.text).toContain('Move capture off the request path');
    expect(header?.querySelector('.slide-hd-sub')?.text).toBe(
      'p95 crossed 2s in March and conversion fell with it.',
    );
  });

  it('sets body copy at presentation size, with the measure still capped', () => {
    const html = toSlides(parseDocument(DOC, 'deck'));
    expect(html).toContain('.docskin.slide .slide-inner p{font-size:19px');
    expect(html).toContain('max-width:58ch');
    expect(html).toContain('.docskin.slide .slide-inner li{font-size:17.5px');
  });
});
