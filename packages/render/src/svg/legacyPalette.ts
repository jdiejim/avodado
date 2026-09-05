/**
 * The legacy per-kind hex palette — the bright "chip" colours the pre-skin
 * architecture renderers (cluster, felogic's shaped nodes, …) still draw with.
 *
 * The block family itself no longer uses hue to tell kinds apart (see
 * `DESIGN.md` and `nodeSkin` in `blockStyle.ts`); this file exists so the
 * untouched renderers keep their look while they migrate, and it shrinks as
 * the skin rolls out. New code never imports it.
 *
 * Ported from doc-studio.jsx `blockStyle`.
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
