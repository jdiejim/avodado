---
'avodado': patch
'@avodado/mcp': patch
---

Skill: `SKILL.md` is now the decision path only (procedure, question table, design and prose rules, file map) at 18 KB, down from 29 KB. The mechanics moved to two reference files read at the step that needs them: `reference/writing.md` (block anatomy, terse items, YAML traps, `doc#id`, naming) for step 6 and `reference/check.md` (commands, every error and warning code with its fix) for step 7. Both install with `avo init` / `avo install` and embed in the MCP skill. Adds `evals/selection` and `evals/write`, the two agent evals used to measure the change.
