# @avodado/cli

## 0.38.0

### Minor Changes

- 231e807: `avo compare [family]` (also `avo explore compare`): one page showing every
  block type rendered BOTH ways — the document card beside a live one-slide
  deck (real slide CSS + fitter in an iframe) — with a Doc / Slide / Both
  toggle and per-family navigation. Examples come from the built-in showcase;
  pass a family id to narrow the page.

## 0.37.2

### Patch Changes

- a911135: Rebuild Studio's browser bundle with @avodado/render 0.26.1 so the Studio
  canvas highlights `lang: markdown` snippets like the CLI exports do. (Studio
  bundles the renderer at its own publish time — the previous release shipped
  the new renderer to the CLI but not to the Studio canvas.)
- Updated dependencies [a911135]
  - @avodado/studio@0.10.1

## 0.37.1

### Patch Changes

- aba44c3: Markdown-aware snippet highlighting: a `code` block (or steps/gallery snippet)
  with `lang: markdown` (or `md`/`mdx`) now colors headings, **bold**, _italic_,
  inline code, links, list markers and blockquotes in the dark code card — and
  fenced code inside the sample still gets generic token highlighting. Any other
  `lang` value keeps the existing universal tokenizer.
- Updated dependencies [aba44c3]
  - @avodado/render@0.26.1
  - @avodado/studio@0.10.0

## 0.37.0

### Minor Changes

- efe9172: Editable PowerPoint: `avo pptx --editable` emits native PowerPoint elements —
  text boxes with real bullets, tables, dark code boxes, stat cards, callouts,
  quotes, and actual PowerPoint charts for `chart` blocks — so the deck's words
  are editable in PowerPoint. Only diagram blocks (sequence, flow, ERD, C4, …)
  are placed as crisp screenshots, and Chromium only launches when a document
  actually contains one. The render package now exposes each slide's structured
  `parts` (prose text / block type + data) on the slide model for
  structure-aware exporters.

### Patch Changes

- Updated dependencies [efe9172]
  - @avodado/render@0.26.0
  - @avodado/studio@0.10.0

## 0.36.0

### Minor Changes

- 4c95ee6: PowerPoint export: `avo pptx doc.md` (and a PowerPoint entry in Studio's
  Export menu) turns any doc into a real `.pptx`. Each deck slide is driven in
  headless Chromium exactly as it presents — themes, diagrams, the slide fitter —
  and photographed at 2× into a full-bleed 16:9 image slide, with slide titles
  as speaker notes. Uses the same auto-installed Chromium as `avo pdf`.

### Patch Changes

- Updated dependencies [4c95ee6]
  - @avodado/studio@0.10.0

## 0.35.19

### Patch Changes

- 808891d: Code presents at presentation scale on slides: 16px type (the doc page keeps
  12.5px), and a lone tall snippet (18+ lines) splits into a two-column spread —
  left column first, like a printed listing — so it fills the stage at full size
  instead of shrinking to half scale. Long lines wrap inside the columns, and
  the split only happens when the syntax-highlight markup divides cleanly. The
  "Structure your prompts"-style template went from an effective 10px strip to
  15.5px across 98% of the stage.
- Updated dependencies [808891d]
  - @avodado/render@0.25.11
  - @avodado/studio@0.9.0

## 0.35.18

### Patch Changes

- 460ef16: Slides: title cards center properly and title themselves.
  - The cover's title + subtitle sit at the true vertical center (trailing doc
    margins no longer skew the flex centering).
  - A slide that is only a `divider` is its own title card: no stale section
    heading above the PART band, and the jump menu lists it by the band's title.
  - Untitled leading-prose slides drop the meaningless "Slide" header.

- Updated dependencies [460ef16]
  - @avodado/render@0.25.10
  - @avodado/studio@0.9.0

## 0.35.17

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

- Updated dependencies [23228b7]
  - @avodado/render@0.25.9
  - @avodado/studio@0.9.0

## 0.35.16

### Patch Changes

- 0451174: Slides: the stage-column treatment now covers every stacked text block —
  `agenda`, `spec`, `inventory`, `slo`, `okr`, and `risk` join list/takeaways/
  steps/faq/glossary/prose lists (2 columns at 4+ items, 3 at 8+). Blocks that
  are already grids (team, persona, drivers, gallery) or whose vertical order is
  the point (layers, changelog) are untouched. Also fixes the terse OKR
  key-result sugar: `· 60` / `· 60%` now lands as the schema's 0-1 fraction, so
  progress bars show the real percentage instead of clamping to 100%.
- Updated dependencies [0451174]
  - @avodado/render@0.25.8
  - @avodado/core@0.16.1
  - @avodado/studio@0.9.0

## 0.35.15

### Patch Changes

- 77e1003: Slides: tall text lists break into stage columns, and the cover centers.
  - `list`, `takeaways`, `steps`, `faq`, `glossary`, and long prose lists flow
    into 2 columns at 4+ items and 3 at 8+ — horizontal space instead of one
    skinny centered strip the fitter would shrink. Short lists keep their single
    column.
  - The cover slide's subtitle (and the whole title column) is properly centered
    on the stage.

- Updated dependencies [77e1003]
  - @avodado/render@0.25.7
  - @avodado/studio@0.9.0

## 0.35.14

### Patch Changes

- 8462fab: `avo -v` prints the version (lowercase, what fingers type) — `-V` and
  `--version` still work.

## 0.35.13

### Patch Changes

