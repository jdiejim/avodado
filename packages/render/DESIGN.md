# Render skin — the single source of truth for how blocks look

Every renderer draws from the tokens and roles in this file. No renderer
carries a hex value; a test enforces it. To change the look of Avodado,
change this file and `src/css.ts`, never a block.

The goal: **editorial, quiet, dense with content.** Meaning travels through
shape, stroke, dash, and small typographic chips. Color is spent on one
thing per diagram.

## Tokens

Semantic roles. Renderers name the role (`var(--ink)`), never the value.

| Role | Purpose | Light |
|---|---|---|
| `paper` | page and default node fill | `#f7f6f2` |
| `paper-2` | diagram ground, secondary fill, frames | `#efede8` |
| `ink` | primary text, primary stroke | `#1f2430` |
| `muted` | secondary text, default arrow stroke, chips | `#4f5868` |
| `soft` | sublabels, guards, legend text | `#646d7b` (4.5:1 on paper-2 — the floor for small text) |
| `rule` | hairlines | `rgba(31,36,48,.14)` |
| `rule-solid` | frame borders, baselines, secondary node and chip outlines | `#807b70` (3.6:1 on paper-2 — the floor for a line that carries meaning) |
| `accent` | the one focal thing per diagram (see the rule below) | `#b04a25` (4.7:1 on paper-2, so it may carry small text) |
| `accent-tint` | fill behind an accent-stroked shape | `rgba(176,74,37,.09)` |
| `link` | HTTP calls, external arrows, links in prose | `#2f5c8f` |
| `negative` | real errors only, desaturated | `#9a3f34` |
| `negative-tint` | fill behind an error shape | `rgba(154,63,52,.08)` |

Legacy names (`--navy`, `--charcoal`, `--gray`, `--light-gray`, `--blue`,
`--highlight`, `--positive`, `--purple`, `--teal`, and their `-soft` tints)
stay defined as aliases of the roles above so untouched renderers keep
working while they migrate. New code never uses a legacy name.

Dark mode inverts the neutrals and lifts `accent` one step; it is defined
once, in `css.ts`, on `[data-theme="dark"]` and `prefers-color-scheme`.

## The one-accent rule

A diagram spends `accent` on **one focal thing**, and the renderer decides
which from the data, deterministically. One thing: a renderer never accents
two unrelated things in the same diagram.

One thing is not always one mark. It is one answer to one question, and the
answer is drawn at whatever size it is:

- **a path** is a chain of marks. `spans` accents the critical path, so a
  trace whose critical path runs through eight spans carries eight accented
  bars. Capping it at two would cut the chain and misstate the trace.
- **an arrival** is a node plus the edge into it. `flow` accents each `end`
  node that is not an error exit, and the edge that reaches it. Two success
  exits are two arrivals of the same one answer — "where does this end well?"
  — and accenting one of two equal exits would claim a difference the data
  does not carry.
- **a per-item state the author wrote** is the author's count, not the
  renderer's: `tone: active` / `tone: target` (`array`, `linkedlist`,
  `bintree`) and `status: current` (`timeline`, `rollout`). The renderer
  paints exactly what the data says and adds nothing of its own — strip the
  marks and the accent goes to zero. Twelve stages marked `current` is an
  authoring mistake; the skin renders it rather than hiding it.

Everywhere else, the accent holds at one or two marks whatever the data size.
A mark inside an accented shape — its label, its chip — is part of that mark,
not a second one.

| Block | What gets the accent |
|---|---|
| `sequence` | the last `response` message that reaches the first actor (the answer the caller gets); the `endpoint` tag |
| `flow` | the `end` node(s) that are not error exits, and the edge into them |
| `spans` | the critical path: from the root, the longest child at each step |
| `block` / `c4` | a node whose `kind` is `gateway` or whose `preset` names it the entry; otherwise none |
| `erd` | the entity on the "one" side of the most relations (the aggregate root); its eyebrow reads `AGGREGATE ROOT` |
| author-marked | the items the author toned `active` / `target`, or gave `status: current` |

Zero accent is a valid outcome. Errors use `negative`, never `accent`.

`src/__tests__/accent.test.ts` enforces this rule. It carries one declared row
per block type — where the accent comes from, how many marks the catalog
example may spend, and which one thing they compose — checks every catalog
example against its row, checks that a renderer-chosen accent does not grow
when the data grows to twelve items, checks that an author-marked accent is
zero when the marks are absent, and checks structurally that the marks of a
path or an arrival all belong to the same thing.

