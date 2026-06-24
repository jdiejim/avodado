import { describe, expect, it } from 'vitest';
import { parseDocument, validateDocument } from '@avodado/core';
import { openapiToMarkdown, parseOpenApi } from '../index.js';

const SAMPLE = `
openapi: 3.0.3
info:
  title: Orders API
  description: |
    A small orders API used by the shop frontend.
    Returns standard HTTP status codes.
  version: 1.2.0
paths:
  /orders:
    get:
      summary: List orders
      description: Returns a paginated list of orders for the authenticated user.
      responses:
        '200':
          description: OK
        '401':
          description: Unauthorized
    post:
      summary: Create order
      description: Creates a new order with the cart items.
      responses:
        '201':
          description: Created
        '400':
          description: Bad Request
        '409':
          description: Idempotency key reused
  /orders/{id}:
    get:
      summary: Get order
      responses:
        '200':
          description: OK
        '404':
          description: Not found
    delete:
      summary: Cancel order
      responses:
        '204':
          description: No Content
        '409':
          description: Order already shipped
components:
  schemas:
    Order:
      type: object
      required: [id, user_id, total, status]
      properties:
        id:
          type: string
          format: uuid
        user_id:
          type: string
          format: uuid
        total:
          type: number
        status:
          type: string
        created_at:
          type: string
          format: date-time
    OrderItem:
      type: object
      required: [id, order_id, sku, qty]
      properties:
        id:
          type: string
          format: uuid
        order_id:
          type: string
          format: uuid
        sku:
          type: string
        qty:
          type: integer
`;

describe('parseOpenApi', () => {
  it('parses + validates a sample spec', () => {
    const spec = parseOpenApi(SAMPLE);
    expect(spec.info.title).toBe('Orders API');
    expect(spec.info.version).toBe('1.2.0');
    expect(Object.keys(spec.paths ?? {}).length).toBe(2);
    expect(Object.keys(spec.components?.schemas ?? {}).length).toBe(2);
  });

  it('rejects a malformed spec', () => {
    expect(() => parseOpenApi('not yaml: [unclosed')).toThrow(/not valid YAML/);
  });

  it('rejects when info.title is missing', () => {
    expect(() => parseOpenApi('openapi: 3.0.0\ninfo: { version: "1" }\n')).toThrow(/failed validation/);
  });
});

describe('openapiToMarkdown', () => {
  const spec = parseOpenApi(SAMPLE);
  const md = openapiToMarkdown(spec, { slug: 'orders-api' });

  it('produces a meta block with title + tag', () => {
    expect(md).toContain('```meta');
    expect(md).toContain('title: "Orders API"');
    expect(md).toContain('tag: "API · v1.2.0"');
  });

  it('includes the API description as prose', () => {
    expect(md).toContain('## Overview');
    expect(md).toContain('A small orders API used by the shop frontend.');
  });

  it('emits an endpoint table with one row per (method, path)', () => {
    expect(md).toContain('```table');
    expect(md).toContain('[GET, "/orders", "List orders"]');
    expect(md).toContain('[POST, "/orders", "Create order"]');
    expect(md).toContain('[GET, "/orders/{id}", "Get order"]');
    expect(md).toContain('[DELETE, "/orders/{id}", "Cancel order"]');
  });

  it('emits one sequence block per endpoint with method-typed tag', () => {
    expect(md).toContain('## POST /orders');
    expect(md).toContain('endpoint: { method: POST, path: "/orders" }');
    // 2xx response is a `response` kind; 4xx becomes `error` kind
    expect(md).toMatch(/label: "201 Created", kind: response/);
    expect(md).toMatch(/label: "400 Bad Request", kind: error/);
    expect(md).toMatch(/label: "409 Idempotency key reused", kind: error/);
  });

  it('emits an erd block from components.schemas with pk/fk inference', () => {
    expect(md).toContain('```erd');
    expect(md).toContain('- name: Order');
    expect(md).toContain('- name: OrderItem');
    // `id` infers pk: true; `*_id` infers fk: true
    expect(md).toMatch(/name: id, type: "uuid", pk: true/);
    expect(md).toMatch(/name: user_id, type: "uuid", fk: true/);
    expect(md).toMatch(/name: order_id, type: "uuid", fk: true/);
    // optional fields get `?` suffix
    expect(md).toMatch(/name: created_at, type: "timestamp\?"/);
  });

  it('output is deterministic — same spec → byte-identical md', () => {
    const a = openapiToMarkdown(spec, { slug: 'orders-api' });
    const b = openapiToMarkdown(spec, { slug: 'orders-api' });
    expect(a).toBe(b);
  });

  it('generated md parses + validates clean as an Avodado document', () => {
    const doc = parseDocument(md, 'orders-api');
    const diags = validateDocument(doc, 'orders-api.md');
    expect(diags).toEqual([]);
  });
});
