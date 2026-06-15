<!-- Repo location: CLAUDE.md at the repository root. Claude Code reads this automatically. -->

# Avodado — agent guide

This repo is **Avodado**: documentation-as-code where a doc is Markdown with typed,
fenced YAML blocks, and the files on disk are the single source of truth.

## Writing or editing documentation

When creating or changing any document under `docs/**/*.md`, **follow the authoring
skill at `.avodado/skill/SKILL.md`**. It defines the block grammar, every block's
fields, and the `doc#id` reference scheme. In short:

- Prose is plain Markdown; structure goes in typed blocks (e.g. `sequence`, `erd`,
  `table`, `callout`, `c4`, `flow`, `timeline`, `userstory`). Never paste raw HTML
  or inline SVG.
- Use only the documented block types (42 of them) and their documented fields —
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
- Keep `pnpm lint`, `pnpm typecheck`, and `pnpm test` green. Conventional commits.
