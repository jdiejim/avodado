---
"@avodado/core": minor
"@avodado/render": minor
"@avodado/studio": patch
"@avodado/mcp": patch
"avodado": minor
---

Diagrams auto-lay out **left-to-right** instead of top-to-bottom. A `flow` or
`c4` written as just nodes + edges used to come back as a tall column of ranks
that outgrew the page and shrank to a thin strip on a slide; it now runs across
the page, matching `state`, `dfd`, `felogic`, and `block`, which already did.

New `dir: LR | TB` on `flow`, `state`, `dfd`, `c4`, `felogic`, and `block` asks
for the other direction — it steers the auto-layout only, so diagrams with
`col`/`row` on their nodes render exactly as before. The showcase's `variant:
dag` pipeline and the authoring skill were updated to match.
