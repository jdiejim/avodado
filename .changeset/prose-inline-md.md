---
'@avodado/render': patch
'@avodado/studio': patch
'@avodado/mcp': patch
---

fix(render): the typed `prose` block now renders inline Markdown (bold, `code`, links) in headings, paragraphs, list items, and quotes through the same hardened pipeline as `callout` and `pullquote`. Literal HTML stays escaped; block structure is unchanged.
