---
'avodado': minor
---

`avo build --rich-index` (also on `avo serve`, or `richIndex: true` in the config) upgrades the generated site index: a project TLDR built from doc meta and counts, the doc map grouped by tag with the top folder as fallback, and the doc-to-doc cross-reference graph rendered as a real `graph` block with a link legend. Off by default — without the flag the index does not change.
