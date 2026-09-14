/**
 * Re-export shim — the full-document templates now live in `chiltepin-core`
 * (`blocks/docTemplates.ts`), beside the single-block templates, so the CLI,
 * studio, and MCP share one source. `chiltepin new <name>`
 * behave exactly as before.
 */

export {
  DOC_TEMPLATES,
  DOC_TEMPLATE_INFO,
  isDocTemplate,
} from 'chiltepin-core';
