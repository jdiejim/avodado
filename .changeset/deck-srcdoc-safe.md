---
"@avodado/render": patch
"@avodado/studio": patch
"avodado": patch
---

A deck embedded with `<iframe srcdoc>` no longer throws on every slide change.
The navigation writes the slide number to the URL hash, and `replaceState`
raises a `SecurityError` against the opaque origin a `srcdoc` document gets —
`avo compare` and any site embedding a deck logged one error per slide. The
hash is a convenience, not the navigation itself, so an embedded deck now
simply goes without it.
