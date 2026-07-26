# @avodado/studio

## 0.11.0

### Minor Changes

- ca204e7: Studio can now run with no server behind it, and every document is shareable as a link.

  Storage sits behind one interface (`StudioBackend`) with two implementations: the
  file bridge `avo studio` already used, and an in-tab vault for a hosted studio.
  The package ships both builds — `dist/app` for the CLI and `dist/web` for a
  static host — so `avo studio` is unchanged: same file bridge, same `docs/*.md`
  as the source of truth, same PDF and PowerPoint export.

  The hosted build hides what needs a server (PDF, PowerPoint, the built site,
  file-change events) rather than offering buttons that fail, and keeps everything
  the browser does on its own: editing, validation, rendering and presenting.

  **Share** copies a link that carries the whole document, deflated into the URL
  fragment — nothing is uploaded and nothing expires. Hold ⇧ for a link that opens
  straight into the deck.

## 0.10.5

### Patch Changes

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

- a9213cf: `{source: …}` no longer leaks into a page heading. The deck stripped it; the
  document renderer only knew the alignment markers, so `## Title {source: …}`
  rendered the marker verbatim on the page.

  The three places that had to agree about what a heading says now share one
  definition in `@avodado/core` (`stripHeadingMarkers`, `readSourceMarker`,
  `readAlignMarker`) — the page renderer, the deck, and `trailingHeading`, which
  feeds block titles and the sections nav and stripped nothing at all.

  On a page the source isn't dropped, it's printed: a small provenance line under
  the heading, matching what the deck puts in the slide footer.

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

## 0.10.4

### Patch Changes

- b418ed2: A deck embedded with `<iframe srcdoc>` no longer throws on every slide change.
  The navigation writes the slide number to the URL hash, and `replaceState`
  raises a `SecurityError` against the opaque origin a `srcdoc` document gets —
  `avo compare` and any site embedding a deck logged one error per slide. The
  hash is a convenience, not the navigation itself, so an embedded deck now
  simply goes without it.

## 0.10.3

### Patch Changes

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

## 0.10.2

### Patch Changes

- 2cde519: Diagrams auto-lay out **left-to-right** instead of top-to-bottom. A `flow` or
  `c4` written as just nodes + edges used to come back as a tall column of ranks
  that outgrew the page and shrank to a thin strip on a slide; it now runs across
  the page, matching `state`, `dfd`, `felogic`, and `block`, which already did.

  New `dir: LR | TB` on `flow`, `state`, `dfd`, `c4`, `felogic`, and `block` asks
  for the other direction — it steers the auto-layout only, so diagrams with
  `col`/`row` on their nodes render exactly as before. The showcase's `variant:
dag` pipeline and the authoring skill were updated to match.

## 0.10.1

### Patch Changes

- a911135: Rebuild Studio's browser bundle with @avodado/render 0.26.1 so the Studio
  canvas highlights `lang: markdown` snippets like the CLI exports do. (Studio
  bundles the renderer at its own publish time — the previous release shipped
  the new renderer to the CLI but not to the Studio canvas.)

## 0.10.0

### Minor Changes

- 4c95ee6: PowerPoint export: `avo pptx doc.md` (and a PowerPoint entry in Studio's
  Export menu) turns any doc into a real `.pptx`. Each deck slide is driven in
  headless Chromium exactly as it presents — themes, diagrams, the slide fitter —
  and photographed at 2× into a full-bleed 16:9 image slide, with slide titles
  as speaker notes. Uses the same auto-installed Chromium as `avo pdf`.

## 0.9.0

### Minor Changes

- af9bae9: **Annotate sequence steps from the canvas.** Select a message in a sequence
  diagram and a "＋ add note ②" button (and an `n` shortcut, taught in the hint
  chip) opens the editor focused on that message's `summary` — the annotation
  appears automatically in the Step-by-step list under the diagram with the SAME
  reference number as the diagram badge (the list now shows real message numbers,
  so a note on step 4 reads ④ even when steps 1–3 have none). Structured edits on
  terse sugar items (arrow messages, string cards…) now materialize the item to
  its object form first instead of failing silently — annotating a one-liner
  message just works, and untouched siblings keep their terse spelling.

## 0.8.0

### Minor Changes

- 1dd0752: **Studio doc view now reads like the site.** A left sidebar lists the
  project's documents (the open one highlighted) with a "‹ Home" link and a
  New-doc entry — pick on the left, the doc displays and edits on the right
  (collapses on narrow windows, where the top-bar switcher takes over). And the
  cover is its own edit surface: hover the rendered cover for an "✎ Edit cover"
  chip and click to open the cover editor — the detached gray placeholder strip
  is gone. Keyboard block-roving starts at the first real block.

## 0.7.0

### Minor Changes

- f8b303a: **Streamlined Studio navigation — no modes to learn.** The Home | Edit | Site |
  Present segmented switch is gone. Studio is now just pages and actions, like a
  website: **Home** (the doc grid — click the wordmark to return) → click a card
  and you're **in the doc**, viewing and editing the same rendered surface.
  **▶ Present** is a button (⇧⌘P, Esc returns), and **Site ↗** opens the built
  docs site in its own browser tab — pointed at the current doc when you're in
  one. The top bar stays contextual: editing chrome only appears inside a doc.

## 0.6.0

### Minor Changes

- c56f620: **Studio opens on a Home page** — a front page for your docs, like a site
  landing. A searchable card grid (most recently edited first) with each doc's
  title, slug, and last-edited time; click a card to edit, hover for a one-click
  Present; a dashed "New doc" card opens the template picker; "Browse the site"
  jumps to Site mode. The wordmark is now a Home button, the mode switch gains
  Home | Edit | Site | Present, and the top bar hides doc-editing chrome (save
  state, autosave, export, undo) while on Home.

## 0.5.1

### Patch Changes

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

## 0.5.0

### Minor Changes

- d143316: Add a **Theme Generator** to Avodado Studio. A "Theme" button in the toolbar
  opens a right-docked panel where you pick a base theme and tune the 11 friendly
  colors + 3 font slots, with the canvas re-tinting live as you edit. **Install**
  writes a `*.theme.json` into the project's `.avodado/themes` (or `~/.avodado/themes`
  for a global theme) via a new `POST /api/theme` route on the file bridge, and
  activates it — so it immediately appears in the theme picker and in `avo theme`.

## 0.4.0

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

## 0.3.1

### Patch Changes

- Custom themes become first-class, and the wordmark goes full avocado.
  - Fixed: installing or referencing a custom theme no longer fails with
    "theme must be one of:" — `avodado.theme.json` accepts built-in names,
    installed theme names, and self-titled theme files; unresolvable names get
    an error listing your installed themes alongside the built-ins.
  - Fixed: the studio theme picker now lists every installed theme (project and
    global) next to the six built-ins, with the on-disk theme selected on load.
  - Fixed: changing the theme while studio is open (including `avo theme
--global`, which previously emitted no change event) repaints live, with a
    "Theme changed on disk — applied" note. In-studio picks are session
    previews; the file on disk stays the source of truth.
  - The `avo init` wordmark is now chunky block letters in the avocado-green
    gradient, matching the per-command action banners.

## 0.3.0

### Minor Changes

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

## 0.2.0

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

## 0.1.0

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