Nothing else is colored. Node kinds are told apart by:

- **stroke weight**: 1.5px `ink` for primary nodes, 1px `rule-solid` for secondary;
- **dash**: `4 3` for external / boundary / async;
- **fill**: `paper` (default) · `paper-2` (store, group, inactive) · `accent-tint` / `negative-tint`;
- **an eyebrow chip** inside the node: `EXT`, `EDGE`, `SVC`, `DB`, `CACHE`, `QUEUE`, `CLIENT`, `JOIN`, `ENTITY`.

## Type roles

Five roles, fixed sizes at figure density. Renderers use the class, not a
`font-size`.

| Class | Face | Size | Weight | Use |
|---|---|---|---|---|
| `.t-name` | Inter | 13px | 600 | node and entity names, actor names |
| `.t-sub` | mono | 10px | 400 | sublabels: tech, port, path, column type |
| `.t-eyebrow` | mono | 8.5px | 500, `letter-spacing:.14em`, uppercase | kind chips, frame tabs, legend title |
| `.t-arrow` | mono | 9.5px | 400, `letter-spacing:.04em` | arrow and relation labels, guards |
| `.t-badge` | mono | 9px | 600 | step numbers |

Every SVG text gets the paper halo (`paint-order:stroke; stroke:var(--paper)`)
so it survives crossing a line.

Figures never upscale. An SVG renders at `min(100%, viewBox width)` so a
120-node diagram fills the column and a 4-node diagram stays small. Decks
set `--scale` on the slide root to enlarge.

## Strokes and arrows

- Default edge: 1.5px `muted`, small filled arrowhead (6px).
- Return / response: 1.5px `muted`, dashed `5 4`, open arrowhead.
- Async: 1.25px `muted`, dashed `2 3`, open arrowhead.
- Error: 1.5px `negative`, filled head.
- Accent edge: 1.75px `accent`, filled head.
- Relation lines (erd): 1.25px `muted`, cardinality as `1` / `N` letters in
  `.t-arrow` at each end; no crow's-foot glyphs.
- Edge labels: `.t-arrow` on a `paper` mask, never a pill outline.

## Chrome around a figure

- No card shadow. The figure sits on `paper-2` with a `rule-solid` hairline
  and a 6px radius, on a dot grid (`radial-gradient` 1px `rule` dots on a 24px
  step).
- Eyebrow: plain `.t-eyebrow` in `soft` (`SEQUENCE · GET /orders`), never a
  filled family-colored pill. The endpoint method may take the accent.
- Title and description as today, in the page's type.
- **Legend strip**: a hairline row under the drawing, `.t-eyebrow` "LEGEND"
  then one item per encoding the diagram actually used (node kinds present,
  arrow styles present, the accent's meaning). Generated by the renderer from
  the data; omitted when only one encoding is in play.
- The step list (sequence) and footer pills stay; badges become hollow
  circles, `muted` stroke, `.t-badge` number; error badges use `negative`.

## Accessibility floor

Every text element passes WCAG AA against what is painted behind it: 4.5:1,
or 3:1 for text at 24px or 18.66px bold. `soft` is the lightest color that
may carry text on `paper-2`; on a dark fill, text is `paper`. Never encode a
meaning in color alone: pair it with a chip, a dash, or a glyph. Run the
audit on any page:

```
node packages/render/scripts/contrast-audit.mjs dist/reference/showcase.html
```

It exits non-zero on the first failure and names the section, element, and
ratio. The showcase page must pass before a renderer change ships.

**Non-text (WCAG 1.4.11).** A stroked shape that carries meaning — a node
outline, a chip outline, an arrow, a border that encodes state — needs 3:1
against the surface behind it. `--rule-solid` is the lightest line that may
carry meaning; `--rule` is the decorative hairline and never does.

```
node packages/render/scripts/contrast-audit.mjs dist/reference/showcase.html --nontext
```

Decoration is out of scope, and a renderer says so with `data-decorative` on
the shape (or on the layer that holds it): tick gridlines, row separators
inside a card, the silhouette detail inside a node glyph, and knockout strokes
that only cut a gap between two adjacent marks. The audit also skips a stroke
that paints exactly what is already behind it or its own fill — no line is
drawn there at all.

## What never changes

Labels, messages, fields, node names, counts, order. The skin is a lens on
the data; the data is complete.
