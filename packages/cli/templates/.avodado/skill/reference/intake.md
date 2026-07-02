# Intake checklists — what to ask before writing

Part of the **avodado-docs** skill (the hub is `SKILL.md`, one folder up). Use
this in move 1 (*Understand the ask — and ask back*) of every new document.

## The ask-back protocol

1. **Identify the document type.** Match the ask to a checklist below (they
   mirror the *Document playbooks* table in `SKILL.md`). No match → fall back to
   the four generic questions: reader & moment · job · scope · form.
2. **Collect the checklist and diff it against the ask.** Note which items the
   user already answered — never ask for something they told you.
3. **Ask everything at once.** Ask for every missing **CRITICAL** item in ONE
   batched message of 2-6 pointed questions — never drip one question per turn.
   Fold in a nice-to-have only when its answer would change the outline.
4. **If the user is unavailable** (or the gaps are minor), proceed with explicit
   assumptions: a `callout` (`tone: note`, title *Assumptions*) near the top of
   the doc, listing each guess so every one is visible and correctable.

Each checklist marks items **CRITICAL** (the document is wrong without them)
vs *nice-to-have* (improves it, but safely assumable).

## API / endpoint spec

- **CRITICAL** — the routes + methods to document (all of them, or which subset?).
- **CRITICAL** — the auth model: scheme, token type, scopes/permissions per route.
- Request/response examples — real payloads beat invented ones.
- Error codes and what each means to the caller.
- Rate limits (per key? per IP? headers exposed?).
- Versioning scheme (URL, header, none).

## System design

- **CRITICAL** — functional requirements: what must the system do, for whom?
- **CRITICAL** — scale numbers: DAU, writes/day, reads/day, data size and growth.
- **CRITICAL** — latency and consistency targets (p95/p99; strong vs eventual, where).
- Existing stack and constraints (languages, cloud, what's already built).
- Budget envelope (infra spend, buy-vs-build appetite).
- Team size and skill mix (shapes how much operational complexity is affordable).

## Agent system

- **CRITICAL** — the model(s) used, and where in the loop.
- **CRITICAL** — the tools: each tool's name and what it actually does.
- **CRITICAL** — stop conditions: when does the loop end, and what bounds it?
- Memory strategy (none, scratchpad, vector store, summaries — and eviction).
- One real transcript of a representative episode (for the `trace` block).
- Eval criteria — how is "it works" measured?
- Guardrails: input/output filtering, permissioning, human-in-the-loop points.

## Architecture overview / onboarding

- **CRITICAL** — the system inventory: the services/components and one line each.
- **CRITICAL** — the one key request path a new joiner will touch most.
- Owners — which team/person owns each piece.
- Deploy topology (where it runs: regions, clusters, environments).

## Runbook

- **CRITICAL** — the trigger: which alert/symptom puts you in this runbook?
- **CRITICAL** — the exact commands to run, verbatim (no "restart the service" hand-waving).
- **CRITICAL** — the verification step: how do you know it worked?
- Access needed (VPN, roles, break-glass credentials) before you start.
- Escalation path — who to page when the runbook doesn't resolve it.
- Rollback — how to undo the intervention if it makes things worse.

## ADR

- **CRITICAL** — the options actually considered (not a padded strawman list).
- **CRITICAL** — the deciding constraint: which force actually picked the winner?
- **CRITICAL** — status: proposed, accepted, superseded?
- Consequences observed so far (if the decision already shipped).

## Roadmap

- **CRITICAL** — the horizon (quarter? half? year?).
- **CRITICAL** — the milestones and what "done" means for each.
- **CRITICAL** — current status per milestone/phase.
- Owners per workstream.
- Dependencies between items (and on other teams).

## Design system

- **CRITICAL** — the token source: actual color values, type sizes/weights, spacing.
- **CRITICAL** — the component list with a status per component (stable/beta/…).
- Usage rules — the do/don't guidance per token or component.
- Contribution process — how a new component gets in.

## Deck

- **CRITICAL** — the audience (engineers? leadership? customers?).
- **CRITICAL** — the time slot (5 minutes and 30 need different decks).
- **CRITICAL** — the decision sought — what should the room say yes to?
- The 3 numbers that matter (the exhibits hang off them).
- Appendix depth — how much backup material to prepare.

## Data model

- **CRITICAL** — the entities and their relationships (with cardinality).
- **CRITICAL** — lifecycle states: which records have a state machine, and what is it?
- Volumes per table (rows now, growth rate).
- Retention — what gets deleted/archived, and when.

## Postmortem / incident

- **CRITICAL** — the timeline: detection → mitigation → resolution, with times.
- **CRITICAL** — the impact: who/what was affected, how badly, for how long.
- **CRITICAL** — the root cause (the real one, not the first symptom).
- Action items with owners (and due dates if agreed).

## Reviewing an existing doc

When asked to review (not write) a doc, walk this checklist top to bottom and
report findings per item — worst first. Fix only what you were asked to fix.

1. **Skim test.** Read only the `meta` title and the `##` headings: do they
   tell one story (orient → big picture → detail → plan)? Headings that could
   sit on any document mean it was templated.
2. **One lens per beat.** No two blocks drawing the same boxes; no three
   tables in a row where one wants to be a `matrix`, `list`, or diagram.
3. **Thin blocks.** A block with fewer than ~3 rows/nodes should fold into
   prose or a `callout`. An empty block is a `W_EMPTY_BLOCK` waiting to fire.
4. **YAML pitfalls scan.** Unquoted `,` `:` `#` in `desc`/`note`/`summary`
   fields, unquoted hex colors, unquoted `1:N` cardinality, numeric-looking
   strings (`version: 1.0`, `delta: 0`) — the usual parse traps.
5. **Refs.** Every `ref:` points at an id that exists; same-doc refs use bare
   `#id`; blocks other docs might need carry an `id:`.
6. **Title/heading agreement.** Each block's `title` and its `##` heading
   sound like one author; the `meta` cover matches the doc's actual content.
7. **Stale facts.** Counts, versions, dates, and status fields
   (`timeline`/`tracker`/`inventory`) that reality has moved past — flag them
   even when you can't verify the correction.
8. **Close with `avo check`.** A review isn't done until the doc validates
   clean — report any diagnostic verbatim.
