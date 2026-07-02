/**
 * `avo tour` chapter definitions — the one structure both tour views consume.
 *
 * Each chapter is `{ title, explain, commands }`. Every command carries the
 * exact CLI line as the user would type it (`cmd`), a `run()` that executes
 * the REAL library code path (the same `runCheck` / `runSingle` the commands
 * use) and returns its display output, and `plain` — the condensed canned
 * output the static (non-TTY / `AVO_PLAIN=1`) tour prints. Because the
 * interactive Ink app and {@link staticTour} both read this single structure,
 * the two views cannot drift.
 *
 * All side effects happen in a scratch playground under the OS temp dir —
 * never the user's repo. `run()` functions are only called by the interactive
 * tour (once per chapter — the app memoizes); {@link staticTour} is pure.
 */

import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pc from 'picocolors';
import { runCheck } from './check.js';
import { runSingle } from './single.js';
import { DESIGN_PATTERNS, findPattern, patternDoc } from './design.js';
import { formatDiagnosticsPlain } from '../ui/DiagnosticsTable.js';

/** The tour's scratch playground — per-process so parallel tours never clash. */
export const playgroundDir = (): string => join(tmpdir(), `avodado-tour-${process.pid}`);

/** The tour document, relative to the playground root. */
const DOC = 'docs/hello.md';

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

// ─── chapter structure ──────────────────────────────────────────────────────

/** Context handed to every command's `run()`. */
export interface TourCtx {
  /** The playground directory (created by chapter 1's command). */
  readonly dir: string;
}

/** What a command's `run()` hands back to the interactive tour. */
export interface TourCommandResult {
  /** The command's real output, ready to print below its command card. */
  readonly output: string;
  /** Absolute path of a produced artifact the browser can open (`o` key). */
  readonly openPath?: string;
}

/** One command card: the star of a chapter. */
export interface TourCommand {
  /** The exact command line as the user would type it (no prompt glyph). */
  readonly cmd: string;
  /** Dim context lines shown above the card (interactive view only). */
  readonly note?: readonly string[];
  /** Runs the real code path once and returns the output to display. */
  readonly run: (ctx: TourCtx) => Promise<TourCommandResult>;
  /** Condensed output for the static (non-TTY / AVO_PLAIN) tour — no I/O. */
  readonly plain: readonly string[];
}

/** One tour chapter: a title, 1-3 explanation lines, and its command cards. */
export interface TourChapter {
  readonly title: string;
  /** Short plain-text explanation lines (rendered dim interactively). */
  readonly explain: readonly string[];
  readonly commands: readonly TourCommand[];
}

// ─── the seven chapters ─────────────────────────────────────────────────────

const checkAgain = async (dir: string): Promise<string> => {
  const res = await runCheck({ patterns: [DOC], cwd: dir, docsRoot: 'docs' });
  return formatDiagnosticsPlain(res.diagnostics, res.files.length, res.sources).trimEnd();
};

/** `avo <cmd>` next-step entries for chapter 7 — one card per command. */
const NEXT_STEPS: ReadonlyArray<{ readonly cmd: string; readonly desc: string }> = [
  { cmd: 'avo init', desc: 'scaffold docs/, config, and the authoring skill' },
  { cmd: 'avo install <tool>', desc: 'teach Claude Code / Cursor / Copilot / Windsurf the grammar' },
  { cmd: 'avo demo', desc: 'the full block showcase (avo demo <family> for one family)' },
  { cmd: 'avo serve', desc: 'serve the docs locally — reloads on save' },
  { cmd: 'avo build', desc: 'press the whole docs set into a static site' },
];

