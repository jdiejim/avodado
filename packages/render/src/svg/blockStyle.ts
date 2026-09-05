/**
 * Node-kind vocabulary + skin helpers for the architecture-flavoured blocks
 * (block / infra / event / ddd / network, cluster, felogic, …).
 *
 * The skin (see `DESIGN.md`) tells kinds apart by stroke weight, dash, fill
 * and an eyebrow chip — never by hue. {@link nodeSkin} is that mapping;
 * {@link nodeGlyph} keeps the small icons (drawn in `muted`). No hex here:
 * every colour is a role token.
 */

/**
 * Every node `kind` {@link blockStyle} styles specially — the case labels of
 * its switch, in switch order. Editors use this as the canonical dropdown of
 * documented kinds for the block-graph family (block / infra / event / ddd /
 * network / cluster). Keep it in sync when adding a case below.
 */
export const KNOWN_NODE_KINDS: readonly string[] = [
  'client',
  'service', 'microservice', 'compute', 'container',
  'data',
  'store', 'db', 'database', 'postgres', 'mysql', 'mongo', 'mongodb', 'dynamo',
  'bucket', 'blob', 'object', 's3',
  'queue', 'mq', 'broker', 'sqs', 'rabbitmq',
  'cache', 'redis', 'memcached',
  'gateway', 'lb', 'proxy',
  'function', 'lambda',
  'cdn',
  'external',
  'producer', 'topic', 'consumer',
  'context',
  'firewall', 'waf', 'shield',
  'dns',
  'auth', 'identity', 'idp', 'iam', 'oauth', 'sso',
  'monitor', 'observability', 'metrics', 'logs', 'tracing', 'apm',
  'scheduler', 'cron', 'job',
  'stream', 'kafka', 'kinesis',
  'warehouse', 'lake',
  'analytics', 'bi',
  'search', 'index', 'elasticsearch', 'opensearch',
  'registry',
  'ci', 'cicd', 'pipeline',
  'git', 'repo', 'scm',
  'device', 'iot',
  'email', 'sms',
  'config', 'settings',
  'ml', 'model', 'llm', 'agent', 'ai',
  'user', 'person', 'actor', 'browser', 'web', 'mobile',
  'vm', 'server', 'host',
  'secrets', 'vault', 'kms',
  'notification', 'webhook',
  'worker', 'etl',
  'shard', 'shards', 'sharded', 'replica', 'replicas', 'replicaset',
  'users', 'crowd',
  'region', 'geo', 'globe',
];

/** How the skin draws one node kind. */
export interface NodeSkin {
  /** The eyebrow chip text (`SVC`, `DB`, …); `''` when the kind has none. */
  readonly chip: string;
  /** Primary nodes: 1.5px `ink`. Secondary (stores, transport): 1px `rule-solid`. */
  readonly primary: boolean;
  /** `paper` (default) or `paper-2` (stores, queues, caches — the "inactive" fill). */
  readonly fill: 'paper' | 'paper-2';
  /** Dashed outline for external / boundary kinds. */
  readonly dashed: boolean;
}

const SKIN: Record<string, NodeSkin> = {};
const def = (kinds: readonly string[], skin: NodeSkin): void => {
  for (const k of kinds) SKIN[k] = skin;
};
const primary = (chip: string): NodeSkin => ({ chip, primary: true, fill: 'paper', dashed: false });
const secondary = (chip: string): NodeSkin => ({ chip, primary: false, fill: 'paper-2', dashed: false });
const external = (chip: string): NodeSkin => ({ chip, primary: true, fill: 'paper', dashed: true });

