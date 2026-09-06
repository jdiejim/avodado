---
'@avodado/studio': minor
'@avodado/render': patch
'@avodado/core': patch
---

Studio: right-click menus and motion on the direct-edit layer.

- **Context menus** (right-click, ⇧F10, the Menu key) on every diagram part — grid nodes (add a connected node in a direction with a kind picker, change kind, replicas, add to / remove from group, rename, delete with its edges), edges (kind, edit label, reverse, delete), empty cells (insert node / group), the block background (insert node, direction, open YAML), sequence actors and messages (connect mode, notes, kind, wrap a range in `alt`/`opt`/`loop`/…, activate/deactivate, delete), ERD entities and columns (add column, relation mode, pk/fk/unique/nullable/indexed toggles, delete). Every item is ≤ 2 clicks from the right-click and writes the same YAML ops the drag/connect layers emit — one undo step each.
- **Motion**: commits play a FLIP (transform-only, 140 ms ease-out) across the re-render; new parts pop, re-routed edges crossfade, deletions fade out first. The connect ghost edge is dashed terra and the snap target gets a highlight ring. All skipped under `prefers-reduced-motion`.
- `felogic` and `cluster` join the connect-spec table (drag-to-move, connect, menus); the felogic renderer now emits the grid metadata attrs the editor reads (no visual change).
- core exports `SEQUENCE_FRAME_KINDS`.
