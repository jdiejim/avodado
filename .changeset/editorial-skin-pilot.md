---
'@avodado/render': minor
'@avodado/studio': patch
'avodado': patch
---

Pilot of the editorial skin (`packages/render/DESIGN.md`) on four blocks: `sequence`, `flow`, `block` (grid and layered, all presets) and `erd`. Meaning now travels through shape, stroke weight, dash and eyebrow chips (`SVC`, `DB`, `EXT`, `ENTITY`, `AGGREGATE ROOT`, …); each diagram spends colour on one accent the renderer picks from the data (the caller's final response, the happy-path exit, the entry gateway, the aggregate root) and on `negative` for real errors. Every figure gets a legend strip listing only the encodings it used. Shared chrome moves with it: role tokens (`--paper`, `--ink`, `--muted`, `--accent`, …) with a dark set on `[data-theme="dark"]` and `prefers-color-scheme`, the legacy token names kept as aliases, five type-role classes (`.t-name` … `.t-badge`), a quiet frame (dot-grid `paper-2` ground, hairline border, plain eyebrow instead of the family pill), and figures that never upscale (`--scale` lets decks enlarge them). The other 86 renderers are not restyled yet and keep rendering through the aliases. Studio bundles the renderer, so it ships the same skin.
