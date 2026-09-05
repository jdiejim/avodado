/**
 * Alias render parity — the consolidation's equality gate.
 *
 * Each fixture pins one of the 12 former block types that merged into a
 * canonical type (infra/event/ddd/network → block, belogic → felogic, dag →
 * flow, waterfall/funnel → chart, diff/terminal → code, mece → tree,
 * tracker → statustable): `<name>.md` is the type's ORIGINAL starter
 * template (recovered verbatim from the pre-merge `BLOCK_TEMPLATES` catalog),
 * still spelled with the old fence tag.
 *
 * The test parses the old-spelling markdown through the CURRENT pipeline —
 * exercising the alias path (canonical kind + patch + `sourceType`) — and
 * asserts it renders byte-identically to the equivalent canonical fence (same
 * body, canonical tag, the alias patch spelled out). The section eyebrow is
 * the one intended difference (it keeps the alias's historical label via
 * `sourceType`), so it is normalised before the comparison. A live check
 * rather than pinned HTML: the skin restyles renderers, and what must never
 * drift is alias == canonical, not the pixels of a given release.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDocument, BLOCK_ALIASES } from '@avodado/core';
import { renderDocumentSegments } from '../parts.js';
import { SECTION_LABEL } from '../blocks/frame.js';

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

describe('alias render parity (byte-equality with the canonical fence)', () => {
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

      // The equivalent canonical fence: canonical tag + the alias patch as
      // YAML lines ahead of the original body.
      const alias = BLOCK_ALIASES[name];
      if (alias === undefined) throw new Error(`no alias entry for ${name}`);
      const patchLines = Object.entries(alias.patch ?? {})
        .map(([k, v]) => `${k}: ${String(v)}\n`)
        .join('');
      const canonicalMd = md.replace(`\`\`\`${name}\n`, `\`\`\`${alias.type}\n${patchLines}`);
      const canonicalDoc = parseDocument(canonicalMd, name);
      const canonicalHtml = renderDocumentSegments(canonicalDoc)
        .segments.map((s) => s.html)
        .join('')
        .replace(`SECTION 01 · ${SECTION_LABEL[alias.type]}`, `SECTION 01 · ${alias.sectionLabel}`);
      expect(canonicalDoc.segments.filter((s) => s.kind !== 'markdown')[0]?.parseError, name).toBeUndefined();
      expect(html, name).toBe(canonicalHtml);
    });
  }
});
