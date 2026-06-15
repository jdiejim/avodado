# @avodado/mcp

Model Context Protocol server for **Avodado** — author, validate, and render
Avodado documents (Markdown with typed YAML blocks) from any MCP client.

## Add it to your client

**Claude Code**

```bash
claude mcp add avodado -- npx -y @avodado/mcp
```

**Claude Desktop / Cursor** (`mcp` config)

```jsonc
{
  "mcpServers": {
    "avodado": { "command": "npx", "args": ["-y", "@avodado/mcp"] }
  }
}
```

Transport is stdio; no configuration or API key required.

## Tools

| Tool | What it does |
|---|---|
| `get_authoring_guide` | The full Avodado authoring grammar — **read first** before authoring. |
| `list_block_types` | Every supported block type. |
| `get_block_schema(type)` | JSON Schema (fields, enums) for one block type. |
| `check_document(markdown, slug?)` | Parse + validate; returns diagnostics (empty = valid). |
| `render_document(markdown, slug?, theme?)` | Render to standalone styled HTML. |
| `resolve_refs(documents[])` | Cross-check `doc#id` references (dangling refs, duplicate ids). |
| `sync_openapi(spec, slug?)` | Generate an Avodado doc from an OpenAPI (JSON) spec. |

## Resources

- `avodado://skill` — the authoring guide (block grammar + rules).

## Typical agent loop

1. `get_authoring_guide` → learn the block grammar.
2. Write Avodado Markdown.
3. `check_document` → fix any diagnostics.
4. `render_document` → styled HTML.

Built on the pure `@avodado/core`, `@avodado/render`, and `@avodado/sync`
libraries.
