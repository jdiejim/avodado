---
"@avodado/render": patch
"avodado": patch
---

Markdown-aware snippet highlighting: a `code` block (or steps/gallery snippet)
with `lang: markdown` (or `md`/`mdx`) now colors headings, **bold**, *italic*,
inline code, links, list markers and blockquotes in the dark code card — and
fenced code inside the sample still gets generic token highlighting. Any other
`lang` value keeps the existing universal tokenizer.
