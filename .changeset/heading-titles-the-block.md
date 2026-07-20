---
"@avodado/core": minor
"@avodado/render": minor
"avodado": patch
---

**The heading titles the block.** A `##` heading directly above a block now
titles it: a near-duplicate block `title` is suppressed at render (no more two
stacked headings saying the same thing — healed in HTML, slides, Studio, and
PDF), and a title-less block inherits the heading into the sections nav. The
Markdown-native way to write docs is now simply: put the title in the heading
and skip `title:` in the YAML.

The `W_DUP_HEADING` warning is removed (the condition is auto-healed), and core
exports `trailingHeading` alongside `isNearDuplicateTitle`. The authoring skill
teaches the new rule.
