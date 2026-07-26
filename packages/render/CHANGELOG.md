# @avodado/render

## 0.29.0

### Minor Changes

- 7f969a3: Two blocks a consulting deck opens and closes with, and three fixes to how a
  slide handles text. 84 → 86 types.
  - **`harvey`** — the rated comparison grid: options across the top, criteria
    down the side, a Harvey ball (0–4) for each judgement. The WEIGHTED footer is
    computed from the balls, so the column marked `recommend` and the arithmetic
    can be seen to agree. A row shorter than `columns` reads as _not assessed_
    rather than as a zero — different claims. Use `benchmark` for measured
    numbers, `harvey` for judgements.
  - **`scqa`** — the executive summary in Minto order: situation, complication,
    question, answer. Every field is optional but the order is fixed, which is
    the block's job; `answer` takes the filled card and `because` hangs the
    support beneath it.

  **Slides:** a block's `lede` used to vanish on a slide — it lives in the
  section head, which the stage hides. It now pins under the slide title as the
  supporting line of an action title, at a fixed size so the fitter can't shrink
  it with the exhibit. Body copy also moves to presentation sizes (19px prose,
  17.5px list items, 19.5px in a `{split}` message column) with the measure still
  capped, because long lines are harder to follow on a screen, not easier.

- f56bbac: The four pieces a consulting deck still needed. 86 → 87 types.
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

- 4f4811e: Five new block types and two new chart kinds — the shapes a technical doc still
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

- 35059ea: Two additions from a pass over the whole library, looking for what a technical
  doc still can't draw.

  **New `sankey` block — how much moves between stages.** `flow` and `dfd` show
  that a path exists; nothing showed how heavy it is. Node height and ribbon
  thickness are the same scale, so the widest ribbon leaving a stage IS where the
  volume goes: cloud spend by service, traffic by route, a funnel with its
  drop-off. Nodes are inferred from the links, so the minimum body is a list of
  `from -> to: value`; declare `nodes` only to relabel, colour, or pin a column.
  A node's column is the longest link chain reaching it, so a stage always sits
  right of everything feeding it.

  **New `chart` kind: `gauge` — radial progress against a ceiling.** A donut says
  how a whole splits up; a gauge says how far along one number is, which is the
  shape an SLO, a quota, a migration or a rollout actually has. `max` is the full
  sweep (default 100, the percentage case). One item draws a single dial with the
  value in the middle; several become concentric rings with a legend.

  The block count goes 78 → 79.

### Patch Changes

- a9213cf: `{source: …}` no longer leaks into a page heading. The deck stripped it; the
  document renderer only knew the alignment markers, so `## Title {source: …}`
  rendered the marker verbatim on the page.

  The three places that had to agree about what a heading says now share one
  definition in `@avodado/core` (`stripHeadingMarkers`, `readSourceMarker`,
  `readAlignMarker`) — the page renderer, the deck, and `trailingHeading`, which
  feeds block titles and the sections nav and stripped nothing at all.

  On a page the source isn't dropped, it's printed: a small provenance line under
  the heading, matching what the deck puts in the slide footer.

- Updated dependencies [7f969a3]
- Updated dependencies [f56bbac]
- Updated dependencies [4f4811e]
- Updated dependencies [a9213cf]
- Updated dependencies [35059ea]
  - @avodado/core@0.19.0

## 0.28.1

### Patch Changes

- b418ed2: A deck embedded with `<iframe srcdoc>` no longer throws on every slide change.
  The navigation writes the slide number to the URL hash, and `replaceState`
  raises a `SecurityError` against the opaque origin a `srcdoc` document gets —
  `avo compare` and any site embedding a deck logged one error per slide. The
  hash is a convenience, not the navigation itself, so an embedded deck now
  simply goes without it.

## 0.28.0

### Minor Changes

- 6294435: New **`benchmark`** block — measured results side by side, in the shape model
  cards and vendor comparisons use: subject columns × metric rows, each metric
  carrying the benchmark's own name under its label.

  The winner in each row is **derived, not authored**: the numbers are read out of
  the cells (`$0.14`, `310 ms`, `1861` and `43.3%` all compare), then bolded and
  tinted. `better: low` flips it for latency and cost, `better: none` turns it
  off, and `best: true` forces a tie or a non-numeric winner. `featured: true`
  outlines one subject's whole column; `tone: muted` tints a rival's win gray so
  it doesn't read as your win. A row measured under several conditions names them
  in `variants` and gives each subject one value per condition — they stack in
  the cell, captioned, and each condition is compared on its own line.

- 3c1df17: Card and list blocks stop presenting at page width on a slide. Shrink-wrapped
  to their natural width, they sat where the fitter's text ceiling (1.06×) left
  them: a checklist covered 30% of the stage, a status board 52%, a set of KPI
  cards 64%. They now take the stage the way tables do — 20 blocks move to full
  width, including `list`, `cvt`, `kanban`, `stories`, `spec`, `anatomy`,
  `changelog`, `prompt`, `team`, `stats`, `proscons`, `dodont` and `userstory`.

  Stacked cards go **across** the stage rather than down it: `slo`, `okr`,
  `stories`, `envelope` and `trace` lay their cards out with `auto-fit`, so as
  many fit as stay readable and the rest wrap — the same mechanism `drivers` and
  `options` already used. Three SLOs side by side instead of a column took that
  block from 24% of the stage to 98%, and its labels from 7.2px to 12.3px.

  `pullquote` and `bignumber` are deliberately excluded: they are hero text, not
  card stacks, so they keep the shrink-wrap that lets the fitter enlarge them —
  and a pull quote now reads at statement size (22px) on the stage.

  Across the library this takes blocks that land clean on a slide from 34 of 77
  to 59, with no slide clipping at 1120×630. What remains is diagram labels
  (their wrap widths are baked into the viewBox) and four blocks that need a
  different drawing on a slide rather than a bigger one.

