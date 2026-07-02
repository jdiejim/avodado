# Avodado blocks — Data model

Part of the **avodado-docs** skill (the hub is `SKILL.md`, two folders up).
Field contracts and examples for this family's blocks. The at-a-glance contract
table for all 87 blocks is `contract.md` beside this file; the block → family
map is `INDEX.md`. Schemas reject unknown fields — use exactly these.

### Data model

#### `erd` — entities and relations
```erd
entities:
  - name: users
    columns:
      - { name: id, type: uuid, pk: true }
      - { name: email, type: text }
  - name: devices
    columns:
      - { name: id, type: uuid, pk: true }
      - { name: user_id, type: uuid, fk: true }
      - { name: push_token, type: text }
  - name: notifications
    columns:
      - { name: id, type: uuid, pk: true }
      - { name: user_id, type: uuid, fk: true }
      - { name: status, type: text }
relations:
  - { from: users, to: devices, card: "1:N" }
  - { from: users, to: notifications, card: "1:N" }
```
Column flags are booleans (`pk: true`, `fk: true`). Relation `card` is
`"1:1" | "1:N" | "N:M"`. Quote cardinality values because YAML parses the
unquoted form as a number sequence.
