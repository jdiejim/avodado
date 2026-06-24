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
  type Diagnostic,
  type DiagnosticCode,
  type DiagnosticLevel,
  assertNever,
  helpUrl,
} from './diagnostics.js';

export { levenshtein, closest } from './suggest.js';
export { splitMarkdown, type RawSegment } from './splitter.js';
export {
  parseBlockBody,
  locateYamlPath,
  type YamlParseResult,
  type YamlLocation,
} from './yaml.js';
export { parseDocument } from './parser.js';
export { validateDocument } from './validate.js';
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
  trackerSchema,
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
  meceSchema,
  frontendSchema,
  clusterSchema,
  blockGraphSchema,
  felogicSchema,
  dagSchema,
} from './blocks/schemas.js';

export { blockRegistry, type BlockDef, type BlockRegistry } from './blocks/registry.js';
