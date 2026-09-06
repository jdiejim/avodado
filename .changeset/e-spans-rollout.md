---
'@avodado/core': minor
'@avodado/render': minor
'avodado': patch
'@avodado/mcp': patch
'@avodado/studio': patch
---

Two cloud & microservices blocks. **`spans`** draws a distributed-trace waterfall: one lane per service (first-appearance order, with a chip for its dominant span kind), a nice-number time axis in `unit` (`ms` · `s` · `us`), and one bar per span placed by `start` and sized by `duration` on that shared scale — bars lighten with nesting depth (ink → muted → paper-2), a thin connector joins each child to its parent, the critical path (root, then the longest child at every hop) takes the accent, and `error: true` draws a negative outline plus an `ERR` chip. `attrs` and `note` list under the drawing; a name that cannot fit its bar follows the duration label instead of being cut. Terse item: `service/id: name · start · duration [· parent]`. Density warns past 40 spans. **`rollout`** draws a progressive-delivery strip: one paper card per stage with a `STAGE n` eyebrow, the name, the status chip (done = paper-2 fill · current = accent outline · next = dashed · blocked = negative), an ink traffic bar, the hold `duration`, and the note; each stage's `gate` rides as a chip on the connector to the next card; `rollback` is the footer line; `strategy` (`canary` · `blue-green` · `rolling` · `feature-flag`) shows in the eyebrow. Terse stage: `"[status] traffic% · name · duration — gate"`.
