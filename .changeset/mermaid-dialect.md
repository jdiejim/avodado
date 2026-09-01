---
'@avodado/core': minor
'avodado': patch
'@avodado/mcp': patch
'@avodado/studio': patch
---

feat(core): Mermaid input dialect — a ```` ```mermaid ```` fence parses into a typed block

- A ```` ```mermaid ```` fence whose first line is `sequenceDiagram`, `flowchart` / `graph`, `erDiagram`, `stateDiagram` / `stateDiagram-v2`, or `pie` parses into the matching `sequence`, `flow`, `erd`, `state`, or `chart` (donut) block with `sourceType: 'mermaid'`. The converter (`core/src/mermaid/`, `convertMermaid`) emits exactly the data the block schema accepts, so validation and rendering are identical to a YAML block. Any other Mermaid grammar (gantt, classDiagram, mindmap, …) stays prose, exactly as before, and is never flagged as a suspect fence.
- New diagnostic code `E_PARSE_MERMAID` (error, same shape as `E_PARSE_YAML`, positioned at the offending body line) for a line outside the supported subset. A Mermaid fence never emits `W_ALIAS_TYPE`.
- `replaceBlockBody` on a Mermaid segment rewrites the opening fence to the canonical block tag, so an edit from Studio or the MCP writes YAML under ` ```sequence ` (etc.), never YAML under ` ```mermaid `. New `editableBodyYaml(seg)` returns the YAML an editor starts a structured edit from (bare-text and Mermaid bodies canonicalized). Studio uses it for its sheet and direct edits.
- New skill reference `reference/mermaid.md` (installed by `avo init` / `avo install`, embedded in the MCP skill) documents the exact subset, what is ignored, and what is lost; `SKILL.md` gains the `E_PARSE_MERMAID` row. New catalog example `docs/examples/mermaid-dialect.md`.
- Exports: `MERMAID_SOURCE`, `MERMAID_KEYWORDS`, `detectMermaidKind`, `convertMermaid`, `mermaidBodyYaml`, `editableBodyYaml`.