def(['client', 'user', 'person', 'actor', 'users', 'crowd', 'browser', 'web', 'mobile', 'device', 'iot'], primary('CLIENT'));
def(['service', 'microservice', 'compute', 'container', 'worker', 'etl'], primary('SVC'));
def(['data'], primary('DATA'));
def(['store', 'db', 'database', 'postgres', 'mysql', 'mongo', 'mongodb', 'dynamo'], secondary('DB'));
def(['shard', 'shards', 'sharded', 'replica', 'replicas', 'replicaset'], secondary('DB'));
def(['bucket', 'blob', 'object', 's3'], secondary('BUCKET'));
def(['warehouse', 'lake'], secondary('WAREHOUSE'));
def(['queue', 'mq', 'broker', 'sqs', 'rabbitmq'], secondary('QUEUE'));
def(['topic'], secondary('TOPIC'));
def(['stream', 'kafka', 'kinesis'], secondary('BUS'));
def(['cache', 'redis', 'memcached'], secondary('CACHE'));
def(['search', 'index', 'elasticsearch', 'opensearch'], secondary('SEARCH'));
def(['registry'], secondary('REGISTRY'));
def(['gateway', 'proxy'], primary('GATEWAY'));
def(['lb'], primary('LB'));
def(['function', 'lambda'], primary('FN'));
def(['cdn'], external('EDGE'));
def(['external'], external('EXT'));
def(['producer'], primary('PRODUCER'));
def(['consumer'], primary('CONSUMER'));
def(['context'], primary('CONTEXT'));
def(['firewall', 'waf', 'shield'], primary('WAF'));
def(['dns'], external('DNS'));
def(['auth', 'identity', 'idp', 'iam', 'oauth', 'sso'], primary('AUTH'));
def(['monitor', 'observability', 'metrics', 'logs', 'tracing', 'apm'], primary('OBS'));
def(['scheduler', 'cron', 'job'], primary('CRON'));
def(['analytics', 'bi'], primary('ANALYTICS'));
def(['ci', 'cicd', 'pipeline'], primary('CI'));
def(['git', 'repo', 'scm'], secondary('GIT'));
def(['email', 'sms'], external('EMAIL'));
def(['config', 'settings'], secondary('CONFIG'));
def(['ml', 'model', 'llm', 'agent', 'ai'], primary('AI'));
def(['vm', 'server', 'host'], primary('HOST'));
def(['secrets', 'vault', 'kms'], secondary('SECRETS'));
def(['notification', 'webhook'], external('WEBHOOK'));
def(['region', 'geo', 'globe'], external('REGION'));

/**
 * Maps a node `kind` to its skin. Unknown kinds are primary paper nodes whose
 * chip is the kind word itself (so an author's `kind: billing` still reads);
 * no kind → no chip.
 */
export function nodeSkin(kind: string | undefined): NodeSkin {
  const k = (kind ?? '').trim().toLowerCase();
  if (k === '') return { chip: '', primary: true, fill: 'paper', dashed: false };
  return SKIN[k] ?? primary(k.toUpperCase());
}

/** The node's fill from its skin (accent nodes take the tint). */
export function skinFill(sk: NodeSkin, accent = false): string {
  if (accent) return 'var(--accent-tint)';
  return sk.fill === 'paper-2' ? 'var(--paper-2)' : 'var(--paper)';
}

/**
 * Returns a small SVG glyph (database cylinder, queue bars, function ƒ, …)
 * for the given node kind, or empty string if no glyph applies.
 *
 * @param kind - Node kind.
 * @param x - Glyph top-left x.
 * @param y - Glyph top-left y.
 * @param c - Stroke / fill color.
 */
