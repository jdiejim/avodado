---
"@avodado/core": minor
"avodado": patch
---

**Terse sugar everywhere.** Eleven more fields accept one-line string items:

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
