# Avodado blocks — Design system & UI mockups

Part of the **avodado-docs** skill (the hub is `SKILL.md`, two folders up).
Field contracts and examples for this family's blocks. The at-a-glance contract
table for all 87 blocks is `contract.md` beside this file; the block → family
map is `INDEX.md`. Schemas reject unknown fields — use exactly these.

### Design system

#### `palette` — color-token swatches
```palette
title: Brand palette
description: Core tokens — always reference by name, never by raw hex.
cols: 4
colors:
  - { name: Primary, value: "#0E54A1", usage: "Buttons, links, focus rings" }
  - { name: Ink, value: "#1F2937", usage: Body text }
  - { name: Surface, value: "#F6F8FB", usage: Card and panel backgrounds }
  - { name: Positive, value: "#1F9747", usage: Success states }
```
A responsive card grid (`cols` 2-6, default 4): each card is a swatch filled
with `value`, the hex shown in mono inside it (auto-contrast — dark text on
light swatches, white on dark; `on` overrides), then the token name and
`usage`. **Always quote hex values** (`"#0E54A1"`) — an unquoted `#` starts a
YAML comment. Invalid colors fall back to a neutral gray swatch. Use `palette`
for color tokens; use `stats` for KPI numbers.

#### `typescale` — a live type specimen
```typescale
title: Type scale
sample: The five boxing wizards jump quickly
items:
  - { name: Display, size: 40, weight: 700, font: display, note: hero headings }
  - { name: Body, size: 15, lineHeight: 1.6 }
  - { name: Caption, size: 12, weight: 500, note: secondary text }
  - { name: Code, size: 13, font: mono }
```
One row per style: a meta column (name, `NNpx / weight NNN`, note) and the
`sample` text rendered **live** at that size / weight / `lineHeight` (default
1.3) in the chosen `font` (`display | body | mono`, default body). Sizes over
64px render clamped at 64 but the label keeps the true size. `size`, `weight`,
and `lineHeight` are plain numbers. Use `typescale` for type ramps; use `table`
for token tables with no visual payoff.

#### `dodont` — do / don't guideline cards
```dodont
title: Button usage
dos:
  - { text: Use one primary button per view }
  - { text: Write labels as verbs, example: "Save changes" }
donts:
  - { text: Stack two primary buttons side by side }
  - { text: Disable a button without explaining why, example: "tooltip: Add a line item first" }
```
Two cards side by side — DO (green band, ✓) and DON'T (red band, ✕), one
column on mobile. Both `dos` and `donts` are required. An item's optional
`example` renders beneath it as a mono chip — great for label copy or code.
Use `dodont` for usage guidelines; use `proscons` to weigh a decision and
`callout` for a single warning.

#### `inventory` — component / feature status board
```inventory
title: Component status
items:
  - { name: Button, status: stable, tag: v2 }
  - { name: Data table, status: beta, note: API may change before GA }
  - { name: Date picker, status: experimental }
  - { name: Modal (legacy), status: deprecated, note: Use Dialog instead }
  - { name: Charts, status: planned }
```
Compact hairline-separated rows, scannable like a status page: name (+ tiny
mono `tag` chip), an optional `note` beneath, and a right-aligned color-coded
`status` chip — `stable` green · `beta` blue · `experimental` purple ·
`deprecated` red · `planned` gray. Use `inventory` for component / feature
maturity; use `tracker` for task work and `changelog` for shipped history.

### UI mockups

#### `wireframe` — low-fi screen mockups (desktop / browser / phone)
```wireframe
title: What the user sees
screens:
  - device: browser
    title: Notification center
    url: app.example.com/inbox
    label: Desktop — notification center
    elements:
      - { type: nav, label: "Home, Inbox, Settings" }
      - { type: header, label: Notifications }
      - { type: badge, label: "3 new", tone: danger, align: r }
      - { type: list, rows: 4 }
      - { type: button, label: Mark all as read }
  - device: phone
    title: "9:41"
    label: iPhone — live bell + feed
    elements:
      - { type: header, label: Alerts }
      - { type: card, rows: 3 }
      - { type: tabs, label: "Home, Search, Bell, You" }
```
`screens` lay out left-to-right; each picks a `device` frame (`desktop` /
`browser` / `phone`) and stacks `elements` top-to-bottom. `device: browser`
shows an address bar (`url`); `phone` adds a notch + home indicator. `title`
is the window/status-bar text, `label` is the caption under the frame.

Element `type` is one of: `header · subheader · text · button · input · search
· image · avatar · card · list · nav · tabs · divider · badge · toggle ·
spacer`. `rows` repeats stack-like elements (`list` / `card`) or sizes `text` /
`spacer`. `nav` / `tabs` read their items from a **comma-separated** `label`
(quote it). `align` is `l | c | r`; `tone` is `accent | muted | danger` (colours
buttons, badges, toggles). Keep it low-fidelity — it's a wireframe, not a comp.