export function nodeGlyph(kind: string | undefined, x: number, y: number, c: string): string {
  const k = (kind ?? '').toLowerCase();
  if (
    k === 'store' || k === 'db' || k === 'database' ||
    k === 'postgres' || k === 'mysql' || k === 'mongo' || k === 'mongodb' || k === 'dynamo'
  ) {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none">` +
      `<ellipse cx="${x + 8}" cy="${y + 3}" rx="7" ry="3"/>` +
      `<path d="M${x + 1} ${y + 3} V ${y + 13}"/>` +
      `<path d="M${x + 15} ${y + 3} V ${y + 13}"/>` +
      `<path d="M${x + 1} ${y + 13} a 7 3 0 0 0 14 0"/>` +
      `</g>`
    );
  }
  if (k === 'bucket' || k === 'blob' || k === 'object' || k === 's3') {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none">` +
      `<ellipse cx="${x + 8}" cy="${y + 3}" rx="7" ry="2.5"/>` +
      `<path d="M${x + 1.5} ${y + 3} L ${x + 3.5} ${y + 14} L ${x + 12.5} ${y + 14} L ${x + 14.5} ${y + 3}"/>` +
      `</g>`
    );
  }
  if (k === 'queue' || k === 'topic' || k === 'mq' || k === 'broker' || k === 'sqs' || k === 'rabbitmq') {
    return (
      `<g stroke="${c}" stroke-width="1.6">` +
      `<path d="M${x + 2} ${y + 1} V ${y + 14}"/>` +
      `<path d="M${x + 8} ${y + 1} V ${y + 14}"/>` +
      `<path d="M${x + 14} ${y + 1} V ${y + 14}"/>` +
      `</g>`
    );
  }
  if (k === 'firewall' || k === 'waf' || k === 'shield') {
    return `<path d="M${x + 8} ${y} L ${x + 15} ${y + 3} V ${y + 9} Q ${x + 15} ${y + 14} ${x + 8} ${y + 16} Q ${x + 1} ${y + 14} ${x + 1} ${y + 9} V ${y + 3} Z" fill="none" stroke="${c}" stroke-width="1.3"/>`;
  }
  if (k === 'dns') {
    return (
      `<g stroke="${c}" stroke-width="1.2" fill="none">` +
      `<circle cx="${x + 8}" cy="${y + 8}" r="7"/>` +
      `<ellipse cx="${x + 8}" cy="${y + 8}" rx="3" ry="7"/>` +
      `<path d="M${x + 1.5} ${y + 8} H ${x + 14.5}"/>` +
      `</g>`
    );
  }
  if (k === 'auth' || k === 'identity' || k === 'idp' || k === 'iam' || k === 'oauth' || k === 'sso') {
    return (
      `<g stroke="${c}" stroke-width="1.4" fill="none">` +
      `<circle cx="${x + 5}" cy="${y + 8}" r="3.5"/>` +
      `<path d="M${x + 8.5} ${y + 8} H ${x + 15} M${x + 12.5} ${y + 8} V ${y + 11.5} M${x + 15} ${y + 8} V ${y + 10.5}"/>` +
      `</g>`
    );
  }
  if (k === 'monitor' || k === 'observability' || k === 'metrics' || k === 'logs' || k === 'tracing' || k === 'apm') {
    return `<path d="M${x} ${y + 9} H ${x + 4} L ${x + 6.5} ${y + 3} L ${x + 9.5} ${y + 13} L ${x + 12} ${y + 9} H ${x + 16}" fill="none" stroke="${c}" stroke-width="1.5" stroke-linejoin="round"/>`;
  }
  if (k === 'scheduler' || k === 'cron' || k === 'job') {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none">` +
      `<circle cx="${x + 8}" cy="${y + 8}" r="7"/>` +
      `<path d="M${x + 8} ${y + 4} V ${y + 8} L ${x + 11.5} ${y + 10}"/>` +
      `</g>`
    );
  }
  if (k === 'stream' || k === 'kafka' || k === 'kinesis') {
    const wave = (dy: number): string =>
      `<path d="M${x + 1} ${y + 4 + dy} q 3.5 -3 7 0 t 7 0" fill="none" stroke="${c}" stroke-width="1.4"/>`;
    return `<g>${wave(0)}${wave(4.5)}${wave(9)}</g>`;
  }
  if (k === 'warehouse' || k === 'lake') {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none">` +
      `<ellipse cx="${x + 8}" cy="${y + 3}" rx="7" ry="3"/>` +
      `<path d="M${x + 1} ${y + 3} V ${y + 13}"/>` +
      `<path d="M${x + 15} ${y + 3} V ${y + 13}"/>` +
      `<path d="M${x + 1} ${y + 8} a 7 3 0 0 0 14 0"/>` +
      `<path d="M${x + 1} ${y + 13} a 7 3 0 0 0 14 0"/>` +
      `</g>`
    );
  }
  if (k === 'search' || k === 'index') {
    return (
      `<g stroke="${c}" stroke-width="1.4" fill="none">` +
      `<circle cx="${x + 6.5}" cy="${y + 6.5}" r="5"/>` +
      `<path d="M${x + 10.5} ${y + 10.5} L ${x + 15} ${y + 15}"/>` +
      `</g>`
    );
  }
  if (k === 'ml' || k === 'model' || k === 'llm' || k === 'agent' || k === 'ai') {
    return `<path d="M${x + 8} ${y + 1} L ${x + 9.8} ${y + 6.2} L ${x + 15} ${y + 8} L ${x + 9.8} ${y + 9.8} L ${x + 8} ${y + 15} L ${x + 6.2} ${y + 9.8} L ${x + 1} ${y + 8} L ${x + 6.2} ${y + 6.2} Z" fill="${c}"/>`;
  }
  if (k === 'user' || k === 'person' || k === 'actor') {
    return `<g fill="${c}"><circle cx="${x + 8}" cy="${y + 4.5}" r="3.5"/><path d="M ${x + 2} ${y + 15} a 6 6.5 0 0 1 12 0 z"/></g>`;
  }
  if (k === 'browser' || k === 'web') {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none">` +
      `<rect x="${x + 1}" y="${y + 2}" width="14" height="12" rx="2"/>` +
      `<path d="M${x + 1} ${y + 6} H ${x + 15}"/>` +
      `</g>`
    );
  }
  if (k === 'mobile') {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none">` +
      `<rect x="${x + 4}" y="${y + 1}" width="8" height="14" rx="2"/>` +
      `<path d="M${x + 7} ${y + 12.5} H ${x + 9}"/>` +
      `</g>`
    );
  }
  if (k === 'vm' || k === 'server' || k === 'host') {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none">` +
      `<rect x="${x + 2}" y="${y + 2}" width="12" height="5" rx="1.2"/>` +
      `<rect x="${x + 2}" y="${y + 9}" width="12" height="5" rx="1.2"/>` +
      `<path d="M${x + 4.5} ${y + 4.5} H ${x + 7} M${x + 4.5} ${y + 11.5} H ${x + 7}"/>` +
      `</g>`
    );
  }
  if (k === 'secrets' || k === 'vault' || k === 'kms') {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none">` +
      `<rect x="${x + 3}" y="${y + 7}" width="10" height="8" rx="1.5"/>` +
      `<path d="M${x + 5} ${y + 7} V ${y + 5} a 3 3 0 0 1 6 0 V ${y + 7}"/>` +
      `</g>`
    );
  }
  if (k === 'notification' || k === 'webhook') {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none">` +
      `<path d="M${x + 3} ${y + 11} a 5 5 0 0 1 1.6 -3.6 V ${y + 5} a 3.4 3.4 0 0 1 6.8 0 v 2.4 a 5 5 0 0 1 1.6 3.6 z"/>` +
      `<path d="M${x + 6.5} ${y + 13.5} a 1.5 1.5 0 0 0 3 0"/>` +
      `</g>`
    );
  }
  if (k === 'email' || k === 'sms') {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none">` +
      `<rect x="${x + 1}" y="${y + 3}" width="14" height="10" rx="1.5"/>` +
      `<path d="M${x + 1.5} ${y + 4} L ${x + 8} ${y + 9} L ${x + 14.5} ${y + 4}"/>` +
      `</g>`
    );
  }
  if (k === 'registry') {
    return (
      `<g stroke="${c}" stroke-width="1.2" fill="none">` +
      `<rect x="${x + 1}" y="${y + 8}" width="6" height="6" rx="1"/>` +
      `<rect x="${x + 9}" y="${y + 8}" width="6" height="6" rx="1"/>` +
      `<rect x="${x + 5}" y="${y + 1}" width="6" height="6" rx="1"/>` +
      `</g>`
    );
  }
  if (k === 'ci' || k === 'cicd' || k === 'pipeline') {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none">` +
      `<circle cx="${x + 8}" cy="${y + 8}" r="7"/>` +
      `<path d="M${x + 6} ${y + 5} L ${x + 11.5} ${y + 8} L ${x + 6} ${y + 11} Z" fill="${c}" stroke="none"/>` +
      `</g>`
    );
  }
  if (k === 'git' || k === 'repo' || k === 'scm') {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none">` +
      `<circle cx="${x + 4}" cy="${y + 3.5}" r="2.5"/>` +
      `<circle cx="${x + 4}" cy="${y + 12.5}" r="2.5"/>` +
      `<circle cx="${x + 12}" cy="${y + 6}" r="2.5"/>` +
      `<path d="M${x + 4} ${y + 6} V ${y + 10} M${x + 4} ${y + 8} q 0 -2 3 -2 h 2.5"/>` +
      `</g>`
    );
  }
  if (k === 'device' || k === 'iot') {
    return (
      `<g stroke="${c}" stroke-width="1.2" fill="none">` +
      `<rect x="${x + 4}" y="${y + 4}" width="8" height="8" rx="1.5"/>` +
      `<path d="M${x + 6} ${y + 4} V ${y + 1} M${x + 10} ${y + 4} V ${y + 1} M${x + 6} ${y + 15} V ${y + 12} M${x + 10} ${y + 15} V ${y + 12} M${x + 4} ${y + 6} H ${x + 1} M${x + 4} ${y + 10} H ${x + 1} M${x + 15} ${y + 6} H ${x + 12} M${x + 15} ${y + 10} H ${x + 12}"/>` +
      `</g>`
    );
  }
  if (k === 'analytics' || k === 'bi') {
    return (
      `<g fill="${c}">` +
      `<rect x="${x + 1}" y="${y + 9}" width="3.4" height="6" rx="0.8"/>` +
      `<rect x="${x + 6.3}" y="${y + 5}" width="3.4" height="10" rx="0.8"/>` +
      `<rect x="${x + 11.6}" y="${y + 1}" width="3.4" height="14" rx="0.8"/>` +
      `</g>`
    );
  }
  if (k === 'config' || k === 'settings') {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none">` +
      `<circle cx="${x + 8}" cy="${y + 8}" r="4"/>` +
      `<path d="M${x + 8} ${y + 1} V ${y + 3.5} M${x + 8} ${y + 12.5} V ${y + 15} M${x + 1} ${y + 8} H ${x + 3.5} M${x + 12.5} ${y + 8} H ${x + 15} M${x + 3} ${y + 3} L ${x + 5} ${y + 5} M${x + 11} ${y + 11} L ${x + 13} ${y + 13} M${x + 13} ${y + 3} L ${x + 11} ${y + 5} M${x + 5} ${y + 11} L ${x + 3} ${y + 13}"/>` +
      `</g>`
    );
  }
  if (k === 'cache' || k === 'redis' || k === 'memcached') {
    // stacked slabs (memory layers) — three offset parallelograms
    const slab = (dy: number): string =>
      `<path d="M${x + 1} ${y + 5 + dy} L${x + 8} ${y + 2 + dy} L${x + 15} ${y + 5 + dy} L${x + 8} ${y + 8 + dy} Z" fill="none" stroke="${c}" stroke-width="1.2"/>`;
    return `<g>${slab(0)}${slab(3.5)}${slab(7)}</g>`;
  }
  if (k === 'function' || k === 'lambda') {
    return `<text x="${x + 7}" y="${y + 14}" font-family="Georgia, serif" font-size="17" font-style="italic" font-weight="700" fill="${c}" text-anchor="middle">ƒ</text>`;
  }
  if (k === 'cdn' || k === 'external') {
    return `<path d="M${x + 3} ${y + 13} a 4 4 0 0 1 0.5 -8 a 5 5 0 0 1 9.5 1.2 a 3 3 0 0 1 1 6.8 z" fill="none" stroke="${c}" stroke-width="1.3"/>`;
  }
  if (k === 'gateway' || k === 'lb' || k === 'proxy') {
    return (
      `<g stroke="${c}" stroke-width="1.5" fill="none">` +
      `<path d="M${x + 2} ${y + 1} L ${x + 8} ${y + 7} L ${x + 2} ${y + 13}"/>` +
      `<path d="M${x + 8} ${y + 1} L ${x + 14} ${y + 7} L ${x + 8} ${y + 13}"/>` +
      `</g>`
    );
  }
  if (k === 'service' || k === 'microservice' || k === 'compute' || k === 'container' || k === 'worker' || k === 'etl') {
    return (
      `<g stroke="${c}" stroke-width="1.3">` +
      `<rect x="${x + 4}" y="${y + 1}" width="11" height="11" rx="1.5" fill="none"/>` +
      `<rect x="${x + 1}" y="${y + 4}" width="11" height="11" rx="1.5" fill="var(--paper)"/>` +
      `</g>`
    );
  }
  return '';
}

