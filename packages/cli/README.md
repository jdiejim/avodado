# @avodado/cli

`avo` — author, validate, render, and export Avodado documentation from the terminal. Ink TUI when interactive; plain log-friendly output in CI.

## Install

```
pnpm add -D @avodado/cli
```

## Commands

```
avo init                              # scaffold docs/, config, skill, editor adapters
avo new                               # interactive picker → new doc from a block template
avo new --type callout --out docs/x.md
avo check                             # validate all docs (default: docs/**/*.md)
avo check 'docs/api/**'               # custom glob
avo check --json                      # machine-readable diagnostics
avo render docs/orders.md -o out.html
avo export 'docs/**/*.md' --format html,pdf --out dist/
avo preview docs/orders.md            # render to a temp file and open it
```

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Clean (or non-error warnings only) |
| 1 | One or more error-level diagnostics |
| 2 | CLI usage error (missing required flag, etc.) |

## Output modes

| Mode | Trigger |
| --- | --- |
| Ink TUI | TTY and not in CI and `AVO_PLAIN` unset |
| Plain text | Non-TTY, or `CI=true`, or `AVO_PLAIN=1` |
| JSON | `avo check --json` (always non-Ink) |

Set `AVO_PLAIN=1` to force plain output even in a TTY.

## What `avo init` writes

- `avodado.config.json` — `{ docsDir: 'docs', outDir: 'dist' }`
- `docs/getting-started.md` — sample doc
- `.avodado/skill/SKILL.md` — authoring skill (block grammar + worked examples)
- `CLAUDE.md` — pointer for Claude Code to follow the skill
- `.cursor/rules/avodado.mdc` — same, for Cursor

This means any AI agent already in the user's repo (Claude Code, Cursor, others that read `CLAUDE.md` or rules files) can author Avodado docs immediately.

## Configuration

`avo` looks for `avodado.config.{ts,js,mjs,json,yml,yaml}` in the working directory and falls back to defaults:

```json
{ "docsDir": "docs", "outDir": "dist" }
```
