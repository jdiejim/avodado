/**
 * Parses an OpenAPI 3.x spec from a YAML or JSON string and validates it
 * against {@link openApiSchema}. Returns the typed spec or throws with a
 * structured message.
 */

import { parse as yamlParse } from 'yaml';
import { openApiSchema, type OpenApiSpec } from './schemas.js';

/**
 * Parses + validates an OpenAPI spec.
 *
 * @param source - YAML or JSON source string.
 * @returns The validated spec.
 * @throws If the source isn't valid YAML/JSON or doesn't match the OpenAPI
 *   subset we support.
 */
export function parseOpenApi(source: string): OpenApiSpec {
  let raw: unknown;
  try {
    raw = yamlParse(source) as unknown;
  } catch (err) {
    throw new Error(`OpenAPI spec is not valid YAML/JSON: ${(err as Error).message}`);
  }
  const result = openApiSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    throw new Error(`OpenAPI spec failed validation: ${issues}`);
  }
  return result.data;
}
