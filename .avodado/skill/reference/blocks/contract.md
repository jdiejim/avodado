# Avodado blocks — the strict field contract

Part of the **avodado-docs** skill (the hub is `SKILL.md`, two folders up). The
strict field contract for all 87 blocks. Schemas reject unknown fields — use
exactly these.

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
| `callout` | `tone` `title` `body` | tone: note · tip · warn · danger |
| `prose` | `blocks[]`: `type` `text` `items[]` | type: h · p · ul · ol · quote |
| `glossary` | `terms[]`: `term*` `def*` | — |
| `proscons` | `prosLabel` `consLabel` `pros[]` `cons[]` | — |
| `cvt` | `current{label, items[]}` `target{label, items[]}` `note` | — |
| `agenda` | `items[]`: `title*` `time` `duration` `owner` `desc` | — |
| `table` | `columns[]`: string \| `{label*, align, highlight}` · `rows[][]`: string \| number \| `{v*, tone, lead, highlight}` · `note` | align: l · c · r — tone: pos · neg · warn · muted |
| `stats` | `stats[]`: `value*` `label*` `delta` `trend` `accent` | trend: up · down · flat |
| `code` | `blocks[]`: `code*` `title` `lang` | — |
| `tracker` | `items[]`: `task*` `status` `priority` `owner` `due` | status: todo · doing · done · blocked — priority: high · med · low |
| `risk` | `items[]`: `risk*` `likelihood*` `impact*` `mitigation` `owner` `status` | likelihood / impact: low · med · high — status: open · mitigating · accepted · closed. Severity derives: both high → critical · one high → high · both low → low · else medium |
| `kanban` | `columns[]`: `label*` `cards[]`: `title*` `tag` | — |
| `timeline` | `items[]`: `label*` `date` `desc` `status` | status: done · current · next · future |
| `gantt` | `periods[]` · `tasks[]`: `label*` `start`(n) `span`(n) `kind` | kind: done · active · current · milestone |
| `userstory` | `role` `want` `soThat` `priority` `points`(n) · `criteria[]`: `given` `when` `then` · `links[]`: `ref` `mode` `label` | — |
| `sequence` | `actors[]`: `id*` `name*` `sub` `external` · `messages[]`: `from*` `to*` `label` `kind` `summary` `code` `note` · `endpoint{method*, path*, status}` · `foot[]`: `label*` `value*` | msg kind: sync · response · async · error · note — method: GET · POST · PUT · PATCH · DELETE |
| `state` | `states[]`: `id*` `col*`(n) `row*`(n) `name` `kind` · `transitions[]`: `from*` `to*` `event*` `guard` | kind: start · terminal · active · wait |
| `flow` / `dag` | `nodes[]`: `id*` `col*`(n) `row*`(n) `w`(n) `label*` `kind` · `edges[]`: `from*` `to*` `label` `kind` | node kind: start · end · decision · process — edge kind: error |
| `dfd` | `nodes[]`: `id*` `col*`(n) `row*`(n) `name*` `kind` `num` · `edges[]`: `from*` `to*` `label` | kind: process · external · store · datastore |
| `swimlane` | `lanes[]`: `label*` · `steps[]`: `id*` `col*`(n) `lane*`(n) `label*` `kind` · `links[]`: `from*` `to*` `label` | kind: action · decision · start · end · wait |
| `journey` | `stages[]`: `label*` · `rows[]`: `label*` `cells[]` · `emotion[]`(n, 0..1) | — |
| `erd` | `entities[]`: `name*` `columns[]`: `name*` `type` `pk`(bool) `fk`(bool) · `relations[]`: `from*` `to*` `label` `card` | card: "1:1" · "1:N" · "N:M" (quote!) |
| `uml` | `classes[]`: `id*` `col*`(n) `row*`(n) `name*` `stereotype` `attrs[]` `methods[]` · `rels[]`: `from*` `to*` `label` `kind` | rel kind: inheritance · extends · implementation · implements · composition · aggregation · dependency · association |
| `c4` | `level` `boundary{label*}` · `boundaries[]`: `label*` `nodes*[]` `color` · `nodes[]`: `id*` `col`(n) `row`(n) `w`(n) `kind*` `family` `name*` `tech` `desc` · `edges[]`: `from*` `to*` `label` `tech` `kind` | level: context · container · component — node kind: person · system · external · store · container · component — edge kind: solid · dashed · forbidden · error |
| `block` `infra` `event` `ddd` `network` | `systemLabel` · `layers[]`: `label*` `color` · `groups[]`: `id` `col*`(n) `row*`(n) `cols`(n) `rows`(n) `label*` `color` · `nodes[]`: `id*` `name*` (`col`(n)+`row`(n) **or** `layer`(n)) `w`(n) `kind` `tech` · `edges[]`: `from*` `to*` `label` `kind` | node kind: free string (client · service · microservice · db · cache · queue · gateway · cdn · external · …) — edge kind: solid · dashed · forbidden · error |
| `cluster` | `clusters[]`: `id*` `label*` `kind` · `services[]`: `id*` `cluster*` `label*` `kind` `tech` `replicas`(n) · `edges[]`: `from*` `to*` `label` `kind` | edge kind: solid · dashed · forbidden · error |
| `archmap` | `cols`(n, areas per row, 2-4, default 3) · `areas[]`: `label*` `accent` `desc` `items[]`: string \| `{name*, status}` | a plain string is a **current** capability — status: target (dashed blue, to be built) · new (green) · gap (dashed red, missing) · deprecated (gray). accent as in `drivers`; a legend shows only the statuses used |
| `frontend` | `nodes[]`: `id*` `name*` `parent` `kind` `note` | kind: root · layout · page · component · leaf · provider · context · hook · store · state |
| `felogic` / `belogic` | `groups[]` (as `block`) · `nodes[]`: `id*` `col`(n) `row`(n) `w`(n) `kind` `name*` `note` · `edges[]`: `from*` `to*` `label` `kind` | node kind: free string (controller · service · repository · adapter · interface · strategy · hook · …) — edge kind: uses · implements · reads · egress · https · api · dashed · async |
| `graph` | `nodes[]`: `id*` `col`(n) `row`(n) `label*` `group`(n) `state` · `edges[]`: `from*` `to*` `label` `dir` `weight`(n) | dir: directed · undirected — state: visited · current · frontier · target (algorithm walkthroughs; overrides the group colour). `weight` renders on the edge pill — with a label as "label · w" |
| `array` | `items[]`: `value*` (string — **quote numbers**) `tone` `label` · `window{from*(n), to*(n), label}` · `showIndex`(bool, default true) | tone: active · visited · target · muted — `label` renders a pointer marker below its cell; `window` is a 0-based **inclusive** index range (out-of-bounds clamps) |
| `linkedlist` | `kind` (default singly) · `nodes[]`: `value*` `tone` `label` · `nullEnd`(bool, default true) | kind: singly · doubly — tone as `array`; `label` renders a marker above its node; `nullEnd` draws the ∅ terminator |
| `bintree` | `nodes[]`: `id*` `value*` `parent` `side` `tone` | side: left · right — **required when `parent` is set**; one child per side per parent. tone as `array`. Parentless nodes are roots (lay out side by side) |
| `hashmap` | `buckets*`(n) · `entries[]`: `key*` `value` `bucket*`(n) `tone` | tone as `array` — entries with `bucket` outside 0..N-1 are **skipped** (not clamped); rendering caps at 12 buckets with a "+N more" note |
| `agentloop` | `agent*{name*, model, note}` · `tools[]`: `name*` `desc` · `memory[]` (strings) · `env` (default User) · `stop` | no tools → the loop is just ① prompt / ④ response; the tool column caps at 5 cards + "+N more"; the memory cylinder draws only when `memory:` is present; `stop` renders as a "stops when:" foot pill |
| `trace` | `turns*[]`: `role*` `text` `thinking` `tool` `args` `result` | role: user · assistant · tool · system — `thinking` renders before `text` (assistant); `tool`+`args`+`result` shape a tool turn; multi-line strings keep their line breaks |
| `prompt` | `segments*[]`: `kind*` `label` `text*` · `vars[]`: `name*` `desc` | kind: system · user · assistant · tool — any `{{variable}}` in `text` renders as an amber chip. **Quote `text` containing `{{ }}`** — bare braces are YAML flow syntax |
| `context` | `window*`(n) `unit` (default tokens) · `segments*[]`: `label*` `tokens*`(n) `accent` `desc` | accent as in `drivers` — zero-token segments are skipped; leftover space renders as a dim "free (N)" segment; a sum past `window` renders in red past a dashed boundary with an "over budget" chip |
| `mece` | `nodes[]`: `id*` `parent` `label*` `note` | — |
| `tree` | `nodes[]`: `id*` `parent` `label*` `note` | — |
| `pyramid` | `levels[]`: `label*` `desc` | — |
| `quadrant` | `xAxis{label, low, high}` `yAxis{label, low, high}` · `items[]`: `x*`(n, 0..1) `y*`(n, 0..1) `label*` | — |
| `wireframe` | `screens[]`: `device` `title` `url` `label` `elements[]`: `type` `label` `rows`(n) `align` `tone` | device: desktop · browser · phone — element type: header · subheader · text · button · input · search · image · avatar · card · list · nav · tabs · divider · badge · toggle · spacer — align: l · c · r — tone: accent · muted · danger |
| `endpoint` | `method*` `path*` `title` `description` `auth` · `params[]`: `name*` `in` `type` `required`(bool) `desc` · `body[]`: `name*` `type` `required`(bool) `desc` · `responses[]`: `status*`(n) `desc` · `request` `response` | method: GET · POST · PUT · PATCH · DELETE · HEAD · OPTIONS — `in`: path · query · header · cookie |
| `pullquote` | `text*` `attribution` | — |
| `layers` | `title` `description` · `items[]`: `title*` `kicker` `source` `question` `body` | — |
| `matrix` | `title` `description` `corner` `cols*[]` · `rows[]`: `label*` `cells*[]` (one per col, in order) | cell tints: Full/Admin/Write/✓ → green · —/None/✗ → muted · else → amber |
| `anatomy` | `title` `description` `separator` (default `:`) · `parts[]`: `label*` `value*` `note` | — |
| `composition` | `title` `description` `result` · `gates[]`: `label*` `desc` `kicker` `source` | renders `gate₁ ∩ gate₂ ∩ … = result`; per-gate `kicker`/`source` add a coloured header + source line |
| `drivers` | `title` `description` · `items[]`: `title*` `body` `tag` `icon` `accent` | icon: location·shield·grid·lock·key·user·clock·check·database·bolt·flag·doc·link·eye·server·layers — accent: navy·blue·teal·green·amber·purple·red·gray |
| `options` | `title` `description` · `items[]`: `title*` `kicker` `how` `pros[]` `cons[]` `verdict` `tone` | tone: rejected·viable·chosen·warn·neutral (chosen is highlighted) |
| `scorecard` | `criteria[]`: `label*` `weight`(n, default 1) · `options[]`: `label*` `scores*[]`(n, one per criterion) `note` | scores on a 0-5 scale by convention; the highest weighted total wins (ties highlight all) |
| `spec` | `title` `description` `accent` · `rows[]`: `label*` (`value` **or** `steps[]`) | a `steps[]` row renders as an arrow-joined pill flow — accent as in `drivers` |
| `list` | `title` `description` `style` `accent` · `items[]`: `lead*` `text` `icon` `accent` `done`(bool) | style: accent · check · icon · number — icon/accent as in `drivers`; `done: false` dims a check row |
| `stories` | `title` `description` · `items[]`: `id` `title` `role` `want` `soThat` `priority` `points`(n) `tags[]` `open`(bool) · `criteria[]`: `given` `when` `then` · `links[]`: `ref` `mode` `label` | each item is a collapsible story; `open: true` starts expanded; `links[].ref` is a real `doc#id` cross-reference |
| `pattern` | `name*` `category` `intent` `forces[]` `solution` `structure` `note` · `participants[]`: `name*` `role` · `consequences{pros[], cons[]}` | — |
| `gallery` | `title` `description` `cols`(n) · `items[]`: `title` `code` `lang` `caption` `accent` | a card with `code` renders a highlighted snippet; without it, a title+caption note. Responsive grid (set `cols` to fix the column count). |
| `chart` | `kind` `unit` `max`(n) `labels[]` · `series[]`: `label*` `accent` `values*[]`(n) · `items[]` (donut): `label*` `value*`(n) `accent` | kind: bar · line · area · donut · radar (default bar) — accent as in `drivers`. `labels`+`series` drive bar/line/area/radar; `items` drives donut. `unit` suffixes values; `max` caps the y-axis (radar: the outer ring). Radar needs 3+ labels as axes. |
| `waterfall` | `unit` (default ms) `budget`(n) · `items[]`: `label*` `value*`(n) `desc` | bars cascade left→right in item order and a navy TOTAL bar closes the run; `budget` draws a dashed cap — segments past it tint red and the total row gets an over/under chip |
| `heatmap` | `xLabels*[]` `unit` `min`(n) `max`(n) · `rows[]`: `label*` `values*[]`(n, one per xLabel) | tiles tint low → high on a single-hue ramp between the data min/max (or the explicit `min`/`max` bounds); short rows pad missing cells as blank tiles |
| `figure` | `src*` `alt` `caption` `width`(n, px) | — |
| `diff` | `title` `lang` `code*` (unified-diff text) | lines starting `+` added · `-` removed · `@@` hunk header · else context |
| `steps` | `title` `description` · `items[]`: `title*` `body` `code` `lang` `note` | — |
| `faq` | `title` `description` · `items[]`: `q*` `a*` `open`(bool) | `open: true` starts a question expanded; `a` is plain text (blank lines become paragraphs) |
| `envelope` | `assumptions[]`: `label*` `value*` · `steps[]`: `label*` `calc*` `result*` · `result{label*, value*}` | every value is a string — quote anything with `, : #`; `result` is the highlighted bottom line |
| `slo` | `items[]`: `name*` `sli*` `target*` `current` `window` `budget`(n, 0..1) | `budget` = fraction of error budget **consumed**: <0.5 green · 0.5–0.8 amber · >0.8 red · >1 exhausted; omit it for no bar |
| `terminal` | `title` `session*` (shell text) | per line: `$ ` command · `# ` comment · anything else output |
| `swot` | `strengths[]` `weaknesses[]` `opportunities[]` `threats[]` (string lists) | all four quadrants always draw; omit a list you have no content for |
| `funnel` | `unit` · `stages[]`: `label*` `value*`(n) `desc` | bands are proportional to `value / max` (28% floor); a `↓ NN%` chip between stages shows conversion — honestly >100% when a stage grows |
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
| `takeaways` | `title` (default Takeaways) · `items*[]` (2-6): `text*` `detail` · `accent` | accent as in `drivers` — tints the circled row numbers |

**Reading the contract:**

- A block with **no items at all** is a `W_EMPTY_BLOCK` warning — give it content
  or delete it. The `*` fields are the minimum to make each item valid.
- **Grid blocks** (`flow` · `state` · `dfd` · `c4` · `uml` · `graph` ·
  `felogic`/`belogic` · grid-mode `block`/`infra`/`event`/`ddd`/`network`) place
  nodes on a 1-indexed `col`/`row` grid — but coordinates are **optional**: omit
  them on every node and the engine auto-lays the graph out from the edges
  (*quick mode*). Place **all or none** — if any node is missing a coordinate the
  auto-layout replaces every placement. `groups` require placed nodes (zones are
  anchored to grid cells); `swimlane` always needs `col` + `lane`. Adding
  `layers:` to `block`/`infra`/`event`/`ddd`/`network` switches them to band
  layout, where nodes use `layer:` (an index) instead of `col`/`row`.
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
