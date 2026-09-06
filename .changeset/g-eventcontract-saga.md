---
'@avodado/core': minor
'@avodado/render': minor
'avodado': patch
'@avodado/mcp': patch
'@avodado/studio': patch
---

Two async-contract blocks. `eventcontract` is the twin of `endpoint` for events: `name`, `version`, `channel`, `summary`, `producers` / `consumers`, `delivery` (at-least-once · at-most-once · exactly-once), `ordering` (none · per-key · global), `key`, `retention`, payload `schema` and `headers` (terse `name type [required] — desc`), an `example`, `errors` (terse `Name — when`), and a `note`. It renders as a card in the skin: an `EVENT · v2` eyebrow, a channel chip, a PRODUCERS → CONSUMERS strip of mono chips, the delivery facts as outlined word chips, the payload table with the partition-key row marked `#` (the card's one accent) and optional fields `?`, and the example on the code surface. `saga` draws a distributed transaction: `steps` (terse `id: Name · service · compensate`, or `· service · action · compensate`) as paper cards left to right with the owning service as a chip, the compensation under each as a dashed card, and `failAt` naming the step that fails — it takes the one accent and a `FAILED` chip, earlier steps read `COMPENSATED`, later ones `SKIPPED` on the inactive fill, the forward arrows past it turn dashed, and a `negative` dashed compensating flow runs right to left back to step 1; `mode: orchestration` adds a coordinator band on top fanning out to every step. Both blocks carry data paths for Studio, a legend (saga), a density budget of 12 saga steps, catalog templates, and skill reference entries.
