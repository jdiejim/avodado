<!-- Repo location: CLAUDE.md at the repository root. Claude Code reads this automatically. -->

# Avodado — agent guide

This repo is **Avodado**: documentation-as-code where a doc is Markdown with typed,
fenced YAML blocks, and the files on disk are the single source of truth.

## Writing or editing documentation

When creating or changing any document under `docs/**/*.md`, **follow the authoring
skill at `.avodado/skill/SKILL.md`**. It defines the block grammar and the `doc#id`
reference scheme; every block's full field contract lives beside it in
`.avodado/skill/reference/` (read `reference/blocks/contract.md` + the family file you need — map in `reference/blocks/INDEX.md` — before writing a block).
In short:

- Prose is plain Markdown; structure goes in typed blocks (e.g. `sequence`, `erd`,
  `table`, `callout`, `c4`, `flow`, `timeline`, `userstory`). Never paste raw HTML
  or inline SVG.
- Use only the documented block types (90 of them, plus 12 permanent aliases for
  merged old names) and their documented fields —
  the schemas are strict. Bodies are YAML.
- Give a block an `id:` when it needs to be referenced; reference it as `doc#id`.
- Edit the specific block surgically — don't regenerate whole files.
- **Run `avo check` and fix all diagnostics before finishing.** A change isn't done
  until it passes.

## Working on the codebase itself

- Read `ARCHITECTURE.md` before changing structure.
- Dependency direction points inward to `@avo/core`; `core` is pure (no I/O, no DOM).
- Block types are defined once in the **block registry**; adding one means adding a
  schema in `core` plus a renderer in each target. Registries are compile-time
  exhaustive — don't bypass them with ad-hoc switches.
- Libraries return diagnostics/typed results; only the CLI throws and sets exit codes.
- `@avodado/studio` BUNDLES `core`/`render` (devDependencies, baked in by Vite at
  publish). A changeset that changes anything Studio renders must also patch
  `@avodado/studio`, or the published Studio canvas keeps the old renderer.
- Keep `pnpm lint`, `pnpm typecheck`, and `pnpm test` green. Conventional commits.

## Avodado — what this repo is

Documentation-as-code. A doc is plain Markdown; every visual thing is a **typed
block** — a fenced section with a type and a YAML body. 90 block types across 12
families (narrative, tables/code, API, architecture, flows/state, data model,
charts, planning, business/decisions, design system, algorithms, AI/agents).
`.md` files on disk are the only source of truth. Nothing else holds state.

### Packages

- `@avo/core` — pure library. Parsing, block registry, schemas, diagnostics.
  No I/O, no DOM. Everything depends inward on core. If a change here is not
  additive, it is a breaking change to every other package — say so.
- `@avodado/render` — deterministic renderers. One block type → one renderer →
  consistent HTML/SVG. **The LLM never draws.** It writes ~1KB of YAML; the
  renderer owns 100% of layout and geometry.
- `avo` (CLI) — `check` (strict typed diagnostics; a change is not done until it
  passes), `build`, `serve`, `site`, slides/decks, `theme`, catalog/demo.
- `@avodado/studio` — web canvas/editor bundling core + render.
- MCP package + authoring skill (`.avodado/skill/SKILL.md` + reference files) —
  teaches an agent to author docs. `avo init` installs it into CLAUDE.md /
  Cursor rules / Copilot instructions.

### The invariant that matters most

Geometry is code, never prompt. If a task tempts you to teach the model pixel
coordinates, inline SVG, or layout rules, you have misdiagnosed the task: the
fix belongs in `@avodado/render`, not in the skill. The skill teaches
_selection, composition, and content_. The renderer owns _appearance_.

### Definition of done

`pnpm -w typecheck && pnpm -w test && pnpm -w lint && avo check` all green, plus
a rendered example of anything visual you touched. Schema changes ship with:
the schema, the renderer, a reference entry in the skill, a catalog example, and
a test. Five things. A block type missing any of them does not exist.

### House style for anything a user reads

Short, technical, synthesized. No filler openers ("In this section we will…"),
no restating the block below in prose, no adjective stacking. Explain to a smart
non-specialist: simple words, precise claims. If a sentence carries no fact,
delete it.

Technical text in this repo follows **STE discipline** — the writing rules of
ASD-STE100 Simplified Technical English, adapted for software docs. The rules
live in `.avodado/skill/reference/style-ste.md`. Read that file before you write
any prose block, CLI help string, diagnostic message, or skill instruction.

Two hard constraints on how we use it:

- ASD-STE100 is free to obtain but **not free to redistribute**. Never copy the
  specification text or its ~900-word approved dictionary into this repo. We
  apply the rules and keep our own term list.
- Never claim Avodado output "is STE" or "is STE-compliant". The wording is
  "STE-informed" or "follows STE writing discipline". Certified compliance
  requires the real dictionary, which we do not ship.
