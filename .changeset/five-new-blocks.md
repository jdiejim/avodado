---
"@avodado/core": minor
"@avodado/render": minor
"@avodado/studio": patch
"@avodado/mcp": patch
"avodado": minor
---

Five new block types and two new chart kinds — the shapes a technical doc still
had to draw somewhere else. The library goes 79 → 84.

- **`gitgraph`** — the branching and release model. Lanes for branches, dots
  for commits, a solid curve where one forks and a dashed one where it merges
  back, tags for releases. Commits are a plain sequence, so the YAML reads in
  the order the history happened; the first commit on an unseen branch opens
  its lane.
- **`treemap`** — proportional composition where a donut gives up. Squarified
  layout (near-square tiles, biggest first) makes areas comparable by eye, so
  thirty services by spend stay readable.
- **`packet`** — a wire format bit by bit, the diagram an RFC draws in ASCII.
  Cell width IS the bit count, and a field that overruns its row wraps and
  continues on the next, marked `→` / `(cont.)`.
- **`venn`** — two or three overlapping sets with the shared regions labelled,
  for scope, ownership and responsibility.
- **`wardley`** — components placed by visibility to the user and by evolution
  (genesis → commodity), joined into a value chain, with `movement` for where
  one is heading.
- **`chart` `kind: stacked`** — columns that sum instead of standing side by
  side; the axis scales to the totals and each column is labelled with its own.
- **`chart` `kind: scatter`** — the same series as unjoined points, for when x
  order carries no meaning.

Also: schema introspection now reports an array's declared `.min(n)`, and the
Studio form seeds that many items when it adds one. A form that produced fewer
was building a value its own schema would reject — `venn.shared.sets` (min 2)
is the first field to require it.
