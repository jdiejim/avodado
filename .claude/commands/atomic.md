---
description: Run a task through recon → plan → parallel build → hostile critic → bounded loop.
---

# Atomic

Run the task in $ARGUMENTS through the phases below. Do not skip phases. Do not
collapse phases into one another. Announce each phase boundary in one line.

## Phase 0 — Recon (READ ONLY)

Write no code. Change no files.

**Start from the graph, not from grep.** This is a monorepo; orienting by
reading files burns context rebuilding a map that already exists on disk.

1. If `graphify-out/` exists, refresh it: `graphify . --update`. If it does not,
   build it once: `graphify .`.
2. Read `graphify-out/GRAPH_REPORT.md` first. It gives you the communities, the
   god nodes, and the connections nobody documented.
3. Ask the graph before opening files:
   - `graphify query "<the subsystem this task touches>"`
   - `graphify path "<A>" "<B>"` to check whether two things this task assumes
     are separate are actually coupled
   - `graphify explain "<node>"` for anything the report flags as central
4. Only then open files, and only the ones the graph pointed at. Name the query
   that led you to each file.

If graphify is not installed, say so once and fall back to grep — do not stop,
and do not install it without asking.

Then produce:

- The files that actually matter for this task (paths, why each one matters,
  which query surfaced them).
- The existing conventions this task must not break.
- **Blast radius** — from the graph, what depends on the code this task changes.
  For anything in `@avo/core` this is the whole repo; prove otherwise before
  claiming a change is local.
- Anything in the task description that is already true in the repo — call it out
  and drop it from scope rather than rebuilding it.
- Anything in the task description that is wrong about the repo. Say so plainly.

Treat graph edges as evidence with a confidence level, not as fact. Graphify
tags edges as extracted, inferred, or ambiguous — an inferred edge is a lead to
check in the source, not a conclusion.

Stop and show me this before Phase 1 if recon contradicts the task in a way that
changes what should be built.

## Phase 1 — Plan

Write the plan to `.scratch/<task-slug>/PLAN.md`:

- The task split into independent units. A unit is independent if two agents can
  do them at once without touching the same file.
- For each unit: files touched, the acceptance gate, the rubric the critic will use.
- The order of the objective gates (below) for this task.
- What is explicitly NOT in scope.

Show me the unit list before fanning out. If there is only one unit, say so and
skip the fan-out — parallelism is not the goal, correctness is.

## Phase 2 — Fan out

Spawn one sub-agent per unit. Each sub-agent gets: the unit spec, the acceptance
gate, the relevant file paths, the conventions from Phase 0. It does NOT get the
other units' specs.

Rules for builder sub-agents:

- Touch only the files listed in your unit.
- If you need a file outside your unit, stop and report — do not reach.
- Report back: diff summary, gates run, gate output verbatim.

## Phase 3 — Objective gates (cheap, run first, always)

In this order, stopping at the first failure:

    pnpm -w typecheck
    pnpm -w test
    pnpm -w lint
    avo check <affected docs>
    pnpm -w build   # only if packages changed

A unit is not "done" until every one of these passes on its own diff. Failures
go back to the builder sub-agent, not to me.

## Phase 3.5 — Visual proof (ALWAYS, no exceptions)

Every unit emits a rendered HTML artifact before it can be reviewed. Never
describe output in text when you can render it.

    .scratch/<task-slug>/proof/<unit>.html

Build it by running the real pipeline — `avo build` / the renderer under test —
never by hand-writing HTML. Hand-written proof proves nothing about our
renderers.

What each kind of unit renders:

- **A block type or renderer change** — the block at three data sizes (minimum,
  typical, stress), plus one degenerate case (missing optionals, 40 nodes, a
  400-character label). Side by side on one page, labeled.
- **A schema change** — one existing doc that uses the block, rendered before
  and after the change, so regressions are visible.
- **A doc, exemplar, or prose rewrite** — the built page, plus the previous
  version in a second column.
- **A skill or prompt change** — the doc an agent produces when given the new
  skill, built and rendered. The skill's output is the artifact, not the skill.
- **A CLI change** — a terminal transcript in a `<pre>`, plus whatever it built.

Every proof page carries a header: unit name, commit, timestamp, and what the
reader is being asked to judge. Index them all at
`.scratch/<task-slug>/proof/index.html` and give me that path in Phase 6.

Proof pages are throwaway. `.scratch/` is gitignored — never commit them, never
put them in `/mnt` or in the package output directories.

## Phase 4 — Critic (subjective, only after Phase 3 is green)

Spawn a critic sub-agent with a FRESH context. The critic receives:

- The Phase 3.5 proof page — the rendered thing, not a description of it. A
  critic reviewing prose about output instead of the output itself is theater;
  if there is no proof page, the unit fails automatically.
- The rubric from Phase 1.
- The rubric from Phase 1.
- Reference exemplars, if the unit has them.

The critic does NOT receive: the builder's reasoning, the plan, the commit
message, or any explanation of intent. It judges the artifact cold.

The critic is a hostile reviewer with taste. Its job is to find what is wrong,
not to be encouraging. It returns exactly:

    VERDICT: PASS | FAIL
    DEFECTS:
      1. <specific, located, actionable>
      2. ...
    STRONGEST OBJECTION: <the one thing that would embarrass us if shipped>

The critic never edits files.

For anything visual or prose-shaped, the critic runs a **blind comparison**:
present its artifact and the reference exemplar unlabeled, in randomized order,
and state which is better and why before being told which is which. If ours
loses, that is a FAIL regardless of the rubric score.

## Phase 5 — Loop (BOUNDED)

FAIL → hand the defect list to the builder sub-agent → rerun Phase 3 → rerun
Phase 4 with a fresh critic.

Maximum 3 iterations per unit. On the third FAIL, stop and report to me:
what was attempted, what the critic kept objecting to, and your read on whether
the spec is wrong rather than the implementation. Do not loop past 3. An
unbounded loop is a token fire, not a quality bar.

## Phase 6 — Integrate

Merge units, rerun the full objective gate suite across the whole repo, rebuild
`.scratch/<task-slug>/proof/index.html` against the merged state, and report:
the path to that index first, then what changed, what the critics caught, what
you'd do differently, and what is still weak but out of scope. I want to look
before I read.