export const CHAPTERS: readonly TourChapter[] = [
  {
    title: 'What a block is',
    explain: [
      'An Avodado doc is plain Markdown with typed, fenced YAML blocks — the',
      'fence tag (callout, sequence, …) picks the block type; the YAML body is its data.',
    ],
    commands: [
      {
        cmd: `cat ${DOC}`,
        note: ['The tour wrote this doc into a scratch playground — your repo is untouched:'],
        run: async ({ dir }) => {
          await mkdir(join(dir, 'docs'), { recursive: true });
          await writeFile(join(dir, DOC), HELLO_GOOD, 'utf8');
          return { output: sourceListing(HELLO_GOOD) };
        },
        plain: [
          '```meta — title: Hello, Avodado',
          '## Placing an order        (prose is ordinary Markdown)',
          '```callout — tone: tip — "The .md file is the source of truth."',
          '```sequence — Checkout: 3 actors, 3 messages, one YAML map per line',
        ],
      },
    ],
  },
  {
    title: 'Validate',
    explain: [
      'avo check validates every block against its schema (and your doc#id refs).',
      'A classic bug is planted below: an unquoted comma inside a { … } flow map,',
      'which YAML silently turns into a bogus extra field.',
    ],
    commands: [
      {
        cmd: `avo check ${DOC}`,
        note: [
          'The planted bug — one extra comma:',
          `  ${pc.red('-')} ${GOOD_LINE.trim()}`,
          `  ${pc.green('+')} ${BAD_LINE.trim()}`,
        ],
        run: async ({ dir }) => {
          await writeFile(join(dir, DOC), HELLO_BAD, 'utf8');
          return { output: await checkAgain(dir) };
        },
        plain: [
          '- { from: api, to: client, label: 201 Created, idempotent, kind: response }',
          '                                               ^^^^^^^^^^ bogus extra field',
          'avo check names the file, line, and offending value — and exits 1.',
        ],
      },
      {
        cmd: `avo check ${DOC}`,
        note: ['Fix applied — the stray comma removed — then checked again:'],
        run: async ({ dir }) => {
          await writeFile(join(dir, DOC), HELLO_GOOD, 'utf8');
          return {
            output: [
              pc.green(await checkAgain(dir)),
              pc.dim('avo check exits non-zero on errors — gate CI on it.'),
            ].join('\n'),
          };
        },
        plain: ['OK: 1 file checked, no diagnostics — exit 0. Gate CI on it.'],
      },
    ],
  },
  {
    title: 'Preview',
    explain: [
      'One command renders the doc to a styled, self-contained HTML page —',
      'inline SVG diagrams, zero runtime — and opens it in the browser.',
    ],
    commands: [
      {
        cmd: `avo preview ${DOC}`,
        run: async ({ dir }) => {
          const result = await runSingle({ cwd: dir, input: DOC, format: 'html' });
          return {
            output: [
              `${pc.green('✓')} Rendered ${result.output} ${pc.dim(`(${result.bytes} bytes)`)}`,
              pc.dim('  → the sequence diagram on that page is pure YAML.'),
            ].join('\n'),
            openPath: result.output,
          };
        },
        plain: ['✓ Rendered hello.html — a styled, self-contained page (inline SVG, no runtime).'],
      },
    ],
  },
  {
    title: 'Diagrams for free — quick mode',
    explain: [
      'Architecture blocks need no coordinates: omit col/row and the layout is',
      'computed from the edges (quick mode) — boxes and arrows from 10 lines.',
    ],
    commands: [
      {
        cmd: `cat >> ${DOC}`,
        note: ['Appending this block to the doc:'],
        run: async ({ dir }) => {
          await appendFile(join(dir, DOC), QUICK_BLOCK, 'utf8');
          return { output: sourceListing(QUICK_BLOCK.trim()) };
        },
        plain: ['```block — 4 nodes, 3 edges, no col/row → the layout comes from the edges.'],
      },
      {
        cmd: `avo check ${DOC}`,
        run: async ({ dir }) => ({
          output: [
            pc.green(await checkAgain(dir)),
            pc.dim('  → re-render (avo preview) and the boxes-and-arrows diagram appears.'),
          ].join('\n'),
        }),
        plain: ['OK: 1 file checked, no diagnostics.'],
      },
    ],
  },
  {
    title: 'Decks — the same doc as slides',
    explain: [
      'Any doc renders as a presentation — one slide per #/## heading, keyboard',
      'navigation, print-to-PDF ready. A {split} heading marker gives a',
      'consulting-style layout: message on the left, exhibit on the right.',
    ],
    commands: [
      {
        cmd: `avo slides ${DOC} -o hello-deck.html`,
        run: async ({ dir }) => {
          const result = await runSingle({
            cwd: dir,
            input: DOC,
            output: 'hello-deck.html',
            format: 'slides',
          });
          return {
            output: [
              `${pc.green('✓')} Rendered ${result.output} ${pc.dim(`(${result.bytes} bytes)`)}`,
              pc.dim('  → arrow keys flip through the deck.'),
            ].join('\n'),
            openPath: result.output,
          };
        },
        plain: ['✓ Rendered hello-deck.html — arrow keys flip through it.'],
      },
    ],
  },
  {
    title: 'The design library',
    explain: [
      `avo design ships ${DESIGN_PATTERNS.length} ready design-pattern templates —`,
      'system design, AI/agents, and GoF code patterns.',
    ],
    commands: [
      {
        cmd: 'avo design',
        run: () => {
          const counts = new Map<string, number>();
          for (const p of DESIGN_PATTERNS) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
          const list = [...counts.entries()].map(
            ([c, n]) => `  ${pc.cyan(c.padEnd(16))}${pc.dim(`${n} patterns`)}`,
          );
          return Promise.resolve({ output: list.join('\n') });
        },
        plain: [`Lists all ${DESIGN_PATTERNS.length} patterns, grouped by category.`],
      },
      {
        cmd: 'avo design cache-aside',
        run: () => {
          const p = findPattern('cache-aside');
          const taste = p !== undefined ? patternDoc(p).split('\n').slice(0, 14).join('\n') : '';
          return Promise.resolve({
            output: [
              pc.dim(taste),
              pc.dim('  … (truncated — the real template is a complete, valid doc)'),
            ].join('\n'),
          });
        },
        plain: ['Prints a ready-to-paste `pattern` block — a complete, valid doc.'],
      },
    ],
  },
  {
    title: 'Next steps',
    explain: ["That's the loop: write blocks → avo check → render. From here:"],
    commands: NEXT_STEPS.map(({ cmd, desc }) => ({
      cmd,
      run: () => Promise.resolve({ output: pc.dim(`  ${desc}`) }),
      plain: [desc],
    })),
  },
];