- 75a0648: `avo --version` (and the studio's version reporting) works again after the
  package rename — the version lookup accepted only the old `@avodado/cli` name
  and fell back to `0.0.0`.

## 0.35.12

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
- Updated dependencies [af9bae9]
  - @avodado/studio@0.9.0
  - @avodado/render@0.25.6

## 0.35.11

### Patch Changes

- 1dd0752: **Studio doc view now reads like the site.** A left sidebar lists the
  project's documents (the open one highlighted) with a "‹ Home" link and a
  New-doc entry — pick on the left, the doc displays and edits on the right
  (collapses on narrow windows, where the top-bar switcher takes over). And the
  cover is its own edit surface: hover the rendered cover for an "✎ Edit cover"
  chip and click to open the cover editor — the detached gray placeholder strip
  is gone. Keyboard block-roving starts at the first real block.
- Updated dependencies [1dd0752]
  - @avodado/studio@0.8.0

## 0.35.10

### Patch Changes

- f8b303a: **Streamlined Studio navigation — no modes to learn.** The Home | Edit | Site |
  Present segmented switch is gone. Studio is now just pages and actions, like a
  website: **Home** (the doc grid — click the wordmark to return) → click a card
  and you're **in the doc**, viewing and editing the same rendered surface.
  **▶ Present** is a button (⇧⌘P, Esc returns), and **Site ↗** opens the built
  docs site in its own browser tab — pointed at the current doc when you're in
  one. The top bar stays contextual: editing chrome only appears inside a doc.
- Updated dependencies [f8b303a]
  - @avodado/studio@0.7.0

## 0.35.9

### Patch Changes

- c56f620: **Studio opens on a Home page** — a front page for your docs, like a site
  landing. A searchable card grid (most recently edited first) with each doc's
  title, slug, and last-edited time; click a card to edit, hover for a one-click
  Present; a dashed "New doc" card opens the template picker; "Browse the site"
  jumps to Site mode. The wordmark is now a Home button, the mode switch gains
  Home | Edit | Site | Present, and the top bar hides doc-editing chrome (save
  state, autosave, export, undo) while on Home.
- Updated dependencies [c56f620]
  - @avodado/studio@0.6.0

## 0.35.8

### Patch Changes

- ed6dde6: Edge-step numerals (① ② ③) dodge node boxes — a long edge's midpoint can land
  on a node in tight layouts, which printed the badge over the node's label.
  Badges now nudge off any node box along the edge's axis, and keep clear of
  each other when two edges share a corridor. Diagrams without collisions render
  byte-identically.
- Updated dependencies [ed6dde6]
  - @avodado/render@0.25.5
  - @avodado/studio@0.5.1

## 0.35.7

### Patch Changes

- b55ae7e: Decks show diagrams complete on slide entry — the progressive ① ② ③ step
  reveal is removed; navigation is one press per slide again.
- Updated dependencies [b55ae7e]
  - @avodado/render@0.25.4
  - @avodado/studio@0.5.1

## 0.35.6

### Patch Changes

- 402174b: **Terse sugar everywhere.** Eleven more fields accept one-line string items:
  - **Diagrams:** `dfd.edges`, `swimlane.links` + `lanes`, `c4.edges`,
    `cluster.links` take `a -> b: label`; `state.transitions` take
    `idle -> active: submit` (the label is the event); `flow`/`graph`/`block`/
    `dfd`/`state` **nodes** take `rx: Receive` — or just `Receive` (a bare name
    is both id and label, so a whole sketch is `nodes: [Receive, Check]` +
    `edges: [Receive -> Check]`); `erd` columns take `id uuid pk` /
    `org_id: uuid fk`.
  - **Cards:** `stats` take `p95 · 120ms · -30%` (trend inferred from the delta
    sign); `team.members` take `Ana · Backend · payments`; `agenda.items` take
    `09:00 · 20m · Standup — round robin` (time/duration detected by shape);
    `okr` key results take `[on-track] Signups · 60%`.

  Object forms are untouched and mix freely; the skill's terse-grammar table
  documents every form.

- Updated dependencies [402174b]
  - @avodado/core@0.16.0
  - @avodado/render@0.25.3
  - @avodado/studio@0.5.1

## 0.35.5

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
  - @avodado/render@0.25.2
  - @avodado/studio@0.5.1

## 0.35.4

### Patch Changes

- c7de193: Diagrams shed their page-card chrome on slides: no border box, tag pill, fig
  number, or dashed rule inside a slide — the slide itself is the card, so
  sequence/flow/architecture diagrams now sit directly on the stage at full
  presentation scale.
- Updated dependencies [c7de193]
  - @avodado/render@0.25.1
  - @avodado/studio@0.5.1

## 0.35.3

### Patch Changes

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

- Updated dependencies [1b44c6c]
  - @avodado/render@0.25.0
  - @avodado/studio@0.5.1

## 0.35.2

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

- Updated dependencies [0d9c992]
  - @avodado/core@0.14.0
  - @avodado/render@0.24.0
  - @avodado/studio@0.5.1

## 0.35.1

### Patch Changes

- 43a45ea: **The heading titles the block.** A `##` heading directly above a block now
  titles it: a near-duplicate block `title` is suppressed at render (no more two
  stacked headings saying the same thing — healed in HTML, slides, Studio, and
  PDF), and a title-less block inherits the heading into the sections nav. The
  Markdown-native way to write docs is now simply: put the title in the heading
  and skip `title:` in the YAML.

  The `W_DUP_HEADING` warning is removed (the condition is auto-healed), and core
  exports `trailingHeading` alongside `isNearDuplicateTitle`. The authoring skill
  teaches the new rule.

- Updated dependencies [43a45ea]
  - @avodado/core@0.13.0
  - @avodado/render@0.23.0
  - @avodado/studio@0.5.0

## 0.35.0

### Minor Changes

- d143316: Add a **Theme Generator** to Avodado Studio. A "Theme" button in the toolbar
  opens a right-docked panel where you pick a base theme and tune the 11 friendly
  colors + 3 font slots, with the canvas re-tinting live as you edit. **Install**
  writes a `*.theme.json` into the project's `.avodado/themes` (or `~/.avodado/themes`
  for a global theme) via a new `POST /api/theme` route on the file bridge, and
  activates it — so it immediately appears in the theme picker and in `avo theme`.

### Patch Changes

- Updated dependencies [d143316]
  - @avodado/studio@0.5.0

## 0.34.1

### Patch Changes

- Fix the npm README title — the heading now reads `avodado` instead of the old
  `@avodado/cli` package name.

## 0.34.0

### Minor Changes

- 7052a5d: Rename the CLI package `@avodado/cli` → **`avodado`** (unscoped) for
  discoverability: `npm i -g avodado`, `npx avodado`, and the command is available
  as both `avo` and `avodado`. `@avodado/cli` is deprecated and points here.

  Also improve the npm READMEs: the CLI README opens with a worked example (a
  Markdown doc with a `sequence` block → `avo check` / `avo html` / `avo studio`)
  in plainer language; the core README lists the real block-type set (77 across 12
  families) instead of a stale short list.

### Patch Changes

- Updated dependencies [7052a5d]
  - @avodado/core@0.12.1
  - @avodado/render@0.22.1
  - @avodado/studio@0.4.0

## 0.33.0

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
  - @avodado/render@0.22.0
  - @avodado/studio@0.4.0

## 0.32.1

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

- Updated dependencies
  - @avodado/studio@0.3.1

## 0.32.0

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
- Updated dependencies
  - @avodado/render@0.21.0
  - @avodado/core@0.11.0
  - @avodado/studio@0.3.0

## 0.31.1

### Patch Changes

- Brand favicon + studio review-before-write mode.
  - render: new brand exports (`FAVICON_SVG`, `FAVICON_DATA_URI`, `FAVICON_LINK`)
    — a clean avocado favicon, now on every rendered page (`avo html`/`preview`).
  - cli: `avo serve`/`avo build` pages and slide decks carry the favicon.
  - studio: the tab icon matches; **review mode** — with autosave off, the save
    chip reads "Unsaved · N changes" and saving opens a review dialog listing
    edited / added / removed / reordered blocks with Apply / Cancel, so nothing
    touches the file until approved. Deleting a block or diagram part asks first
    (double-⌫ confirms; pristine just-inserted scaffolding deletes silently).

- Updated dependencies
  - @avodado/render@0.20.0
  - @avodado/studio@0.2.0
  - @avodado/export@0.3.2

