# @avodado/mcp

## 0.1.9

### Patch Changes

- Updated dependencies
  - @avodado/render@0.17.1

## 0.1.8

### Patch Changes

- New `gallery` block (now 53): a real grid (2 columns by default; set `cols` for
  3–4) of cells. Each cell is a syntax-highlighted code snippet, a note, or a
  **nested block** (`block: { type: c4, …data }`) — so you can lay out a bug gallery
  of code or compare several architectures/diagrams side by side. Nested blocks are
  validated against their own schema. Skill, `avo block`/`avo catalog`, and the
  showcase updated.
- Updated dependencies
  - @avodado/core@0.8.0
  - @avodado/render@0.17.0
  - @avodado/sync@0.0.10

## 0.1.7

### Patch Changes

- Updated dependencies
  - @avodado/render@0.16.0

## 0.1.6

### Patch Changes

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

## 0.1.5

### Patch Changes

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

## 0.1.4

### Patch Changes

- More system-design patterns (now 23) and more elegant, varied diagrams:
  - New: `leader-election` (a `state` machine), `bloom-filter` & `backpressure`
    (decision `flow`s), `write-ahead-log` & `service-discovery` (`sequence`s),
    `sidecar` (a k8s `cluster`), `outbox` & `blue-green-deploy` (`block`s with
    labelled zone groups).
  - Existing fan-out diagrams (load-balancing, pub-sub, api-gateway, sharding) now
    use labelled zone groups, and CQRS is split into write/read zones — so the
    system diagrams no longer all look like the same boxes.

  The library is now 55 patterns (23 system · 10 AI · 22 GoF code).

## 0.1.3

### Patch Changes

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

## 0.1.2

### Patch Changes

- `avo design` templates now include a **structure diagram**, not just the card:
  code patterns render a `belogic` graph (with interface/impl UML stereotypes
  inferred from the relationships) and system-design patterns render a `block`
  graph (with cache/queue/store/gateway glyphs), each with labelled edges. Applies
  to `avo design <slug>` templates and the `avo design --all` gallery.

## 0.1.1

### Patch Changes

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

## 0.1.0

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
  - @avodado/sync@0.0.9

## 0.0.31

### Patch Changes

- Per-slide alignment override. On top of the auto centering/top-align, a heading
  marker forces a slide's vertical alignment: `## Title {top}`, `## Title {center}`,
  or `## Title {bottom}` (the marker is stripped from the displayed title). Documented
  in the skill's "Slide decks" section.
- Updated dependencies
  - @avodado/render@0.14.0

## 0.0.30

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

## 0.0.29

### Patch Changes

- Slides split by heading. `avo slides` now starts a new slide at each top-level
  Markdown heading (`#`/`##`), using the heading as the slide title; everything
  until the next heading (prose + blocks) stays on that slide. A `---` thematic
  break still forces a split, and a doc with no headings falls back to one slide per
  block. This means ordinary section-structured docs present cleanly with no special
  markup. Skill "Slide decks" section, presentation playbook, and prompt updated.
- Updated dependencies
  - @avodado/render@0.12.0

## 0.0.28

### Patch Changes

- Skill: add a **Presentation / deck** Document Playbook that points at the `---`
  slide model (one slide per `---`, `#` heading as title), tying the playbooks to
  the existing "Slide decks" section so agents pick it up.

## 0.0.27

### Patch Changes

- Author-controlled slide pagination with `---`.

  `avo slides` now splits the deck on Markdown thematic breaks (`---`): everything
  between two `---` is one slide and can hold several blocks plus prose, with the
  first `#`/`##` heading as the slide title. A document with no `---` keeps the
  previous one-slide-per-block behavior. Documented in the skill (new "Slide decks"
  section) and the `presentation` prompt.

- Updated dependencies
  - @avodado/render@0.11.0

## 0.0.26

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

## 0.0.25

### Patch Changes

- Updated dependencies
  - @avodado/render@0.9.1

## 0.0.24

### Patch Changes

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

- Updated dependencies
  - @avodado/core@0.6.0
  - @avodado/render@0.9.0
  - @avodado/sync@0.0.8

## 0.0.23

### Patch Changes

- Remove the `plum` built-in theme. Six themes remain: textbook, minimal, soft,
  dark, teal, slate. `theme: 'plum'` (or `avo theme use plum`) is no longer valid —
  switch any document using it to another theme.
- Updated dependencies
  - @avodado/render@0.8.0