// ─── navigation (pure, unit-testable) ───────────────────────────────────────

/** Interactive-tour navigation state: current chapter + every chapter reached. */
export interface TourNav {
  readonly chapter: number;
  readonly visited: ReadonlySet<number>;
}

export type TourNavAction =
  | { readonly type: 'next' }
  | { readonly type: 'back' }
  | { readonly type: 'jump'; readonly to: number };

/** The tour starts on chapter 0, already visited. */
export const initialNav = (): TourNav => ({ chapter: 0, visited: new Set([0]) });

/**
 * Pure navigation reducer. Clamps at both ends — chapter 1 has no "back" and
 * "next" never passes the last chapter (finishing is the app's decision) —
 * and records every chapter reached in `visited`. No-ops return `nav` as-is.
 */
export function reduceNav(nav: TourNav, action: TourNavAction, total: number): TourNav {
  const target =
    action.type === 'next'
      ? Math.min(nav.chapter + 1, total - 1)
      : action.type === 'back'
        ? Math.max(nav.chapter - 1, 0)
        : action.to;
  if (target === nav.chapter || target < 0 || target >= total) return nav;
  return { chapter: target, visited: new Set([...nav.visited, target]) };
}

// ─── static (non-TTY / AVO_PLAIN) version ───────────────────────────────────

/**
 * The plain-text tour for non-TTY / `AVO_PLAIN=1` callers: the same chapters
 * as the interactive tour (built from {@link CHAPTERS}, so they can't drift),
 * each command rendered as a prominent `$ …` line followed by its condensed
 * output. No playground writes, no browser, exit 0.
 */
export function staticTour(): string {
  const hr = '─'.repeat(64);
  const lines: string[] = [
    'The Avodado tour (static version — run `avo tour` in a terminal for the hands-on one)',
  ];
  CHAPTERS.forEach((ch, i) => {
    lines.push(hr, `Chapter ${i + 1}/${CHAPTERS.length} — ${ch.title}`, ...ch.explain, '');
    for (const c of ch.commands) {
      lines.push(`  $ ${c.cmd}`);
      lines.push(...c.plain.map((l) => `      ${l}`));
      lines.push('');
    }
  });
  return `${lines.join('\n')}\n`;
}
