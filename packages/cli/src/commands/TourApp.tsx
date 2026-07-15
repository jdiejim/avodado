/**
 * `avo tour` — a chaptered, bidirectional, hands-on walkthrough of Avodado (Ink).
 *
 * The chapters (and the static non-TTY version) live in `tourChapters.ts`;
 * this file is only the interactive shell. Navigation: `→`/enter/space next,
 * `←`/`b` back, `1-7` jumps, `q`/escape quits. Chapters are memoized — each
 * chapter's side effects (playground writes, real `runCheck`/`runSingle`
 * calls) run ONCE on first visit and the computed view is cached, so
 * revisiting re-renders instantly and never re-runs side effects. Chapters
 * that produce a browser artifact auto-open it on first visit only (never
 * with `--no-open`); `o` re-opens it on demand.
 *
 * The big cfonts wordmark is printed by the CLI once, before this app mounts —
 * chapters use the compact one-line brand header so it doesn't repeat.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import open from 'open';
import pc from 'picocolors';
import {
  CHAPTERS,
  initialNav,
  playgroundDir,
  reduceNav,
  type TourChapter,
  type TourNav,
} from './tourChapters.js';

export { staticTour } from './tourChapters.js';

/** One rendered command card: the command line plus its real output. */
interface Card {
  readonly cmd: string;
  readonly note?: readonly string[];
  readonly output: string;
}

/** A chapter's memoized view — computed once on first visit, then cached. */
interface ChapterView {
  readonly cards: readonly Card[];
  /** The chapter's browser artifact, if any — what the `o` key opens. */
  readonly openPath?: string;
}

interface TourAppProps {
  /** False when `--no-open` was passed — never auto-open the browser. */
  readonly open: boolean;
  /** Injectable for tests; defaults to the real chapters. */
  readonly chapters?: readonly TourChapter[];
  /** Injectable for tests; defaults to the scratch playground. */
  readonly dir?: string;
}

export function TourApp({
  open: openBrowser,
  chapters = CHAPTERS,
  dir = playgroundDir(),
}: TourAppProps): React.JSX.Element {
  const { exit } = useApp();
  const [nav, setNav] = useState<TourNav>(initialNav);
  const [views, setViews] = useState<ReadonlyMap<number, ChapterView>>(new Map());
  const [done, setDone] = useState(false);
  /** Chapters whose side effects have started — the run-once guarantee. */
  const started = useRef(new Set<number>());
  const quit = useRef(false);

  const total = chapters.length;
  const { chapter } = nav;
  const view = views.get(chapter);

  // Exit only after the farewell frame has committed, so it actually shows.
  useEffect(() => {
    if (done) exit();
  }, [done, exit]);

  useEffect(() => {
    if (started.current.has(chapter)) return; // memoized — never re-run
    started.current.add(chapter);
    const ch = chapters[chapter];
    if (ch === undefined) return;
    void (async () => {
      const cards: Card[] = [];
      let openPath: string | undefined;
      try {
        for (const command of ch.commands) {
          const res = await command.run({ dir });
          cards.push({
            cmd: command.cmd,
            ...(command.note !== undefined ? { note: command.note } : {}),
            output: res.output,
          });
          if (res.openPath !== undefined) openPath = res.openPath;
        }
      } catch (err) {
        cards.push({ cmd: '', output: pc.red(`Tour chapter failed: ${(err as Error).message}`) });
      }
      if (quit.current) return;
      setViews((prev) => new Map(prev).set(chapter, {
        cards,
        ...(openPath !== undefined ? { openPath } : {}),
      }));
      // Auto-open only here — this effect body runs once per chapter, so the
      // browser opens on the FIRST visit only (and never with --no-open).
      if (openPath !== undefined && openBrowser) {
        try {
          await open(openPath);
        } catch {
          /* the page is on disk either way — `o` can retry */
        }
      }
    })();
  }, [chapter, chapters, dir, openBrowser]);

  useInput((input, key) => {
    if (input === 'q' || key.escape) {
      quit.current = true;
      setDone(true);
      return;
    }
    if (input === 'o' && view?.openPath !== undefined) {
      void open(view.openPath).catch(() => undefined);
      return;
    }
    if (view === undefined) return; // this chapter's commands still running
    if (key.rightArrow || key.return || input === ' ') {
      if (chapter >= total - 1) {
        quit.current = true;
        setDone(true);
      } else {
        setNav((n) => reduceNav(n, { type: 'next' }, total));
      }
    } else if (key.leftArrow || input === 'b') {
      setNav((n) => reduceNav(n, { type: 'back' }, total));
    } else if (input >= '1' && input <= '9') {
      setNav((n) => reduceNav(n, { type: 'jump', to: Number(input) - 1 }, total));
    }
  });

  if (done) {
    return <Text dimColor>{`Enjoy the grove. Playground left at ${dir} — safe to delete.`}</Text>;
  }

  const ch = chapters[chapter];
  const last = chapter === total - 1;
  const legend = [
    '← back',
    last ? 'enter finish' : '→ next',
    `1-${total} jump`,
    ...(view?.openPath !== undefined ? ['o open'] : []),
    'q quit',
  ].join(' · ');

  return (
    <Box flexDirection="column">
      {/* header: compact brand mark + progress dots + chapter title */}
      <Text>
        <Text color="green">◖ </Text>
        <Text color="green" bold>
          avodado
        </Text>
        <Text color="cyan" bold>
          {' TOUR'}
        </Text>
        {'  '}
        {chapters.map((c, i) =>
          i === chapter ? (
            <Text key={c.title} color="green">
              ●
            </Text>
          ) : nav.visited.has(i) ? (
            <Text key={c.title}>●</Text>
          ) : (
            <Text key={c.title} dimColor>
              ○
            </Text>
          ),
        )}
        {'  '}
        <Text dimColor>{`Chapter ${chapter + 1}/${total} · `}</Text>
        <Text bold>{ch?.title ?? ''}</Text>
      </Text>

      {/* body: explanation, then one command card (+ real output) per command */}
      <Box flexDirection="column" marginTop={1}>
        {(ch?.explain ?? []).map((line) => (
          <Text key={line} dimColor>
            {line}
          </Text>
        ))}
        {view === undefined ? (
          <Box marginTop={1}>
            <Text dimColor>working…</Text>
          </Box>
        ) : (
          view.cards.map((card, i) => (
            <Box key={`${card.cmd}-${i}`} flexDirection="column" marginTop={1}>
              {card.note?.map((line) => (
                <Text key={line} dimColor>
                  {line}
                </Text>
              ))}
              {card.cmd !== '' && (
                <Box borderStyle="round" borderColor="gray" paddingX={1} alignSelf="flex-start">
                  <Text>
                    <Text color="green">❯ </Text>
                    <Text color="cyan" bold>
                      {card.cmd}
                    </Text>
                  </Text>
                </Box>
              )}
              <Text>{card.output}</Text>
            </Box>
          ))
        )}
      </Box>

      {/* footer: persistent key legend */}
      <Box marginTop={1}>
        <Text dimColor>{legend}</Text>
      </Box>
    </Box>
  );
}
