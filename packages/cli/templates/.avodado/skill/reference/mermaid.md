# Mermaid input dialect

Part of the **avodado-docs** skill (the hub is `SKILL.md`, one folder up).

A ` ```mermaid ` fence is a second way to write five block types. The parser
reads the first line of the body and converts the diagram into the matching
typed block. Validation and rendering are the same as for a YAML block. The
Markdown file keeps the Mermaid text until an editor changes the block; an
edit writes the block back as YAML under its canonical tag.

| First line | Block | What it becomes |
|---|---|---|
| `sequenceDiagram` | `sequence` | actors + messages |
| `flowchart` / `graph` (+ `TD` `TB` `LR` `RL` `BT`) | `flow` | nodes + edges, auto-laid-out |
| `erDiagram` | `erd` | entities + relations |
| `stateDiagram` / `stateDiagram-v2` | `state` | states + transitions |
| `pie` | `chart` (`kind: donut`) | title + items |

Any other first line (`gantt`, `classDiagram`, `mindmap`, `gitGraph`, …) is
not converted. The fence stays prose and renders as a plain code block, with
no diagnostic. `%%` comment lines are ignored in every grammar.

## The rule

Write a ` ```mermaid ` fence when you already know the Mermaid grammar and
the diagram needs only what the subset below can say. Switch to the typed
YAML block when you need a field Mermaid cannot say: `endpoint`, `foot`,
`summary` / `code` / `note` on a message, `groups`, `guard`, node `kind`
overrides, `accent`, `description`, or `lede`. Never mix: one fence is either
Mermaid or YAML.

## sequenceDiagram

- `participant A`, `participant A as Name`, `actor A as Name` → an actor
  `{ id, name }`. Without `as`, the id is the name. An id used in a message
  but never declared is added at its first use, in order, as Mermaid does.
- Messages: `A->>B: text` sync · `A-->>B: text` response · `A-)B: text`
  async · `A--)B: text` response · `A-xB: text` and `A--xB: text` error ·
  `A->B:` sync · `A-->B:` response. The text after `:` is the label.
- `Note over A,B: text`, `Note right of A: text`, `Note left of A: text` →
  a message `{ from: A, to: B, kind: note }` (`to` is `A` for a one-actor
  note).
- `title Text` → `title`.
- Ignored: `autonumber`, `activate` / `deactivate`, `+` / `-` activation
  suffixes on an arrow, and the framing lines `alt` / `else` / `opt` /
  `loop` / `par` / `and` / `critical` / `option` / `break` / `rect` / `box`
  / `end`. The messages inside a frame are kept; the frame is lost.
- Any other line is an error (`E_PARSE_MERMAID`, with the line number).

## flowchart / graph

- Direction: `TD` and `TB` → `dir: TB`; `LR`, `RL`, `BT` → `dir: LR`; none →
  `TB`. The renderer lays the nodes out; Mermaid positions are not kept.
- Node shapes: `A[text]`, `A(text)`, `A[/text/]`, `A[\text\]`, `A>text]`,
  `A[(text)]`, `A[[text]]` → process. `A{text}`, `A{{text}}` → `decision`.
  `A([text])`, `A((text))` → `start` when the node has no incoming edge,
  `end` when it has no outgoing edge, otherwise process. A bare `A` uses the
  id as its label. Quotes around a label are removed. Ids keep their Mermaid
  spelling.
- Edges: `A --> B`, `A -->|label| B`, `A -- label --> B`, `A -.-> B`,
  `A -. label .-> B`, `A ==> B`, `A --- B`. A dotted edge (`-.->`) becomes
  `kind: dashed`; a thick edge (`==>`) renders as a plain edge. `A --x B` →
  `kind: error`. `A <--> B` is one edge from A to B.
- Chains `A --> B --> C` and fans `A & B --> C` expand to one edge per pair.
  `;` separates statements on one line.
- Lost: `subgraph … end` framing. The nodes inside are kept; the box is
  dropped, because `flow` groups need grid coordinates and the auto layout
  has none. Add `groups` with `col` / `row` in a YAML `flow` block instead.
- Ignored: `style`, `classDef`, `class`, `click`, `linkStyle`, `direction`
  inside a subgraph, and `:::class` suffixes.

## erDiagram

- `A ||--o{ B : label` → a relation. Left ends `||` `|o` (one) and `}o` `}|`
  (many); right ends `||` `o|` (one) and `o{` `|{` (many). One–one → `1:1`,
  one–many → `1:N`, many–one → `N:1`, many–many → `N:M`. `--` and `..` bodies
  are the same (identifying vs non-identifying is lost). The label loses its
  quotes; `""` means no label.
- `A { type name PK "comment" }` → an entity with `columns: [{ name, type,
  pk }]`. `FK` → `fk: true`. `UK` and the comment are dropped. An entity
  named only in a relation is added with no columns. Names may be quoted:
  `"Order Line"`.
- Ignored: `direction`.

## stateDiagram / stateDiagram-v2

- `[*]` becomes a pseudo-state node: `_start` (`kind: start`, the filled
  dot) or `_end` (`kind: terminal`, the bullseye). `[*] --> A : event` and
  `A --> [*]` are ordinary transitions from or to that node.
- `A --> B : event` → `{ from, to, event }`. Without `: event` the event is
  the empty string, which renders as an unlabelled arrow.
- `state "Long name" as A` → `{ id: A, name: "Long name" }`. `A : text` sets
  the name of A. A bare `state A` or an id used only in a transition is named
  by its id.
- `direction LR|TB` at the top level → `dir`.
- Lost: composite states `state A { … }` are flattened. The inner states and
  transitions are kept; the container box is dropped. An inner `[*]` gets
  its own pseudo-state, `_start_A` / `_end_A`.
- Ignored: `note … end note` blocks, one-line `note right of A : text`, `--`
  concurrency separators, `<<fork>>`-style stereotypes, `classDef`, `class`.

## pie

- `pie`, optionally followed by `showData` and/or `title Text` on the same
  line. `title Text` on its own line also works.
- `"Label" : 42` → an item `{ label, value }`. Decimals are accepted.
- Result: `{ kind: donut, title?, items }`.

## Errors

`E_PARSE_MERMAID` names the body line the subset cannot read. Fix the line to
match the subset above, or rewrite the block as typed YAML. A Mermaid fence
never produces `W_ALIAS_TYPE`.