## 0.31.0

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
  - @avodado/render@0.19.0
  - @avodado/studio@0.1.0
  - @avodado/export@0.3.1
  - @avodado/sync@0.0.12

## 0.30.3

### Patch Changes

- The Copilot adapter installs a real Agent Skill. GitHub Copilot now supports Agent Skills (the same SKILL.md folder format) in `.github/skills/` — `avo init` / `avo install copilot` install the canonical skill folder there (hub + `reference/` spokes, progressive disclosure intact) instead of the old stitched `.github/prompts/avodado-docs.prompt.md` single file. The stitched form remains behind `avo skill` and the MCP embed for surfaces without skill support.

## 0.30.2

### Patch Changes

- Piped `avo --help` output is now genuinely ANSI-free even when a `CI` environment variable is set (picocolors treats CI as color-friendly, which colored the grouped help epilogue on runners and broke pipe-cleanliness); e2e assertions are environment-deterministic.

## 0.30.1

### Patch Changes

- avo tour v2: step back/forward (arrows, b, 1-7 jump), memoized chapters that never re-run side effects, prominent command cards showing the exact avo command per step, progress dots, key legend, and o to re-open the browser.

## 0.30.0

### Minor Changes

- Agentic blocks, 106-pattern library, the full shape language, and a restructured skill. **AI & agents family** (79 → 83 blocks): `agentloop` (agent + tools + memory with numbered loop arrows and a stop-condition pill), `trace` (execution transcript with thinking and tool calls), `prompt` (prompt anatomy with highlighted `{{variables}}`), `context` (context-window token budget bar with overflow) + an Agent-system-doc playbook. **Design library 80 → 106**: interpreter (the 23rd GoF), architecture classics (mvc, mvvm, dependency-injection, unit-of-work, active-record, data-mapper, event-bus, specification, null-object), resilience/concurrency/messaging (retry-backoff, bulkhead, timeout, cache-aside, throttling, actor-model, producer-consumer, thread-pool, competing-consumers, splitter-aggregator), and agentic patterns (plan-and-execute, human-in-the-loop, agentic-rag, swarm-handoff, chain-of-thought, context-compaction). **Diagram elegance**: labeled C4 edges (and dense block-family diagrams) render as circled step numerals with a legend below; C4 tech renders as a chip; all node cards drop the left accent bar for the clean rounded agent-card look. **Shape language, 21 silhouettes by kind**: cylinder, tiered cylinder (warehouse), pail (S3), sharded trio, replica set, pipe, cloud, hexagon (gateway), octagon (lb), instance stack (cache + worker pools), server rack, shield (waf), actor figure, crowd, browser window, phone, ƒ circle (lambda), clock (cron), vault dial (secrets), globe (region), clean card — plus new kinds shard/replica/users/crowd/region/geo. **Skill restructured** for progressive disclosure: a 598-line hub (down from 2,373) + `reference/` spokes (blocks contract, system design, decks, and new per-document intake checklists with a batched ask-back protocol); `avo skill`, the Copilot adapter, and the MCP embed stitch everything into one prompt; `avo init` installs the full folder. **Plus**: a new `archmap` block (83 → 84) — the target-architecture capability mosaic with status-coded tiles (current/target/new/gap/deprecated) and an auto-legend; the shape language extends into `belogic`/`felogic` (db → cylinder, queue → pipe, cache → stack, external → cloud), `c4` (`store` → true database cylinder), and `cluster`; secrets render as a padlock and schedulers as the industry-standard calendar-with-clock; the ERD is restyled (tinted header band, content-sized entities, zebra rows, PK/FK chips); and block titles no longer render twice (the section head owns the title; the block body's duplicate header is suppressed at top level).
- The documentation-tool release. **New commands**: `avo serve` (zero-dep live-reload dev server — watch, SSE reload, in-page diagnostics banner), `avo build` (docs/ → a static site: index cards, sidebar nav with per-doc sections, cross-doc `doc#id` refs rewritten to real links), `avo mcp` (setup snippets + `--stdio` server), `avo install <tool>` (claude/cursor/copilot/windsurf — replaces the old per-tool commands, Copilot correctly named), `avo tour` (interactive 7-chapter terminal onboarding with a live-caught planted bug), `avo demo [family]` (filtered showcases with an interactive picker). **Removed**: the duplicate `render` command (use `html`). **Render**: blocks with an `id:` emit real anchors + `data-block-id`; userstory/stories ref chips are real links; C4 goes professional (level-aware `C4 · CONTAINER` tag, centered structurizr-style typography, dashed externals, legend derived from the kinds present, taller cards) and the layered architecture drops its solid label slabs for tinted zone bands with optional per-layer `color`. **Catalog** groups all blocks by family. **Skill**: `reference/blocks/` per-family split with INDEX + whole contract table (coverage-tested), trimmed trigger frontmatter, new "Organizing a documentation set" + "Reviewing an existing doc" + "C4 done right" guides. **Slides** gain an automated gate (full-demo deck + split-layout tests). New professional cfonts wordmark + one-line banner (ANSI-free when piped) and purpose-grouped help.
- Twelve more blocks (67 → 79) plus consulting-style decks. **Engineering & decisions**: `waterfall` (latency/cost budget cascade with a dashed budget line and over/under chip), `heatmap` (numeric grid with intensity ramp + legend), `scorecard` (weighted decision matrix with computed totals and winner highlight), `risk` (register with likelihood × impact severity chips), and `chart` gains a `radar` kind. **Design system** (new family): `palette` (color-token swatches with auto-contrast labels), `typescale` (live type specimen), `dodont` (Do/Don't guideline cards), `inventory` (component status board) + a Design-system doc playbook in the skill. **Algorithms & data structures** (new family): `array` (cells, indices, pointer labels, window highlight), `linkedlist` (singly/doubly with head/curr markers), `bintree` (binary tree with per-node walkthrough states), `hashmap` (buckets + collision chains); `graph` gains node `state` (visited/current/frontier/target) and edge `weight` for BFS/Dijkstra walkthroughs. **Decks**: `{split}` heading marker renders the consulting layout (message left, exhibit right), every slide gets a footer (deck title · page number), and the skill gains a Consulting-style decks section (action titles → one exhibit → takeaway). Also fixes `avo <cmd> | head` leaving an unsettled flush await.
- Fourteen new block types — the catalog grows from 53 to 67. **Everyday primitives**: `chart` (bar / line / area / donut, pure SVG), `figure` (image + caption), `diff` (unified +/− code diff on the dark editor surface), `steps` (numbered runbook stepper with per-step commands), `faq` (Q&A accordions). **System design**: `envelope` (back-of-envelope capacity math — assumptions → derivation rows → highlighted result), `slo` (service objectives with error-budget burn bars), `terminal` (shell session, distinct from code). **Business & strategy**: `swot`, `funnel` (conversion trapezoids with stage-to-stage %), `okr` (objectives + key-result progress bars), `persona` (user persona cards), `changelog` (release rail with typed change chips), `team` (people cards). All fully registered: strict schemas, renderers + CSS in the house style, `avo block` scaffolds, catalog descriptions, demo showcase sections, and skill documentation (glossary, contract table, examples, new Business & strategy family).
- Presentation text blocks + a full template set. **Three new blocks (84 → 87)**: `divider` (deck part-break interstitial — kicker, big title, accent wash), `bignumber` (the hero-stat slide: one huge figure + claim + context), `takeaways` (numbered presentation-scale closing statements). Dividers render full-width on slides; blocks whose title _is_ the visual no longer have it lifted into the section head; `{split}`/`{top}` heading markers no longer leak into HTML doc headings. **`avo template` grows from 1 to 11**: adr, design-doc, runbook, roadmap, api-spec, system-design, agent-system, design-system, postmortem, data-model, and a `deck` template demonstrating the consulting formula (divider → `{split}` argument slides → bignumber → takeaways) — every template schema-validated by tests and namespaced so several scaffold cleanly into one repo. The skill's deck guide covers when to use each, and the playbooks table maps each playbook to its template.
- System-design diagram overhaul. **Quick mode**: `col`/`row` are now optional on the block family, `graph`, and `felogic`/`belogic` — omit coordinates and the layout is computed from the edges. **Canonical shapes by kind**: db/store/warehouse render as cylinders, queue/topic/stream as horizontal-cylinder pipes, cdn/external as clouds, gateway/lb/proxy as hexagons, cache/redis as stacked-instance cards. **~40 new node kinds** with glyphs (dns, waf, auth/idp, monitor, scheduler, stream, warehouse, search, ml/llm/agent, vm, secrets, notification, email, ci, git, registry, device, analytics, config, …) plus vendor aliases (postgres/mysql/mongo→db, kafka/kinesis→stream, s3, sqs, redis, elasticsearch). **C4**: edge `tech:` labels, multiple named `boundaries[]`, and a fix for edge labels never rendering. **Cluster**: namespaces now sit side by side, self-sized, in the refined zone style. **UML**: content-sized class cards with tinted header compartments. **Polish**: nested infra zone labels no longer overlap, off-palette ink normalized to theme vars, graph label clamping, slide decks render text at presentation scale with a proper measure (text-only slides no longer over-scale). Skill updated throughout.

### Patch Changes

- Rework the authoring skill around a think-first method instead of fill-in templates: understand the ask and ask 2-4 clarifying questions back when the answer changes the outline, outline the story as headings before any YAML, cast blocks dynamically from the catalog (one lens per beat, varied lenses), keep one consistent cast of names across all blocks, then validate and skim. Adds a "Designing a system — reason it, don't template it" section (requirements → envelope math → contract → high-level shape → bottleneck deep-dive → trade-offs → failure modes → plan) plus rules for editing existing docs without breaking their story. Removes the duplicated block decision tables and quick index, and rewrites a dozen repetitive same-domain examples with varied system-design ones (circuit-breaker state machine, telemetry pub/sub, search platform, clickstream DFD, notifications ERD, admission-control flow, incident swimlane, payment-strategy UML, clip-platform C4).
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @avodado/core@0.9.0
  - @avodado/render@0.18.0
  - @avodado/export@0.3.0
  - @avodado/sync@0.0.11

## 0.29.0

### Minor Changes

- CLI cleanup:
  - **Removed `avo export` and `avo new`** (batch export and the old scaffolder).
    Use the one-doc `avo html|slides|pdf` for output, and `avo block`/`avo template`
    to scaffold.
  - **`avo demo`** now opens the showcase directly; pass `-s` for a slide deck
    (no more positional format).
  - **`avo catalog`** prints the block catalog (name + description) in the terminal;
    `-p` opens an HTML gallery of live samples, `-s` a slide deck.
  - **`avo design`** follows the same shape: list in the terminal, `<slug>` prints a
    template, `-p` opens the gallery and `-s` a deck (replacing `--all`); filters
    `--system`/`--ai`/`--code` still apply.
  - Skill: comparing things ("adapter vs command") routes to a `gallery` of nested
    blocks; gallery docs show text / code / diagram grids.

## 0.28.3

### Patch Changes

- Skill + showcase now document the `gallery` grid with a labelled example of each
  cell kind — grid with text (notes), grid with code, and grid with diagrams
  (nested blocks, e.g. comparing architectures side by side). `avo demo` gains a
  diagram-comparison gallery.

## 0.28.2

### Patch Changes

- Refine block styling across the board: softer two-layer shadows, larger and more
  consistent corner radii on card surfaces (drivers, options, spec, list, gallery,
  pattern, composition, code, …), roomier callouts, and a subtle elevation on
  diagram frames — a more polished, cohesive look. Skill notes that code renders on
  a dark editor surface (shared by `gallery` cells and `sequence` snippets).
- Updated dependencies
  - @avodado/render@0.17.2
  - @avodado/export@0.2.15

## 0.28.1

### Patch Changes

- Updated dependencies
  - @avodado/render@0.17.1
  - @avodado/export@0.2.14

## 0.28.0

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
  - @avodado/render@0.17.0
  - @avodado/export@0.2.13
  - @avodado/sync@0.0.10

## 0.27.2

### Patch Changes

- Updated dependencies
  - @avodado/render@0.16.0
  - @avodado/export@0.2.12

## 0.27.1

### Patch Changes

- Updated dependencies
  - @avodado/export@0.2.11

## 0.27.0

### Minor Changes

- Themes are now a global library. `avo theme install <path>` installs into
  `~/.avodado/themes/` by default, so a theme is usable in every project (use
  `--local` for project-only). `avo theme` / `theme list` show global + project
  themes together (marked), and `avo theme use <name> --global` sets a default that
  applies to every project (`~/.avodado/avodado.theme.json`) wherever a project has
  no theme of its own. `avo theme new <name> --global` scaffolds into the global
  library too.

## 0.26.3

### Patch Changes

- Make `avo design --all -s` decks readable: in slides mode each pattern is one
  clean slide — heading + one-line intent + its diagram — instead of cramming the
  full card and the diagram onto a single slide (which `fit()` shrank to nothing).
  The HTML gallery still shows the full card + diagram.

## 0.26.2

### Patch Changes

- Fix the `cdc` design pattern rendering as a thin, cramped strip: it now uses an
  `infra` banded diagram (Source → Capture → Consumers, multiple subscribers) — a
  balanced, richer shape consistent with the other system-design patterns.

## 0.26.1

### Patch Changes

- Render the `service-mesh` pattern as a `c4` container diagram (like
  `microservices`) instead of a cluster — control plane + sidecars with families,
  tech, and a boundary.

## 0.26.0

### Minor Changes

- Richer, demo-quality system-design diagrams (and fewer plain boxes): `caching`
  is now a `belogic` backend-logic chain; `microservices` a full `c4` container
  view (boundary, person, families, a datastore, an external, with tech + desc);
  `service-mesh` and `sidecar` are `cluster` diagrams with namespaces, replicas,
  and tech; `cdn` and `event-driven` use `infra` with nested zones / layered bands.
  Modeled on the `avo demo` showcase.

## 0.25.0

### Minor Changes

- Big expansion of the `avo design` library — now 80 patterns (46 system · 12 AI ·
  22 GoF) with even more diagram variety:
  - **Architecture & data**: `event-driven` (`infra` bands), `microservices`
    (`c4` containers — new shape), `event-streaming` (Kafka), `service-mesh`,
    `strangler-fig`, `bff`, `scatter-gather`, `dead-letter-queue`,
    `database-per-service`, `lambda-architecture`, `async-write`, `failover`
    (`state`), `indexing`.
  - **AI / agents** (from Anthropic's "Building Effective Agents"):
    `parallelization`, `augmented-llm`.

  The gallery now spans `uml · block (zoned) · flow · state · sequence · cluster ·
dfd · dag · c4 · infra`. README gains an at-a-glance command table; the tutorial
  gains a pattern-library slide.

## 0.24.0

### Minor Changes

- Ten more classic system-design patterns (ByteByteGo / interview style), now 33
  system patterns and 65 total — with two new diagram shapes in the gallery for
  more variety:
  - `feed-fanout` & `quorum` — zoned `block` fan-outs
  - `distributed-lock`, `webhooks`, `oauth2` (authorization-code flow),
    `two-phase-commit` — `sequence`s
  - `heartbeat` — a `state` machine (ALIVE → SUSPECT → DEAD)
  - `cdc` — a **`dfd`** data-flow diagram (new in the design gallery)
  - `cicd-pipeline` — a **`dag`** pipeline (new in the design gallery)
  - `geohashing` — a decision `flow`

  The library now spans uml · block (with zones) · flow · state · sequence ·
  cluster · dfd · dag — no two patterns look the same.

## 0.23.0

### Minor Changes

- More system-design patterns (now 23) and more elegant, varied diagrams:
  - New: `leader-election` (a `state` machine), `bloom-filter` & `backpressure`
    (decision `flow`s), `write-ahead-log` & `service-discovery` (`sequence`s),
    `sidecar` (a k8s `cluster`), `outbox` & `blue-green-deploy` (`block`s with
    labelled zone groups).
  - Existing fan-out diagrams (load-balancing, pub-sub, api-gateway, sharding) now
    use labelled zone groups, and CQRS is split into write/read zones — so the
    system diagrams no longer all look like the same boxes.

  The library is now 55 patterns (23 system · 10 AI · 22 GoF code).

## 0.22.0

### Minor Changes

- `avo design` is richer and more varied:
  - **Bespoke structure diagrams per pattern** (no more uniform graphs): GoF code
    patterns render proper **UML class diagrams** (inheritance / implementation /
    aggregation markers, interface stereotypes); system-design patterns use the
    shape that fits — `block` fan-outs, a `state` machine (circuit breaker), a
    `flow` decision (rate limiting), or a `sequence` (saga, idempotency).
  - **New AI / agent patterns** (10): `rag`, `react`, `tool-use`, `prompt-chaining`,
    `routing`, `reflection`, `multi-agent`, `guardrails`, `memory`,
    `evaluator-optimizer` — each with a fitting diagram. Filter with
    `avo design --ai` (and `--system` / `--code`).
  - The skill gains a **pattern-driven system-design playbook**: when asked to
    design a system ("a notification system, event-driven"), the agent infers
    requirements (`drivers`), presents `options` with a recommendation, grabs the
    building-block patterns via `avo design <slug>`, and assembles the architecture.

## 0.21.0

### Minor Changes

- `avo design` templates now include a **structure diagram**, not just the card:
  code patterns render a `belogic` graph (with interface/impl UML stereotypes
  inferred from the relationships) and system-design patterns render a `block`
  graph (with cache/queue/store/gateway glyphs), each with labelled edges. Applies
  to `avo design <slug>` templates and the `avo design --all` gallery.

## 0.20.0

### Minor Changes

- Add `avo design` — a library of common design patterns as ready, validated
  `pattern`-block templates. Covers 15 system-design building blocks (caching,
  sharding, replication, CQRS, event sourcing, circuit breaker, saga…) and the 22
  GoF code patterns (Strategy, Observer, Adapter, Decorator…), curated from
  common references (hellointerview "system design in a hurry" and
  refactoring.guru).
  - `avo design` lists them by category; `avo design <slug>` prints a ready
    template (copies to clipboard) or scaffolds it with `-o`.
  - `avo design --all [--system|--code] [-s]` renders the whole gallery to HTML or
    a slide deck.
  - The skill now tells agents to grab `avo design <slug>` templates instead of
    improvising a pattern from memory.

## 0.19.0

### Minor Changes

- Add `avo catalog` — render a living catalog of every block type: each block's
  identifier (the fenced type name an AI uses), a one-line description of what it
  does, and a live sample. `avo catalog -s` renders one block per slide (a handy
  reference deck); `-o <path>` writes to a file. Built from the block registry, so
  it always covers the full set.

## 0.18.1

### Patch Changes

- Don't bake the Avodado brand logo into scaffolded docs: removed the `meta.logo`
  line from the `getting-started.md` and `tutorial.md` templates that `avo init`
  generates. The optional `meta.logo` field stays available for users' own logos.

## 0.18.0

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
  - @avodado/render@0.15.0
  - @avodado/export@0.2.10
  - @avodado/sync@0.0.9

## 0.17.0

### Minor Changes

- Add `avo skill` — print the Avodado authoring grammar as a copy-paste **system
  prompt** for AI tools without a repo-file adapter (Microsoft 365 Copilot, custom
  GPTs, ChatGPT, Gemini). Prints to stdout (pipes cleanly), copies to the clipboard
  in a terminal, supports `-o <file>` and `--raw`. Also fixes large piped output
  being truncated at the 64 KiB pipe buffer on exit.

## 0.16.0

### Minor Changes

- CLI: `avo theme install` now offers to set the theme as the default after a
  successful install (interactive prompt; `--use` still forces it). `avo init` no
  longer silently skips a tool you only highlighted — pressing Enter with nothing
  toggled installs the highlighted adapter, with a clearer footer hint. Rewrote
  `docs/getting-started.md` into an 80/20 tour and added a new deck-first
  `docs/tutorial.md` (rendered with `avo slides`) covering the full block set;
  both ship with `avo init`.

## 0.15.10

### Patch Changes

- Add an `avo prompt slides` prompt for slide-specific formatting (heading-per-slide
  pagination, one idea per slide, `{top}`/`{center}`/`{bottom}` alignment markers, no
  `---` breaks), and mention the alignment markers in the `presentation` prompt.

## 0.15.9

### Patch Changes

- Per-slide alignment override. On top of the auto centering/top-align, a heading
  marker forces a slide's vertical alignment: `## Title {top}`, `## Title {center}`,
  or `## Title {bottom}` (the marker is stripped from the displayed title). Documented
  in the skill's "Slide decks" section.
- Updated dependencies
  - @avodado/render@0.14.0
  - @avodado/export@0.2.9

## 0.15.8

### Patch Changes

- Slides: split on headings only, with auto vertical alignment.
  - `avo slides` no longer treats `---` as a slide break — it renders as a normal
    horizontal rule. Slides split **only** at top-level `#`/`##` headings (a doc
    with no headings still falls back to one slide per block).
  - Slide content is auto-aligned: light slides (≤1 block, little prose) stay
    vertically centered; heavier slides (stacked blocks or lots of prose) top-align,
    so dense slides read top-to-bottom instead of floating in the middle.

- Updated dependencies
  - @avodado/render@0.13.0
  - @avodado/export@0.2.8

## 0.15.7

### Patch Changes

- Fix stale `-p` previews. `avo html|slides|pdf -p` named the temp file by the input
  path, so re-running after an edit overwrote the same file and the browser kept
  showing the cached tab. The preview file is now keyed by content (source + format
  - theme), so each edit opens a fresh tab with the new render; unchanged content
    reuses the same file.

## 0.15.6

### Patch Changes

- Slides split by heading. `avo slides` now starts a new slide at each top-level
  Markdown heading (`#`/`##`), using the heading as the slide title; everything
  until the next heading (prose + blocks) stays on that slide. A `---` thematic
  break still forces a split, and a doc with no headings falls back to one slide per
  block. This means ordinary section-structured docs present cleanly with no special
  markup. Skill "Slide decks" section, presentation playbook, and prompt updated.
- Updated dependencies
  - @avodado/render@0.12.0
  - @avodado/export@0.2.7

## 0.15.5

### Patch Changes

- Skill: add a **Presentation / deck** Document Playbook that points at the `---`
  slide model (one slide per `---`, `#` heading as title), tying the playbooks to
  the existing "Slide decks" section so agents pick it up.

## 0.15.4

### Patch Changes

- Author-controlled slide pagination with `---`.

  `avo slides` now splits the deck on Markdown thematic breaks (`---`): everything
  between two `---` is one slide and can hold several blocks plus prose, with the
  first `#`/`##` heading as the slide title. A document with no `---` keeps the
  previous one-slide-per-block behavior. Documented in the skill (new "Slide decks"
  section) and the `presentation` prompt.

- Updated dependencies
  - @avodado/render@0.11.0
  - @avodado/export@0.2.6

## 0.15.3

### Patch Changes

- Updated dependencies
  - @avodado/export@0.2.5

## 0.15.2

### Patch Changes

- Slide titles from Markdown headings, and stronger block routing in the skill.
  - **Slides:** a section's Markdown heading (`#`/`##`) is now the slide's title at
    the top (matching the source), instead of only the block's `title:` field — and
    it's no longer duplicated in the slide body.
  - **Skill:** every block now appears in the "which block when" decision tables, not
    just the glossary — `drivers`, `options`, `spec`, `matrix`, `anatomy`,
    `composition`, `endpoint`, `pullquote`, `layers` were being overlooked because
    they had no routing entry. Fixed the "options compared" signal (was routed to
    `table`, now `options`) and added a worked `belogic` example with UML stereotypes.

- Updated dependencies
  - @avodado/render@0.10.0
  - @avodado/export@0.2.4

## 0.15.1

### Patch Changes

- Updated dependencies
  - @avodado/render@0.9.1
  - @avodado/export@0.2.3

## 0.15.0

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
  - @avodado/render@0.9.0
  - @avodado/export@0.2.2
  - @avodado/sync@0.0.8

## 0.14.1

### Patch Changes

- Show which theme is currently active. The `avo theme` picker now marks the active
  theme with `✓ current` and starts with it highlighted, and `avo theme list` marks
  it and prints a "Current default:" line. The active theme is detected from
  `avodado.theme.json` (a plain built-in, a matching saved custom, or an unmatched
  custom override).

## 0.14.0

### Minor Changes

- Remove the `plum` built-in theme. Six themes remain: textbook, minimal, soft,
  dark, teal, slate. `theme: 'plum'` (or `avo theme use plum`) is no longer valid —
  switch any document using it to another theme.

### Patch Changes

- Updated dependencies
  - @avodado/render@0.8.0
  - @avodado/export@0.2.1

## 0.13.0

### Minor Changes

- Add `avo theme install <path>` and clarify `avo theme use`.
  - `avo theme install ./my.theme.json` validates any theme file (must be JSON with a
    valid base `theme` and/or recognized `colors`/`fonts`; unknown keys warn) and
    copies it into `.avodado/themes/` so it appears in the picker and `avo theme use`.
    `--use` activates it immediately; `--force` overwrites an existing saved theme.
  - `avo theme use <name>` (and the shorthand `avo theme <name>`) now confirm the
    theme is the project default.

## 0.12.0

### Minor Changes

- Add `avo demo` and cfonts banners across the rest of the commands.
  - **`avo demo [html|slides|pdf]`** renders the bundled showcase doc (every block
    type) to a temp file and opens it — a zero-setup way to see Avodado. `--no-open`
    writes without opening.
  - The interactive cfonts action banner + fun line now also show on `new`, `check`,
    `render`, `export`, `preview`, `demo`, and the `claude`/`cursor`/`github`/
    `windsurf` installers (previously only `html`/`slides`/`pdf`/`theme`). `init`
    keeps its full wordmark.

## 0.11.0

### Minor Changes

- Auto-provision Chromium for PDF, and teach the authoring skill to repurpose blocks
  and title intelligently.
  - **PDF "just works":** `avo pdf` and `avo export --format pdf` now download the
    matching Chromium on first use instead of failing with a cryptic Playwright
    error. The download uses the _bundled_ Playwright's own CLI, so the browser
    build always matches the library version (no more "Executable doesn't exist at
    …chromium-XXXX"). New `toPdf(doc, { autoInstallBrowser, log })` option and an
    exported `installChromium()` helper; a missing browser otherwise throws a clear,
    copy-pasteable command.
  - **Authoring skill:** new "Repurpose a block" guide (map the _shape of an idea_
    to a block — `quadrant` for any 2-axis 2×2, `anatomy` for any delimited string,
    `matrix` for any X×Y grid) and a "Titles, headings & voice" section (derive all
    titles from the user's own domain wording; never leave scaffold placeholders).
    Also refreshes the embedded MCP skill.

### Patch Changes

- Updated dependencies
  - @avodado/export@0.2.0

## 0.10.0

### Minor Changes

- Add saved custom themes and a noun-first `avo theme` surface.
  - `avo theme new <name>` scaffolds `.avodado/themes/<name>.theme.json` (pick a base
    theme, override any friendly color/font).
  - `avo theme list` shows built-in + saved themes; the interactive `avo theme`
    picker now lists your saved themes alongside the built-ins.
  - `avo theme use <name>` activates a built-in or saved theme (shorthand:
    `avo theme <name>`); selecting copies it to the active `avodado.theme.json`.

## 0.9.1

### Patch Changes

- Simplify the per-action CLI banner: drop the ASCII avocado art and the avocado
  emoji, keeping just the action word in avocado-green cfonts plus the status line.

## 0.9.0

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
  - @avodado/render@0.7.0
  - @avodado/export@0.1.8
  - @avodado/sync@0.0.7

## 0.8.0

### Minor Changes

- - **Removed the `funnel` block** (catalog is now 43). Use `stats`, `gantt`, or a `table` instead.
  - **`pyramid` fixed** — wider flat apex and theme-derived colors so labels no longer get cut off.
  - **New `avo theme [name]` command** — interactive picker (with the cfonts banner) or `avo theme dark` to set it directly; writes `avodado.theme.json`, including a `custom` scaffold.
  - **`avo html` / `avo slides` / `avo pdf`** now show the avocado cfonts banner and a fun status line (interactive only).

### Patch Changes

- Updated dependencies
  - @avodado/core@0.4.0
  - @avodado/render@0.6.0
  - @avodado/export@0.1.7
  - @avodado/sync@0.0.6

## 0.7.0

### Minor Changes

- - **Per-tool skill install/update commands:** `avo claude`, `avo cursor`, `avo github`, `avo windsurf` install or refresh just that tool's adapter + the shared authoring skill (no full project scaffold).
  - **Versioned skills:** installed `SKILL.md` files now carry a `version:` stamped with the CLI version, so you can tell what's installed and re-run a command to update.
  - **`--preview` / `-p`** on `avo html` / `avo slides` / `avo pdf` — render to a temp file and open it in the browser.
  - **Slides:** the gradient rail is static again (derived from the theme accents, no animation), and slide content is now **scaled to fit** so there's no scrolling — diagrams shrink to the slide.
  - **`funnel` and `pyramid` fixed:** the pyramid apex is a flat band (top label fits), funnel stages are wide enough, labels wrap, and both follow the theme colors instead of a fixed palette.

### Patch Changes

- Updated dependencies
  - @avodado/render@0.5.1
  - @avodado/export@0.1.6

## 0.6.0

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
  - @avodado/render@0.5.0
  - @avodado/export@0.1.5
  - @avodado/sync@0.0.5

## 0.5.0

### Minor Changes

- - **Animated slide rail.** The slide deck's left gradient rail now gently animates (a moving multi-color gradient), respecting `prefers-reduced-motion`.
  - **Short slides center vertically** while taller ones still scroll from the top.
  - **New single-document CLI shortcuts:** `avo html <doc>`, `avo slides <doc>`, and `avo pdf <doc>` — each renders one document (applying the project theme) and writes a single file, defaulting next to the input. `avo export` remains for batch/glob, multi-format output.

### Patch Changes

- Updated dependencies
  - @avodado/export@0.1.4

## 0.4.3

### Patch Changes

- Fix diagrams rendering invisible on slides: the shared SVG `<defs>` (drop-shadow filter + arrow markers) were emitted inside the first slide, which is `display:none` when inactive — and a node referencing `filter="url(#gshadow)"` from a hidden subtree is not rendered, so most diagrams vanished on other slides. The defs are now placed once at the deck root (`renderSlides` returns them separately), so every slide's diagrams resolve their filters/markers and display.
- Updated dependencies
  - @avodado/render@0.4.1
  - @avodado/export@0.1.3

## 0.4.2

### Patch Changes

- Slides export refinements: each slide now has a header with the **title on the top-left and the section number/label on the top-right**; the left accent is a single shared **gradient rail** (same on every slide); the cover slide centers its title and drops the top bar; and the slide layout was fixed so **diagrams display and scale/scroll** correctly instead of being clipped by the fixed-height stage.
- Updated dependencies
  - @avodado/export@0.1.2

## 0.4.1

### Patch Changes

- Slides export polish: every slide is now the same fixed 16:9 size, sized to fit the viewport and centered, with content centered and diagrams scaled to fit (so wide blocks like `sequence` are no longer cut off — overflow scrolls). The colored accent edge moved from the right to the left.
- Updated dependencies
  - @avodado/export@0.1.1

## 0.4.0

### Minor Changes

- Add a **slides / presentation export**. `avo export <doc> --format slides` produces a self-contained HTML deck — one slide for the cover and one per section — with keyboard (←/→, Home/End), button, and jump-to-section navigation, and a coloured right edge per slide. New `renderSlides` in `@avodado/render` and `toSlides` in `@avodado/export` back it (static HTML + a tiny vanilla-JS controller, no runtime dependency). Also prints cleanly (one slide per page).

### Patch Changes

- Updated dependencies
  - @avodado/render@0.4.0
  - @avodado/export@0.1.0

## 0.3.2

### Patch Changes

- Fix `avo init` generating adapters for tools you didn't pick: the wizard's AI-tool list no longer starts with everything pre-selected. It now starts empty, so you toggle on only the tools you use (space to select, enter to continue) and get only those files. `avo init --yes` still scaffolds all adapters for non-interactive use.

## 0.3.1

### Patch Changes

- The `endpoint` block's request/response examples (and per-response examples) are now syntax-highlighted JSON — keys, strings, numbers, and `true`/`false`/`null` get theme-aware colors. Highlighting is done at render time (static colored spans, no runtime), and non-JSON snippets pass through safely uncolored.
- Updated dependencies
  - @avodado/render@0.3.1
  - @avodado/export@0.0.15

## 0.3.0

### Minor Changes

- Add a dedicated **`endpoint`** block — a Swagger-style API endpoint card. One block captures an HTTP operation: `method` + `path`, optional `title`/`description`/`auth`, `params` (path/query/header/cookie), request-`body` fields, `responses` (status + description + example), and optional `request`/`response` examples. Method and status codes are colour-coded. The block catalog is now 42 types; `avo new --type endpoint` scaffolds a starter, and the authoring skill documents it.

### Patch Changes

- Updated dependencies
  - @avodado/core@0.2.0
  - @avodado/render@0.3.0
  - @avodado/export@0.0.14
  - @avodado/sync@0.0.4

## 0.2.10

### Patch Changes

- Edge/relationship labels are now drawn in a final pass — on top of all lines and nodes — in **every** diagram block. The remaining ones that still drew labels inline (`felogic`/`belogic`, `graph`, `swimlane`, `cluster`, and the `erd` relation label) are fixed, so a connector line never crosses out a label anywhere.
- Updated dependencies
  - @avodado/render@0.2.7
  - @avodado/export@0.0.13

## 0.2.9

### Patch Changes

- Zone/container styling for `infra`, `network`, `block`, `event`, `ddd` is more elegant: the group boundaries lose their tinted background and solid label badges in favour of a clean dashed outline with a plain top-left label (matching the `felogic`/`belogic` look), and the containers + overall diagram get noticeably more padding so nodes and connections breathe.
- Updated dependencies
  - @avodado/render@0.2.6
  - @avodado/export@0.0.12

## 0.2.8

### Patch Changes

- - **Square-left accent cards everywhere.** The remaining diagram blocks with a left accent stripe — `cluster`, `frontend`, `mece` — now use the same flush square-left corner as the others, so no diagram has the "weird" rounded notch behind the stripe.
  - **`uml`** markers are smaller and fixed-size (the composition/aggregation diamonds no longer look oversized), and the class boxes are a touch narrower.
- Updated dependencies
  - @avodado/render@0.2.5
  - @avodado/export@0.0.11

## 0.2.7

### Patch Changes

- - **`uml`** relationship markers (especially the composition/aggregation diamonds) are smaller, so they read in proportion to the now-compact class boxes.
  - **`infra`/cloud** reverts to the stripe-style service cards (the look that worked) and instead gives the zone/group containers noticeably more interior padding so nodes aren't cramped against the boundary.
- Updated dependencies
  - @avodado/render@0.2.4
  - @avodado/export@0.0.10

## 0.2.6

### Patch Changes

- - **`uml` class diagrams reworked.** Classes are laid out with dagre using their real sizes and relationships are routed through dagre's points as smooth, rounded paths (same engine as the ERD) — so arrows no longer overlap or read as jagged. Boxes and markers are smaller and theme-aware.
  - **`infra` / cloud diagrams redesigned** in the style of AWS/GCP/Azure architecture diagrams: each service is a clean white card with a coloured icon badge, the service name, and an optional type line. Nodes without a glyph show their initial in the badge.
- Updated dependencies
  - @avodado/render@0.2.3
  - @avodado/export@0.0.9

## 0.2.5

### Patch Changes

- - **Square-left accent cards.** Diagram nodes with a left accent stripe (`c4`, `felogic`/`belogic`, `infra`/`block`/`network`/`event`/`ddd`) now have square top-left/bottom-left corners so the stripe sits flush — no more "weird" rounded notch. Right corners stay rounded.
  - **Cloud/infra now matches the `felogic` look** — same card proportions and flush-stripe treatment, plus the earlier extra padding for zone boxes.
  - **`uml` classes are smaller again** (narrower boxes, smaller fonts, wider gaps) so relationship arrows have room and stop overlapping.
- Updated dependencies
  - @avodado/render@0.2.2
  - @avodado/export@0.0.8

## 0.2.4

### Patch Changes

- Diagram rendering polish:
  - **Edge labels are never crossed out.** All diagram renderers (`flow`/`dag`, `c4`, `state`, `dfd`, `uml`, `block`/`infra`/`event`/`ddd`/`network`) now draw labels in a final pass, on top of the lines and nodes — fixing the "state lifecycle" labels being struck through by later transitions. Label pills are theme-aware.
  - **`dfd`** boxes are smaller with more separation so flow labels fit between them.
  - **`c4`** person nodes draw the persona glyph in the top-right corner, clear of the title/description text.
  - **`uml`** class boxes and fonts are smaller; the class boxes and compartment rules now follow the theme.
  - **`infra`/`block`/`network`/etc.** get more outer padding/margin and theme-aware layered-mode colors.
  - Left-accent blocks (`callout`, `userstory`, `toc`, kanban cards) have square accent (left) corners and rounded right corners.

- Updated dependencies
  - @avodado/render@0.2.1
  - @avodado/export@0.0.7

## 0.2.3

### Patch Changes

- - **Auto-layout for the coordinate diagrams.** `flow`/`dag`, `c4`, `state`, `dfd`, and `uml` no longer require `col`/`row` on every node — when coordinates are omitted, a clean layered grid is derived from the edges (dagre) so you can declare just nodes + relationships. Explicit `col`/`row` are still honored exactly (fully backward-compatible).
  - **ERD crow's-foot notation.** Relations now render proper crow's-foot ends (one / many) derived from `card`, and show the relation `label` on the edge. Added `N:1` to the `card` values (the common many-to-one shape).
- Updated dependencies
  - @avodado/core@0.1.0
  - @avodado/render@0.2.0
  - @avodado/export@0.0.6
  - @avodado/sync@0.0.3

## 0.2.2

### Patch Changes

- ERD relations now connect at the **field level** — each edge is routed from the foreign-key row in the source entity to the primary-key row in the target entity (arrowhead into the PK row), instead of attaching at the box centre. dagre still handles box placement; edges route orthogonally through the gap between boxes.
- Updated dependencies
  - @avodado/render@0.1.2
  - @avodado/export@0.0.5

## 0.2.1

### Patch Changes

- - **ERD block remodeled** — entity placement and edge routing are now computed with a real graph-layout pass (dagre), so boxes don't overlap and relations route cleanly around them instead of cutting across the diagram. Foreign keys still point an arrowhead into the target entity (FK → PK), with cardinality labels on the edges. Entities longer than 10 columns are truncated with a "… +N more" row for readability.
  - **Textbook theme now uses a sans-serif typeface** (warm palette, larger headings, and cream paper are unchanged).
- Updated dependencies
  - @avodado/render@0.1.1
  - @avodado/export@0.0.4

## 0.2.0

### Minor Changes

- - **New default theme `textbook`** — a warm, classic, printed-page look: cream paper, deep academic navy + terracotta accent, serif display & body, and larger headings. The former default is still available as the `minimal` theme.
  - **ERD foreign keys now connect FK → PK** — relations attach to the foreign-key row in the source entity and point an arrowhead into the primary-key row of the target (instead of generic top-edge arrows). ERD colors now follow the active theme.
  - **`avo init` installs one unified skill across tools** — the same `avodado-docs` skill (`SKILL.md`) is written into each tool's native skill location (Claude Code, Cursor, Windsurf) plus a Copilot prompt file, and **agents** are generated where supported (Claude Code, GitHub Copilot). Instruction files are now consistent pointers.
  - Removed the dead `$schema` URL from the scaffolded `avodado.config.json`.

### Patch Changes

- Updated dependencies
  - @avodado/render@0.1.0
  - @avodado/export@0.0.3

## 0.1.1

### Patch Changes

- Fix `avo --version` (and the help banner) reporting a hard-coded `0.0.1` — the CLI now reads its real version from its own package.json.

## 0.1.0

### Minor Changes

- Interactive `avo init`: a guided wizard (with a cfonts AVODADO banner) that asks which AI tools you use — Claude Code, Cursor, GitHub Copilot, Windsurf — and writes only those editor adapters, then lets you pick a theme (with a Custom option that scaffolds `avodado.theme.json`). Pass `--yes` to skip the wizard and scaffold with defaults (CI/non-interactive).

## 0.0.2

### Patch Changes

- Replace the default theme with `minimal` — a clean, modern, Vercel-style look (white paper, near-black ink, a single `#0070f3` blue accent, geometric sans, subtle rounding). The `navy`/editorial theme is removed; `minimal` is now the default.
- Updated dependencies
  - @avodado/core@0.0.2
  - @avodado/render@0.0.2
  - @avodado/export@0.0.2
  - @avodado/sync@0.0.2

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
  - @avodado/render@0.0.1
  - @avodado/export@0.0.1
  - @avodado/sync@0.0.1
