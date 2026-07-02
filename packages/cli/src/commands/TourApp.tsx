/**
 * `avo tour` — a chaptered, hands-on walkthrough of Avodado (Ink).
 *
 * Everything happens in a scratch playground under the OS temp dir (never the
 * user's repo), and every chapter runs the REAL library code paths — the same
 * `runCheck` / `runSingle` the commands use — so what the tour shows is exactly
 * what the tool does. Enter/space advances, q/escape quits. The browser opens
 * only in chapters 3 and 5 (and never with `--no-open`).
 *
 * Non-TTY / `AVO_PLAIN=1` callers get {@link staticTour} instead — a condensed
 * plain-text version of the same 7 chapters (script/CI safe).
 */

import React, { useEffect, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import open from 'open';
import pc from 'picocolors';
import { runCheck } from './check.js';
import { runSingle } from './single.js';
import { DESIGN_PATTERNS, findPattern, patternDoc } from './design.js';
import { formatDiagnosticsPlain } from '../ui/DiagnosticsTable.js';

/** The tour's scratch playground — per-process so parallel tours never clash. */
const playgroundDir = (): string => join(tmpdir(), `avodado-tour-${process.pid}`);

// ─── the tour document ──────────────────────────────────────────────────────

const HELLO_GOOD = `\`\`\`meta
title: Hello, Avodado
subtitle: Plain Markdown outside, typed YAML blocks inside.
tag: TOUR
\`\`\`

## Placing an order

Prose is ordinary Markdown. Structure — this diagram — is a fenced block.

\`\`\`callout
tone: tip
title: The one rule
body: The .md file is the source of truth. Never paste HTML or SVG — express structure through blocks.
\`\`\`

\`\`\`sequence
title: Checkout
actors:
  - { id: client, name: Client }
  - { id: api, name: Orders API }
  - { id: db, name: Postgres }
messages:
  - { from: client, to: api, label: POST /orders, kind: sync }
  - { from: api, to: db, label: INSERT order, kind: sync }
  - { from: api, to: client, label: 201 Created, kind: response }
\`\`\`
`;

/** The planted bug: an unquoted comma inside a flow map grows a bogus field. */
const GOOD_LINE = '  - { from: api, to: client, label: 201 Created, kind: response }';
const BAD_LINE = '  - { from: api, to: client, label: 201 Created, idempotent, kind: response }';
const HELLO_BAD = HELLO_GOOD.replace(GOOD_LINE, BAD_LINE);

/** Chapter 4's quick-mode diagram — no coordinates, layout comes from edges. */
const QUICK_BLOCK = `
## The system around it

\`\`\`block
title: Order pipeline — quick mode
nodes:
  - { id: web, kind: service, name: Web app }
  - { id: api, kind: gateway, name: Orders API }
  - { id: db, kind: store, name: Postgres }
  - { id: mail, kind: service, name: Mailer }
edges:
  - { from: web, to: api }
  - { from: api, to: db }
  - { from: api, to: mail, kind: dashed }
\`\`\`
`;

/** A dim line-numbered source listing (the code-frame gutter styling). */
function sourceListing(source: string, maxLines = 40): string {
  const lines = source.trimEnd().split('\n').slice(0, maxLines);
  const w = String(lines.length).length + 1;
  return lines.map((l, i) => pc.dim(`${String(i + 1).padStart(w)} | `) + l).join('\n');
}

// ─── chapters ────────────────────────────────────────────────────────────────

interface Chapter {
  readonly title: string;
  /** Runs the chapter's real side effects and returns the text to display. */
  readonly run: (ctx: { readonly dir: string; readonly openBrowser: boolean }) => Promise<string>;
}

const CHAPTERS: readonly Chapter[] = [
  {
    title: 'What a block is',
    run: async ({ dir }) => {
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'hello.md'), HELLO_GOOD, 'utf8');
      return [
        `An Avodado doc is plain Markdown with ${pc.bold('typed, fenced YAML blocks')} —`,
        `the fence tag (${pc.cyan('callout')}, ${pc.cyan('sequence')}, …) picks the block type, the YAML`,
        `body is its data. I just wrote this to ${pc.cyan(join(dir, 'hello.md'))}:`,
        '',
        sourceListing(HELLO_GOOD),
      ].join('\n');
    },
  },
  {
    title: 'Validate — the tool catches what eyes miss',
    run: async ({ dir }) => {
      // Plant the classic YAML pitfall: an unquoted comma inside a flow map.
      await writeFile(join(dir, 'hello.md'), HELLO_BAD, 'utf8');
      const bad = await runCheck({ patterns: ['hello.md'], cwd: dir, docsRoot: '.' });
      const badOut = formatDiagnosticsPlain(bad.diagnostics, bad.files.length, bad.sources).trimEnd();
      // Apply the fix and re-check green — the real `avo check` path both times.
      await writeFile(join(dir, 'hello.md'), HELLO_GOOD, 'utf8');
      const good = await runCheck({ patterns: ['hello.md'], cwd: dir, docsRoot: '.' });
      const goodOut = formatDiagnosticsPlain(good.diagnostics, good.files.length, good.sources).trimEnd();
      return [
        `I planted a classic bug — an unquoted comma inside a ${pc.cyan('{ … }')} flow map:`,
        '',
        `  ${pc.red('-')} ${GOOD_LINE.trim()}`,
        `  ${pc.green('+')} ${BAD_LINE.trim()}`,
        '',
        `YAML happily turns the extra comma into a bogus field. ${pc.cyan('avo check')} catches it:`,
        '',
        badOut,
        '',
        `Fix applied (comma removed) — ${pc.cyan('avo check')} again:`,
        '',
        pc.green(goodOut),
        '',
        pc.dim('avo check exits non-zero on errors — gate CI on it.'),
      ].join('\n');
    },
  },
  {
    title: 'Render — see the document',
    run: async ({ dir, openBrowser }) => {
      const result = await runSingle({ cwd: dir, input: 'hello.md', format: 'html' });
      if (openBrowser) await open(result.output);
      return [
        `One command renders the doc to a styled, self-contained HTML page`,
        `(inline SVG diagrams, no runtime):`,
        '',
        `  ${pc.cyan('avo preview hello.md')}`,
        '',
        `${pc.green('✓')} Rendered ${result.output} ${pc.dim(`(${result.bytes} bytes)`)}`,
        openBrowser
          ? pc.dim('  → opening it in your browser now — the sequence diagram is pure YAML.')
          : pc.dim('  → (--no-open: open that file yourself to see the page.)'),
      ].join('\n');
    },
  },
  {
    title: 'Diagrams for free — quick mode',
    run: async ({ dir }) => {
      await appendFile(join(dir, 'hello.md'), QUICK_BLOCK, 'utf8');
      const result = await runSingle({ cwd: dir, input: 'hello.md', format: 'html' });
      return [
        `Architecture blocks don't need coordinates — omit ${pc.cyan('col')}/${pc.cyan('row')} and the`,
        `layout is computed from the edges (${pc.bold('quick mode')}). I appended this:`,
        '',
        sourceListing(QUICK_BLOCK.trim()),
        '',
        `${pc.green('✓')} Re-rendered ${result.output}`,
        pc.dim('  → refresh the browser tab to see the boxes-and-arrows diagram appear.'),
      ].join('\n');
    },
  },
  {
    title: 'Decks — the same doc as slides',
    run: async ({ dir, openBrowser }) => {
      const result = await runSingle({ cwd: dir, input: 'hello.md', format: 'slides' });
      if (openBrowser) await open(result.output);
      return [
        `Any doc renders as a presentation with ${pc.cyan('avo slides doc.md')} — one slide per`,
        `${pc.cyan('#')}/${pc.cyan('##')} heading, keyboard navigation, print-to-PDF ready.`,
        '',
        `${pc.green('✓')} Rendered ${result.output} ${pc.dim(`(${result.bytes} bytes)`)}`,
        openBrowser
          ? pc.dim('  → opening the deck — arrow keys to flip through it.')
          : pc.dim('  → (--no-open: open that file yourself to flip through it.)'),
        '',
        `Tip: a ${pc.cyan('{split}')} heading marker gives a consulting-style layout —`,
        `message on the left, exhibit on the right.`,
      ].join('\n');
    },
  },
  {
    title: 'The design library',
    run: () => {
      const counts = new Map<string, number>();
      for (const p of DESIGN_PATTERNS) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
      const list = [...counts.entries()].map(([c, n]) => `  ${pc.cyan(c.padEnd(16))}${pc.dim(`${n} patterns`)}`);
      const caching = findPattern('caching');
      const taste = caching !== undefined ? patternDoc(caching).split('\n').slice(0, 14).join('\n') : '';
      return Promise.resolve([
        `${pc.cyan('avo design')} ships ${DESIGN_PATTERNS.length} ready design-pattern templates:`,
        '',
        ...list,
        '',
        `${pc.cyan('avo design caching')} prints a ready-to-paste \`pattern\` block, e.g.:`,
        '',
        pc.dim(taste),
        pc.dim('  … (truncated — the real template is a complete, valid doc)'),
      ].join('\n'));
    },
  },
  {
    title: 'Next steps',
    run: ({ dir }) => {
      return Promise.resolve([
        `That's the loop: ${pc.bold('write blocks → avo check → render')}. From here:`,
        '',
        `  ${pc.cyan('avo init'.padEnd(22))}${pc.dim('scaffold docs/, config, and the authoring skill')}`,
        `  ${pc.cyan('avo install <tool>'.padEnd(22))}${pc.dim('teach Claude Code / Cursor / Copilot / Windsurf the grammar')}`,
        `  ${pc.cyan('avo demo [family]'.padEnd(22))}${pc.dim('the full 84-block showcase (or one family)')}`,
        `  ${pc.cyan('avo catalog'.padEnd(22))}${pc.dim('every block + description, grouped by family')}`,
        `  ${pc.cyan('docs/getting-started.md'.padEnd(22))} ${pc.dim('after avo init — the 80/20 quick start')}`,
        '',
        pc.dim(`Playground left at ${dir} — safe to delete.`),
      ].join('\n'));
    },
  },
];

