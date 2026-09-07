---
'@avodado/core': minor
'@avodado/studio': patch
---

Keep terse list forms when a whole list is rewritten.

A list written in terse sugar (`- App -> Auth: POST /token`) used to survive
only until something wrote the whole array back: `setYamlPath` handed the value
to the `yaml` library's `setIn`, which reserialises from plain data, so deleting
one message rewrote every other one as three lines of `from:`/`to:`/`label:`.
One deleted line became a rewrite of the block, and the `.md` diff — the review
surface — stopped showing what actually changed.

- **`contract`, the inverse of `expand`.** Every terse grammar in
  `blocks/normalize.ts` now has a `contract(value)` that writes the canonical
  object back as its terse string. A contraction is used only when
  `expand(contract(v))` deep-equals `v`, so an item carrying anything the
  grammar cannot say — a `summary`, a `note`, a `kind` no arrow spells, an id
  the grammar would re-split — falls back to the object form on its own.
- **New exports:** `contractTerseItems(kind, field, items)`,
  `contractTerseValue`, `canonicalTerseItem`, `hasTerseGrammar`, and
  `contractTerseAt(raw, path, kind)` — the way back after a deep edit had to
  expand an item, so renaming one field on a terse line keeps it one line.
- **`setYamlPath(raw, path, value, kind?)`** takes an optional block kind. With
  it, an unchanged item keeps the author's own YAML node (byte-identical, with
  its comments and quoting), a new item is contracted where that is faithful,
  and a list the author wrote entirely in field form stays in field form.
  Without it the behaviour is unchanged.
- The terse grammars now live in one registry that both parsing and editing
  read, so the two cannot drift. That registry fix also makes the arrow sugar
  (`- web -> pg: writes`) work for `cluster` edges, where it was registered
  against a field name no cluster body has.
- **Studio** commits through the kind-aware write, and the menu ops that could
  address one index now do: a leaf-node / actor / entity delete, an append, and
  a duplicate or insert at the end of a list. A reorder still rewrites its list
  — that is what the preservation above is for.