## 0.0.22

### Patch Changes

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

## 0.0.21

### Patch Changes

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

- Updated dependencies
  - @avodado/core@0.5.0
  - @avodado/render@0.7.0
  - @avodado/sync@0.0.7

## 0.0.20

### Patch Changes

- - **Removed the `funnel` block** (catalog is now 43). Use `stats`, `gantt`, or a `table` instead.
  - **`pyramid` fixed** — wider flat apex and theme-derived colors so labels no longer get cut off.
  - **New `avo theme [name]` command** — interactive picker (with the cfonts banner) or `avo theme dark` to set it directly; writes `avodado.theme.json`, including a `custom` scaffold.
  - **`avo html` / `avo slides` / `avo pdf`** now show the avocado cfonts banner and a fun status line (interactive only).
- Updated dependencies
  - @avodado/core@0.4.0
  - @avodado/render@0.6.0
  - @avodado/sync@0.0.6

## 0.0.19

### Patch Changes

- Updated dependencies
  - @avodado/render@0.5.1

## 0.0.18

### Patch Changes

- Gap-filling blocks (inspired by replicating a rich design doc), bringing the catalog to **44**:
  - **`pullquote`** — a standout pull-quote with optional attribution.
  - **`layers`** — a layered explanation: N numbered layers, each with a kicker / title / source / question + body (e.g. an L1/L2/L3 model).
  - **`callout` gains a `success` tone** (green).
  - **`userstory` is richer** — optional `title` and `tags`, shown as a header with the points pill.

  All wired through the schema, renderer, `avo new` templates, and the authoring skill.

- Updated dependencies
  - @avodado/core@0.3.0
  - @avodado/render@0.5.0
  - @avodado/sync@0.0.5

## 0.0.17

### Patch Changes

- Updated dependencies
  - @avodado/render@0.4.1

## 0.0.16

### Patch Changes

- Updated dependencies
  - @avodado/render@0.4.0

## 0.0.15

### Patch Changes

- The `endpoint` block's request/response examples (and per-response examples) are now syntax-highlighted JSON — keys, strings, numbers, and `true`/`false`/`null` get theme-aware colors. Highlighting is done at render time (static colored spans, no runtime), and non-JSON snippets pass through safely uncolored.
- Updated dependencies
  - @avodado/render@0.3.1

## 0.0.14

### Patch Changes

- Add a dedicated **`endpoint`** block — a Swagger-style API endpoint card. One block captures an HTTP operation: `method` + `path`, optional `title`/`description`/`auth`, `params` (path/query/header/cookie), request-`body` fields, `responses` (status + description + example), and optional `request`/`response` examples. Method and status codes are colour-coded. The block catalog is now 42 types; `avo new --type endpoint` scaffolds a starter, and the authoring skill documents it.
- Updated dependencies
  - @avodado/core@0.2.0
  - @avodado/render@0.3.0
  - @avodado/sync@0.0.4

## 0.0.13

### Patch Changes

- Edge/relationship labels are now drawn in a final pass — on top of all lines and nodes — in **every** diagram block. The remaining ones that still drew labels inline (`felogic`/`belogic`, `graph`, `swimlane`, `cluster`, and the `erd` relation label) are fixed, so a connector line never crosses out a label anywhere.
- Updated dependencies
  - @avodado/render@0.2.7

## 0.0.12

### Patch Changes

- Zone/container styling for `infra`, `network`, `block`, `event`, `ddd` is more elegant: the group boundaries lose their tinted background and solid label badges in favour of a clean dashed outline with a plain top-left label (matching the `felogic`/`belogic` look), and the containers + overall diagram get noticeably more padding so nodes and connections breathe.
- Updated dependencies
  - @avodado/render@0.2.6

## 0.0.11

### Patch Changes

- - **Square-left accent cards everywhere.** The remaining diagram blocks with a left accent stripe — `cluster`, `frontend`, `mece` — now use the same flush square-left corner as the others, so no diagram has the "weird" rounded notch behind the stripe.
  - **`uml`** markers are smaller and fixed-size (the composition/aggregation diamonds no longer look oversized), and the class boxes are a touch narrower.
- Updated dependencies
  - @avodado/render@0.2.5

## 0.0.10

### Patch Changes

- - **`uml`** relationship markers (especially the composition/aggregation diamonds) are smaller, so they read in proportion to the now-compact class boxes.
  - **`infra`/cloud** reverts to the stripe-style service cards (the look that worked) and instead gives the zone/group containers noticeably more interior padding so nodes aren't cramped against the boundary.
