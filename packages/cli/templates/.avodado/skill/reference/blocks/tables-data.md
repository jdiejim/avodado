# Avodado blocks — Tables, metrics & code

Part of the **avodado-docs** skill (the hub is `SKILL.md`, two folders up).
Field contracts and examples for this family's blocks. The at-a-glance contract
table for all 87 blocks is `contract.md` beside this file; the block → family
map is `INDEX.md`. Schemas reject unknown fields — use exactly these.

### Tables & metrics

#### `table` — comparison table
```table
columns: [Code, Meaning, When]
rows:
  - [201, Created, Order persisted]
  - [409, Conflict, Idempotency key reused]
```
Columns may be objects: `{ label, align: l|c|r, highlight: boolean }`. Cells
may be objects: `{ v: value, tone: pos|neg|warn|muted, lead: boolean,
highlight: boolean }`. Optional top-level `note`.

#### `stats` — KPI / metric cards
```stats
title: This quarter
stats:
  - { value: 12.4k, label: Active users, delta: "+18%", trend: up }
  - { value: 99.95%, label: Uptime, delta: "0", trend: flat }
```
`trend` is `up | down | flat`. `delta` is a string.

#### `slo` — service-level objectives with error budgets
```slo
title: Orders API — objectives
items:
  - { name: Availability, sli: Successful requests / total requests, target: 99.9%, current: 99.97%, window: 30d, budget: 0.25 }
  - { name: Latency, sli: Requests served under 400 ms (p99), target: 99%, current: 98.9%, window: 30d, budget: 0.7 }
  - { name: Freshness, sli: Events indexed within 60 s, target: 99.5%, current: 98.1%, window: 7d, budget: 1.0 }
```
One row-card per objective. `budget` is the fraction of the error budget
**consumed** (a plain number): the burn bar is green below 0.5, amber 0.5–0.8,
red above 0.8; at or above 1 it reads "exhausted" and `current` tints red. Omit
`budget` to skip the bar. Use `slo` for reliability targets; use `stats` for
plain KPIs with trends.

#### `code` — one or more code blocks
```code
blocks:
  - title: schema.sql
    lang: PostgreSQL
    code: |
      CREATE TABLE orders (id uuid PRIMARY KEY, total numeric);
```
Renders on a dark editor surface with syntax highlighting (kw, str, num, fn, ty,
com tokens) and a title bar — the same code styling applies in `gallery` cells and
`sequence` step snippets.

#### `terminal` — a shell session (commands + output)
```terminal
title: deploy — production
session: |
  $ kubectl rollout status deploy/api
  # wait for the rollout to settle before tagging
  deployment "api" successfully rolled out
  $ git tag v1.4.1 && git push --tags
```
Same dark surface as `code`, parsed per line: `$ ` starts a **command** (green
prompt, bold text), `# ` a dim italic **comment**, and everything else is
program **output**. `title` labels the window bar (defaults to `terminal`).
Use `terminal` for an interactive session — what was typed *and* what came
back; use `code` with `lang: bash` for a script to copy, and `steps` for a
runbook with prose between commands.

#### `diff` — a unified diff (before → after of code)
```diff
title: "fix: clamp retry backoff"
lang: TypeScript
code: |
  @@ -12,7 +12,7 @@
   function backoff(attempt: number): number {
  -  return 100 * attempt ** 2;
  +  return Math.min(30_000, 100 * attempt ** 2);
   }
```
Same dark surface as `code`, with per-line colouring: `+` lines green, `-`
lines red, `@@` hunk headers dim. Use `diff` to show a *change* (a bugfix, a
config migration, an API rename); use `code` to show code as it is.
