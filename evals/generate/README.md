# Generation eval

End to end: a fresh agent, the installed skill, a working `avo`, one request.
The agent follows the skill's fast path in full — pick, `avo block`, write,
`avo check`, fix — and hands off. Forty scenarios in `cases.yaml` span the
block families and never name a block type.

It measures what the selection eval cannot: whether the whole loop produces
a document that validates, renders, and answers the question, and what it
costs. `evals/selection` scores only the pick. It replaces the former
`evals/write`, which scored a first draft with the CLI forbidden — that
number is now the **1st errors** column here.

## Run

1. Make a scratch project: `avodado.config.json`, an empty `docs/`, the skill
   copied to `.claude/skills/avodado/`, and `node_modules/avodado` linked to
   `packages/cli` of the build under test (so `npx -y avodado` resolves to
   it, not to npm). Build the CLI first.
2. For each case start a fresh agent with `PROMPT.md`, substituting the
   project path, the id, the request, and a run directory such as
   `.scratch/evals/gen-<date>/`. Record tokens, tool calls, and seconds from
   each task notification into `<run-dir>/usage.json` as
   `{ "<id>": { "tokens": N, "tools": N, "seconds": N } }`.
3. Score and report:

```
node evals/generate/score.mjs <project-dir> <run-dir>
node evals/generate/report.mjs <project-dir> <run-dir>   # → <run-dir>/report.html
```

## Read the score

- **selection** — the first structural block that matches `expected` (1),
  `acceptable` (0.5), or `wrong` (0, a keyword trap).
- **1st errors** — `avo check` errors on the draft copied before the agent
  ran any check. This is the skill's raw quality; the error codes say what
  the skill still teaches wrong.
- **final errors / warnings** — the handed-off document. Errors here mean
  the repair loop did not resolve every error.
- **structural blocks** — a size diagnostic; the skill suggests two to five for a full doc.
- **render** — the shipped renderer must not throw on any handed-off doc.
- **tokens / tools / time** — the cost of the whole loop.

The HTML report shows every document rendered, with the first-draft errors
the agent fixed and any diagnostics still open. Read the documents: a clean
check is necessary, not sufficient.

Keep the case set stable; add new cases at the end.

## Results

| Run | Selection | Traps | Clean first write | Clean at handoff | Render failures | Mean tokens | Mean time |
|---|---|---|---|---|---|---|---|
| `gen-2026-09-13` (skill at `skills/avodado`, `avo block`) | 15.5/16 | 0 | 13/16 | 16/16 | 0 | 53K | 93 s |
| `gen-2026-09-13` + 7 messaging-pattern cases, re-scored after the comma rescue | 22.5/23 | 0 | 20/23 | 23/23 | 0 | 55K | 99 s |
| `gen-2026-09-13` + 15 coverage-sweep cases (13 new blocks, pareto and histogram chart kinds) | 37.5/38 | 0 | 32/38 | 38/38 | 0 | 54K | 91 s |
| `gen-2026-09-13` + 2 lens cases (swimlane, code) after the vary-the-lens rule | 39.5/40 | 0 | 33/40 | 40/40 | 0 | 55K | 91 s |

For comparison, the September 1 write eval averaged 90K to 110K tokens and
12 to 22 tool calls per document with the previous skill layout.

Findings from the first run, all fixed the same day: the SKILL.md rewrite had
dropped the algorithms row (two-pointer picked `flow`); every first-write
error was an unquoted comma inside `{ … }` or a string where a list has no
terse form, so `avo check` now names both; wide drawings shrank to
unreadable, state numerals sat on state boxes, gantt heads collided, and a
quadrant axis label clipped. The evening pass added the seven pattern cases
(pub/sub, feed fan-out, outbox, CQRS, dead-letter, partitioned consumers,
event contract) and showed the same comma trap in 11 of 13 first-draft
schema errors, so the parser now repairs it at the source line; first-write
clean on the same drafts moved from 17/23 to 20/23. The night pass added one
scenario per new block from the coverage sweep (`neuralnet`, `modelcard`,
`mindmap`, `audit`, `checklist`, `perfbudget`, `percentiles`, `threatmodel`,
`usecase`, `pkg`, `timing`, `chevrons`, `roadmap`) plus a pareto and a
histogram request: selection was 15/15 with no traps, 12/15 first drafts
were clean, all 15 rendered. The run's report is
`.scratch/evals/gen-2026-09-13/report.html`.
