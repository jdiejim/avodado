# Avodado blocks — Data model

Part of the **avodado-docs** skill (the hub is `SKILL.md`, two folders up).
Exact fields for every block: `contract.md` beside this file; block → family
map: `INDEX.md`. Schemas reject unknown fields — use exactly these.

**Shape**: Network — entities joined by cardinality edges, no nesting
(`erd`).
**Answers**: What shape is the data at rest, and how do the entities relate?
**Not this family**: data in motion → `dfd` (flows.md) or `sankey`
(charts-overviews.md); classes with behavior → `uml` (architecture.md);
example rows the reader should scan → `table` (tables-data.md).

### Data model

#### `erd` — entities and relations
```erd
groups:
  - { name: auth, entities: [users, devices] }
enums:
  - { name: status, values: [queued, sent, read] }
entities:
  - name: users
    note: People who sign in.
    columns:
      - id uuid pk default=gen_random_uuid()
      - email citext unique !null
  - name: devices
    columns:
      - id uuid pk
      - user_id uuid fk -> users.id !null idx
      - push_token text
  - name: notifications
    columns:
      - id uuid pk
      - user_id uuid fk -> users.id
      - status enum(queued,sent,read)
      - read_at timestamptz null
  - name: unread_counts
    kind: view
    columns:
      - user_id uuid
      - unread int
relations:
  - users ||--o{ devices: owns
  - users ||..o{ notifications: receives
  - users ||--o| unread_counts: summarised by
```

The renderer lays the model out: the aggregate root (the entity on the "one"
side of the most relations) is centred and takes the accent, its neighbours
fan out by relation depth, a join table sits between its parents. `dir: TB`
swaps columns for rows. Nothing is truncated — cards grow.

**Columns** — terse string `name type flags…` (any order after the name):

| Token | Field | Drawn as |
|---|---|---|
| `pk` | `pk: true` | `#` |
| `fk` · `-> table.column` | `fk: true` (+ `ref`) | `→`, the target after the type |
| `unique` / `uk` | `unique: true` | `U` |
| `!null` / `notnull` | `nullable: false` | — |
| `null` / `?` | `nullable: true` | `?` |
| `index` / `idx` | `index: true` | `⌘` |
| `default=<value>` | `default` | `= value` after the type |
| `enum(a,b,c)` | `type: enum`, `enum: [a, b, c]` | a soft sub-row of values |

Everything else joins the type (`double precision`, `numeric(10,2)`). The
object form (`{ name, type, pk, fk, unique, nullable, default, index, enum,
ref, note }`) is the escape hatch; `note` shows on hover.

**Entities** — `name*`, `kind` (`table` default · `view` · `enum` ·
`external`, drawn as a chip; `external` is dashed), `schema` (draws a panel
around every entity that shares it), `note` (a soft line under the name),
`columns`, `indexes: [{ columns: [a, b], unique, name }]` (composite
indexes; single-column ones belong on the column).

**Relations** — `from <op> to: label`. The crow's-foot operator carries the
cardinality and the body carries the kind: `--` identifying (solid), `..`
non-identifying (dashed). Ends: `||` one · `}o` `}|` many (left); `||` one ·
`o|` optional one · `o{` `|{` many (right):

`||--||` 1:1 · `||--o{` 1:N · `}o--||` N:1 · `}o--o{` N:M · `||--o|` 0..1 ·
`||..o{` 1:N non-identifying. A plain `->` means no cardinality. The object
form (`{ from, to, card: "N:1", label, identifying: false, fromCol, toCol }`)
is the escape hatch — `card` is one of `"1:1" "1:N" "N:1" "N:M" "0..1"
"0..N"`, quoted, read from → to; `fromCol` / `toCol` pin the routed rows
when the FK cannot be inferred from `ref` or the column name.

**Top level** — `title`, `description`, `dir` (`LR` default · `TB`),
`groups: [{ name, entities: [...] }]` (explicit schema panels), `enums:
[{ name, values: [...] }]` (small cards in a side column).

Budget: 20 entities or 60 columns per block; past that `avo check` warns —
split the model by domain.

**Other ways to write it** — a ` ```dbml ` or ` ```prisma ` fence parses
into an `erd` (and ` ```mermaid ` + `erDiagram`); `avo sync sql schema.sql
--out docs/data-model.md` (or `sync dbml` / `sync prisma`) converts a schema
file. The subsets are in `reference/mermaid.md` (Input dialects).
