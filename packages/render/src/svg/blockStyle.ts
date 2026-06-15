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
      return { accent: '#f7952c', fill: '#fde7cd', text: '#7a3d00' };
    case 'bucket':
    case 'blob':
    case 'object':
      return { accent: '#b45309', fill: '#fef3c7', text: '#7a3d00' };
    case 'queue':
      return { accent: '#0f766e', fill: '#ccfbf1', text: '#0f4f49' };
    case 'cache':
      return { accent: '#0891b2', fill: '#cffafe', text: '#0e4f5c' };
    case 'gateway':
    case 'lb':
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
      return { accent: '#991b1b', fill: '#fee2e2', text: '#991b1b' };
    default:
      return { accent: '#374151', fill: '#fff', text: '#1a1a2e' };
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
  if (k === 'store' || k === 'db' || k === 'database') {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none">` +
      `<ellipse cx="${x + 8}" cy="${y + 3}" rx="7" ry="3"/>` +
      `<path d="M${x + 1} ${y + 3} V ${y + 13}"/>` +
      `<path d="M${x + 15} ${y + 3} V ${y + 13}"/>` +
      `<path d="M${x + 1} ${y + 13} a 7 3 0 0 0 14 0"/>` +
      `</g>`
    );
  }
  if (k === 'bucket' || k === 'blob' || k === 'object') {
    return (
      `<g stroke="${c}" stroke-width="1.3" fill="none">` +
      `<ellipse cx="${x + 8}" cy="${y + 3}" rx="7" ry="2.5"/>` +
      `<path d="M${x + 1.5} ${y + 3} L ${x + 3.5} ${y + 14} L ${x + 12.5} ${y + 14} L ${x + 14.5} ${y + 3}"/>` +
      `</g>`
    );
  }
  if (k === 'queue' || k === 'topic') {
    return (
      `<g stroke="${c}" stroke-width="1.6">` +
      `<path d="M${x + 2} ${y + 1} V ${y + 14}"/>` +
      `<path d="M${x + 8} ${y + 1} V ${y + 14}"/>` +
      `<path d="M${x + 14} ${y + 1} V ${y + 14}"/>` +
      `</g>`
    );
  }
  if (k === 'firewall') {
    return `<path d="M${x + 8} ${y} L ${x + 15} ${y + 3} V ${y + 9} Q ${x + 15} ${y + 14} ${x + 8} ${y + 16} Q ${x + 1} ${y + 14} ${x + 1} ${y + 9} V ${y + 3} Z" fill="none" stroke="${c}" stroke-width="1.3"/>`;
  }
  if (k === 'cache') {
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
  if (k === 'gateway' || k === 'lb') {
    return (
      `<g stroke="${c}" stroke-width="1.5" fill="none">` +
      `<path d="M${x + 2} ${y + 1} L ${x + 8} ${y + 7} L ${x + 2} ${y + 13}"/>` +
      `<path d="M${x + 8} ${y + 1} L ${x + 14} ${y + 7} L ${x + 8} ${y + 13}"/>` +
      `</g>`
    );
  }
  if (k === 'service' || k === 'microservice' || k === 'compute' || k === 'container') {
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