- 31ba7dc: Slides stop being a scaled-down page. Two changes, measured across a deck of
  one block per type:

  **Tabular exhibits take the stage width.** Every table in the library is
  already `width:100%`, but the slide's content box shrink-wraps (so the fitter
  can enlarge a lone small block), which meant 100% resolved against the table's
  own intrinsic width: a three-row `table` covered 27% of the stage and the
  fitter's 1.47× ceiling could not rescue it. Tables now get the whole stage and
  their size from type rather than transform — 18px rows instead of 13px scaled
  up, so hairlines and shadows stay crisp. `table` 27% → 98% of the stage width,
  `matrix` 49% → 98%, `heatmap` 43% → 98%, `glossary` 55% → 98%, `scorecard`
  58% → 98%. Their page-card borders and shadows drop on the stage, the way the
  diagrams' already did.

  **A legibility floor for small labels.** The library sets eyebrows, chips,
  captions and secondary values at 9–11px because a page is read at 40cm; on a
  stage, after the fitter scales an exhibit down, those were reaching the room at
  5–8px. Every non-SVG label that measured under 12px is now 12.5px on slides.
  Across the library, labels landing under 12px on a slide drop from 641 to 452,
  and 14 blocks lose their sub-10px type entirely — `risk`, `drivers`,
  `options`, `persona`, `changelog`, `spec`, `kanban` and others.

  SVG diagram labels are deliberately untouched: their wrap widths are computed
  against the current size and baked into the viewBox, so they move per diagram.
  `journey`'s emotion label moves from an inline style to a themed class.

### Patch Changes

- Updated dependencies [6294435]
  - @avodado/core@0.18.0

## 0.27.0

### Minor Changes

- 2cde519: Diagrams auto-lay out **left-to-right** instead of top-to-bottom. A `flow` or
  `c4` written as just nodes + edges used to come back as a tall column of ranks
  that outgrew the page and shrank to a thin strip on a slide; it now runs across
  the page, matching `state`, `dfd`, `felogic`, and `block`, which already did.

  New `dir: LR | TB` on `flow`, `state`, `dfd`, `c4`, `felogic`, and `block` asks
  for the other direction — it steers the auto-layout only, so diagrams with
  `col`/`row` on their nodes render exactly as before. The showcase's `variant:
dag` pipeline and the authoring skill were updated to match.

### Patch Changes

- Updated dependencies [2cde519]
  - @avodado/core@0.17.0

## 0.26.1

### Patch Changes

- aba44c3: Markdown-aware snippet highlighting: a `code` block (or steps/gallery snippet)
  with `lang: markdown` (or `md`/`mdx`) now colors headings, **bold**, _italic_,
  inline code, links, list markers and blockquotes in the dark code card — and
  fenced code inside the sample still gets generic token highlighting. Any other
  `lang` value keeps the existing universal tokenizer.

## 0.26.0

### Minor Changes

- efe9172: Editable PowerPoint: `avo pptx --editable` emits native PowerPoint elements —
  text boxes with real bullets, tables, dark code boxes, stat cards, callouts,
  quotes, and actual PowerPoint charts for `chart` blocks — so the deck's words
  are editable in PowerPoint. Only diagram blocks (sequence, flow, ERD, C4, …)
  are placed as crisp screenshots, and Chromium only launches when a document
  actually contains one. The render package now exposes each slide's structured
  `parts` (prose text / block type + data) on the slide model for
  structure-aware exporters.

## 0.25.11

### Patch Changes

- 808891d: Code presents at presentation scale on slides: 16px type (the doc page keeps
  12.5px), and a lone tall snippet (18+ lines) splits into a two-column spread —
  left column first, like a printed listing — so it fills the stage at full size
  instead of shrinking to half scale. Long lines wrap inside the columns, and
  the split only happens when the syntax-highlight markup divides cleanly. The
  "Structure your prompts"-style template went from an effective 10px strip to
  15.5px across 98% of the stage.

## 0.25.10

### Patch Changes

- 460ef16: Slides: title cards center properly and title themselves.
  - The cover's title + subtitle sit at the true vertical center (trailing doc
    margins no longer skew the flex centering).
  - A slide that is only a `divider` is its own title card: no stale section
    heading above the PART band, and the jump menu lists it by the band's title.
  - Untitled leading-prose slides drop the meaningless "Slide" header.

## 0.25.9

### Patch Changes

- 23228b7: Slide layout audit fixes (found by measuring a real 27-slide deck):
  - **Flat code blocks weigh in** — a top-level `code:` snippet counted as 2.0
    regardless of height, so two 24-line terminals piled onto one slide at 0.5×.
    Both spellings now count lines; tall snippets get their own slide.
  - **Code takes the stage width** — `<pre>` slides no longer shrink-wrap to a
    narrow strip; height is the only fit axis (0.54× → ~0.8× on real content).
  - **Short intros ride with their exhibit** — the kicker threshold rises from
    ~180 to ~400 chars, so a two-sentence lede shares the slide with its hero
    block instead of stranding a near-empty prose slide.
  - **Statement slides** — prose-only fragments that still end up alone render
    as a deliberate centered statement (larger, measured type) instead of a
    small lost paragraph.

## 0.25.8

### Patch Changes

- 0451174: Slides: the stage-column treatment now covers every stacked text block —
  `agenda`, `spec`, `inventory`, `slo`, `okr`, and `risk` join list/takeaways/
  steps/faq/glossary/prose lists (2 columns at 4+ items, 3 at 8+). Blocks that
  are already grids (team, persona, drivers, gallery) or whose vertical order is
  the point (layers, changelog) are untouched. Also fixes the terse OKR
  key-result sugar: `· 60` / `· 60%` now lands as the schema's 0-1 fraction, so
  progress bars show the real percentage instead of clamping to 100%.
- Updated dependencies [0451174]
  - @avodado/core@0.16.1

## 0.25.7

### Patch Changes

- 77e1003: Slides: tall text lists break into stage columns, and the cover centers.
  - `list`, `takeaways`, `steps`, `faq`, `glossary`, and long prose lists flow
    into 2 columns at 4+ items and 3 at 8+ — horizontal space instead of one
    skinny centered strip the fitter would shrink. Short lists keep their single
    column.
  - The cover slide's subtitle (and the whole title column) is properly centered
    on the stage.

## 0.25.6

### Patch Changes

- af9bae9: **Annotate sequence steps from the canvas.** Select a message in a sequence
  diagram and a "＋ add note ②" button (and an `n` shortcut, taught in the hint
  chip) opens the editor focused on that message's `summary` — the annotation
  appears automatically in the Step-by-step list under the diagram with the SAME
  reference number as the diagram badge (the list now shows real message numbers,
  so a note on step 4 reads ④ even when steps 1–3 have none). Structured edits on
  terse sugar items (arrow messages, string cards…) now materialize the item to
  its object form first instead of failing silently — annotating a one-liner
  message just works, and untouched siblings keep their terse spelling.

## 0.25.5

### Patch Changes

- ed6dde6: Edge-step numerals (① ② ③) dodge node boxes — a long edge's midpoint can land
  on a node in tight layouts, which printed the badge over the node's label.
  Badges now nudge off any node box along the edge's axis, and keep clear of
  each other when two edges share a corridor. Diagrams without collisions render
  byte-identically.

## 0.25.4

### Patch Changes

- b55ae7e: Decks show diagrams complete on slide entry — the progressive ① ② ③ step
  reveal is removed; navigation is one press per slide again.

## 0.25.3

### Patch Changes

- Updated dependencies [402174b]
  - @avodado/core@0.16.0

## 0.25.2

### Patch Changes

- 3aca7b1: **Block audit: simpler authoring across the list-shaped blocks.** Six more
  blocks now take terse string items (the callout bare-text philosophy):
  - `glossary` — `SLO — the target` or unquoted `SLO: the target`
  - `faq` — `Why is it fast? — The cache is warm.`
  - `takeaways` — `Ship small — five beats one.`
  - `list` — `Lead` or `Lead — text`
  - `steps` — `Title` or `Title — body`
  - `kanban` cards — `Core parser` or `Validation · priority`

  Object forms are untouched; unquoted `Key: value` items (the YAML wrinkle) are
  rescued when the key isn't a real field. Also refiles `pullquote` and `layers`
  from the `api` family to `narrative` where they belong, and the skill's
  contract + examples teach the terse forms.

- Updated dependencies [3aca7b1]
  - @avodado/core@0.15.0

## 0.25.1

### Patch Changes

- c7de193: Diagrams shed their page-card chrome on slides: no border box, tag pill, fig
  number, or dashed rule inside a slide — the slide itself is the card, so
  sequence/flow/architecture diagrams now sit directly on the stage at full
  presentation scale.

## 0.25.0

### Minor Changes

- 1b44c6c: **Smarter slides — less shrinking, more presenting.**
  - **Auto-split layout:** substantial prose + a medium exhibit that would
    overflow stacked now lays out side by side automatically (prose as the left
    message column, the exhibit right) — the layout `{split}` forces, chosen for
    you. Write the section naturally; the deck picks the layout instead of
    scaling the stack down.
  - **Numbered diagrams build step by step:** in the deck, a sequence diagram (or
    any edge-steps diagram with the ① ② ③ legend — flow, c4, cycle…) reveals one
    step per advance — arrow, numeral, and legend row together. Back un-reveals,
    jump/Home/End show the finished slide, print shows everything.

## 0.24.0

### Minor Changes

- 0d9c992: **Callouts (and pullquotes) are now just text.** A text-first block's body can
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

### Patch Changes

- Updated dependencies [0d9c992]
  - @avodado/core@0.14.0

## 0.23.0

### Minor Changes

- 43a45ea: **The heading titles the block.** A `##` heading directly above a block now
  titles it: a near-duplicate block `title` is suppressed at render (no more two
  stacked headings saying the same thing — healed in HTML, slides, Studio, and
  PDF), and a title-less block inherits the heading into the sections nav. The
  Markdown-native way to write docs is now simply: put the title in the heading
  and skip `title:` in the YAML.

  The `W_DUP_HEADING` warning is removed (the condition is auto-healed), and core
  exports `trailingHeading` alongside `isNearDuplicateTitle`. The authoring skill
  teaches the new rule.

