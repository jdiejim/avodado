/**
 * Alias render parity — the consolidation's byte-equality gate.
 *
 * Each fixture pair pins one of the 12 former block types that merged into a
 * canonical type (infra/event/ddd/network → block, belogic → felogic, dag →
 * flow, waterfall/funnel → chart, diff/terminal → code, mece → tree,
 * tracker → statustable):
 *
 * - `<name>.md`  — the type's ORIGINAL starter template (recovered verbatim
 *   from the pre-merge `BLOCK_TEMPLATES` catalog), still spelled with the old
 *   fence tag.
 * - `<name>.html` — that template rendered through the PRE-merge pipeline
 *   (`renderDocumentSegments`, segment html joined).
 *
 * The test parses the old-spelling markdown through the CURRENT pipeline —
 * exercising the alias path (canonical kind + patch + `sourceType`) — and
 * asserts the rendered segments are byte-identical to the pinned output.
 * The fixtures are the spec: if this fails, fix the renderer, never the
 * fixtures.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDocument, BLOCK_ALIASES } from '@avodado/core';
import { renderDocumentSegments } from '../parts.js';

const FIXTURES = resolve(import.meta.dirname, '__fixtures__/alias-parity');

const ALIASES = [
  'infra',
  'event',
  'ddd',
  'network',
  'belogic',
  'dag',
  'waterfall',
  'funnel',
  'diff',
  'terminal',
  'mece',
  'tracker',
] as const;

describe('alias render parity (byte-equality with the pre-merge output)', () => {
  it('covers every entry in BLOCK_ALIASES', () => {
    expect([...ALIASES].sort()).toEqual(Object.keys(BLOCK_ALIASES).sort());
  });

  for (const name of ALIASES) {
    it(`\`${name}\` template renders byte-identically through the alias path`, () => {
      const md = readFileSync(resolve(FIXTURES, `${name}.md`), 'utf8');

      const doc = parseDocument(md, name);
      // The alias fence must parse (no parse/patch regressions hiding behind
      // an error <div> that would trivially differ from the fixture).
      const typed = doc.segments.filter((s) => s.kind !== 'markdown');
      expect(typed).toHaveLength(1);
      expect(typed[0]?.parseError, name).toBeUndefined();
      expect(typed[0]?.sourceType, name).toBe(name);

      const { segments } = renderDocumentSegments(doc);
      const html = segments.map((s) => s.html).join('');

      if (name === 'dag') {
        // The `flow` renderer gained INERT grid-metadata attributes (studio
        // drag-to-connect) after this fixture was pinned, so the byte pin
        // moved to a LIVE parity check: the alias fence must render exactly
        // like the equivalent canonical fence (same body, `flow` tag, the
        // alias patch spelled out). The section eyebrow still reads DAG via
        // `sourceType`, so only the body-derived markup is compared.
        const canonicalMd = md.replace('```dag\n', '```flow\nvariant: dag\n');
        const canonicalDoc = parseDocument(canonicalMd, name);
        const canonicalHtml = renderDocumentSegments(canonicalDoc)
          .segments.map((s) => s.html)
          .join('')
          .replace('SECTION 01 · Flowchart', 'SECTION 01 · DAG');
        expect(html, name).toBe(canonicalHtml);
        return;
      }

      const pinned = readFileSync(resolve(FIXTURES, `${name}.html`), 'utf8');
      expect(html, name).toBe(pinned);
    });
  }
});
