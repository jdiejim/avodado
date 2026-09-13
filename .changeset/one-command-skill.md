---
"avodado": minor
"@avodado/core": minor
"@avodado/studio": patch
"@avodado/mcp": patch
---

One-command install and a schema-derived block reference.

- The authoring skill lives once, at `skills/avodado/`, laid out so `npx skills add jdiejim/avodado` installs it into Claude Code, Cursor, Codex, OpenCode, and 70+ agents. The skill runs the CLI through `npx -y avodado`, so nothing has to be installed in a project.
- New `avo block [type]`: every block on one line (no argument), or one block's fields, enums, terse one-line forms, and a validating example — generated from the zod schema (`blockContract` / `formatBlockContract` in `@avodado/core`), so the reference can never drift. `--json` for the structured form. The hand-written `reference/blocks/contract.md` is gone; family files are short selection sheets.
- `SKILL.md` is a 120-line fast path: pick, `avo block`, write, `avo check --json`, fix by code, two rounds maximum, handoff receipt.
- Removed: `avo explore` (tour, design patterns, compare, catalog), `avo install <tool>` and the per-tool adapter templates, `avo pptx` and Studio's PowerPoint export, the `avo init` wizard and `--scope`. `avo init` now writes only `avodado.config.json` and the two starter docs. `avo demo` stays.
- The MCP server embeds the skill from `skills/avodado/`.
