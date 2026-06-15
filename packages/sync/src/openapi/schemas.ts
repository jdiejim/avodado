/**
 * Minimal zod schemas for the OpenAPI 3.x subset we actually use during
 * generation. Anything not listed here is allowed via `passthrough` so we
 * don't fail on extra fields the spec author put in.
 */

import { z } from 'zod';

const refSchema = z.object({ $ref: z.string() }).passthrough();

const propertySchema: z.ZodType = z.lazy(() =>
  z
    .object({
      type: z.string().optional(),
      format: z.string().optional(),
      description: z.string().optional(),
      enum: z.array(z.unknown()).optional(),
      items: z.union([refSchema, propertySchema]).optional(),
      properties: z.record(z.string(), z.union([refSchema, propertySchema])).optional(),
      required: z.array(z.string()).optional(),
      example: z.unknown().optional(),
      $ref: z.string().optional(),
    })
    .passthrough(),
);

const componentSchema = z
  .object({
    type: z.string().optional(),
    description: z.string().optional(),
    properties: z.record(z.string(), z.union([refSchema, propertySchema])).optional(),
    required: z.array(z.string()).optional(),
    enum: z.array(z.unknown()).optional(),
    allOf: z.array(z.union([refSchema, propertySchema])).optional(),
  })
  .passthrough();

const responseSchema = z
  .object({
    description: z.string().optional(),
    content: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const parameterSchema = z
  .object({
    name: z.string(),
    in: z.string(),
    required: z.boolean().optional(),
    description: z.string().optional(),
    schema: z.union([refSchema, propertySchema]).optional(),
  })
  .passthrough();

const operationSchema = z
  .object({
    operationId: z.string().optional(),
    summary: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    parameters: z.array(parameterSchema).optional(),
    requestBody: z.unknown().optional(),
    responses: z.record(z.string(), responseSchema).optional(),
  })
  .passthrough();

const pathItemSchema = z
  .object({
    get: operationSchema.optional(),
    post: operationSchema.optional(),
    put: operationSchema.optional(),
    patch: operationSchema.optional(),
    delete: operationSchema.optional(),
    head: operationSchema.optional(),
    options: operationSchema.optional(),
    parameters: z.array(parameterSchema).optional(),
  })
  .passthrough();

const infoSchema = z
  .object({
    title: z.string(),
    description: z.string().optional(),
    version: z.string(),
  })
  .passthrough();

export const openApiSchema = z
  .object({
    openapi: z.string().optional(),
    swagger: z.string().optional(),
    info: infoSchema,
    paths: z.record(z.string(), pathItemSchema).optional(),
    components: z
      .object({
        schemas: z.record(z.string(), componentSchema).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

/** Parsed OpenAPI spec (validated subset). */
export type OpenApiSpec = z.infer<typeof openApiSchema>;
export type OpenApiOperation = z.infer<typeof operationSchema>;
export type OpenApiSchema = z.infer<typeof componentSchema>;
export type OpenApiParameter = z.infer<typeof parameterSchema>;

/** HTTP methods we generate sequences for. */
export const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];
