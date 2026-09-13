/**
 * Re-export shim — the full-document templates now live in `@avodado/core`
 * (`blocks/docTemplates.ts`), beside the single-block templates, so the CLI,
 * studio, and MCP share one source. `avo new <name>`
 * behave exactly as before.
 */

export {
  DOC_TEMPLATES,
  DOC_TEMPLATE_INFO,
  isDocTemplate,
} from '@avodado/core';
