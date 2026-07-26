# @avodado/core

Pure library: parse Avodado Markdown into a typed model, validate it, and resolve references across documents. No I/O.

## Install

```
pnpm add @avodado/core
```

## Primary API

```ts
import {
  parseDocument,
  validateDocument,
  resolveRefs,
  blockRegistry,
  type Document,
  type Diagnostic,
} from '@avodado/core';

const doc: Document = parseDocument(markdown, 'orders');
const diags: Diagnostic[] = validateDocument(doc, 'docs/orders.md');
const { graph, diagnostics } = resolveRefs([{ doc, file: 'docs/orders.md' }]);
```

- **`parseDocument(md, slug)`** — splits Markdown into prose / typed-block segments, parses YAML bodies, extracts top-level `id` slugs and `meta`. Errors are deferred to `validateDocument`.
- **`validateDocument(doc, file)`** — runs each block against its zod schema and returns `Diagnostic[]`.
- **`resolveRefs(inputs)`** — resolves `doc#id` / `#id` references across many documents. Returns the reference graph plus diagnostics for duplicate ids and dangling refs.
- **`blockRegistry`** — `Record<BlockType, BlockDef>`. The single source of truth for each block's schema and reference extractor.

## Diagnostic codes

`E_PARSE_YAML`, `E_SCHEMA`, `E_DUP_ID`, `E_DANGLING_REF`, `E_BAD_REF_FORMAT`, `E_UNKNOWN_BLOCK`, `W_EMPTY_BLOCK`. Uniform shape: `{ file, line?, level, code, message, value? }`.

## Block types

**84 block types** across 12 families (prose, tables, API, architecture, flows, data model, charts, planning, business, design system, algorithms, AI/agents) — high-signal ones include `sequence`, `erd`, `c4`, `table`, `callout`, `flow`, `userstory`, `chart`, and `endpoint`. The full list is `BLOCK_TYPES`; `BLOCK_FAMILIES` groups them.

Each block's field shape is a zod schema exported individually (e.g. `sequenceSchema`), and its data type is `BlockDataMap[K]`. See the full reference at **[avodado.dev](https://avodado.dev)**.
