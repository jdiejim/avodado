# Avodado blocks — Data model

Part of the **avodado-docs** skill (the hub is `SKILL.md`, two folders up).
Field contracts and examples for this family's blocks. The at-a-glance contract
table for all 77 blocks is `contract.md` beside this file; the block → family
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
  - users ||--o{ devices: owns
  - users ||--o{ notifications: receives
```
Column flags are booleans (`pk: true`, `fk: true`). Relations default to the
terse crow's-foot form — `from <op> to: label`, where the operator carries the
cardinality: `||--||` 1:1 · `||--o{` 1:N · `}o--||` N:1 · `}o--o{` N:M, and a
plain `->` means no cardinality. The object form
(`{ from: users, to: devices, card: "1:N" }`) remains the escape hatch — there
`card` is `"1:1" | "1:N" | "N:M"`, quoted, because YAML parses the unquoted
form as a number sequence.