### Patch Changes

- Updated dependencies [43a45ea]
  - @avodado/core@0.13.0

## 0.22.1

### Patch Changes

- Updated dependencies [7052a5d]
  - @avodado/core@0.12.1

## 0.22.0

### Minor Changes

- ebdf605: Studio, rendering, and package metadata.

  **Studio**
  - Toolbar **Export** menu: download the current doc as a standalone HTML page,
    a self-contained slide deck, or a PDF. PDF is produced by a new
    `POST /api/export/pdf` route on the file-bridge server (headless Chromium).
  - **ERD drag-to-connect:** selecting an entity shows connector dots; dragging
    to another entity opens a cardinality picker (1:1 / 1:N / N:1 / N:M) that
    appends the relation. Committed as a single undo step.
  - Direct-manipulation editing for grid groups (marquee select + resize) and
    column-family blocks.

  **Rendering**
  - New `cycle` block and grid-group / orthogonal-lane / label-wrap improvements
    across the diagram renderers.

  **Metadata**
  - SEO-focused `description` + `keywords` across all packages, framed around the
    real use cases: API docs, architecture & system design, ERDs, ADRs, and
    slide/PDF presentations.

### Patch Changes

- Updated dependencies [ebdf605]
  - @avodado/core@0.12.0

## 0.21.0

### Minor Changes

