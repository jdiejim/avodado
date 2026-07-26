---
"@avodado/core": patch
"@avodado/render": patch
"@avodado/studio": patch
"avodado": patch
---

`{source: …}` no longer leaks into a page heading. The deck stripped it; the
document renderer only knew the alignment markers, so `## Title {source: …}`
rendered the marker verbatim on the page.

The three places that had to agree about what a heading says now share one
definition in `@avodado/core` (`stripHeadingMarkers`, `readSourceMarker`,
`readAlignMarker`) — the page renderer, the deck, and `trailingHeading`, which
feeds block titles and the sections nav and stripped nothing at all.

On a page the source isn't dropped, it's printed: a small provenance line under
the heading, matching what the deck puts in the slide footer.
