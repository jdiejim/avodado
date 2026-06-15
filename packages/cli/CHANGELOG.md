# @avodado/cli

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
