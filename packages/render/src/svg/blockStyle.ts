/**
 * Shared color palette + node-glyph helpers used by architecture-flavoured
 * blocks (cluster, block, infra, felogic, belogic, …).
 *
 * Ported from doc-studio.jsx `blockStyle` + `nodeGlyph`.
 */

/** Color triple for a node kind: accent (stripe / border), fill, text color. */
export interface NodeColors {
  readonly accent: string;
  readonly fill: string;
  readonly text: string;
}

/** Maps a node `kind` (client / service / store / queue / ...) to colors. */
export function blockStyle(kind: string | undefined): NodeColors {
  switch ((kind ?? '').toLowerCase()) {
    case 'client':
      return { accent: '#0e54a1', fill: '#e5eff8', text: '#0a3a6e' };
    case 'service':
    case 'microservice':
    case 'compute':
    case 'container':
      return { accent: '#1f9747', fill: '#dcf1e2', text: '#0f3d22' };
    case 'data':
      return { accent: '#6b21a8', fill: '#ede9fe', text: '#4a1772' };
    case 'store':
    case 'db':
    case 'database':
    case 'postgres':
    case 'mysql':
    case 'mongo':
    case 'mongodb':
    case 'dynamo':
      return { accent: '#f7952c', fill: '#fde7cd', text: '#7a3d00' };
    case 'bucket':
    case 'blob':
    case 'object':
    case 's3':
      return { accent: '#b45309', fill: '#fef3c7', text: '#7a3d00' };
    case 'queue':
    case 'mq':
    case 'broker':
    case 'sqs':
    case 'rabbitmq':
      return { accent: '#0f766e', fill: '#ccfbf1', text: '#0f4f49' };
    case 'cache':
    case 'redis':
    case 'memcached':
      return { accent: '#0891b2', fill: '#cffafe', text: '#0e4f5c' };
    case 'gateway':
    case 'lb':
    case 'proxy':
      return { accent: '#0e54a1', fill: '#cfe0f3', text: '#0a3a6e' };
    case 'function':
    case 'lambda':
      return { accent: '#7c3aed', fill: '#ede9fe', text: '#4a1772' };
    case 'cdn':
      return { accent: '#1a6dbe', fill: '#e5eff8', text: '#0a3a6e' };
    case 'external':
      return { accent: '#6b7280', fill: '#f3f4f6', text: '#374151' };
    case 'producer':
      return { accent: '#1f9747', fill: '#dcf1e2', text: '#0f3d22' };
    case 'topic':
      return { accent: '#0f766e', fill: '#ccfbf1', text: '#0f4f49' };
    case 'consumer':
      return { accent: '#1a6dbe', fill: '#e5eff8', text: '#0a3a6e' };
    case 'context':
      return { accent: '#6b21a8', fill: '#ede9fe', text: '#4a1772' };
    case 'firewall':
    case 'waf':
    case 'shield':
      return { accent: '#991b1b', fill: '#fee2e2', text: '#991b1b' };
    case 'dns':
      return { accent: '#1a6dbe', fill: '#e5eff8', text: '#0a3a6e' };
    case 'auth':
    case 'identity':
    case 'idp':
    case 'iam':
    case 'oauth':
    case 'sso':
      return { accent: '#6b21a8', fill: '#ede9fe', text: '#4a1772' };
    case 'monitor':
    case 'observability':
    case 'metrics':
    case 'logs':
    case 'tracing':
    case 'apm':
      return { accent: '#0891b2', fill: '#cffafe', text: '#0e4f5c' };
    case 'scheduler':
    case 'cron':
    case 'job':
      return { accent: '#475569', fill: '#e2e8f0', text: '#1e293b' };
    case 'stream':
    case 'kafka':
    case 'kinesis':
      return { accent: '#0369a1', fill: '#e0f2fe', text: '#0c4a6e' };
    case 'warehouse':
    case 'lake':
      return { accent: '#4338ca', fill: '#e0e7ff', text: '#312e81' };
    case 'analytics':
    case 'bi':
      return { accent: '#4338ca', fill: '#e0e7ff', text: '#312e81' };
    case 'search':
    case 'index':
    case 'elasticsearch':
    case 'opensearch':
      return { accent: '#1a6dbe', fill: '#e5eff8', text: '#0a3a6e' };
    case 'registry':
      return { accent: '#b45309', fill: '#fef3c7', text: '#7a3d00' };
    case 'ci':
    case 'cicd':
    case 'pipeline':
      return { accent: '#0e54a1', fill: '#cfe0f3', text: '#0a3a6e' };
    case 'git':
    case 'repo':
    case 'scm':
      return { accent: '#475569', fill: '#e2e8f0', text: '#1e293b' };
    case 'device':
    case 'iot':
      return { accent: '#0e54a1', fill: '#e5eff8', text: '#0a3a6e' };
    case 'email':
    case 'sms':
      return { accent: '#b45309', fill: '#fef3c7', text: '#7a3d00' };
    case 'config':
    case 'settings':
      return { accent: '#475569', fill: '#e2e8f0', text: '#1e293b' };
    case 'ml':
    case 'model':
    case 'llm':
    case 'agent':
    case 'ai':
      return { accent: '#7c3aed', fill: '#ede9fe', text: '#4a1772' };
    case 'user':
    case 'person':
    case 'actor':
    case 'browser':
    case 'web':
    case 'mobile':
      return { accent: '#0e54a1', fill: '#e5eff8', text: '#0a3a6e' };
    case 'vm':
    case 'server':
    case 'host':
      return { accent: '#475569', fill: '#f1f5f9', text: '#1e293b' };
    case 'secrets':
    case 'vault':
    case 'kms':
      return { accent: '#334155', fill: '#e2e8f0', text: '#0f172a' };
    case 'notification':
    case 'webhook':
      return { accent: '#b45309', fill: '#fef3c7', text: '#7a3d00' };
    case 'worker':
    case 'etl':
      return { accent: '#1f9747', fill: '#dcf1e2', text: '#0f3d22' };
    case 'shard':
    case 'shards':
    case 'sharded':
    case 'replica':
    case 'replicas':
    case 'replicaset':
      return { accent: '#f7952c', fill: '#fde7cd', text: '#7a3d00' };
    case 'users':
    case 'crowd':
      return { accent: '#0e54a1', fill: '#e5eff8', text: '#0a3a6e' };
    case 'region':
    case 'geo':
    case 'globe':
      return { accent: '#1a6dbe', fill: '#e5eff8', text: '#0a3a6e' };
    default:
      return { accent: '#374151', fill: '#fff', text: 'var(--charcoal)' };
  }
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
      `<rect x="${x + 1}" y="${y + 4}" width="11" height="11" rx="1.5" fill="#fff"/>` +
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

/** Edge style table — `solid | dashed | forbidden | error` → SVG attributes. */
export const GEDGE: Record<string, EdgeStyle> = {
  solid: { stroke: 'var(--charcoal)', sw: 1.4, dash: '', marker: 'gArrow', err: false },
  dashed: { stroke: 'var(--gray)', sw: 1.4, dash: '5 4', marker: 'gSoft', err: false },
  forbidden: { stroke: '#991b1b', sw: 2, dash: '', marker: 'gErr', err: true },
  error: { stroke: '#991b1b', sw: 1.6, dash: '', marker: 'gErr', err: true },
};
