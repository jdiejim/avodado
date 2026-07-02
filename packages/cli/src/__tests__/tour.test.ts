import { describe, expect, it } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import {
  CHAPTERS,
  initialNav,
  reduceNav,
  staticTour,
  type TourChapter,
  type TourCommand,
} from '../commands/tourChapters.js';

/** Narrowing helper — indexes are checked, so tests never non-null-assert. */
function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`expected ${label} to be defined`);
  return value;
}

describe('tour chapters (shared structure)', () => {
  it('defines exactly 7 chapters, each with a title, explanation, and commands', () => {
    expect(CHAPTERS).toHaveLength(7);
    for (const ch of CHAPTERS) {
      expect(ch.title.length).toBeGreaterThan(0);
      expect(ch.explain.length).toBeGreaterThanOrEqual(1);
      expect(ch.explain.length).toBeLessThanOrEqual(3);
      expect(ch.commands.length).toBeGreaterThanOrEqual(1);
      for (const c of ch.commands) {
        expect(c.cmd.length).toBeGreaterThan(0);
        expect(c.plain.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('shows at least 5 distinct `avo …` commands across the tour', () => {
    const avoCmds = new Set(
      CHAPTERS.flatMap((ch: TourChapter) => ch.commands.map((c: TourCommand) => c.cmd)).filter(
        (cmd) => cmd.startsWith('avo '),
      ),
    );
    expect(avoCmds.size).toBeGreaterThanOrEqual(5);
    for (const expected of [
      'avo check docs/hello.md',
      'avo preview docs/hello.md',
      'avo slides docs/hello.md -o hello-deck.html',
      'avo design',
      'avo init',
      'avo serve',
      'avo build',
    ]) {
      expect(avoCmds).toContain(expected);
    }
  });

  it('runs the real check path: planted bug fails, the fix passes', async () => {
    const dir = join(tmpdir(), `avo-tour-test-${randomBytes(6).toString('hex')}`);
    await mkdir(dir, { recursive: true });
    try {
      // Chapter 1 writes the doc; chapter 2 plants the bug, checks, fixes, re-checks.
      const write = must(must(CHAPTERS[0], 'chapter 1').commands[0], 'write command');
      const listing = await write.run({ dir });
      expect(listing.output).toContain('sequence');

      const validate = must(CHAPTERS[1], 'chapter 2');
      const bad = must(validate.commands[0], 'failing check');
      const badOut = await bad.run({ dir });
      expect(badOut.output).toContain('docs/hello.md');
      expect(badOut.output).toContain('error');

      const good = must(validate.commands[1], 'passing check');
      const goodOut = await good.run({ dir });
      expect(goodOut.output).toContain('OK: 1 file checked, no diagnostics');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('staticTour', () => {
  const out = staticTour();

  it('prints all 7 chapter headings', () => {
    for (let n = 1; n <= 7; n++) {
      expect(out).toContain(`Chapter ${n}/7`);
    }
  });

  it('makes the commands prominent: >= 5 distinct `$ avo` lines', () => {
    const avoLines = new Set(
      out
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('$ avo ')),
    );
    expect(avoLines.size).toBeGreaterThanOrEqual(5);
  });

  it('mirrors every interactive command exactly (views cannot drift)', () => {
    for (const ch of CHAPTERS) {
      expect(out).toContain(ch.title);
      for (const c of ch.commands) {
        expect(out).toContain(`$ ${c.cmd}`);
      }
    }
  });
});

describe('reduceNav (chapter reducer)', () => {
  const TOTAL = 7;

  it('starts on chapter 0 with chapter 0 visited', () => {
    const nav = initialNav();
    expect(nav.chapter).toBe(0);
    expect([...nav.visited]).toEqual([0]);
  });

  it('next/back move one chapter and record visits', () => {
    let nav = initialNav();
    nav = reduceNav(nav, { type: 'next' }, TOTAL);
    expect(nav.chapter).toBe(1);
    nav = reduceNav(nav, { type: 'next' }, TOTAL);
    nav = reduceNav(nav, { type: 'back' }, TOTAL);
    expect(nav.chapter).toBe(1);
    expect([...nav.visited].sort()).toEqual([0, 1, 2]);
  });

  it('clamps at chapter 1: back is a no-op returning the same state', () => {
    const nav = initialNav();
    expect(reduceNav(nav, { type: 'back' }, TOTAL)).toBe(nav);
  });

  it('clamps at chapter 7: next is a no-op returning the same state', () => {
    let nav = initialNav();
    for (let i = 0; i < TOTAL - 1; i++) nav = reduceNav(nav, { type: 'next' }, TOTAL);
    expect(nav.chapter).toBe(TOTAL - 1);
    expect(reduceNav(nav, { type: 'next' }, TOTAL)).toBe(nav);
  });

  it('jump goes straight to any chapter; out-of-range jumps are no-ops', () => {
    let nav = initialNav();
    nav = reduceNav(nav, { type: 'jump', to: 6 }, TOTAL);
    expect(nav.chapter).toBe(6);
    expect([...nav.visited].sort()).toEqual([0, 6]);
    expect(reduceNav(nav, { type: 'jump', to: 7 }, TOTAL)).toBe(nav);
    expect(reduceNav(nav, { type: 'jump', to: -1 }, TOTAL)).toBe(nav);
    expect(reduceNav(nav, { type: 'jump', to: 6 }, TOTAL)).toBe(nav);
  });
});
