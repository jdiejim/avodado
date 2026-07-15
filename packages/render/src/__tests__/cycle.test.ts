import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { renderCycle } from '../blocks/cycle.js';

describe('cycle renderer', () => {
  const THREE = {
    title: 'Build–measure–learn',
    steps: [
      { label: 'Build', desc: 'Ship the smallest testable change' },
      { label: 'Measure' },
      { label: 'Learn', desc: 'Keep or roll back' },
    ],
    center: 'every release',
  };

  it('renders one pill group per step with data-bp, plus one arc per step', () => {
    const html = renderCycle(THREE);
    const root = parse(html);
    const pills = root.querySelectorAll('[data-bp="steps.0"], [data-bp="steps.1"], [data-bp="steps.2"]');
    // Each step appears three times: the pill group, its circled numeral
    // (clickable in editors), and its legend entry.
    expect(pills.length).toBe(9);
    // The ring closes: N steps → N arc arrows, all with the shared marker.
    expect(html.match(/marker-end="url\(#gArrow\)"/g)?.length).toBe(3);
    expect(root.querySelector('[data-bl="steps"]')).not.toBeNull();
  });

  it('object steps edit at steps.N.label; bare-string steps at steps.N', () => {
    const objHtml = renderCycle(THREE);
    expect(objHtml).toContain('data-bp="steps.0.label"');
    const strHtml = renderCycle({ steps: ['Detect', 'Triage'] });
    expect(strHtml).not.toContain('.label"');
    // The string step's label text carries the whole-scalar path.
    const root = parse(strHtml);
    const texts = root.querySelectorAll('text.cycle-name[data-bp="steps.0"]');
    expect(texts.length).toBe(1);
    expect(texts[0]?.text).toBe('Detect');
  });

  it('descriptions produce a numbered legend; without any, no legend renders', () => {
    const withDesc = parse(renderCycle(THREE));
    const legend = withDesc.querySelectorAll('.edge-step');
    expect(legend.length).toBe(3);
    expect(legend[0]?.text).toContain('Build — Ship the smallest testable change');
    const noDesc = renderCycle({ steps: ['A', 'B'] });
    expect(noDesc).not.toContain('edge-steps');
  });

  it('center hub renders with its data path; omitted center renders nothing', () => {
    const withHub = parse(renderCycle(THREE));
    expect(withHub.querySelector('.cycle-center[data-bp="center"]')?.text).toBe('every release');
    expect(renderCycle({ steps: ['A', 'B'] })).not.toContain('cycle-center');
  });

  it('numerals and arcs stay inside the viewBox at every supported size', () => {
    for (const n of [2, 3, 5, 8]) {
      const steps = Array.from({ length: n }, (_, i) => `Stage number ${i + 1}`);
      const html = renderCycle({ steps });
      const m = html.match(/viewBox="0 0 (\d+) (\d+)"/);
      expect(m, `n=${n}`).not.toBeNull();
      const size = Number(m?.[1]);
      // Every emitted coordinate must sit inside the square canvas.
      for (const c of html.matchAll(/(?:cx|cy|x|y)="(-?[\d.]+)"/g)) {
        const v = Number(c[1]);
        expect(v, `n=${n} coord ${c[0]}`).toBeGreaterThanOrEqual(0);
        expect(v, `n=${n} coord ${c[0]}`).toBeLessThanOrEqual(size);
      }
    }
  });

  it('long labels wrap into multiple tspans-free text lines inside the pill', () => {
    const html = renderCycle({ steps: ['Deploy the release candidate to staging', 'Verify'] });
    const root = parse(html);
    const group = root.querySelector('g[data-bp="steps.0"] g[data-bp="steps.0"]');
    // Wrapped label = a group of >1 <text> lines under the pill group.
    const wrapped = root.querySelectorAll('[data-bp="steps.0"] text.cycle-name');
    expect(wrapped.length).toBeGreaterThan(1);
    expect(group).toBeNull(); // no accidental double-nesting of the same path
  });
});
