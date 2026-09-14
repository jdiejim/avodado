<!-- Repo location: .github/copilot-instructions.md — GitHub Copilot reads this automatically. -->

# Chiltepin — authoring guide

This project uses **Chiltepin**: documentation-as-code where a doc is Markdown with
typed, fenced YAML blocks, and the files on disk are the single source of truth.

When creating or changing any document under `docs/**/*.md`, follow the authoring
skill at `skills/chiltepin/SKILL.md`. It defines the block grammar and the `doc#id`
reference scheme; run `node packages/cli/dist/bin.js block <type>` for any block's
fields and an example. In short:

- Prose is plain Markdown; structure goes in typed blocks (e.g. `sequence`, `erd`,
  `table`, `callout`, `c4`, `flow`, `timeline`, `userstory`). Never paste raw HTML
  or inline SVG.
- Use only the documented block types and their documented fields — the schemas are
  strict, so an unknown block or field fails validation. Bodies are YAML.
- Give a block an `id:` when it needs to be referenced; reference it as `doc#id`.
- Edit the specific block surgically — don't regenerate whole files.
- Run `chiltepin check` and fix all diagnostics before finishing. A change isn't done
  until it passes.
