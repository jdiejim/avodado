---
'avodado': minor
---

feat(cli): avo audit (evidence-based doc recommendations, graphify adapter) + /avo Claude Code command

- `avo audit [path]` scans the codebase (graphify graph when present, built-in extraction otherwise) and emits an evidence report with rule-derived doc recommendations — human table and `--json` (contract version 1). It never writes docs.
- New `/avo` slash command for Claude Code, installed by `avo init` (claude tool) and `avo install claude` at `.claude/commands/avo.md`. Subcommands: `audit [path] [--full]` (run the audit, pick recommendations from a multi-select menu, author the selected docs via the avodado-docs skill with the audit's citations as the reading list, then `avo check`), `doc <target>` (author one doc about a path, module, or feature), and `check` (validate and fix).
