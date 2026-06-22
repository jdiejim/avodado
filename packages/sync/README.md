# @avodado/sync

Import external sources into Avodado documents. v1 supports **OpenAPI 3.x**
specs; more importers can land here later (SQL DDL, JSON Schema, …).

## CLI

```bash
# Generate a doc from an OpenAPI spec
avo sync openapi openapi.yaml --out docs/api.md

# Check that the existing doc matches what the spec would generate (CI-friendly)
avo sync openapi openapi.yaml --check docs/api.md
```

The generated doc contains:

- `meta` — title / subtitle / version from `info`
- `prose` — the API description
- `table` — every endpoint (method · path · summary)
- One `sequence` per endpoint (with method-coloured tag, status codes as messages)
- `erd` — every named schema from `components/schemas`

The generated doc is **strict**: re-running the sync produces byte-identical
output. The `--check` mode fails CI if the doc has drifted from the spec.

## Library

```ts
import { openapiToMarkdown, parseOpenApi } from '@avodado/sync';
import { readFileSync } from 'node:fs';

const spec = parseOpenApi(readFileSync('openapi.yaml', 'utf8'));
const md = openapiToMarkdown(spec, { slug: 'api' });
```
