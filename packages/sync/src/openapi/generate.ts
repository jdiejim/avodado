/**
 * Converts an OpenAPI spec into Avodado markdown.
 *
 * The output is **deterministic**: same spec in → same markdown out. That
 * makes drift detection a simple string compare.
 *
 * The doc contains:
 * - `meta` block (title / subtitle / tag from `info`)
 * - `prose` block with the API description
 * - `table` block listing every endpoint
 * - one `sequence` block per endpoint
 * - `erd` block from `components.schemas`
 */

import {
  HTTP_METHODS,
  type HttpMethod,
  type OpenApiOperation,
  type OpenApiSchema,
  type OpenApiSpec,
} from './schemas.js';

/** Options for {@link openapiToMarkdown}. */
export interface GenerateOptions {
  /**
   * The doc slug — also drives generated block ids (e.g. `<slug>-post-orders`).
   * Defaults to `api`.
   */
  readonly slug?: string;
}

const METHOD_ORDER: Record<HttpMethod, number> = {
  get: 0,
  post: 1,
  put: 2,
  patch: 3,
  delete: 4,
};

interface Endpoint {
  readonly method: HttpMethod;
  readonly path: string;
  readonly op: OpenApiOperation;
}

function collectEndpoints(spec: OpenApiSpec): Endpoint[] {
  const out: Endpoint[] = [];
  const paths = spec.paths ?? {};
  for (const path of Object.keys(paths).sort()) {
    const item = paths[path];
    if (item === undefined) continue;
    for (const method of HTTP_METHODS) {
      const op = item[method];
      if (op === undefined) continue;
      out.push({ method, path, op });
    }
  }
  out.sort((a, b) => {
    const p = a.path.localeCompare(b.path);
    if (p !== 0) return p;
    return METHOD_ORDER[a.method] - METHOD_ORDER[b.method];
  });
  return out;
}

