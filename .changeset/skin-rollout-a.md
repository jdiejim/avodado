---
'@avodado/render': patch
'@avodado/studio': patch
---

Editorial skin (`packages/render/DESIGN.md`) on the graph-family SVG renderers: `state`, `dfd`, `swimlane`, `cycle`, `gitgraph`, `graph`, `cluster`, `felogic`, `frontend`, `uml` and `c4`. Kinds now travel through stroke weight, dash, fill and eyebrow chips (`EXT`, `DB`, `DECISION`, `WAIT`, `INTERFACE`, `CONTROLLER`, `ROOT`, `VISITED`, `PERSON`, `SYSTEM`, `CONTAINER`, …) instead of a hue per kind; each diagram spends colour on one accent the renderer derives from the data (the success exit of a state machine, the single external entity of a DFD, the trunk of a branch graph, the target of a graph walk, the entry module of a logic graph, the root of a component tree, the single interface of a class model, the system in scope of a top-level C4 diagram) and on `negative` for real error exits. Every figure gets a legend strip listing only the encodings it used. The legacy hex palette (`svg/legacyPalette.ts`) is gone; `cluster` draws its services with the block family's shaped nodes. Studio bundles the renderer, so it ships the same skin.
