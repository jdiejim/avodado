# Avodado blocks — Narrative & prose

Part of the **avodado-docs** skill (the hub is `SKILL.md`, two folders up).
Field contracts and examples for this family's blocks. The at-a-glance contract
table for all 87 blocks is `contract.md` beside this file; the block → family
map is `INDEX.md`. Schemas reject unknown fields — use exactly these.

### Document & meta

#### `meta` — document cover (first block only)
```meta
title: Orders API
subtitle: How the orders service accepts and persists a purchase.
tag: API · v1
logo: https://example.com/logo.png   # optional brand logo in the cover (use an absolute https URL)
```
`logo` is optional — an absolute https URL (or path) shown above the title on the
document and slide cover.

### Prose & structure

#### `prose` — structured prose (heading / paragraph / list / quote)
```prose
title: Background
blocks:
  - { type: h, text: Why this exists }
  - { type: p, text: A short paragraph explaining context. }
  - { type: ul, items: [Idea one, Idea two] }
  - { type: quote, text: A pull-quote. }
```

#### `callout` — note / tip / warning / danger
```callout
tone: warn
title: Idempotency required
body: Clients must send an Idempotency-Key header so retries are safe.
```
`tone` is `note | tip | warn | danger`.

#### `glossary` — term / definition rows
```glossary
terms:
  - { term: Idempotent, def: A replay produces the same outcome. }
  - { term: SLO, def: Service-level objective the team commits to. }
```

#### `figure` — an image with a caption
```figure
src: https://example.com/dashboard-screenshot.png
alt: The alerts dashboard after the redesign
caption: "The redesigned alerts dashboard: unacked alerts pin to the top."
width: 560            # optional px cap on the rendered image
```
`src` is required (an absolute https URL or a repo-relative path). Use `figure`
for real images — screenshots, photos, exported charts from other tools. For
anything the renderer can draw (architecture, flows, data), use a typed diagram
block instead so the source stays editable.

#### `faq` — Q&A accordions (native details, no JS)
```faq
title: Rollout questions
items:
  - q: Does this change the on-call rotation?
    a: "No. Paging stays in PagerDuty; only the alert routing rules move."
    open: true
  - q: What happens to alerts created before the migration?
    a: |
      They keep working — the old webhook stays registered until Q3.

      After Q3 the webhook is removed and unmigrated alerts stop firing.
```
Each item is one `<details>` accordion: the question in the summary, the answer
expands. `open: true` starts an item expanded. Answers are plain text — blank
lines become paragraph breaks. Use `faq` for genuine reader questions; use
`glossary` for term definitions and `callout` for a single aside.

### Presentation text

#### `divider` — a full-width section break ("PART 2")
```divider
kicker: PART 2
title: What we change
subtitle: The three fixes, in the order we ship them.
accent: navy
```
Only `title` is required. `kicker` is a short mono eyebrow ("PART 2",
"APPENDIX") rendered with rule lines either side; `accent` tints the kicker and
the band's wash (accent as in `drivers`). In a deck, put a `divider` alone
under its own `##` heading and it becomes a clean interstitial slide.

#### `bignumber` — one hero metric that carries the slide
```bignumber
value: "-75%"
label: Checkout p95 after moving capture off the request path
context: "2.4s → 600ms, measured over four weeks of production traffic"
delta: "-1.8s"
trend: down
accent: green
```
`value` is a string — **quote numeric-looking values** (`"-75%"`, `"3.2"`).
`trend` is `up | down | flat`; the arrow renders neutral gray on purpose
(for a hero metric "down" is often good — latency, cost), while the `delta`
text takes the accent color. Use `bignumber` for ONE number; use `stats` for
a row of KPIs.

#### `takeaways` — the 2-6 things to remember
```takeaways
title: Takeaways
items:
  - text: The synchronous capture call was the bottleneck
    detail: It accounted for 71% of the 2.4s checkout p95.
  - text: Moving it to a queue cut p95 by 75%
  - text: Conversion recovered within two weeks
    detail: "+0.4pp against the pre-regression baseline."
```
`items` takes 2-6 rows; each `text` is a bold one-liner, `detail` an optional
smaller line beneath. `title` defaults to "Takeaways"; `accent` tints the
circled numbers. The natural closing slide of a deck — use `list` for ordinary
bullets inside a document.
