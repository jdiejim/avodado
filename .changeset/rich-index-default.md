---
'avodado': minor
---

The rich site index is now on by default: `avo build`, `avo serve`, and the studio Site mode group the doc map by tag, prepend the TLDR digest, and render the cross-reference graph without a flag. When most tags are unique the index falls back to the flat card grid. Pass `--no-rich-index` (or set `richIndex: false` in the config) to keep the plain index.
