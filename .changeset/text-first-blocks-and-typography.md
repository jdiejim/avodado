---
"@avodado/core": minor
"@avodado/render": minor
"@avodado/studio": patch
"avodado": patch
---

**Callouts (and pullquotes) are now just text.** A text-first block's body can
be plain prose — no YAML at all, so colons, quotes and dashes never need
escaping:

    ```callout
    Heads up: the rate limit is 100 req/min — use `retry()` with **backoff**.
    ```

The whole body becomes the block's text field (callout `body`, pullquote
`text`), and it renders as inline Markdown (bold/italic/code/links, blank lines
as paragraph breaks — hardened, no raw HTML). Leading with a known field
(`tone:`, `title:`, `id:`…) still parses as YAML exactly as before. Studio's
structured edits canonicalize a bare-text body to explicit fields instead of
failing.

**Typography: reading text is bigger.** Body prose 14 → 15.5px, list items
13.5 → 15px, callout body 13 → 14.5px, glossary/diagram descriptions 13 → 14px,
section ledes 15.5 → 16px.
