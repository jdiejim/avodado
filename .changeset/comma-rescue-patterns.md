---
'@avodado/core': minor
'avodado': patch
'@avodado/mcp': patch
'@avodado/studio': patch
---

Repair the unquoted-comma trap instead of reporting it. A single-line `{ … }` map whose cell has no key of its own (`label: Hold as BACKORDERED, email ETA`, `value: 1,000,000 followers`) is folded back into the field before it on the source line, before YAML parses it, so the text survives exactly. `E_PARSE_YAML` now says what to do for a `[ ]` inside a row cell and for an inline map that does not close on its line. A terse line whose text holds a colon (`name type required — Sum: lines plus tax`) is rescued from the single-pair map YAML makes of it. The skill gains `reference/patterns.md`: twelve messaging and event patterns (pub/sub, competing consumers, partitioned streams, backbone, outbox, dead-letter and retry, CQRS, event sourcing, saga, scatter-gather, backpressure and circuit breaker, CDC and webhooks, idempotency), each as a block stack with its trap; the generation eval adds seven scenarios for them.
