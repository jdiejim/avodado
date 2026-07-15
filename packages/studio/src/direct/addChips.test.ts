/**
 * The add-chip sweep: for EVERY block type's template, every list the studio
 * offers a "+ Add …" chip for (each `data-bl` the renderer emits, plus the
 * synthesized column-family and user-story chips) must produce a
 * SCHEMA-VALID document when its default item is appended — the exact op
 * `DirectLayer.addItem` commits, validated through the real pipeline.
 */

import { describe, expect, it } from 'vitest';
import {
  BLOCK_TEMPLATES,
  BLOCK_TYPES,
  describeBlockSchema,
  parseDocument,
  validateDocument,
} from '@avodado/core';
import { renderDocument } from '@avodado/render';
import { addColumnSets, columnSpecFor } from './columnOps.js';
import { setPathsInSegment } from './host.js';
import { newItemForList, parseBlockPath, resolveFieldAt, singularize, valueAt } from './paths.js';
import { fixupNewItem } from './seedItem.js';

function errorsOf(source: string): string[] {
  return validateDocument(parseDocument(source, 't'), 't.md')
    .filter((d) => d.level === 'error')
    .map((d) => `${d.code}: ${d.message}`);
}

describe('every add-chip default is schema-valid (all block types)', () => {
  for (const type of BLOCK_TYPES) {
    const body = BLOCK_TEMPLATES[type];
    it(`${type}: every offered list appends cleanly`, () => {
      const source = `# T\n\n${body}\n`;
      const doc = parseDocument(source, 't');
      const idx = doc.segments.findIndex((s) => s.kind !== 'markdown');
      const seg = doc.segments[idx];
      if (seg === undefined || seg.kind === 'markdown') throw new Error('segment missing');
      expect(errorsOf(source), `${type} template itself`).toEqual([]);

      const html = renderDocument(doc, {});
      const lists = new Set(
        [...html.matchAll(/data-bl="([^"]+)"/g)].map((m) => m[1] as string),
      );
      if (type === 'userstory') {
        lists.add('tags');
        lists.add('criteria');
      }
      const root = describeBlockSchema(seg.kind);
      const colSpec = columnSpecFor(seg.kind);

      for (const listPath of lists) {
        // Column-family columns add through the compound op instead.
        if (colSpec !== null && listPath === colSpec.colsPath) continue;
        const segs = parseBlockPath(listPath);
        const node = resolveFieldAt(root, segs);
        expect(node?.kind, `${type} ${listPath} resolves to an array`).toBe('array');
        if (node === null || node.kind !== 'array') continue;
        const items = valueAt(seg.data, segs);
        const siblings = Array.isArray(items) ? items : [];
        const lastName =
          [...segs].reverse().find((s): s is string => typeof s === 'string') ?? 'item';
        const value = fixupNewItem(
          seg.kind,
          listPath,
          newItemForList(node.element, siblings, singularize(lastName)),
          seg.data,
        );
        const edited = setPathsInSegment(source, doc, idx, [
          { path: [...segs, siblings.length], value },
        ]);
        expect(errorsOf(edited), `${type} + ${listPath}`).toEqual([]);
      }

      // The synthesized "+ Add column" chip (compound header + cells).
      if (colSpec !== null) {
        const r = addColumnSets(seg.kind, seg.data);
        expect(r, `${type} column add`).not.toBeNull();
        if (r !== null) {
          expect(errorsOf(setPathsInSegment(source, doc, idx, r.sets)), `${type} + column`).toEqual(
            [],
          );
        }
      }
    });
  }
});
