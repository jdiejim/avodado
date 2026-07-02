import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { TourApp } from '../commands/TourApp.js';
import type { TourChapter } from '../commands/tourChapters.js';

const ARROW_RIGHT = '[C';
const ARROW_LEFT = '[D';

/**
 * Three fake chapters whose `run()` counts invocations — so memoization (side
 * effects run once per chapter, ever) is observable. Chapter 2 exposes an
 * `openPath` to exercise the `o open` footer entry.
 */
function fakeChapters(runs: number[]): readonly TourChapter[] {
  return [0, 1, 2].map((i) => ({
    title: `Fake chapter ${i + 1}`,
    explain: [`explains ${i + 1}`],
    commands: [
      {
        cmd: `avo fake ${i + 1}`,
        run: () => {
          runs[i] = (runs[i] ?? 0) + 1;
          return Promise.resolve({
            output: `real output ${i + 1}`,
            ...(i === 1 ? { openPath: '/dev/null' } : {}),
          });
        },
        plain: [`plain ${i + 1}`],
      },
    ],
  }));
}

async function frameContains(lastFrame: () => string | undefined, text: string): Promise<void> {
  await vi.waitFor(() => {
    expect(lastFrame() ?? '').toContain(text);
  });
}

describe('TourApp (interactive)', () => {
  it('walks forward, back (memoized), jumps by number, and quits', async () => {
    const runs: number[] = [];
    // open={false} (--no-open): never auto-open a browser from tests; the
    // fake openPath still makes the footer's `o open` entry appear.
    const { lastFrame, stdin } = render(
      <TourApp open={false} chapters={fakeChapters(runs)} dir="/tmp/fake" />,
    );

    // Chapter 1: header, dots, explanation, command card, output, footer.
    await frameContains(lastFrame, 'real output 1');
    const first = lastFrame() ?? '';
    expect(first).toContain('avodado');
    expect(first).toContain('TOUR');
    expect(first).toContain('Chapter 1/3 · Fake chapter 1');
    expect(first).toContain('●○○');
    expect(first).toContain('explains 1');
    expect(first).toContain('❯ avo fake 1');
    expect(first).toContain('← back · → next · 1-3 jump · q quit');
    expect(runs).toEqual([1]);

    // → forward to chapter 2 (which has an artifact → footer gains `o open`).
    stdin.write(ARROW_RIGHT);
    await frameContains(lastFrame, 'real output 2');
    expect(lastFrame()).toContain('Chapter 2/3 · Fake chapter 2');
    expect(lastFrame()).toContain('o open');
    expect(runs).toEqual([1, 1]);

    // ← back to chapter 1: instant from cache, run() NOT re-invoked.
    stdin.write(ARROW_LEFT);
    await frameContains(lastFrame, 'Chapter 1/3');
    expect(lastFrame()).toContain('real output 1');
    expect(lastFrame()).toContain('●●○'); // both visited, current accented
    expect(runs).toEqual([1, 1]);

    // Jump straight to chapter 3 by number.
    stdin.write('3');
    await frameContains(lastFrame, 'Chapter 3/3');
    await frameContains(lastFrame, 'real output 3');
    expect(lastFrame()).toContain('enter finish'); // last-chapter footer
    expect(runs).toEqual([1, 1, 1]);

    // `b` also goes back; bounds hold at chapter 1.
    stdin.write('1');
    await frameContains(lastFrame, 'Chapter 1/3');
    stdin.write('b');
    expect(lastFrame()).toContain('Chapter 1/3');
    expect(runs).toEqual([1, 1, 1]); // still no re-runs anywhere

    // q quits with the playground-path farewell.
    stdin.write('q');
    await frameContains(lastFrame, 'Enjoy the grove');
    expect(lastFrame()).toContain('/tmp/fake');
  });
});
