# Avodado blocks — the strict field contract

Part of the **avodado-docs** skill (the hub is `SKILL.md`, two folders up). The
strict field contract for all 84 blocks. Schemas reject unknown fields — use
exactly these. Twelve old block names remain valid as permanent aliases — see
the **Alias table** at the bottom.

## Block data shapes — required vs optional (the contract)

Every block also carries optional `title`, `description`, `lede` (editorial text
rendered around the diagram) and an optional top-level `id:` — **none are ever
required**, so they're left out of the table below, which shows only the
*structural* payload. `*` marks a **required** field; everything else is optional.
**Omit optional fields you have no value for** — don't pad them with empty strings.
`(n)` marks a **number** (don't quote it); every other value is a string.

| Block | Structural shape (`*` = required, `(n)` = number) | Closed enums |
|---|---|---|
| `meta` | `title` `subtitle` `tag` `logo` | — |
| `callout` | `tone` `title` `body` | tone: note · tip · warn · danger; bare-text body allowed (the body IS `body`) |
| `prose` | `blocks[]`: `type` `text` `items[]` | type: h · p · ul · ol · quote |
| `glossary` | `terms[]`: `term*` `def*` | string items: `Term — definition` or `Term: definition` |
| `proscons` | `prosLabel` `consLabel` `pros[]` `cons[]` | — |
| `cvt` | `current{label, items[]}` `target{label, items[]}` `note` | — |
| `agenda` | `items[]`: `title*` `time` `duration` `owner` `desc` | — |
| `table` | `columns[]`: string \| `{label*, align, highlight}` · `rows[][]`: string \| number \| `{v*, tone, lead, highlight}` · `note` | align: l · c · r — tone: pos · neg · warn · muted |
| `stats` | `stats[]`: `value*` `label*` `delta` `trend` `accent` | trend: up · down · flat |
| `code` | `kind` · `code` `lang` `session` (single-snippet shorthand) · `blocks[]`: `code*` `title` `lang` | kind: diff · terminal (omit for plain snippets). Plain: one snippet via top-level `code`/`lang`, several via `blocks[]`. `kind: diff`: unified-diff text in `code` (`+` added · `-` removed · `@@` hunk). `kind: terminal`: shell text in `session` (`$ ` command · `# ` comment · else output) |
| `risk` | `items[]`: `risk*` `likelihood*` `impact*` `mitigation` `owner` `status` | likelihood / impact: low · med · high — status: open · mitigating · accepted · closed. Severity derives: both high → critical · one high → high · both low → low · else medium |
| `kanban` | `columns[]`: `label*` `cards[]`: `title*` `tag` | string cards: `Title` or `Title · tag` |
| `timeline` | `items[]`: `label*` `date` `desc` `status` | status: done · current · next · future |
| `gantt` | `periods[]` · `tasks[]`: `label*` `start`(n) `span`(n) `kind` | kind: done · active · current · milestone |
| `userstory` | `role` `want` `soThat` `priority` `points`(n) · `criteria[]`: `given` `when` `then` · `links[]`: `ref` `mode` `label` | — |
| `sequence` | `actors[]`: `id*` `name*` `sub` `external` · `messages[]`: `from*` `to*` `label` `kind` `summary` `code` `note` · `endpoint{method*, path*, status}` · `foot[]`: `label*` `value*` | msg kind: sync · response · async · error · note — method: GET · POST · PUT · PATCH · DELETE |
| `state` | `dir` · `groups[]`: `id` `col*`(n) `row*`(n) `cols`(n) `rows`(n) `label*` `color` · `states[]`: `id*` `col*`(n) `row*`(n) `name` `kind` · `transitions[]`: `from*` `to*` `event*` `guard` | dir: LR (default) · TB — kind: start · terminal · active · wait |
| `flow` | `variant` `dir` · `groups[]`: `id` `col*`(n) `row*`(n) `cols`(n) `rows`(n) `label*` `color` · `nodes[]`: `id*` `col*`(n) `row*`(n) `w`(n) `label*` `kind` · `edges[]`: `from*` `to*` `label` `kind` | variant: dag (pipeline/DAG framing) — dir: LR (default) · TB — node kind: start · end · decision · process — edge kind: error |
| `dfd` | `dir` · `groups[]`: `id` `col*`(n) `row*`(n) `cols`(n) `rows`(n) `label*` `color` · `nodes[]`: `id*` `col*`(n) `row*`(n) `name*` `kind` `num` · `edges[]`: `from*` `to*` `label` | dir: LR (default) · TB — kind: process · external · store · datastore |
| `swimlane` | `lanes[]`: `label*` · `steps[]`: `id*` `col*`(n) `lane*`(n) `label*` `kind` · `links[]`: `from*` `to*` `label` | kind: action · decision · start · end · wait |
| `journey` | `stages[]`: `label*` · `rows[]`: `label*` `cells[]` · `emotion[]`(n, 0..1) | — |
| `erd` | `entities[]`: `name*` `columns[]`: `name*` `type` `pk`(bool) `fk`(bool) · `relations[]`: `from*` `to*` `label` `card` | card: "1:1" · "1:N" · "N:M" (quote!) |
| `uml` | `classes[]`: `id*` `col*`(n) `row*`(n) `name*` `stereotype` `attrs[]` `methods[]` · `rels[]`: `from*` `to*` `label` `kind` | rel kind: inheritance · extends · implementation · implements · composition · aggregation · dependency · association |
| `c4` | `level` `dir` `boundary{label*}` · `boundaries[]`: `label*` `nodes*[]` `color` · `groups[]`: `id` `col*`(n) `row*`(n) `cols`(n) `rows`(n) `label*` `color` · `nodes[]`: `id*` `col`(n) `row`(n) `w`(n) `kind*` `family` `name*` `tech` `desc` · `edges[]`: `from*` `to*` `label` `tech` `kind` | level: context · container · component — node kind: person · system · external · store · container · component — edge kind: solid · dashed · forbidden · error |
| `block` | `preset` `systemLabel` `dir` · `layers[]`: `label*` `color` · `groups[]`: `id` `col*`(n) `row*`(n) `cols`(n) `rows`(n) `label*` `color` · `nodes[]`: `id*` `name*` (`col`(n)+`row`(n) **or** `layer`(n)) `w`(n) `kind` `tech` · `edges[]`: `from*` `to*` `label` `kind` | preset: infra · event · ddd · network (framing only — same YAML) — node kind: free string (client · service · microservice · db · cache · queue · gateway · cdn · external · …) — edge kind: solid · dashed · forbidden · error |
| `cluster` | `clusters[]`: `id*` `label*` `kind` · `services[]`: `id*` `cluster*` `label*` `kind` `tech` `replicas`(n) · `edges[]`: `from*` `to*` `label` `kind` | edge kind: solid · dashed · forbidden · error |
| `archmap` | `cols`(n, areas per row, 2-4, default 3) · `areas[]`: `label*` `accent` `desc` `items[]`: string \| `{name*, status}` | a plain string is a **current** capability — status: target (dashed blue, to be built) · new (green) · gap (dashed red, missing) · deprecated (gray). accent as in `drivers`; a legend shows only the statuses used |
| `frontend` | `nodes[]`: `id*` `name*` `parent` `kind` `note` | kind: root · layout · page · component · leaf · provider · context · hook · store · state |
| `felogic` | `variant` `dir` · `groups[]` (as `block`) · `nodes[]`: `id*` `col`(n) `row`(n) `w`(n) `kind` `name*` `note` · `edges[]`: `from*` `to*` `label` `kind` | variant: be (backend framing) — node kind: free string (controller · service · repository · adapter · interface · strategy · hook · …) — edge kind: uses · implements · reads · egress · https · api · dashed · async |
| `graph` | `nodes[]`: `id*` `col`(n) `row`(n) `label*` `group`(n) `state` · `edges[]`: `from*` `to*` `label` `dir` `weight`(n) | dir: directed · undirected — state: visited · current · frontier · target (algorithm walkthroughs; overrides the group colour). `weight` renders on the edge pill — with a label as "label · w" |
| `array` | `items[]`: `value*` (string — **quote numbers**) `tone` `label` · `window{from*(n), to*(n), label}` · `showIndex`(bool, default true) | tone: active · visited · target · muted — `label` renders a pointer marker below its cell; `window` is a 0-based **inclusive** index range (out-of-bounds clamps) |
| `linkedlist` | `kind` (default singly) · `nodes[]`: `value*` `tone` `label` · `nullEnd`(bool, default true) | kind: singly · doubly — tone as `array`; `label` renders a marker above its node; `nullEnd` draws the ∅ terminator |
| `bintree` | `nodes[]`: `id*` `value*` `parent` `side` `tone` | side: left · right — **required when `parent` is set**; one child per side per parent. tone as `array`. Parentless nodes are roots (lay out side by side) |
| `hashmap` | `buckets*`(n) · `entries[]`: `key*` `value` `bucket*`(n) `tone` | tone as `array` — entries with `bucket` outside 0..N-1 are **skipped** (not clamped); rendering caps at 12 buckets with a "+N more" note |
| `agentloop` | `agent*{name*, model, note}` · `tools[]`: `name*` `desc` · `memory[]` (strings) · `env` (default User) · `stop` | no tools → the loop is just ① prompt / ④ response; the tool column caps at 5 cards + "+N more"; the memory cylinder draws only when `memory:` is present; `stop` renders as a "stops when:" foot pill |
| `trace` | `turns*[]`: `role*` `text` `thinking` `tool` `args` `result` | role: user · assistant · tool · system — `thinking` renders before `text` (assistant); `tool`+`args`+`result` shape a tool turn; multi-line strings keep their line breaks |
| `prompt` | `segments*[]`: `kind*` `label` `text*` · `vars[]`: `name*` `desc` | kind: system · user · assistant · tool — any `{{variable}}` in `text` renders as an amber chip. **Quote `text` containing `{{ }}`** — bare braces are YAML flow syntax |
| `context` | `window*`(n) `unit` (default tokens) · `segments*[]`: `label*` `tokens*`(n) `accent` `desc` | accent as in `drivers` — zero-token segments are skipped; leftover space renders as a dim "free (N)" segment; a sum past `window` renders in red past a dashed boundary with an "over budget" chip |
| `tree` | `variant` · `nodes[]`: `id*` `parent` `label*` `note` | variant: issue (MECE issue-tree presentation) |
| `pyramid` | `levels[]`: `label*` `desc` | — |
| `quadrant` | `xAxis{label, low, high}` `yAxis{label, low, high}` · `items[]`: `x*`(n, 0..1) `y*`(n, 0..1) `label*` | — |
| `wireframe` | `screens[]`: `device` `title` `url` `label` `elements[]`: `type` `label` `rows`(n) `align` `tone` | device: desktop · browser · phone — element type: header · subheader · text · button · input · search · image · avatar · card · list · nav · tabs · divider · badge · toggle · spacer — align: l · c · r — tone: accent · muted · danger |
| `endpoint` | `method*` `path*` `title` `description` `auth` · `params[]`: `name*` `in` `type` `required`(bool) `desc` · `body[]`: `name*` `type` `required`(bool) `desc` · `responses[]`: `status*`(n) `desc` · `request` `response` | method: GET · POST · PUT · PATCH · DELETE · HEAD · OPTIONS — `in`: path · query · header · cookie |
| `pullquote` | `text*` `attribution` | bare-text body allowed (the body IS `text`) |
| `layers` | `title` `description` · `items[]`: `title*` `kicker` `source` `question` `body` | — |
| `matrix` | `title` `description` `corner` `cols*[]` · `rows[]`: `label*` `cells*[]` (one per col, in order) | cell tints: Full/Admin/Write/✓ → green · —/None/✗ → muted · else → amber |
| `anatomy` | `title` `description` `separator` (default `:`) · `parts[]`: `label*` `value*` `note` | — |
| `composition` | `title` `description` `result` · `gates[]`: `label*` `desc` `kicker` `source` | renders `gate₁ ∩ gate₂ ∩ … = result`; per-gate `kicker`/`source` add a coloured header + source line |
| `drivers` | `title` `description` · `items[]`: `title*` `body` `tag` `icon` `accent` | icon: location·shield·grid·lock·key·user·clock·check·database·bolt·flag·doc·link·eye·server·layers — accent: navy·blue·teal·green·amber·purple·red·gray |
| `options` | `title` `description` · `items[]`: `title*` `kicker` `how` `pros[]` `cons[]` `verdict` `tone` | tone: rejected·viable·chosen·warn·neutral (chosen is highlighted) |
| `scorecard` | `criteria[]`: `label*` `weight`(n, default 1) · `options[]`: `label*` `scores*[]`(n, one per criterion) `note` | scores on a 0-5 scale by convention; the highest weighted total wins (ties highlight all) |
| `spec` | `title` `description` `accent` · `rows[]`: `label*` (`value` **or** `steps[]`) | a `steps[]` row renders as an arrow-joined pill flow — accent as in `drivers` |
| `list` | `title` `description` `style` `accent` · `items[]`: `lead*` `text` `icon` `accent` `done`(bool) | string items: `Lead` or `Lead — text`; style: accent · check · icon · number — icon/accent as in `drivers`; `done: false` dims a check row |
| `stories` | `title` `description` · `items[]`: `id` `title` `role` `want` `soThat` `priority` `points`(n) `tags[]` `open`(bool) · `criteria[]`: `given` `when` `then` · `links[]`: `ref` `mode` `label` | each item is a collapsible story; `open: true` starts expanded; `links[].ref` is a real `doc#id` cross-reference |
| `pattern` | `name*` `category` `intent` `forces[]` `solution` `structure` `note` · `participants[]`: `name*` `role` · `consequences{pros[], cons[]}` | — |
| `gallery` | `title` `description` `cols`(n) · `items[]`: `title` `code` `lang` `caption` `accent` | a card with `code` renders a highlighted snippet; without it, a title+caption note. Responsive grid (set `cols` to fix the column count). |
| `benchmark` | `metricLabel` `note` · `subjects*[]`: `label*` `sub` `featured`(bool) `tone` · `rows*[]`: `label*` `sub` `variants[]` `better` `cells[]`: value \| `{value, best(bool), note}` \| array of those (one per variant) | subject tone: accent (default) · muted — better: high (default) · low · none. The best value per row is **derived** from the numbers (`$0.14`, `310 ms`, `43.3%` all compare) — `best: true` only forces a tie or a non-numeric winner. `variants[]` names the conditions measured; then that subject's cell is an array, one value per condition. Missing values render as `—` |
| `chart` | `kind` `unit` `max`(n) `budget`(n) `labels[]` · `series[]`: `label*` `accent` `values*[]`(n) · `items[]` (donut / gauge / waterfall / funnel): `label*` `value*`(n) `accent` `desc` | kind: bar · stacked · line · area · scatter · donut · gauge · radar · waterfall · funnel (default bar) — accent as in `drivers`. `labels`+`series` drive bar/stacked/line/area/scatter/radar (stacked sums each column and scales the axis to the totals; scatter plots points without joining them); `items` drives donut/gauge/waterfall/funnel (`stages[]` is a legacy synonym for funnel items). `unit` suffixes values; `max` caps the y-axis (radar: the outer ring; gauge: the full sweep, default 100); radar needs 3+ labels as axes. waterfall: bars cascade left→right, a navy TOTAL bar closes the run, `budget` draws a dashed cap (segments past it tint red + over/under chip). funnel: bands proportional to value with `↓ NN%` conversion chips. gauge: one item draws a single dial with the value in the middle, several become concentric rings |
| `heatmap` | `xLabels*[]` `unit` `min`(n) `max`(n) · `rows[]`: `label*` `values*[]`(n, one per xLabel) | tiles tint low → high on a single-hue ramp between the data min/max (or the explicit `min`/`max` bounds); short rows pad missing cells as blank tiles |
| `sankey` | `unit` · `nodes[]`: `id*` `label` `accent` `col`(n) · `links*[]`: `from*` `to*` `value*`(n) `label` | accent as in `drivers`. Nodes are INFERRED from the links — declare `nodes` only to relabel, colour, or pin a column. A node's column is the longest link chain reaching it; `col` (1-indexed) overrides. Node height and ribbon thickness are the same scale, so volumes are comparable across the whole diagram; `unit` suffixes every figure. Values must be positive; self-links are dropped |
| `gitgraph` | `branches[]`: `name*` `accent` · `commits*[]`: `branch` `label` `tag` `merge` `from` `kind` | node kind: normal · release · hotfix · revert — accent as in `drivers`. Commits are a SEQUENCE, one step right of the last. The first commit on an unseen branch opens its lane, forking from `from` (else the lane above); `merge: <branch>` closes that branch back into this commit's branch. `tag` draws a release marker above the dot |
| `treemap` | `unit` · `items*[]`: `label*` `value*`(n) `accent` `desc` | accent as in `drivers`. Tiles are laid out squarified (near-square, biggest first), so areas are comparable by eye; each shows its value and share of the total. Label, value and `desc` appear only where the tile is big enough to hold them — the tooltip always carries all three |
| `packet` | `width`(n, default 32) · `fields*[]`: `label*` `bits*`(n) `accent` `value` | accent as in `drivers`. Cell width IS the bit count; a field that doesn't fit the rest of its row wraps and continues on the next one (marked `→` / `(cont.)`). The footer totals bits and bytes and flags a partial last row |
| `venn` | `sets*[]` (2–3): `label*` `accent` `desc` · `shared[]`: `sets*[]` `label*` | accent as in `drivers`. Positions are fixed (two circles, or three on a triangle) — a Venn names regions rather than measuring them. `shared.sets` matches set LABELS (case-insensitive): two names land in that lens, all three in the middle |
| `wardley` | `components*[]`: `id` `label*` `x*`(n, 0–1) `y*`(n, 0–1) `kind` `movement`(n) · `links[]`: `from*` `to*` `label` | kind: user · component · commodity · build · buy. `x` is evolution (0 genesis → 1 commodity), `y` is visibility to the user (0 invisible → 1 visible); both clamp to 0–1. `movement` draws a dashed arrow that far along the evolution axis. `links` join components by `id` (else `label`) into the value chain |
| `figure` | `src*` `alt` `caption` `width`(n, px) | — |
| `steps` | `title` `description` · `items[]`: `title*` `body` `code` `lang` `note` | string items: `Title` or `Title — body` |
| `cycle` | `id` `title` `description` · `steps*[]` (string \| `label*` `desc`) · `center` | 2-8 steps; stages render clockwise from 12 o'clock, last feeds first; `desc`s become the numbered legend |
| `faq` | `title` `description` · `items[]`: `q*` `a*` `open`(bool) | string items: `Question? — Answer`; `open: true` starts a question expanded; `a` is plain text (blank lines become paragraphs) |
| `envelope` | `assumptions[]`: `label*` `value*` · `steps[]`: `label*` `calc*` `result*` · `result{label*, value*}` | every value is a string — quote anything with `, : #`; `result` is the highlighted bottom line |
| `slo` | `items[]`: `name*` `sli*` `target*` `current` `window` `budget`(n, 0..1) | `budget` = fraction of error budget **consumed**: <0.5 green · 0.5–0.8 amber · >0.8 red · >1 exhausted; omit it for no bar |
| `swot` | `strengths[]` `weaknesses[]` `opportunities[]` `threats[]` (string lists) | all four quadrants always draw; omit a list you have no content for |
| `okr` | `items[]`: `objective*` `owner` · `krs[]`: `kr*` `progress*`(n, 0..1) `status` | status: on-track · at-risk · off-track · done (colours the bar; no status → navy). `progress` clamps to 0..1 |
| `persona` | `personas[]`: `name*` `role` `quote` `goals[]` `frustrations[]` `tools[]` `accent` | accent as in `drivers`; avatar initials derive from `name`; empty sections are omitted |
| `changelog` | `releases[]`: `version*` `date` `tag` · `items[]`: `text*` `type` | tag: major · minor · patch · breaking (breaking → red dot + pill) — item type: added · changed · fixed · removed · security (untyped items get no chip) |
| `team` | `members[]`: `name*` `role` `focus` `initials` `accent` | accent as in `drivers`; `initials` overrides the monogram derived from `name` |
| `palette` | `cols`(n, 2-6, default 4) · `colors[]`: `name*` `value*` (hex — **quote it**: `"#0E54A1"`) `on` `usage` | the hex label inside the swatch auto-contrasts from the value; `on` overrides the label color; invalid / unsafe colors fall back to a neutral gray swatch |
| `typescale` | `sample` · `items[]`: `name*` `size*`(n, px) `weight`(n, default 400) `lineHeight`(n, default 1.3) `font` `note` | font: display · body · mono (default body) — the sample renders live at `size`, display-clamped to 10-64px (the label keeps the true size) |
| `dodont` | `dos*[]` / `donts*[]`: `text*` `example` | both lists are required; `example` renders as a mono chip under its guideline |
| `inventory` | `items[]`: `name*` `status*` `tag` `note` | status: stable (green) · beta (blue) · experimental (purple) · deprecated (red) · planned (gray) |
| `divider` | `title*` `kicker` `subtitle` `accent` | accent as in `drivers` — tints the kicker + band wash. Alone under a `##` heading it makes an interstitial slide |
| `bignumber` | `value*` (string — **quote numbers**: `"-75%"`) `label*` `context` `delta` `trend` `accent` | trend: up · down · flat — the arrow stays neutral gray ("down" is often good); `delta` text takes the accent. One number only — a row of KPIs is `stats` |
| `takeaways` | `title` (default Takeaways) · `items*[]` (2-6): `text*` `detail` · `accent` | string items: `Text` or `Text — detail`; accent as in `drivers` — tints the circled row numbers |
| `statustable` | `variant` · `columns[]` (strings; default Task · Update) · `statuses[]`: `label*` `color*` · `rows*[]`: `cells*[]` (string \| number) `status*` `subtasks[]`: `cells*[]` `status*` · legacy `items[]`: `task*` `status` `priority` `owner` `due` | color: navy · blue · teal · green · amber · purple · red · gray, or a semantic alias: success → green · error → red · warn → amber · neutral → gray · info → blue. Every `status` (row or subtask) must match a `statuses` label or a built-in default (case-insensitive): in progress (amber) · blocked (red) · completed (green) · todo (gray) · done (green). variant: tracker + `items[]` (status: todo · doing · done · blocked — priority: high · med · low) is the legacy `tracker`-era shape — accepted in place of `rows`, write `rows` in new blocks |

**Reading the contract:**

- A block with **no items at all** is a `W_EMPTY_BLOCK` warning — give it content
  or delete it. The `*` fields are the minimum to make each item valid.
- **Terse item strings** are the default form for four list fields —
  `sequence.messages` and `flow`/`graph`/`block` `edges` take
  `from -> to: label` (`-->` response/dashed · `-x->` error), `erd.relations`
  takes `from ||--o{ to: label` (crow's-foot cardinality), and
  `timeline.items` takes `[status] date · label · desc`. They expand to the
  object shapes above at parse time; use the object form for anything the
  grammar can't say.
- **Grid blocks** (`flow` · `state` · `dfd` · `c4` · `uml` · `graph` ·
  `felogic` · grid-mode `block`) place
  nodes on a 1-indexed `col`/`row` grid — but coordinates are **optional**: omit
  them on every node and the engine auto-lays the graph out from the edges
  (*quick mode*). Place **all or none** — if any node is missing a coordinate the
  auto-layout replaces every placement. `groups` require placed nodes (zones are
  anchored to grid cells); `swimlane` always needs `col` + `lane`. Adding
  `layers:` to `block` switches it to band
  layout, where nodes use `layer:` (an index) instead of `col`/`row`.
- **Quick mode runs left-to-right.** Ranks become columns, so the diagram grows
  sideways instead of down the page — a tall stack of ranks outgrows both the
  page column and the slide stage. Set `dir: TB` on `flow` · `state` · `dfd` ·
  `c4` · `felogic` · `block` for the top-to-bottom layout instead (`dir: LR` is
  the default and never needs writing). `dir` only steers the auto-layout —
  with coordinates on the nodes it does nothing, so **place a diagram
  horizontally yourself**: put the progression on `col` and the branches on
  `row`. `graph` has no `dir` (its edges already use that key) and `uml` always
  ranks top-to-bottom.
- **Numbers stay unquoted:** coordinates (`col` `row` `lane` `w`), `points`,
  `replicas`, `group`, `start`/`span`, quadrant `x`/`y`, and `emotion[]`. Quote
  anything string-like that *looks* numeric (`version`, `delta: "0"`) — see *YAML pitfalls* in `SKILL.md`.
- **`kind` is optional on most nodes/edges** — omit it for the neutral default;
  set it only to get the right glyph, colour, or marker.

## Field semantics — cross-block clarifications

A few fields are easy to misuse. Lock these in.

- On most diagram blocks: `lede` renders as a `<p class="section-lede">` under
  the section title, sized for an editorial paragraph. `description` renders
  inside the diagram frame as the diagram's caption. Use both when you have
  both kinds of text to convey.
- In grid layout, `col`/`row` are **optional** (*quick mode*): omit them on every
  node and the layout is derived from the edges. Half-placed graphs are fully
  re-laid-out, and `groups` need placed nodes — all or none.

## Alias table — old spellings that keep working

These 12 former block types are **permanent aliases**: the old fence tag
parses to its canonical type with the patch below injected (only for keys the
body doesn't set — the body always wins), and renders byte-identically to how
it always did. `avo check` surfaces the mapping as a `W_ALIAS_TYPE` warning —
informational only; the old spelling keeps working. Use the canonical name +
patch in new blocks.

| Alias | Canonical | Injected patch |
|---|---|---|
| `infra` | `block` | `preset: infra` |
| `event` | `block` | `preset: event` |
| `ddd` | `block` | `preset: ddd` |
| `network` | `block` | `preset: network` |
| `belogic` | `felogic` | `variant: be` |
| `dag` | `flow` | `variant: dag` |
| `waterfall` | `chart` | `kind: waterfall` |
| `funnel` | `chart` | `kind: funnel` |
| `diff` | `code` | `kind: diff` |
| `terminal` | `code` | `kind: terminal` |
| `mece` | `tree` | `variant: issue` |
| `tracker` | `statustable` | `variant: tracker` |
