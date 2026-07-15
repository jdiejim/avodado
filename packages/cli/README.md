# @avodado/cli

`avo` — author, validate, render, and export Avodado documentation from the terminal. Ink TUI when interactive; plain log-friendly output in CI.

## Install

```
pnpm add -D @avodado/cli
```

## Commands

```
avo init                              # scaffold docs/, config, skill, editor adapters
avo block sequence -o docs/orders.md  # scaffold a doc around one block (avo block list — all 76 types)
avo template adr -o docs/adr-001.md   # scaffold a doc from a document template
avo check                             # validate all docs (default: docs/**/*.md)
avo check 'docs/api/**'               # custom glob
avo check --json                      # machine-readable diagnostics
avo html docs/orders.md -o out.html
avo preview docs/orders.md            # render to a temp file and open it
avo build                             # build the static site (index + sidebar nav + Doc | Slides toggle) → dist/
avo studio                            # THE local surface — Edit visually · Site: browse the built site live · Present: slides; files stay the source of truth
avo sync openapi spec.yaml -o docs/api.md   # generate an API doc from an OpenAPI spec (--check for CI drift)
avo sync csv sales.csv                # CSV → ready-to-paste table/statustable/chart block (auto-picked; -o wraps it in a doc)
avo install claude                    # install/update the skill + an AI-tool adapter (claude | cursor | copilot | windsurf)
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
