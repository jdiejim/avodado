/**
 * Embedded sample docs loaded as raw text via Vite's `?raw` query string.
 * These ship with the playground so first-time visitors land on something
 * meaningful instead of an empty editor.
 */

import roadmapMd from '../../../resources/avodado-roadmap.md?raw';
import ordersMd from '../../../resources/orders-api.md?raw';
import blocksDemoMd from '../../../resources/blocks-demo.md?raw';

export interface Sample {
  readonly id: string;
  readonly label: string;
  readonly source: string;
}

export const samples: readonly Sample[] = [
  { id: 'orders-api', label: 'Orders API (sequence + erd + userstory)', source: ordersMd },
  { id: 'blocks-demo', label: 'All blocks demo (every type)', source: blocksDemoMd },
  { id: 'roadmap', label: 'Avodado roadmap', source: roadmapMd },
];

// `samples` is a non-empty const above; the cast just satisfies
// `noUncheckedIndexedAccess` without a non-null assertion.
export const DEFAULT_SAMPLE: Sample = samples[0] ?? { id: 'empty', label: 'Empty', source: '' };
