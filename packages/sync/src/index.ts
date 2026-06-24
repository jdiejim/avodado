/**
 * Avodado sync — import external sources into Avodado documents.
 *
 * v1 supports OpenAPI 3.x. Future importers (SQL DDL, JSON Schema, …) can
 * live alongside under `src/<source>/`.
 *
 * @packageDocumentation
 */

export { parseOpenApi } from './openapi/parse.js';
export { openapiToMarkdown, type GenerateOptions } from './openapi/generate.js';
export {
  openApiSchema,
  type OpenApiSpec,
  type OpenApiOperation,
  type OpenApiSchema,
  type OpenApiParameter,
  type HttpMethod,
  HTTP_METHODS,
} from './openapi/schemas.js';
