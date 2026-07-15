---
"avodado": minor
"@avodado/core": patch
---

Rename the CLI package `@avodado/cli` → **`avodado`** (unscoped) for
discoverability: `npm i -g avodado`, `npx avodado`, and the command is available
as both `avo` and `avodado`. `@avodado/cli` is deprecated and points here.

Also improve the npm READMEs: the CLI README opens with a worked example (a
Markdown doc with a `sequence` block → `avo check` / `avo html` / `avo studio`)
in plainer language; the core README lists the real block-type set (77 across 12
families) instead of a stale short list.
