/**
 * Avodado core: parser, block schemas, validation, and reference resolver.
 *
 * Pure library — no I/O. Reads strings, returns models and diagnostics.
 *
 * @packageDocumentation
 */

export const version = '0.0.0';

export {
  BLOCK_TYPES,
  BLOCK_TYPE_SET,
  type BlockType,
  type Document,
  type MetaData,
  type ProseSegment,
  type Segment,
  type TypedSegment,
} from './types.js';

export {
  BLOCK_ALIASES,
  ALIAS_TYPE_SET,
  BLOCK_SYNONYMS,
  type BlockAlias,
} from './blocks/aliases.js';

export { normalizeBlockData } from './blocks/normalize.js';

export {
  type Diagnostic,
  type DiagnosticCode,
  type DiagnosticLevel,
  assertNever,
  helpUrl,
} from './diagnostics.js';

export { levenshtein, closest } from './suggest.js';
export { splitMarkdown, type RawSegment } from './splitter.js';
export { parseBlockBody, locateYamlPath, type YamlParseResult, type YamlLocation } from './yaml.js';
export { parseDocument } from './parser.js';
export { validateDocument, isNearDuplicateTitle } from './validate.js';
export {
  segmentSpan,
  replaceBlockBody,
  replaceProse,
  insertBlock,
  insertProse,
  removeSegment,
  moveSegment,
  serializeBlockData,
  setYamlPath,
  deleteYamlPath,
  type SegmentSpan,
} from './edit.js';
export { resolveRefs, type RefGraph, type InputDocument } from './resolve.js';

export {
  blockSchemas,
  type BlockDataMap,
  metaSchema,
  calloutSchema,
  tableSchema,
  sequenceSchema,
  erdSchema,
  userstorySchema,
  timelineSchema,
  kanbanSchema,
  proseSchema,
  glossarySchema,
  prosconsSchema,
  cvtSchema,
  statsSchema,
  codeSchema,
  agendaSchema,
  treeSchema,
  pyramidSchema,
  flowSchema,
  stateSchema,
  dfdSchema,
  journeySchema,
  ganttSchema,
  graphSchema,
  quadrantSchema,
  swimlaneSchema,
  c4Schema,
  umlSchema,
  frontendSchema,
  clusterSchema,
  blockGraphSchema,
  felogicSchema,
  statustableSchema,
  cycleSchema,
  STATUSTABLE_DEFAULT_STATUSES,
  STATUS_COLOR_ALIASES,
  normalizeStatusColor,
  type StatusColor,
} from './blocks/schemas.js';

export { blockRegistry, type BlockDef, type BlockRegistry } from './blocks/registry.js';

export { describeBlockSchema, type FieldNode } from './blocks/introspect.js';

export { stringOnlyAt } from './blocks/schema-walk.js';

export {
  BLOCK_TEMPLATES,
  templateBody,
  BLOCK_DESCRIPTIONS,
  BLOCK_LABELS,
  BLOCK_FAMILY,
  BLOCK_FAMILIES,
  familyBlocks,
  isBlockFamily,
  type BlockFamily,
} from './blocks/catalog.js';

export {
  DOC_TEMPLATES,
  DOC_TEMPLATE_INFO,
  isDocTemplate,
  type DocTemplateInfo,
} from './blocks/docTemplates.js';

export {
  parseCsv,
  csvToTable,
  csvToStatustable,
  csvToChart,
  suggestCsvImport,
  type ImportDiagnostic,
  type CsvDelimiter,
  type ParseCsvOptions,
  type ParseCsvResult,
  type CsvImportResult,
  type CsvImportSuggestion,
  type CsvToTableOptions,
  type CsvToStatustableOptions,
  type CsvToChartOptions,
} from './import/csv.js';

export { IMPORTERS, importerForFile, type Importer } from './import/registry.js';

export { parseOpenApi } from './import/openapi/parse.js';
export { openapiToMarkdown, type GenerateOptions } from './import/openapi/generate.js';
export {
  openApiSchema,
  HTTP_METHODS,
  type OpenApiSpec,
  type OpenApiOperation,
  type OpenApiSchema,
  type OpenApiParameter,
  type HttpMethod,
} from './import/openapi/schemas.js';
