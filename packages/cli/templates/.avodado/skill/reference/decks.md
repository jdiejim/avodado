# Slide decks — `avo slides`

Part of the **avodado-docs** skill (the hub is `SKILL.md`, one folder up). Read
this for any slides or deck ask.

## Slide decks (`avo slides`)

Any document renders as a deck with `avo slides`. **Each top-level heading
(`#`/`##`) starts a new slide and is its title.** Everything until the next
heading — prose *and* every block — stays on that slide, so a slide can hold
several blocks. (`###`+ headings stay in the slide body; to keep things on the
same slide, just don't add a new `#`/`##`.)

````md
# Why now
A sentence of context, then any blocks under this heading.

```drivers
items:
  - { title: Slow, body: "p95 hit 2.4s.", icon: clock, accent: amber }
```

# The fix
Next heading → next slide. This one stacks two blocks.

```stats
stats:
  - { value: "800ms", label: New p95 target, trend: flat }
```

```callout
tone: success
body: Both blocks land on "The fix" slide.
```
````

- This means a normal Avodado doc (sections under `##` headings) already
  presents cleanly — no special markup needed. To author *for* slides, write one
  `##` heading per slide and keep each to **one idea**: a heading plus one strong
  visual (a diagram, `drivers`, `stats`, `pyramid`, `quadrant`, `timeline`) reads
  better than dense prose.
- **Vertical alignment is automatic** — light slides (one block, little prose)
  center; heavier slides (stacked blocks or lots of prose) top-align. To force it,
  add a marker to the heading: `## Title {top}`, `## Title {center}`, or
  `## Title {bottom}` (the marker is stripped from the displayed title). A fourth
  marker, `## Title {split}`, switches the slide to the consulting layout —
  prose left, exhibit right (see *Consulting-style decks* below).
- Every non-cover slide automatically gets a footer (deck title · page number).
- The `meta` block is the cover slide. A doc with **no headings at all** falls
  back to one slide per block (legacy behavior).

### Consulting-style decks

For an executive or consulting-grade deck, hold every slide to the formula
**assertion → exhibit → takeaway**:

- **Action titles.** Each `##` is a full-sentence assertion the slide proves
  ("Checkout latency is costing us conversions"), never a topic label
  ("Latency"). Someone flipping through only the titles should get the whole
  argument.
- **`{split}` layout.** `## Title {split}` puts the slide's prose in a left
  *message* column and its blocks in a right *exhibit* column — the classic
  consulting slide. Write 1-3 short punchy paragraphs, then exactly one strong
  block.
- **One exhibit per slide.** A `chart`, `waterfall`, `scorecard`, `heatmap`, or
  a diagram — the block *is the evidence* for the title's claim. Two exhibits
  means two slides.
- **Open each part with a `divider`.** A deck with 3+ parts gets an
  interstitial per part — a `divider` alone under its own `##` heading
  (`kicker: PART 2`, an assertion as the `title`). It renders as a clean
  full-band break slide.
- **The money slide is a `bignumber`.** When one metric carries the whole
  argument ("-75% checkout p95"), give it its own `{split}` slide: message
  left, the `bignumber` as the exhibit right — not a one-item `stats` row.
- **Close the argument with `takeaways`**: the 2-4 things the room must
  remember, numbered; follow with a `callout` (`tone: success`) only if
  there's a separate ask.
- **No thin slides.** A heading floating over one small block reads empty —
  merge it into a neighbour, or give it a message column with `{split}`.

A three-part skeleton using all three:

````md
## Part 1 — checkout is bleeding conversions

```divider
kicker: PART 1
title: Checkout is bleeding conversions
accent: navy
```

## One number tells the story {split}

The async capture change removed the 1.7s synchronous call from the
request path. Nothing else moved.

```bignumber
value: "-75%"
label: Checkout p95 after the change
trend: down
accent: green
```

## What to remember

```takeaways
items:
  - text: The synchronous capture call was the bottleneck
  - text: Moving it to a queue cut p95 by 75%
  - text: Conversion recovered within two weeks
```
````

````md
## Checkout latency is costing us conversions {split}

Every 100ms of checkout latency costs ~0.6% conversion. Our p95 has drifted
to 2.4s — the synchronous capture call is 71% of it.

```chart
kind: bar
title: Where the 2.4s goes
labels: [Gateway, Fraud, Capture, Persist, Render]
series:
  - { label: p95 ms, values: [120, 260, 1700, 180, 140] }
```
````


### The design-review arc — the structural exemplar

For a full design-review deck, follow this **arc**. The structure is the
template — swap every exhibit and every title for the system at hand; nothing
about the topic carries over.

| # | Slide (always an action title) | Layout | Exhibit |
|---|---|---|---|
| 1 | Cover | `meta` | — |
| 2 | PART 1 · the problem | `divider` | — |
| 3 | *The pain, stated as a claim* | `{split}` | `chart` — the evidence |
| 4 | *The scale is real* | — | `envelope` — the math that sets the target |
| 5 | PART 2 · the design | `divider` | — |
| 6 | *Who touches the system* | — | `c4` (context) |
| 7 | *The design, stated as a claim* | `{split}` | `block`/`infra` — the shape |
| 8 | *The decision that mattered* | `{split}` | `options` — chosen vs rejected |
| 9 | *The budget holds* | — | `waterfall` against the target |
| 10 | *One request, end to end* | — | `sequence` |
| 11 | *When X degrades, …* | — | `swimlane` — the ops story |
| 12 | PART 3 · the commitment | `divider` | — |
| 13 | *What we're measured on* | — | `slo` |
| 14 | *The number that matters* | — | `bignumber` |
| 15 | Takeaways | — | `takeaways` — the close |

What the arc encodes (keep these even when you reshape it):

- **Three parts, opened by dividers**: problem → design → commitment. The
  reader always knows where they are.
- **Evidence before design**: slides 3-4 earn the right to propose anything —
  a complaint chart, a metric, then the envelope math that turns pain into a
  numeric target the rest of the deck answers to.
- **One decision slide** (8): every real design had a fork; show the rejected
  option honestly or the deck reads as a sales pitch.
- **Slides 9-11 are chosen by YOUR bottleneck**, not by this table: a fan-out
  system shows `sequence` + `swimlane`; a storage system might show `erd` +
  `heatmap`; an agent system `agentloop` + `trace`. Two or three deep dives,
  never a fixed list.
- **The commitment close never changes**: objectives (`slo`) → the money
  number (`bignumber`, echoing slide 4's target) → `takeaways`. The last
  takeaway carries the ask (effort, flag, rollback).
