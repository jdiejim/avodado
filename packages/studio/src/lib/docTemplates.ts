/**
 * Doc-template picker data — the "+ New doc" flow's cards, derived entirely
 * from core's DOC_TEMPLATES / DOC_TEMPLATE_INFO (the same data `avo new`
 * uses). Pure functions; the modal UI lives in components/TemplatePicker.
 */

import {
  BLOCK_TYPES,
  DOC_TEMPLATES,
  DOC_TEMPLATE_INFO,
  parseDocument,
  type BlockType,
} from '@avodado/core';

/** One picker card: a doc template plus its derived mini block-type list. */
export interface DocTemplateCard {
  /** The template name (`adr`, `design-doc`, …) — also the default slug. */
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** The distinct block types the template's body fences use, `meta` excluded. */
  readonly blockTypes: readonly BlockType[];
}

/**
 * The distinct block types a template body's fences open, in first-use order,
 * `meta` excluded (every template has exactly one cover). Fences sit at
 * column 0; closers are bare ``` — a simple open/close toggle walks them.
 */
export function templateBlockTypes(source: string): BlockType[] {
  const out: BlockType[] = [];
  let inFence = false;
  for (const line of source.split('\n')) {
    if (!line.startsWith('```')) continue;
    if (inFence) {
      inFence = false;
      continue;
    }
    inFence = true;
    const tag = line.slice(3).trim();
    if (
      tag !== 'meta' &&
      (BLOCK_TYPES as readonly string[]).includes(tag) &&
      !out.includes(tag as BlockType)
    ) {
      out.push(tag as BlockType);
    }
  }
  return out;
}

/** The picker cards, in DOC_TEMPLATES order (Blank is the UI's own card). */
export const TEMPLATE_CARDS: readonly DocTemplateCard[] = Object.entries(DOC_TEMPLATES).map(
  ([id, source]) => ({
    id,
    title: DOC_TEMPLATE_INFO[id]?.title ?? id,
    description: DOC_TEMPLATE_INFO[id]?.description ?? '',
    blockTypes: templateBlockTypes(source),
  }),
);

/**
 * The segment index a just-created doc should open its Edit Sheet on: the
 * FIRST content block (first typed, non-meta segment) so Tab/Enter walks the
 * author through filling every section — or the cover (0) for a blank doc.
 */
export function firstContentIndex(source: string, slug: string): number {
  const doc = parseDocument(source, slug);
  const i = doc.segments.findIndex((s) => s.kind !== 'markdown' && s.kind !== 'meta');
  return i >= 0 ? i : 0;
}
