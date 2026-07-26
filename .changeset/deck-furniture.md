---
"@avodado/core": minor
"@avodado/render": minor
"@avodado/studio": patch
"@avodado/mcp": patch
"avodado": minor
---

The four pieces a consulting deck still needed. 86 → 87 types.

- **`scenarios`** — base, upside and downside against the same drivers. Cases
  in columns, so reading across a driver row shows how much of the outcome
  hangs on that assumption; the base case is badged because every other column
  is read relative to it, and `outcome` gets its own emphasised row. A case
  that omits a driver renders `·` — silent about it, which is not the same as
  claiming no change.
- **`tree` becomes a driver tree** when its nodes carry `value`. Each node
  shows its number and **its share of its parent** — p95 = capture (74%) +
  order write (16%) + the rest. No new block: values turn the hierarchy into
  arithmetic, the way `gauge` went into `chart`.
- **`## Title {source: production traces, 14 Oct 2026}`** puts a source line in
  the slide footer, where every consulting exhibit carries one. It lives in the
  footer rather than under the block on purpose: the fitter scales the exhibit,
  and provenance that shrinks with it stops being readable.
- **A deck tracker.** Two or more `divider` bands and the slide header grows a
  "you are here" strip — the parts of the deck with the current one lit. One
  divider draws nothing; a strip of one says nothing.