// ─── interactive app ─────────────────────────────────────────────────────────

interface TourAppProps {
  /** False when `--no-open` was passed — chapters 3/5 then skip the browser. */
  readonly open: boolean;
}

export function TourApp({ open: openBrowser }: TourAppProps): React.JSX.Element {
  const { exit } = useApp();
  const [chapter, setChapter] = useState(0);
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(true);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    const ch = CHAPTERS[chapter];
    void (ch?.run({ dir: playgroundDir(), openBrowser }) ?? Promise.resolve(''))
      .then((text) => {
        if (!cancelled) {
          setOutput(text);
          setBusy(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setOutput(pc.red(`Tour chapter failed: ${(err as Error).message}`));
          setBusy(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [chapter, openBrowser]);

  useInput((input, key) => {
    if (input === 'q' || key.escape) {
      setDone(true);
      exit();
      return;
    }
    if (busy) return;
    if (key.return || input === ' ') {
      if (chapter >= CHAPTERS.length - 1) {
        setDone(true);
        exit();
      } else {
        setChapter((c) => c + 1);
      }
    }
  });

  if (done) return <Text dimColor>Enjoy the grove.</Text>;

  const ch = CHAPTERS[chapter];
  const last = chapter === CHAPTERS.length - 1;
  return (
    <Box flexDirection="column">
      <Text>
        <Text color="green" bold>{`Chapter ${chapter + 1}/${CHAPTERS.length}`}</Text>
        <Text bold>{` — ${ch?.title ?? ''}`}</Text>
      </Text>
      <Text> </Text>
      {busy ? <Text dimColor>working…</Text> : <Text>{output}</Text>}
      <Text> </Text>
      <Text dimColor>{last ? 'enter to finish · q to quit' : 'enter/space for the next chapter · q to quit'}</Text>
    </Box>
  );
}

// ─── static (non-TTY / AVO_PLAIN) version ────────────────────────────────────

/**
 * The plain-text tour for non-TTY / `AVO_PLAIN=1` callers: the same 7 chapters,
 * condensed — no playground writes, no browser, exit 0.
 */
export function staticTour(): string {
  const hr = '─'.repeat(64);
  const chapterHead = (n: number, title: string): string => `Chapter ${n}/7 — ${title}`;
  return [
    'The Avodado tour (static version — run `avo tour` in a terminal for the hands-on one)',
    hr,
    chapterHead(1, 'What a block is'),
    'A doc is plain Markdown plus typed, fenced YAML blocks — the fence tag',
    '(callout, sequence, erd, …) picks the type; the YAML body is its data:',
    '',
    '  ```callout',
    '  tone: tip',
    '  title: The one rule',
    '  body: The .md file is the source of truth.',
    '  ```',
    hr,
    chapterHead(2, 'Validate'),
    'avo check validates every block against its schema and your doc#id refs.',
    'The classic bug — an unquoted comma inside a { … } flow map — becomes a',
    "bogus extra field; avo check names the file, line, and offending value:",
    '',
    '  - { from: api, to: client, label: 201 Created, idempotent }',
    '                                                 ^^^^^^^^^^ unknown field',
    '',
    'It exits non-zero on errors — gate CI on it.',
    hr,
    chapterHead(3, 'Render'),
    'avo preview doc.md renders a styled, self-contained HTML page (inline SVG',
    'diagrams, no runtime) and opens it in the browser.',
    hr,
    chapterHead(4, 'Diagrams for free'),
    'Architecture blocks work without coordinates: omit col/row and the layout',
    'is computed from the edges (quick mode) — boxes and arrows from 10 lines.',
    hr,
    chapterHead(5, 'Decks'),
    'avo slides doc.md turns the same doc into a slide deck — one slide per',
    'heading; a {split} heading marker gives message-left / exhibit-right.',
    hr,
    chapterHead(6, 'The design library'),
    `avo design lists ${DESIGN_PATTERNS.length} ready patterns (system design · AI/agents · GoF code);`,
    'avo design <slug> prints a ready-to-paste pattern template.',
    hr,
    chapterHead(7, 'Next steps'),
    '  avo init                 scaffold docs/, config, and the authoring skill',
    '  avo install <tool>       teach your AI tool the grammar (claude | cursor | copilot | windsurf)',
    '  avo demo [family]        the full block showcase, or one family',
    '  docs/getting-started.md  the 80/20 quick start (after avo init)',
    '',
  ].join('\n');
}