/** Edge-style preset: per-kind stroke, dash, marker, error flag. */
export interface EdgeStyle {
  readonly stroke: string;
  readonly sw: number;
  readonly dash: string;
  readonly marker: string;
  readonly err: boolean;
}

/**
 * Legacy edge table (cluster / c4 still read it) — `solid | dashed |
 * forbidden | error` → SVG attributes, on the legacy token names.
 */
export const GEDGE: Record<string, EdgeStyle> = {
  solid: { stroke: 'var(--charcoal)', sw: 1.4, dash: '', marker: 'gArrow', err: false },
  dashed: { stroke: 'var(--gray)', sw: 1.4, dash: '5 4', marker: 'gSoft', err: false },
  forbidden: { stroke: 'var(--negative)', sw: 2, dash: '', marker: 'gErr', err: true },
  error: { stroke: 'var(--negative)', sw: 1.6, dash: '', marker: 'gErr', err: true },
};

/**
 * The skin's edge table (`DESIGN.md` › Strokes and arrows): default 1.5px
 * `muted` with a small filled head; dashed = open head; forbidden / error =
 * `negative` (forbidden also dashed, so the "never" reads without hue).
 */
export const SKIN_EDGE: Record<string, EdgeStyle> = {
  solid: { stroke: 'var(--muted)', sw: 1.5, dash: '', marker: 'skArrow', err: false },
  dashed: { stroke: 'var(--muted)', sw: 1.5, dash: '5 4', marker: 'skOpen', err: false },
  forbidden: { stroke: 'var(--negative)', sw: 1.5, dash: '4 3', marker: 'skErr', err: true },
  error: { stroke: 'var(--negative)', sw: 1.5, dash: '', marker: 'skErr', err: true },
};

/** The accent edge: 1.75px `accent`, filled head. */
export const SKIN_EDGE_ACCENT: EdgeStyle = {
  stroke: 'var(--accent)',
  sw: 1.75,
  dash: '',
  marker: 'skAccent',
  err: false,
};