- Consolidate the workspace from 7 published packages to 5.
  - `@avodado/cli` absorbs `@avodado/sync` (the OpenAPI importer behind `avo sync openapi`, now at `src/sync/`) and PDF export (`toPdf` / `installChromium` / `isChromiumAvailable`, now at `src/io/pdf.ts`); `playwright` is now a direct (optional) dependency of the CLI instead of arriving transitively via `@avodado/export`.
  - `@avodado/render` gains `toSlides` — the self-contained slide-deck assembly formerly in `@avodado/export`. All rendering (HTML pages, embeddable parts, slide decks) now lives in one package, and it stays browser-safe.
  - `@avodado/mcp` no longer depends on `@avodado/sync`; it vendors the OpenAPI generator (a test pins the copy byte-identical to the CLI's). Behavior of the `sync_openapi` tool is unchanged.

  `@avodado/export` and `@avodado/sync` are discontinued: their final versions remain on npm (deprecation notices to be run manually), and `toHtml` — a thin alias of `renderDocument` — is gone; call `renderDocument` from `@avodado/render` directly.

- Simplification: 76 block types, terser YAML, a smaller CLI, and a sharper story — with zero breaking changes.

  **88 → 76 block types, 12 permanent aliases.** Twelve blocks that were variants of another block merged into their canonical type: `infra`/`event`/`ddd`/`network` → `block` (`preset:`), `belogic` → `felogic` (`variant: be`), `dag` → `flow` (`variant: dag`), `waterfall`/`funnel` → `chart` (`kind:`), `diff`/`terminal` → `code` (`kind:`), `mece` → `tree` (`variant: issue`), `tracker` → `statustable` (`variant: tracker`). **The old spellings stay valid forever**: an aliased fence parses to its canonical type with the variant fields injected (your body always wins on conflict), renders byte-identically to before (pinned parity fixtures), keeps its historical section eyebrow, and survives studio editing untouched. `avo check` surfaces a `W_ALIAS_TYPE` warning — informational only, never a failure — telling you where the type lives now. No file needs to change. (Further merges the audits suggested — matrix→table, heatmap→chart, gantt→timeline, and friends — were rejected: their data shapes are structurally different, and forcing them would have bolted second grammars onto flagship blocks.)

  **YAML sugar.** The chattiest blocks now take one-line string forms alongside the object form: sequence messages and flow/graph/block edges (`Client -> Server: request`, `-->` for response/dashed, `-x->` for error), ERD relations in crow's-foot (`users ||--o{ orders: places`), and timeline items (`[done] 2026-07 · Phase 1 · What shipped`). Input-only — files keep whatever form you wrote.

  **Scalar coercion.** Bare numbers and booleans in string-only positions coerce automatically — "expected string, received number" is gone where the intent was unambiguous, and positions that legitimately take numbers (table cells, stats values) are protected.

  **CLI redesign.** Twenty commands became ~13 in four groups — Work (`avo`, `init`, `new`, `check`, `studio`, `serve`), Output (`html`, `slides`, `pdf`, `build`), Discover (`explore`), Setup (`install`, `theme`, `mcp`, `sync`). Bare `avo` is now smart: outside a project it points you at `avo init`; inside one it shows a mini status and your next actions. `avo <file.md>` renders and opens the file. `avo new` unifies doc templates and block scaffolds (`avo new adr`, `avo new sequence` — old names resolve with an alias note). `avo explore` fronts demo/catalog/design/tour. Old command names keep working as hidden compat. `avo init` writes ~30 files instead of 104: the authoring skill installs once at `.avodado/skill/` and each AI tool gets a small pointer stub instead of a full copy.

  **Studio.** "+ New doc" opens a template picker — Blank plus the 11 doc templates (ADR, design doc, runbook, API spec, …) as cards; picking one creates the doc and opens the first content block's Edit Sheet so Tab/Enter walks you through filling it in. Insert search understands the old spellings: typing "waterfall" surfaces "Data chart — matches waterfall (kind: waterfall)" and inserts a chart with the variant pre-filled.

  **Positioning.** The lede everywhere is now the point: _your documentation has a schema_ — typed, fenced YAML blocks in plain Markdown, validated like code, with the `.md` files on disk as the only source of truth.

  `@avodado/mcp` picks up the regenerated skill embed and `list_block_types` now returns the canonical 76 plus the alias map.

- Studio becomes the single local surface, imports arrive, and the official mark
  ships everywhere.
  - studio: **Edit · Site · Present modes** — Site browses the real built docs
    site (live-reloading, cross-doc nav) inside studio; Present (⇧⌘P) shows the
    current doc as slides, unsaved edits included. **Block Library** — browse all
    blocks as cards with rendered previews, filter by family/search (old block
    spellings resolve), click through to a full preview + template and insert in
    one step. **Import by drag-drop**: a `.csv` becomes a filled table /
    status table / chart at the drop point (smart suggestion with reasoning); an
    OpenAPI `.yaml`/`.json` scaffolds a whole validated doc. Forms-first editing
    (spreadsheet-style table grid, Simple|Detailed union fields) and an
    interactive 9-step tour.
  - core: new `import/` module — dependency-free RFC-4180 CSV engine
    (`csvToTable` / `csvToStatustable` / `csvToChart` / `suggestCsvImport`), the
    OpenAPI generator relocated from the CLI (one source for cli, mcp, studio),
    and an importer registry.
  - cli: `avo sync csv <file>` (smart block pick, `--block/--delimiter/--title`);
    `avo serve` is now a hidden alias — `avo studio` (Site mode) is the one local
    surface.
  - render: every rendered page, deck, and site now carries the official avodado
    mark as its favicon.
  - mcp: imports the OpenAPI generator from core (vendored copy removed).

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @avodado/core@0.11.0

## 0.20.0

### Minor Changes

- Brand favicon + studio review-before-write mode.
  - render: new brand exports (`FAVICON_SVG`, `FAVICON_DATA_URI`, `FAVICON_LINK`)
    — a clean avocado favicon, now on every rendered page (`avo html`/`preview`).
  - cli: `avo serve`/`avo build` pages and slide decks carry the favicon.
  - studio: the tab icon matches; **review mode** — with autosave off, the save
    chip reads "Unsaved · N changes" and saving opens a review dialog listing
    edited / added / removed / reordered blocks with Apply / Cancel, so nothing
    touches the file until approved. Deleting a block or diagram part asks first
    (double-⌫ confirms; pristine just-inserted scaffolding deletes silently).

## 0.19.0

### Minor Changes

- `avo studio` — the visual doc editor. A full-screen local web app served by the
  CLI: insert blocks from the searchable palette into a live-rendered canvas, edit them
  via schema-generated forms or raw YAML, reorder with drag handles, and watch AI
  edits to the same files repaint live over SSE. Files on disk stay the single
  source of truth — studio surgically rewrites individual fenced blocks.
  - core: new surgical edit ops (`replaceBlockBody`, `insertBlock`, `removeSegment`,
    `moveSegment`, `setYamlPath`, …), schema introspection (`describeBlockSchema`),
    and the block catalog data (`BLOCK_TEMPLATES`, `BLOCK_DESCRIPTIONS`,
    `BLOCK_FAMILY`) relocated from the CLI as public API.
  - render: `renderDocumentSegments` — per-segment HTML index-aligned with
    `doc.segments`, for editors that need DOM↔segment mapping.
  - cli: new `avo studio` command — a localhost-only file-bridge server (JSON API +
    SSE + static app assets); shared fs-watch helpers extracted into `io/watch.ts`.
  - studio: first release of the web app (published as static assets consumed by
    the CLI).

### Patch Changes

- Updated dependencies
  - @avodado/core@0.10.0

## 0.18.0

### Minor Changes

- Agentic blocks, 106-pattern library, the full shape language, and a restructured skill. **AI & agents family** (79 → 83 blocks): `agentloop` (agent + tools + memory with numbered loop arrows and a stop-condition pill), `trace` (execution transcript with thinking and tool calls), `prompt` (prompt anatomy with highlighted `{{variables}}`), `context` (context-window token budget bar with overflow) + an Agent-system-doc playbook. **Design library 80 → 106**: interpreter (the 23rd GoF), architecture classics (mvc, mvvm, dependency-injection, unit-of-work, active-record, data-mapper, event-bus, specification, null-object), resilience/concurrency/messaging (retry-backoff, bulkhead, timeout, cache-aside, throttling, actor-model, producer-consumer, thread-pool, competing-consumers, splitter-aggregator), and agentic patterns (plan-and-execute, human-in-the-loop, agentic-rag, swarm-handoff, chain-of-thought, context-compaction). **Diagram elegance**: labeled C4 edges (and dense block-family diagrams) render as circled step numerals with a legend below; C4 tech renders as a chip; all node cards drop the left accent bar for the clean rounded agent-card look. **Shape language, 21 silhouettes by kind**: cylinder, tiered cylinder (warehouse), pail (S3), sharded trio, replica set, pipe, cloud, hexagon (gateway), octagon (lb), instance stack (cache + worker pools), server rack, shield (waf), actor figure, crowd, browser window, phone, ƒ circle (lambda), clock (cron), vault dial (secrets), globe (region), clean card — plus new kinds shard/replica/users/crowd/region/geo. **Skill restructured** for progressive disclosure: a 598-line hub (down from 2,373) + `reference/` spokes (blocks contract, system design, decks, and new per-document intake checklists with a batched ask-back protocol); `avo skill`, the Copilot adapter, and the MCP embed stitch everything into one prompt; `avo init` installs the full folder. **Plus**: a new `archmap` block (83 → 84) — the target-architecture capability mosaic with status-coded tiles (current/target/new/gap/deprecated) and an auto-legend; the shape language extends into `belogic`/`felogic` (db → cylinder, queue → pipe, cache → stack, external → cloud), `c4` (`store` → true database cylinder), and `cluster`; secrets render as a padlock and schedulers as the industry-standard calendar-with-clock; the ERD is restyled (tinted header band, content-sized entities, zebra rows, PK/FK chips); and block titles no longer render twice (the section head owns the title; the block body's duplicate header is suppressed at top level).
- The documentation-tool release. **New commands**: `avo serve` (zero-dep live-reload dev server — watch, SSE reload, in-page diagnostics banner), `avo build` (docs/ → a static site: index cards, sidebar nav with per-doc sections, cross-doc `doc#id` refs rewritten to real links), `avo mcp` (setup snippets + `--stdio` server), `avo install <tool>` (claude/cursor/copilot/windsurf — replaces the old per-tool commands, Copilot correctly named), `avo tour` (interactive 7-chapter terminal onboarding with a live-caught planted bug), `avo demo [family]` (filtered showcases with an interactive picker). **Removed**: the duplicate `render` command (use `html`). **Render**: blocks with an `id:` emit real anchors + `data-block-id`; userstory/stories ref chips are real links; C4 goes professional (level-aware `C4 · CONTAINER` tag, centered structurizr-style typography, dashed externals, legend derived from the kinds present, taller cards) and the layered architecture drops its solid label slabs for tinted zone bands with optional per-layer `color`. **Catalog** groups all blocks by family. **Skill**: `reference/blocks/` per-family split with INDEX + whole contract table (coverage-tested), trimmed trigger frontmatter, new "Organizing a documentation set" + "Reviewing an existing doc" + "C4 done right" guides. **Slides** gain an automated gate (full-demo deck + split-layout tests). New professional cfonts wordmark + one-line banner (ANSI-free when piped) and purpose-grouped help.
- Twelve more blocks (67 → 79) plus consulting-style decks. **Engineering & decisions**: `waterfall` (latency/cost budget cascade with a dashed budget line and over/under chip), `heatmap` (numeric grid with intensity ramp + legend), `scorecard` (weighted decision matrix with computed totals and winner highlight), `risk` (register with likelihood × impact severity chips), and `chart` gains a `radar` kind. **Design system** (new family): `palette` (color-token swatches with auto-contrast labels), `typescale` (live type specimen), `dodont` (Do/Don't guideline cards), `inventory` (component status board) + a Design-system doc playbook in the skill. **Algorithms & data structures** (new family): `array` (cells, indices, pointer labels, window highlight), `linkedlist` (singly/doubly with head/curr markers), `bintree` (binary tree with per-node walkthrough states), `hashmap` (buckets + collision chains); `graph` gains node `state` (visited/current/frontier/target) and edge `weight` for BFS/Dijkstra walkthroughs. **Decks**: `{split}` heading marker renders the consulting layout (message left, exhibit right), every slide gets a footer (deck title · page number), and the skill gains a Consulting-style decks section (action titles → one exhibit → takeaway). Also fixes `avo <cmd> | head` leaving an unsettled flush await.
- Fourteen new block types — the catalog grows from 53 to 67. **Everyday primitives**: `chart` (bar / line / area / donut, pure SVG), `figure` (image + caption), `diff` (unified +/− code diff on the dark editor surface), `steps` (numbered runbook stepper with per-step commands), `faq` (Q&A accordions). **System design**: `envelope` (back-of-envelope capacity math — assumptions → derivation rows → highlighted result), `slo` (service objectives with error-budget burn bars), `terminal` (shell session, distinct from code). **Business & strategy**: `swot`, `funnel` (conversion trapezoids with stage-to-stage %), `okr` (objectives + key-result progress bars), `persona` (user persona cards), `changelog` (release rail with typed change chips), `team` (people cards). All fully registered: strict schemas, renderers + CSS in the house style, `avo block` scaffolds, catalog descriptions, demo showcase sections, and skill documentation (glossary, contract table, examples, new Business & strategy family).
- Presentation text blocks + a full template set. **Three new blocks (84 → 87)**: `divider` (deck part-break interstitial — kicker, big title, accent wash), `bignumber` (the hero-stat slide: one huge figure + claim + context), `takeaways` (numbered presentation-scale closing statements). Dividers render full-width on slides; blocks whose title _is_ the visual no longer have it lifted into the section head; `{split}`/`{top}` heading markers no longer leak into HTML doc headings. **`avo template` grows from 1 to 11**: adr, design-doc, runbook, roadmap, api-spec, system-design, agent-system, design-system, postmortem, data-model, and a `deck` template demonstrating the consulting formula (divider → `{split}` argument slides → bignumber → takeaways) — every template schema-validated by tests and namespaced so several scaffold cleanly into one repo. The skill's deck guide covers when to use each, and the playbooks table maps each playbook to its template.
- System-design diagram overhaul. **Quick mode**: `col`/`row` are now optional on the block family, `graph`, and `felogic`/`belogic` — omit coordinates and the layout is computed from the edges. **Canonical shapes by kind**: db/store/warehouse render as cylinders, queue/topic/stream as horizontal-cylinder pipes, cdn/external as clouds, gateway/lb/proxy as hexagons, cache/redis as stacked-instance cards. **~40 new node kinds** with glyphs (dns, waf, auth/idp, monitor, scheduler, stream, warehouse, search, ml/llm/agent, vm, secrets, notification, email, ci, git, registry, device, analytics, config, …) plus vendor aliases (postgres/mysql/mongo→db, kafka/kinesis→stream, s3, sqs, redis, elasticsearch). **C4**: edge `tech:` labels, multiple named `boundaries[]`, and a fix for edge labels never rendering. **Cluster**: namespaces now sit side by side, self-sized, in the refined zone style. **UML**: content-sized class cards with tinted header compartments. **Polish**: nested infra zone labels no longer overlap, off-palette ink normalized to theme vars, graph label clamping, slide decks render text at presentation scale with a proper measure (text-only slides no longer over-scale). Skill updated throughout.

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @avodado/core@0.9.0

## 0.17.2

### Patch Changes

- Refine block styling across the board: softer two-layer shadows, larger and more
  consistent corner radii on card surfaces (drivers, options, spec, list, gallery,
  pattern, composition, code, …), roomier callouts, and a subtle elevation on
  diagram frames — a more polished, cohesive look. Skill notes that code renders on
  a dark editor surface (shared by `gallery` cells and `sequence` snippets).

## 0.17.1

### Patch Changes

- Code now renders as a dark editor surface — near-black background, a One Dark-style
  syntax palette (keywords, strings, numbers, functions, types, comments), generous
  padding, rounded corners, and a title bar with macOS traffic lights on full code
  blocks. The styling + syntax colors now apply everywhere code appears (the `code`
  block, `gallery` code cards, and `sequence` step snippets), not just `code` blocks.

## 0.17.0

### Minor Changes

- New `gallery` block (now 53): a real grid (2 columns by default; set `cols` for
  3–4) of cells. Each cell is a syntax-highlighted code snippet, a note, or a
  **nested block** (`block: { type: c4, …data }`) — so you can lay out a bug gallery
  of code or compare several architectures/diagrams side by side. Nested blocks are
  validated against their own schema. Skill, `avo block`/`avo catalog`, and the
  showcase updated.

### Patch Changes

- Updated dependencies
  - @avodado/core@0.8.0

## 0.16.0

### Minor Changes

- Slides: stop cramming (and over-scaling) blocks. A heavy heading now
  auto-paginates across multiple slides (same title) using a build-time content
  weight, so a big proscons / table / multi-block section no longer shrinks to an
  unreadable size on one slide. And the fit() up-scale is dialled back to a gentle
  1.5x cap so small lone blocks fill a bit without being blown up huge.

## 0.15.0

### Minor Changes

- Add three new block types (now 52):
  - **`list`** — a fancy bullet list with four marker styles (`accent` bar,
    `check`, `icon`, `number`); each item has a bold lead + optional supporting line.
  - **`stories`** — a collapsible backlog of user stories rendered as native
    `<details>` accordions (no JavaScript) in a single section; supports cross-doc
    `links[].ref`.
  - **`pattern`** — a GoF-style design-pattern reference card (intent · forces ·
    participants · consequences), for backend/architecture-pattern tutorials.

  Also: the `meta` block gains an optional **`logo`** field that renders in the
  document and slide cover. The getting-started doc gains the logo + an `avo skill`
  reference; a new `docs/tutorial.md` deck and a `docs/be-pattern-repository.md`
  tutorial show the new blocks. Skill, `avo block` templates, and `avo demo`
  showcase updated for all three.

### Patch Changes

- Updated dependencies
  - @avodado/core@0.7.0

## 0.14.0

### Minor Changes

- Per-slide alignment override. On top of the auto centering/top-align, a heading
  marker forces a slide's vertical alignment: `## Title {top}`, `## Title {center}`,
  or `## Title {bottom}` (the marker is stripped from the displayed title). Documented
  in the skill's "Slide decks" section.

## 0.13.0

### Minor Changes

- Slides: split on headings only, with auto vertical alignment.
  - `avo slides` no longer treats `---` as a slide break — it renders as a normal
    horizontal rule. Slides split **only** at top-level `#`/`##` headings (a doc
    with no headings still falls back to one slide per block).
  - Slide content is auto-aligned: light slides (≤1 block, little prose) stay
    vertically centered; heavier slides (stacked blocks or lots of prose) top-align,
    so dense slides read top-to-bottom instead of floating in the middle.

## 0.12.0

### Minor Changes

- Slides split by heading. `avo slides` now starts a new slide at each top-level
  Markdown heading (`#`/`##`), using the heading as the slide title; everything
  until the next heading (prose + blocks) stays on that slide. A `---` thematic
  break still forces a split, and a doc with no headings falls back to one slide per
  block. This means ordinary section-structured docs present cleanly with no special
  markup. Skill "Slide decks" section, presentation playbook, and prompt updated.

## 0.11.0

### Minor Changes

- Author-controlled slide pagination with `---`.

  `avo slides` now splits the deck on Markdown thematic breaks (`---`): everything
  between two `---` is one slide and can hold several blocks plus prose, with the
  first `#`/`##` heading as the slide title. A document with no `---` keeps the
  previous one-slide-per-block behavior. Documented in the skill (new "Slide decks"
  section) and the `presentation` prompt.

## 0.10.0

### Minor Changes

- Slide titles from Markdown headings, and stronger block routing in the skill.
  - **Slides:** a section's Markdown heading (`#`/`##`) is now the slide's title at
    the top (matching the source), instead of only the block's `title:` field — and
    it's no longer duplicated in the slide body.
  - **Skill:** every block now appears in the "which block when" decision tables, not
    just the glossary — `drivers`, `options`, `spec`, `matrix`, `anatomy`,
    `composition`, `endpoint`, `pullquote`, `layers` were being overlooked because
    they had no routing entry. Fixed the "options compared" signal (was routed to
    `table`, now `options`) and added a worked `belogic` example with UML stereotypes.

## 0.9.1

### Patch Changes

- Wrap layered `block`/`infra` band labels (the left "lane" column) to up to 3 lines
  so long layer names like "Meridian apps — one model" no longer overflow the column —
  matching the node-label and swimlane-lane wrapping.

## 0.9.0

### Minor Changes

- Add presentation blocks, `avo prompt`, and diagram-quality fixes.
  - **New blocks (49 total):** `drivers` (factor cards with icon + accent + tag),
    `options` (approaches explored — pros/cons/verdict, chosen highlighted), and
    `spec` (labelled spec sheet with an inline step-flow row).
  - **`avo prompt`** — ready-to-paste authoring prompts wired to the Document
    Playbooks (adr · situation · roadmap · cloud · rbac · api · design · runbook ·
    presentation). `avo prompt list`, `avo prompt <name>`, and `avo prompt new <name>`
    for saved custom prompts. In a terminal it copies to the clipboard; piped, it
    just prints (so `avo prompt adr | pbcopy` works).
  - **Diagram quality:** `block`/`infra` and `felogic`/`belogic` node labels now wrap
    and centre (no overflow/overlap); `swimlane` lane labels wrap; `composition` gets
    coloured per-gate cards with optional `kicker`/`source`; `belogic` kinds render
    UML stereotypes («controller» «service» «repository» «adapter» «gateway»).
  - **Skill:** the three new blocks documented (glossary, field reference, family
    examples) and a **Document playbooks** section mapping a one-line ask to a block
    stack; counts updated to 49.

### Patch Changes

- Updated dependencies
  - @avodado/core@0.6.0

## 0.8.0

### Minor Changes

- Remove the `plum` built-in theme. Six themes remain: textbook, minimal, soft,
  dark, teal, slate. `theme: 'plum'` (or `avo theme use plum`) is no longer valid —
  switch any document using it to another theme.

## 0.7.0

### Minor Changes

- Add three access-control block types and give the CLI some flair.
  - **New blocks (46 total):** `matrix` (role × resource capability grid; cells tint
    by permission level), `anatomy` (the labelled parts of a delimited string such as
    `app:feature:action`), and `composition` (effective access as intersected gates,
    `gate₁ ∩ gate₂ ∩ … = result`). All three are theme-aware HTML/CSS.
  - **CLI:** interactive `avo html|slides|pdf|theme` (and `-p` preview) now show a
    per-action banner — an ASCII avocado next to the action word in avocado-green
    cfonts, plus a fun status line — instead of the generic wordmark.
  - **Slides:** `fit()` now measures with `getBoundingClientRect`, so diagrams
    (incl. inline SVG) scale to fit without being clipped.
  - **Docs:** SKILL.md catalog, family sections, strict field reference, and
    block-selection tables updated for all new blocks; counts corrected to 46.

### Patch Changes

- Updated dependencies
  - @avodado/core@0.5.0

## 0.6.0

### Minor Changes

- - **Removed the `funnel` block** (catalog is now 43). Use `stats`, `gantt`, or a `table` instead.
  - **`pyramid` fixed** — wider flat apex and theme-derived colors so labels no longer get cut off.
  - **New `avo theme [name]` command** — interactive picker (with the cfonts banner) or `avo theme dark` to set it directly; writes `avodado.theme.json`, including a `custom` scaffold.
  - **`avo html` / `avo slides` / `avo pdf`** now show the avocado cfonts banner and a fun status line (interactive only).

### Patch Changes

- Updated dependencies
  - @avodado/core@0.4.0

## 0.5.1

### Patch Changes

- - **Per-tool skill install/update commands:** `avo claude`, `avo cursor`, `avo github`, `avo windsurf` install or refresh just that tool's adapter + the shared authoring skill (no full project scaffold).
  - **Versioned skills:** installed `SKILL.md` files now carry a `version:` stamped with the CLI version, so you can tell what's installed and re-run a command to update.
  - **`--preview` / `-p`** on `avo html` / `avo slides` / `avo pdf` — render to a temp file and open it in the browser.
  - **Slides:** the gradient rail is static again (derived from the theme accents, no animation), and slide content is now **scaled to fit** so there's no scrolling — diagrams shrink to the slide.
  - **`funnel` and `pyramid` fixed:** the pyramid apex is a flat band (top label fits), funnel stages are wide enough, labels wrap, and both follow the theme colors instead of a fixed palette.

## 0.5.0

### Minor Changes

- Gap-filling blocks (inspired by replicating a rich design doc), bringing the catalog to **44**:
  - **`pullquote`** — a standout pull-quote with optional attribution.
  - **`layers`** — a layered explanation: N numbered layers, each with a kicker / title / source / question + body (e.g. an L1/L2/L3 model).
  - **`callout` gains a `success` tone** (green).
  - **`userstory` is richer** — optional `title` and `tags`, shown as a header with the points pill.

  All wired through the schema, renderer, `avo new` templates, and the authoring skill.

### Patch Changes

- Updated dependencies
  - @avodado/core@0.3.0

## 0.4.1

### Patch Changes

- Fix diagrams rendering invisible on slides: the shared SVG `<defs>` (drop-shadow filter + arrow markers) were emitted inside the first slide, which is `display:none` when inactive — and a node referencing `filter="url(#gshadow)"` from a hidden subtree is not rendered, so most diagrams vanished on other slides. The defs are now placed once at the deck root (`renderSlides` returns them separately), so every slide's diagrams resolve their filters/markers and display.

## 0.4.0

### Minor Changes

- Add a **slides / presentation export**. `avo export <doc> --format slides` produces a self-contained HTML deck — one slide for the cover and one per section — with keyboard (←/→, Home/End), button, and jump-to-section navigation, and a coloured right edge per slide. New `renderSlides` in `@avodado/render` and `toSlides` in `@avodado/export` back it (static HTML + a tiny vanilla-JS controller, no runtime dependency). Also prints cleanly (one slide per page).

## 0.3.1

### Patch Changes

- The `endpoint` block's request/response examples (and per-response examples) are now syntax-highlighted JSON — keys, strings, numbers, and `true`/`false`/`null` get theme-aware colors. Highlighting is done at render time (static colored spans, no runtime), and non-JSON snippets pass through safely uncolored.

## 0.3.0

### Minor Changes

- Add a dedicated **`endpoint`** block — a Swagger-style API endpoint card. One block captures an HTTP operation: `method` + `path`, optional `title`/`description`/`auth`, `params` (path/query/header/cookie), request-`body` fields, `responses` (status + description + example), and optional `request`/`response` examples. Method and status codes are colour-coded. The block catalog is now 42 types; `avo new --type endpoint` scaffolds a starter, and the authoring skill documents it.

### Patch Changes

- Updated dependencies
  - @avodado/core@0.2.0

## 0.2.7

### Patch Changes

- Edge/relationship labels are now drawn in a final pass — on top of all lines and nodes — in **every** diagram block. The remaining ones that still drew labels inline (`felogic`/`belogic`, `graph`, `swimlane`, `cluster`, and the `erd` relation label) are fixed, so a connector line never crosses out a label anywhere.

## 0.2.6

### Patch Changes

- Zone/container styling for `infra`, `network`, `block`, `event`, `ddd` is more elegant: the group boundaries lose their tinted background and solid label badges in favour of a clean dashed outline with a plain top-left label (matching the `felogic`/`belogic` look), and the containers + overall diagram get noticeably more padding so nodes and connections breathe.

## 0.2.5

### Patch Changes

- - **Square-left accent cards everywhere.** The remaining diagram blocks with a left accent stripe — `cluster`, `frontend`, `mece` — now use the same flush square-left corner as the others, so no diagram has the "weird" rounded notch behind the stripe.
  - **`uml`** markers are smaller and fixed-size (the composition/aggregation diamonds no longer look oversized), and the class boxes are a touch narrower.

## 0.2.4

### Patch Changes

- - **`uml`** relationship markers (especially the composition/aggregation diamonds) are smaller, so they read in proportion to the now-compact class boxes.
  - **`infra`/cloud** reverts to the stripe-style service cards (the look that worked) and instead gives the zone/group containers noticeably more interior padding so nodes aren't cramped against the boundary.

## 0.2.3

### Patch Changes

- - **`uml` class diagrams reworked.** Classes are laid out with dagre using their real sizes and relationships are routed through dagre's points as smooth, rounded paths (same engine as the ERD) — so arrows no longer overlap or read as jagged. Boxes and markers are smaller and theme-aware.
  - **`infra` / cloud diagrams redesigned** in the style of AWS/GCP/Azure architecture diagrams: each service is a clean white card with a coloured icon badge, the service name, and an optional type line. Nodes without a glyph show their initial in the badge.

## 0.2.2

### Patch Changes

- - **Square-left accent cards.** Diagram nodes with a left accent stripe (`c4`, `felogic`/`belogic`, `infra`/`block`/`network`/`event`/`ddd`) now have square top-left/bottom-left corners so the stripe sits flush — no more "weird" rounded notch. Right corners stay rounded.
  - **Cloud/infra now matches the `felogic` look** — same card proportions and flush-stripe treatment, plus the earlier extra padding for zone boxes.
  - **`uml` classes are smaller again** (narrower boxes, smaller fonts, wider gaps) so relationship arrows have room and stop overlapping.

## 0.2.1

### Patch Changes

- Diagram rendering polish:
  - **Edge labels are never crossed out.** All diagram renderers (`flow`/`dag`, `c4`, `state`, `dfd`, `uml`, `block`/`infra`/`event`/`ddd`/`network`) now draw labels in a final pass, on top of the lines and nodes — fixing the "state lifecycle" labels being struck through by later transitions. Label pills are theme-aware.
  - **`dfd`** boxes are smaller with more separation so flow labels fit between them.
  - **`c4`** person nodes draw the persona glyph in the top-right corner, clear of the title/description text.
  - **`uml`** class boxes and fonts are smaller; the class boxes and compartment rules now follow the theme.
  - **`infra`/`block`/`network`/etc.** get more outer padding/margin and theme-aware layered-mode colors.
  - Left-accent blocks (`callout`, `userstory`, `toc`, kanban cards) have square accent (left) corners and rounded right corners.

## 0.2.0

### Minor Changes

- - **Auto-layout for the coordinate diagrams.** `flow`/`dag`, `c4`, `state`, `dfd`, and `uml` no longer require `col`/`row` on every node — when coordinates are omitted, a clean layered grid is derived from the edges (dagre) so you can declare just nodes + relationships. Explicit `col`/`row` are still honored exactly (fully backward-compatible).
  - **ERD crow's-foot notation.** Relations now render proper crow's-foot ends (one / many) derived from `card`, and show the relation `label` on the edge. Added `N:1` to the `card` values (the common many-to-one shape).

### Patch Changes

- Updated dependencies
  - @avodado/core@0.1.0

## 0.1.2

### Patch Changes

- ERD relations now connect at the **field level** — each edge is routed from the foreign-key row in the source entity to the primary-key row in the target entity (arrowhead into the PK row), instead of attaching at the box centre. dagre still handles box placement; edges route orthogonally through the gap between boxes.

## 0.1.1

### Patch Changes

- - **ERD block remodeled** — entity placement and edge routing are now computed with a real graph-layout pass (dagre), so boxes don't overlap and relations route cleanly around them instead of cutting across the diagram. Foreign keys still point an arrowhead into the target entity (FK → PK), with cardinality labels on the edges. Entities longer than 10 columns are truncated with a "… +N more" row for readability.
  - **Textbook theme now uses a sans-serif typeface** (warm palette, larger headings, and cream paper are unchanged).

## 0.1.0

### Minor Changes

- - **New default theme `textbook`** — a warm, classic, printed-page look: cream paper, deep academic navy + terracotta accent, serif display & body, and larger headings. The former default is still available as the `minimal` theme.
  - **ERD foreign keys now connect FK → PK** — relations attach to the foreign-key row in the source entity and point an arrowhead into the primary-key row of the target (instead of generic top-edge arrows). ERD colors now follow the active theme.
  - **`avo init` installs one unified skill across tools** — the same `avodado-docs` skill (`SKILL.md`) is written into each tool's native skill location (Claude Code, Cursor, Windsurf) plus a Copilot prompt file, and **agents** are generated where supported (Claude Code, GitHub Copilot). Instruction files are now consistent pointers.
  - Removed the dead `$schema` URL from the scaffolded `avodado.config.json`.

## 0.0.2

### Patch Changes

- Replace the default theme with `minimal` — a clean, modern, Vercel-style look (white paper, near-black ink, a single `#0070f3` blue accent, geometric sans, subtle rounding). The `navy`/editorial theme is removed; `minimal` is now the default.
- Updated dependencies
  - @avodado/core@0.0.2

## 0.0.1

### Patch Changes

- aaa2610: Initial public release (0.0.1).
  - **@avodado/core** — parser, Zod schemas for all 41 block types, the typed block
    registry, document validator with precise diagnostics (line/column, did-you-mean,
    hints), and the cross-document reference resolver.
  - **@avodado/render** — `renderDocument` (standalone styled HTML) and
    `renderDocumentParts` (embeddable parts: CSS + body + sections) with inline SVG
    diagrams and 6 themes.
  - **@avodado/export** — HTML + PDF export (PDF via Playwright, optional).
  - **@avodado/cli** — the `avo` CLI: `init / new / check / render / preview / export /
sync`, with a code-frame diagnostics UI and the authoring skill scaffolder.
  - **@avodado/sync** — generate Avodado docs from external sources (OpenAPI).
  - **@avodado/mcp** — Model Context Protocol server exposing the doc tooling to any
    MCP client.

- Updated dependencies [aaa2610]
  - @avodado/core@0.0.1