- Updated dependencies
  - @avodado/render@0.2.4

## 0.0.9

### Patch Changes

- - **`uml` class diagrams reworked.** Classes are laid out with dagre using their real sizes and relationships are routed through dagre's points as smooth, rounded paths (same engine as the ERD) — so arrows no longer overlap or read as jagged. Boxes and markers are smaller and theme-aware.
  - **`infra` / cloud diagrams redesigned** in the style of AWS/GCP/Azure architecture diagrams: each service is a clean white card with a coloured icon badge, the service name, and an optional type line. Nodes without a glyph show their initial in the badge.
- Updated dependencies
  - @avodado/render@0.2.3

## 0.0.8

### Patch Changes

- - **Square-left accent cards.** Diagram nodes with a left accent stripe (`c4`, `felogic`/`belogic`, `infra`/`block`/`network`/`event`/`ddd`) now have square top-left/bottom-left corners so the stripe sits flush — no more "weird" rounded notch. Right corners stay rounded.
  - **Cloud/infra now matches the `felogic` look** — same card proportions and flush-stripe treatment, plus the earlier extra padding for zone boxes.
  - **`uml` classes are smaller again** (narrower boxes, smaller fonts, wider gaps) so relationship arrows have room and stop overlapping.
- Updated dependencies
  - @avodado/render@0.2.2

## 0.0.7

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

## 0.0.6

### Patch Changes

- - **Auto-layout for the coordinate diagrams.** `flow`/`dag`, `c4`, `state`, `dfd`, and `uml` no longer require `col`/`row` on every node — when coordinates are omitted, a clean layered grid is derived from the edges (dagre) so you can declare just nodes + relationships. Explicit `col`/`row` are still honored exactly (fully backward-compatible).
  - **ERD crow's-foot notation.** Relations now render proper crow's-foot ends (one / many) derived from `card`, and show the relation `label` on the edge. Added `N:1` to the `card` values (the common many-to-one shape).
- Updated dependencies
  - @avodado/core@0.1.0
  - @avodado/render@0.2.0
  - @avodado/sync@0.0.3

## 0.0.5

### Patch Changes

- ERD relations now connect at the **field level** — each edge is routed from the foreign-key row in the source entity to the primary-key row in the target entity (arrowhead into the PK row), instead of attaching at the box centre. dagre still handles box placement; edges route orthogonally through the gap between boxes.
- Updated dependencies
  - @avodado/render@0.1.2

## 0.0.4

### Patch Changes

- - **ERD block remodeled** — entity placement and edge routing are now computed with a real graph-layout pass (dagre), so boxes don't overlap and relations route cleanly around them instead of cutting across the diagram. Foreign keys still point an arrowhead into the target entity (FK → PK), with cardinality labels on the edges. Entities longer than 10 columns are truncated with a "… +N more" row for readability.
  - **Textbook theme now uses a sans-serif typeface** (warm palette, larger headings, and cream paper are unchanged).
- Updated dependencies
  - @avodado/render@0.1.1

## 0.0.3

### Patch Changes

- - **New default theme `textbook`** — a warm, classic, printed-page look: cream paper, deep academic navy + terracotta accent, serif display & body, and larger headings. The former default is still available as the `minimal` theme.
  - **ERD foreign keys now connect FK → PK** — relations attach to the foreign-key row in the source entity and point an arrowhead into the primary-key row of the target (instead of generic top-edge arrows). ERD colors now follow the active theme.
  - **`avo init` installs one unified skill across tools** — the same `avodado-docs` skill (`SKILL.md`) is written into each tool's native skill location (Claude Code, Cursor, Windsurf) plus a Copilot prompt file, and **agents** are generated where supported (Claude Code, GitHub Copilot). Instruction files are now consistent pointers.
  - Removed the dead `$schema` URL from the scaffolded `avodado.config.json`.
- Updated dependencies
  - @avodado/render@0.1.0

## 0.0.2

### Patch Changes

- Replace the default theme with `minimal` — a clean, modern, Vercel-style look (white paper, near-black ink, a single `#0070f3` blue accent, geometric sans, subtle rounding). The `navy`/editorial theme is removed; `minimal` is now the default.
- Updated dependencies
  - @avodado/core@0.0.2
  - @avodado/render@0.0.2
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
  - @avodado/sync@0.0.1