/** Sanitises an arbitrary string into a slug-safe id segment. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function endpointId(slug: string, ep: Endpoint): string {
  return `${slug}-${ep.method}-${slugify(ep.path) || 'root'}`;
}

/** Escapes a string for safe use inside a single-line YAML scalar. */
function yamlString(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Renders the endpoint table block. */
function renderEndpointTable(endpoints: readonly Endpoint[]): string {
  const rows = endpoints
    .map((ep) => {
      const summary = (ep.op.summary ?? '').replace(/\s+/g, ' ').trim();
      return `  - [${ep.method.toUpperCase()}, ${yamlString(ep.path)}, ${yamlString(summary)}]`;
    })
    .join('\n');
  return ['```table', 'columns: [Method, Path, Summary]', 'rows:', rows, '```'].join('\n');
}

/** Renders the `sequence` block for one endpoint. */
function renderEndpointSequence(slug: string, ep: Endpoint): string {
  const id = endpointId(slug, ep);
  const title = (ep.op.summary ?? `${ep.method.toUpperCase()} ${ep.path}`).trim();
  const desc = (ep.op.description ?? '').replace(/\s+/g, ' ').trim();
  const responses = ep.op.responses ?? {};
  const codes = Object.keys(responses).sort();
  const okCodes = codes.filter((c) => /^[12]/.test(c));
  const errCodes = codes.filter((c) => /^[345]/.test(c));

  const lines: string[] = [
    '```sequence',
    `id: ${id}`,
    `title: ${yamlString(title)}`,
  ];
  if (desc.length > 0) lines.push(`description: ${yamlString(desc)}`);
  lines.push(`endpoint: { method: ${ep.method.toUpperCase()}, path: ${yamlString(ep.path)} }`);
  lines.push('actors:');
  lines.push('  - { id: Client, name: Client }');
  lines.push('  - { id: API, name: API }');
  lines.push('messages:');
  lines.push(
    `  - { from: Client, to: API, label: ${yamlString(`${ep.method.toUpperCase()} ${ep.path}`)}, kind: sync }`,
  );
  for (const code of okCodes) {
    const summary = (responses[code]?.description ?? '').replace(/\s+/g, ' ').trim();
    const label = summary.length > 0 ? `${code} ${summary}` : code;
    lines.push(`  - { from: API, to: Client, label: ${yamlString(label)}, kind: response }`);
  }
  for (const code of errCodes) {
    const summary = (responses[code]?.description ?? '').replace(/\s+/g, ' ').trim();
    const label = summary.length > 0 ? `${code} ${summary}` : code;
    lines.push(`  - { from: API, to: Client, label: ${yamlString(label)}, kind: error }`);
  }
  lines.push('```');
  return lines.join('\n');
}

interface ColumnSpec {
  readonly name: string;
  readonly type: string;
  readonly pk: boolean;
  readonly fk: boolean;
}

const PRIMITIVE_TYPE_REMAP: Record<string, string> = {
  integer: 'int',
  number: 'number',
  string: 'string',
  boolean: 'bool',
};

function schemaTypeLabel(schema: OpenApiSchema, propName: string | undefined, propSchema?: unknown): string {
  const s = (propSchema as OpenApiSchema | undefined) ?? schema;
  if (s.$ref !== undefined) {
    const name = String(s.$ref).split('/').pop() ?? 'ref';
    return name;
  }
  const fmt = s.format;
  if (fmt === 'uuid') return 'uuid';
  if (fmt === 'date-time' || fmt === 'date') return 'timestamp';
  if (s.type === 'array') {
    const items = s.items as OpenApiSchema | undefined;
    return `${items !== undefined ? schemaTypeLabel(s, propName, items) : 'any'}[]`;
  }
  if (typeof s.type === 'string') {
    return PRIMITIVE_TYPE_REMAP[s.type] ?? s.type;
  }
  return 'any';
}

function flattenColumns(schema: OpenApiSchema): ColumnSpec[] {
  const out: ColumnSpec[] = [];
  const required = new Set(schema.required ?? []);
  const props = schema.properties ?? {};
  for (const name of Object.keys(props)) {
    const propSchema = props[name] as OpenApiSchema | undefined;
    if (propSchema === undefined) continue;
    const type = schemaTypeLabel(schema, name, propSchema);
    const pk = name === 'id';
    const fk = !pk && /_id$/i.test(name);
    out.push({
      name,
      type: required.has(name) ? type : `${type}?`,
      pk,
      fk,
    });
  }
  return out;
}

/** Renders the `erd` block from `components.schemas`. */
function renderSchemasErd(slug: string, spec: OpenApiSpec): string {
  const schemas = spec.components?.schemas ?? {};
  const names = Object.keys(schemas).sort();
  if (names.length === 0) return '';
  const entityLines: string[] = ['entities:'];
  for (const name of names) {
    const schema = schemas[name];
    if (schema === undefined || schema.type !== 'object') continue;
    const cols = flattenColumns(schema);
    if (cols.length === 0) continue;
    entityLines.push(`  - name: ${name}`);
    entityLines.push('    columns:');
    for (const c of cols) {
      const flags: string[] = [];
      if (c.pk) flags.push('pk: true');
      if (c.fk) flags.push('fk: true');
      const tail = flags.length > 0 ? `, ${flags.join(', ')}` : '';
      entityLines.push(`      - { name: ${c.name}, type: ${yamlString(c.type)}${tail} }`);
    }
  }
  if (entityLines.length === 1) return '';
  return ['```erd', `id: ${slug}-schemas`, ...entityLines, '```'].join('\n');
}

/**
 * Generates an Avodado markdown document from an OpenAPI spec.
 *
 * @param spec - The parsed OpenAPI spec.
 * @param opts - Options including the doc slug.
 * @returns The markdown source.
 */
export function openapiToMarkdown(spec: OpenApiSpec, opts: GenerateOptions = {}): string {
  const slug = opts.slug ?? 'api';
  const endpoints = collectEndpoints(spec);
  const description = (spec.info.description ?? '').trim();

  const out: string[] = [];

  out.push(
    '```meta',
    `title: ${yamlString(spec.info.title)}`,
    description.length > 0
      ? `subtitle: ${yamlString(description.split(/\r?\n/)[0] ?? '')}`
      : '',
    `tag: ${yamlString(`API · v${spec.info.version}`)}`,
    '```',
  );

  if (description.length > 0) {
    out.push('', '## Overview', '', description);
  }

  if (endpoints.length > 0) {
    out.push('', '## Endpoints', '', renderEndpointTable(endpoints));
  }

  for (const ep of endpoints) {
    out.push('', `## ${ep.method.toUpperCase()} ${ep.path}`, '', renderEndpointSequence(slug, ep));
  }

  const erd = renderSchemasErd(slug, spec);
  if (erd.length > 0) {
    out.push('', '## Schemas', '', erd);
  }

  // Strip empty lines from the meta block (description was empty).
  const cleaned = out.filter((s, i, a) => !(s === '' && a[i - 1] === ''));
  return cleaned.join('\n').replace(/\n+$/, '') + '\n';
}
