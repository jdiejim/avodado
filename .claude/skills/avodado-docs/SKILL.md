---
name: avodado-docs
version: 0.42.1
description: >-
  Use whenever you author, edit, validate, or review Avodado documentation —
  Markdown files that mix prose with typed YAML blocks, in 12 families:
  narrative & prose · tables & code · API · architecture · flows & state ·
  data model · charts & overviews · planning & backlogs · business & decisions ·
  design system · algorithms · AI & agents. High-signal types: sequence · erd ·
  c4 · table · callout · timeline · userstory · flow · chart · agentloop ·
  archmap · block · endpoint · kanban · stats · divider — and 74 more, mapped in
  reference/blocks/INDEX.md.
  Trigger on any of: docs/**/*.md in an Avodado repo, the `avo` CLI, any block
  type above, `doc#id` cross-references, presence of `avodado.config.*` or
  `.avodado/skill/SKILL.md` in the workspace, or user mentions "avodado". Covers
  block selection, block grammar, every block's fields, the reference scheme,
  YAML pitfalls, and the validate workflow.
  Detailed references live beside this file — read them on demand:
  reference/blocks/INDEX.md (block → family file map),
  reference/blocks/contract.md (the exact field contract for all 90 blocks),
  reference/blocks/<family>.md (fields + examples per family),
  reference/recipes.md (worked composition recipes),
  reference/style-ste.md (the style authority for all prose),
  reference/system-design.md, reference/decks.md, reference/intake.md,
  reference/organizing.md.
---

# Avodado authoring skill — pointer

The full skill lives at `.avodado/skill/SKILL.md` — read it there, and load its
`reference/` files on demand (`reference/blocks/contract.md` + the family files).
This stub only carries the frontmatter so your tool discovers the skill. Do not
author from it alone, and never edit it by hand — `.avodado/skill/` is the single
source of truth; `avo install <tool>` refreshes both it and this stub.
