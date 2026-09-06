/**
 * The cloud / platform glyph set: one 14px single-stroke `<path>` per node
 * kind, drawn in `muted` with no fill. The block family's card-shaped nodes
 * put the glyph beside the name; the kind chip (see `blockStyle.ts`) stays
 * primary — the glyph is a second cue, never the only one.
 *
 * Every path is authored in a 0–14 box and placed with a `translate`, so a
 * glyph is one string here and nothing else. Kinds the set does not know
 * resolve to the generic box, so every documented kind draws something.
 */

/** The glyph names (one drawing each); kinds alias onto these. */
export type GlyphName =
  | 'function'
  | 'bucket'
  | 'queue'
  | 'topic'
  | 'cache'
  | 'db'
  | 'cdn'
  | 'lb'
  | 'gateway'
  | 'pod'
  | 'cluster'
  | 'user'
  | 'browser'
  | 'mobile'
  | 'cron'
  | 'ml'
  | 'secret'
  | 'config'
  | 'deployment'
  | 'ingress'
  | 'node'
  | 'namespace'
  | 'box';

/** The generic box every unknown kind falls back to. */
export const GENERIC_BOX: GlyphName = 'box';

const PATHS: Record<GlyphName, string> = {
  // λ
  function: 'M3 2 H5 L10.5 12 M7.6 7 L3.5 12',
  // pail: elliptical rim, tapered sides
  bucket: 'M2 3.5 a5 1.6 0 0 0 10 0 a5 1.6 0 0 0 -10 0 M2 3.5 L3.5 12.5 H10.5 L12 3.5',
  // three message bars
  queue: 'M3 1.5 V12.5 M7 1.5 V12.5 M11 1.5 V12.5',
  // one in, fan out to three
  topic: 'M1.5 7 H5.5 M5.5 7 L11.5 2.5 M5.5 7 H12 M5.5 7 L11.5 11.5',
  // stacked memory slabs
  cache: 'M1.5 4.5 L7 2 L12.5 4.5 L7 7 Z M1.5 8 L7 10.5 L12.5 8 M1.5 11 L7 13.5 L12.5 11',
  // the cylinder
  db: 'M1.5 3 a5.5 2.2 0 0 0 11 0 a5.5 2.2 0 0 0 -11 0 V11 a5.5 2.2 0 0 0 11 0 V3',
  // cloud
  cdn: 'M3.5 12 a3 3 0 0 1 0.3 -6 a4 4 0 0 1 7.6 1 a2.5 2.5 0 0 1 0.6 5 Z',
  // splitter: one lane in, three out
  lb: 'M1.5 7 H5 M5 7 L9 3 H12.5 M5 7 H12.5 M5 7 L9 11 H12.5',
  // double chevron
  gateway: 'M2 1.5 L7 7 L2 12.5 M7.5 1.5 L12.5 7 L7.5 12.5',
  // hexagon with a core
  pod: 'M7 1.2 L12.2 4.1 V9.9 L7 12.8 L1.8 9.9 V4.1 Z M5.2 7 a1.8 1.8 0 1 0 3.6 0 a1.8 1.8 0 1 0 -3.6 0',
  // wheel: ring + four spokes
  cluster: 'M1.5 7 a5.5 5.5 0 1 0 11 0 a5.5 5.5 0 1 0 -11 0 M7 1.5 V4.5 M7 9.5 V12.5 M1.5 7 H4.5 M9.5 7 H12.5',
  // head + shoulders
  user: 'M4.5 4.5 a2.5 2.5 0 1 0 5 0 a2.5 2.5 0 1 0 -5 0 M2.5 13 a4.5 4.5 0 0 1 9 0',
  // window with a header band
  browser: 'M1.5 2.5 H12.5 V11.5 H1.5 Z M1.5 5.5 H12.5',
  // phone
  mobile: 'M4 1.5 H10 a1 1 0 0 1 1 1 V11.5 a1 1 0 0 1 -1 1 H4 a1 1 0 0 1 -1 -1 V2.5 a1 1 0 0 1 1 -1 Z M6 11 H8',
  // clock
  cron: 'M1.5 7 a5.5 5.5 0 1 0 11 0 a5.5 5.5 0 1 0 -11 0 M7 3.5 V7 L9.5 8.5',
  // four-point spark
  ml: 'M7 1.5 L8.4 5.6 L12.5 7 L8.4 8.4 L7 12.5 L5.6 8.4 L1.5 7 L5.6 5.6 Z',
  // padlock
  secret: 'M3 6.5 H11 V13 H3 Z M4.5 6.5 V4.5 a2.5 2.5 0 0 1 5 0 V6.5',
  // three sliders
  config: 'M1.5 3.5 H12.5 M1.5 7 H12.5 M1.5 10.5 H12.5 M4.5 2 V5 M9.5 5.5 V8.5 M6 9 V12',
  // replica set: two overlapping squares
  deployment: 'M1.5 5 H9 V12.5 H1.5 Z M4 5 V2.5 H11.5 V10 H9',
  // arrow into a door
  ingress: 'M1.5 7 H8 M5.5 4.5 L8 7 L5.5 9.5 M10 1.5 H12.5 V12.5 H10',
  // two rack slabs
  node: 'M2 2 H12 V6 H2 Z M2 8 H12 V12 H2 Z M4.5 4 H6.5 M4.5 10 H6.5',
  // folder tab
  namespace: 'M1.5 3.5 H5.5 L7 5 H12.5 V12 H1.5 Z',
  box: 'M2 2 H12 V12 H2 Z',
};

