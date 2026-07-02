# The 87 block types — by family

Part of the **avodado-docs** skill (the hub is `SKILL.md`, two folders up).
The map from block type → the family file beside this one that holds its full
field contract and worked example. Read `contract.md` for the exact
required/optional fields of every block at a glance; read the one family file
you need before writing a block.

| Block | Family file | What it represents |
|---|---|---|
| `meta` | `narrative.md` | Document header — title, subtitle, tag pill. Always the first block. |
| `callout` | `narrative.md` | A single aside: note / tip / warn / danger. |
| `table` | `tables-data.md` | Genuinely tabular data (rows × columns of values); cells can carry tone. |
| `sequence` | `flows.md` | Messages between actors **over time** (lifelines, returns); optional step list + endpoint pill. |
| `erd` | `data-model.md` | Entity-relationship diagram — tables, columns, PK/FK, crow's-foot cardinality. |
| `userstory` | `planning.md` | An agile story: role / want / soThat + acceptance criteria + links. |
| `timeline` | `planning.md` | Phases in order with status dots (done / current / next / future). |
| `kanban` | `planning.md` | Flexible named columns (e.g. Now / Next / Later) of cards. |
| `tracker` | `planning.md` | A task list with status / priority / owner / due. |
| `prose` | `narrative.md` | Structured prose (headings, paragraphs, lists, quotes) carried as data. |
| `glossary` | `narrative.md` | Term → definition rows. |
| `proscons` | `planning.md` | Two columns weighed against each other: pros vs cons. |
| `cvt` | `planning.md` | Current → target (before / after) as two side-by-side panels. |
| `stats` | `tables-data.md` | KPI cards — a value with a delta and an up/down/flat trend. |
| `code` | `tables-data.md` | One or more syntax-highlighted snippets under a titled header bar. |
| `agenda` | `planning.md` | Meeting agenda — time, duration, owner, topic per row. |
| `tree` | `charts-overviews.md` | An indented file/folder hierarchy (HTML, not SVG). |
| `pyramid` | `charts-overviews.md` | A layered pyramid (strategy / hierarchy), widening top → bottom. |
| `flow` | `flows.md` | A decision flowchart — start / process / decision / end nodes, with `error` exits. |
| `state` | `flows.md` | A state machine — states + event transitions (+ a transition table). |
| `dfd` | `flows.md` | Data-flow — processes, external entities, and datastores. |
| `journey` | `charts-overviews.md` | A user journey across stages, with an optional emotion curve. |
| `gantt` | `charts-overviews.md` | A schedule — tasks as bars across date columns. |
| `graph` | `charts-overviews.md` | A generic node-link graph with colour-cycled groups. |
| `quadrant` | `charts-overviews.md` | A 2×2 matrix (e.g. effort vs impact) with plotted items. |
| `swimlane` | `flows.md` | A cross-functional process with one horizontal lane per role. |
| `c4` | `architecture.md` | C4 model (context / container / component) — people, systems, containers, stores. |
| `uml` | `architecture.md` | A class diagram — attributes, methods, UML relationships. |
| `mece` | `charts-overviews.md` | A MECE issue tree — one problem broken into mutually-exclusive branches. |
| `frontend` | `architecture.md` | A top-down component tree — root / layout / page / component / provider / hook / store. |
| `cluster` | `architecture.md` | Kubernetes-style namespaces holding services, with replica counts. |
| `block` | `architecture.md` | Generic boxes-and-arrows architecture — grid **or** horizontal `layers`, dashed `groups` zones. |
| `infra` | `architecture.md` | Cloud topology (same engine as `block`) — CDN / gateway / compute / DB, nested account & network zones. |
| `felogic` | `architecture.md` | Frontend module/logic graph — components, hooks, interfaces, strategies; group zones + egress edges. |
| `belogic` | `architecture.md` | Backend module/logic graph (same engine) — controller / service / repository / adapter / gateway + egress. |
| `event` | `architecture.md` | Pub/sub topology (same engine) — producers → topics → consumers. |
| `ddd` | `architecture.md` | DDD bounded-context map (same engine). |
| `network` | `architecture.md` | Security zones with trust boundaries (same engine); supports `forbidden` (red) edges. |
| `dag` | `architecture.md` | A pipeline / DAG — same shapes as `flow`, framed for CI/CD. |
| `wireframe` | `design-system.md` | Low-fi UI mockups inside device frames — desktop / browser / phone screens. |
| `endpoint` | `api.md` | A Swagger-style API endpoint card — method, path, params, request body, responses, examples. |
| `pullquote` | `api.md` | A standout pull-quote with optional attribution. |
| `layers` | `api.md` | A layered explanation — N numbered layers, each a kicker / title / source / question + body. |
| `matrix` | `business.md` | A role × resource capability grid; cells tint by permission level. |
| `anatomy` | `business.md` | The labelled parts of a structured string (e.g. `app:feature:action`). |
| `composition` | `business.md` | Effective access as intersected gates — `gate₁ ∩ gate₂ ∩ … = result`. |
| `drivers` | `business.md` | A grid of factor/driver cards — icon + title + body + tag, the forces that shaped a design. |
| `options` | `business.md` | Approaches explored — cards with pros / cons / verdict; the chosen one is highlighted. |
| `spec` | `business.md` | A labelled spec sheet — `label → value` rows (a value can be an inline step-flow). |
| `list` | `planning.md` | A fancy bullet list — bold lead + supporting line per row, in one of four marker styles (accent bar / check / icon / number). |
| `stories` | `planning.md` | A collapsible backlog of user stories — many stories as `<details>` accordions in one section. |
| `pattern` | `planning.md` | A design-pattern reference card — intent · forces · participants · consequences. |
| `gallery` | `planning.md` | A responsive grid of cards — code snippets or notes (a bug gallery, a comparison grid). |
| `chart` | `charts-overviews.md` | A data chart — bar / line / area / donut / radar in pure SVG, series coloured by accent. |
| `figure` | `narrative.md` | An image with a caption in a bordered card (optional pixel width cap). |
| `diff` | `tables-data.md` | A unified diff on the dark editor surface — `+` added, `-` removed, `@@` hunks. |
| `steps` | `flows.md` | A numbered how-to / runbook stepper — title + body + optional command + note per step. |
| `faq` | `narrative.md` | Q&A accordions — native `<details>`, question in the summary, answer expands. |
| `envelope` | `business.md` | Back-of-envelope capacity math — assumptions, derivation rows, a highlighted bottom line. |
| `slo` | `tables-data.md` | Service-level objectives — SLI, target vs current, and an error-budget burn bar. |
| `terminal` | `tables-data.md` | A shell session on the dark surface — `$ ` commands, `# ` comments, output lines. |
| `swot` | `business.md` | A classic SWOT 2×2 — strengths / weaknesses / opportunities / threats as tinted quadrant cards. |
| `funnel` | `business.md` | A conversion funnel — stacked bands proportional to value, with stage-to-stage conversion chips. |
| `okr` | `business.md` | Objectives + key results — one card per objective, a status-coloured progress bar per KR. |
| `persona` | `business.md` | User persona cards — avatar, role, quote, goals, frustrations, tools. |
| `changelog` | `planning.md` | Release history on a vertical rail — version pills, dates, and typed change chips. |
| `team` | `business.md` | Compact people cards — initials avatar, name, role, focus area. |
| `waterfall` | `charts-overviews.md` | A budget cascade — bars start where the previous total ended; optional dashed budget cap. |
| `heatmap` | `charts-overviews.md` | A numeric grid with an intensity ramp — rows × columns of tiles tinted by value. |
| `scorecard` | `business.md` | A weighted decision matrix — criteria rows × option columns, weighted totals, winner highlighted. |
| `risk` | `planning.md` | A risk register — severity derived from likelihood × impact, with mitigation, owner, status. |
| `palette` | `design-system.md` | Color-token swatches — name, hex value, and usage per color, on a card grid. |
| `typescale` | `design-system.md` | A live type specimen — each row renders the sample text at its real size / weight / font. |
| `dodont` | `design-system.md` | Do / don't guideline cards — what to do (green ✓) vs what to avoid (red ✕), with optional mono examples. |
| `inventory` | `design-system.md` | A component / feature status board — name + color-coded status chip (stable · beta · experimental · deprecated · planned) per row. |
| `array` | `algorithms.md` | Array cells for algorithm walkthroughs — tones, pointer labels below cells, a dashed index-window highlight. |
| `linkedlist` | `algorithms.md` | A pointer-chain diagram (singly or doubly) — boxed nodes with next/prev arrows, markers like `head`/`curr`, a ∅ terminator. |
| `bintree` | `algorithms.md` | A binary tree — nodes placed by `parent` + `side`, tinted to show search paths, traversals, heap shapes. |
| `hashmap` | `algorithms.md` | Hash buckets with chained entries — collision chains read left → right as key/value pills. |
| `agentloop` | `agentic.md` | The canonical LLM agent loop — environment → agent (model chip) → tools column, memory cylinder, numbered loop arrows, stop condition. |
| `trace` | `agentic.md` | An agent / session execution transcript — user / assistant / tool / system turns, with `thinking` and tool `args` → `result`. |
| `prompt` | `agentic.md` | Prompt anatomy — stacked role segments (system / user / assistant / tool) with `{{variable}}` chips and a variable legend. |
| `context` | `agentic.md` | A context-window token budget — one stacked bar sized against the window, with free space and over-budget overflow. |
| `archmap` | `architecture.md` | A target-architecture capability map — a mosaic of tinted domain areas packed with small status-coded capability tiles (current · target · new · gap · deprecated). |
| `divider` | `narrative.md` | A full-width section break — kicker ("PART 2"), display title, optional subtitle on an accent-washed band; a clean interstitial slide in decks. |
| `bignumber` | `narrative.md` | One hero metric at presentation scale — a display-size value with an optional delta + neutral trend arrow, a one-line claim, and a context line. |
| `takeaways` | `narrative.md` | The 2-6 things to remember — numbered rows at presentation scale, each a bold one-liner with an optional detail; a deck's closing slide. |
