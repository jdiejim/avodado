/**
 * Avodado MCP server.
 *
 * Exposes Avodado's pure document tooling (parse, validate, render, schemas,
 * cross-references, OpenAPI sync) and the authoring grammar as MCP tools +
 * resources, so any MCP client (Claude Code/Desktop, Cursor, …) can author,
 * validate, and render Avodado documents natively.
 *
 * Transport: stdio. Run via `npx @avodado/mcp` (or the `avodado-mcp` bin).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  parseDocument,
  validateDocument,
  resolveRefs,
  blockSchemas,
  BLOCK_TYPES,
  type Diagnostic,
  type InputDocument,
} from '@avodado/core';
import { renderDocument, type ThemeName } from '@avodado/render';
import { openapiToMarkdown } from '@avodado/sync';
import { SKILL_MD } from './skill.generated.js';

const THEMES = ['textbook', 'minimal', 'soft', 'dark', 'teal', 'plum', 'slate'] as const;

function formatDiagnostics(diags: readonly Diagnostic[]): string {
  if (diags.length === 0) return 'OK — no diagnostics. The document is valid.';
  return diags
    .map((d) => {
      const loc =
        d.line !== undefined ? `:${d.line}${d.column !== undefined ? `:${d.column}` : ''}` : '';
      const hint = d.hint !== undefined ? ` (hint: ${d.hint})` : '';
      return `${d.level.toUpperCase()} ${d.file}${loc} [${d.code}] ${d.message}${hint}`;
    })
    .join('\n');
}

const server = new McpServer({ name: 'avodado', version: '0.0.1' });

server.registerTool(
  'check_document',
  {
    title: 'Check an Avodado document',
    description:
      'Parse and validate Avodado Markdown (prose + typed YAML blocks). Returns diagnostics; "OK" means valid. Use this after writing or editing a document.',
    inputSchema: {
      markdown: z.string().describe('The Avodado document Markdown.'),
      slug: z.string().optional().describe('Document slug (defaults to "doc").'),
    },
  },
  ({ markdown, slug }) => {
    const s = slug ?? 'doc';
    const diags = validateDocument(parseDocument(markdown, s), s);
    return { content: [{ type: 'text', text: formatDiagnostics(diags) }] };
  },
);

server.registerTool(
  'render_document',
  {
    title: 'Render an Avodado document to HTML',
    description: 'Render Avodado Markdown to a standalone, styled HTML document.',
    inputSchema: {
      markdown: z.string(),
      slug: z.string().optional(),
      theme: z.enum(THEMES).optional().describe('Visual theme (default textbook).'),
    },
  },
  ({ markdown, slug, theme }) => {
    const html = renderDocument(
      parseDocument(markdown, slug ?? 'doc'),
      theme !== undefined ? { theme: theme as ThemeName } : {},
    );
    return { content: [{ type: 'text', text: html }] };
  },
);

server.registerTool(
  'list_block_types',
  {
    title: 'List Avodado block types',
    description: 'List every supported Avodado block type.',
    inputSchema: {},
  },
  () => ({ content: [{ type: 'text', text: BLOCK_TYPES.join('\n') }] }),
);

server.registerTool(
  'get_block_schema',
  {
    title: 'Get a block JSON Schema',
    description: 'Return the JSON Schema (fields, enums) for a given Avodado block type.',
    inputSchema: { type: z.enum([...BLOCK_TYPES] as [string, ...string[]]) },
  },
  ({ type }) => {
    const schema = blockSchemas[type as keyof typeof blockSchemas];
    const json = zodToJsonSchema(schema, type);
    return { content: [{ type: 'text', text: JSON.stringify(json, null, 2) }] };
  },
);

server.registerTool(
  'resolve_refs',
  {
    title: 'Resolve cross-document references',
    description:
      'Check `doc#id` references across multiple Avodado documents (dangling refs, duplicate ids).',
    inputSchema: {
      documents: z
        .array(z.object({ slug: z.string(), markdown: z.string() }))
        .describe('The documents to cross-check.'),
    },
  },
  ({ documents }) => {
    const inputs: InputDocument[] = documents.map((d) => ({
      doc: parseDocument(d.markdown, d.slug),
      file: d.slug,
    }));
    const { diagnostics } = resolveRefs(inputs);
    return { content: [{ type: 'text', text: formatDiagnostics(diagnostics) }] };
  },
);

server.registerTool(
  'sync_openapi',
  {
    title: 'Generate an Avodado doc from OpenAPI',
    description: 'Convert an OpenAPI spec (JSON) into an Avodado Markdown document.',
    inputSchema: {
      spec: z.string().describe('The OpenAPI spec as a JSON string.'),
      slug: z.string().optional(),
    },
  },
  ({ spec, slug }) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(spec);
    } catch {
      return { isError: true, content: [{ type: 'text', text: 'Invalid JSON spec.' }] };
    }
    const md = openapiToMarkdown(
      parsed as Parameters<typeof openapiToMarkdown>[0],
      slug !== undefined ? { slug } : {},
    );
    return { content: [{ type: 'text', text: md }] };
  },
);

server.registerTool(
  'get_authoring_guide',
  {
    title: 'Get the Avodado authoring guide',
    description:
      'Return the full Avodado authoring grammar (block types, every field, YAML pitfalls, recipes). Read this BEFORE authoring Avodado documents.',
    inputSchema: {},
  },
  () => ({ content: [{ type: 'text', text: SKILL_MD }] }),
);

server.registerResource(
  'authoring-skill',
  'avodado://skill',
  {
    title: 'Avodado authoring guide',
    description: 'The block grammar, fields, and authoring rules for Avodado documents.',
    mimeType: 'text/markdown',
  },
  (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'text/markdown', text: SKILL_MD }],
  }),
);

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
  // Protocol uses stdout; logs go to stderr.
  console.error('avodado-mcp server running on stdio');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