const ALIAS: Record<string, GlyphName> = {
  function: 'function',
  lambda: 'function',
  bucket: 'bucket',
  s3: 'bucket',
  blob: 'bucket',
  object: 'bucket',
  queue: 'queue',
  sqs: 'queue',
  mq: 'queue',
  broker: 'queue',
  rabbitmq: 'queue',
  topic: 'topic',
  sns: 'topic',
  kafka: 'topic',
  kinesis: 'topic',
  stream: 'topic',
  cache: 'cache',
  redis: 'cache',
  memcached: 'cache',
  db: 'db',
  database: 'db',
  store: 'db',
  postgres: 'db',
  mysql: 'db',
  mongo: 'db',
  mongodb: 'db',
  dynamo: 'db',
  cdn: 'cdn',
  lb: 'lb',
  gateway: 'gateway',
  proxy: 'gateway',
  pod: 'pod',
  cluster: 'cluster',
  user: 'user',
  person: 'user',
  actor: 'user',
  browser: 'browser',
  web: 'browser',
  mobile: 'mobile',
  cron: 'cron',
  scheduler: 'cron',
  job: 'cron',
  cronjob: 'cron',
  ml: 'ml',
  model: 'ml',
  llm: 'ml',
  agent: 'ml',
  ai: 'ml',
  secret: 'secret',
  secrets: 'secret',
  vault: 'secret',
  kms: 'secret',
  config: 'config',
  configmap: 'config',
  settings: 'config',
  deployment: 'deployment',
  ingress: 'ingress',
  node: 'node',
  vm: 'node',
  server: 'node',
  host: 'node',
  namespace: 'namespace',
};

/** The glyph a kind resolves to — a named drawing, or the generic box. */
export function glyphNameFor(kind: string | undefined): GlyphName {
  return ALIAS[(kind ?? '').trim().toLowerCase()] ?? GENERIC_BOX;
}

/** True when the set has a drawing of its own for this kind (not the fallback box). */
export function hasGlyph(kind: string | undefined): boolean {
  return (kind ?? '').trim().toLowerCase() in ALIAS;
}

/** The raw path data of a glyph (0–14 box). */
export function glyphPath(name: GlyphName): string {
  return PATHS[name];
}

/**
 * The glyph as one `<path>` placed at `(x, y)` — its top-left corner. Muted
 * single stroke, no fill; `c` overrides the stroke for the rare accent use.
 */
export function cloudGlyph(kind: string | undefined, x: number, y: number, c = 'var(--muted)'): string {
  const d = PATHS[glyphNameFor(kind)];
  return `<path d="${d}" transform="translate(${x} ${y})" fill="none" stroke="${c}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`;
}
