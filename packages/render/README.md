# @avodado/render

`renderDocument(doc) → string`. Pure function: takes a parsed `@avodado/core` Document, returns a standalone HTML string with inlined CSS and inline SVG diagrams. No browser, no DOM, no I/O.

## Install

```
pnpm add @avodado/render @avodado/core
```

## Usage

```ts
import { parseDocument } from '@avodado/core';
import { renderDocument } from '@avodado/render';

const html = renderDocument(parseDocument(markdown, 'orders'));
```

## Exports

- **`renderDocument(doc)`** — full standalone HTML page (`<!doctype html>…`).
- **`houseCss`** — the house stylesheet as a string. Useful if you want to render into a fragment and inject CSS elsewhere.
- **`htmlRenderers`** — `Record<BlockType, (data) => string>`. Per-block renderer registry; typed so omitting a block type is a compile error.
- **`renderProse(text)`** — Markdown prose → HTML wrapped in `.prose`.
- **`escapeHtml(value)`** — entity-escape `&<>"`.

## Fidelity

CSS is ported verbatim from the reference renderer at `resources/avodado-renderer.html`. Block DOM signatures match the reference's class names and element structure. SVG geometry uses integer-only coordinates, so output is byte-deterministic.
