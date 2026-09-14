```meta
title: How Chiltepin turns text into documents
subtitle: One source file. A shared core. Deterministic layout.
tag: CHILTEPIN · ARCHITECTURE
```

The CLI and Studio share the parser, schemas, and renderers. An agent writes the same Markdown files that a person edits.

```block
id: chiltepin-render-pipeline
title: The document pipeline
preset: infra
nodes:
  - { id: source, col: 1, row: 1, kind: file, name: Markdown + YAML, tech: Your editor or agent }
  - { id: core, col: 2, row: 1, kind: service, name: Parse + validate, tech: chiltepin-core }
  - { id: render, col: 3, row: 1, kind: service, name: Layout + render, tech: chiltepin-render }
  - { id: diagnostics, col: 2, row: 2, kind: file, name: Diagnostics, tech: File + line + fix hint }
  - { id: output, col: 3, row: 2, kind: browser, name: HTML + SVG, tech: Pages and slide decks }
edges:
  - source -> core: parse blocks
  - core -> render: typed document
  - core --> diagnostics: report issues
  - render -> output: render
```

Core returns models and diagnostics without file access, network calls, or a DOM. The renderer owns typography, spacing, and diagram geometry.
The CLI reads files, validates references across documents, and writes exports. It also serves Studio and uses Chromium for PDF export.

Studio runs the same pipeline in the browser. Its local server reads and writes the Markdown files through a file API.
The source files remain the source of truth for every editor and export.
