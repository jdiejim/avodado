/**
 * Full-document templates (relocated from the CLI): every template is a
 * complete doc that parses and validates with no errors (alias fences inside
 * legacy templates may warn — warnings never fail `avo check`), and the
 * picker display info covers exactly the template names.
 */

import { describe, expect, it } from 'vitest';
import {
  DOC_TEMPLATES,
  DOC_TEMPLATE_INFO,
  isDocTemplate,
} from '../blocks/docTemplates.js';
import { parseDocument } from '../parser.js';
import { validateDocument } from '../validate.js';

const EXPECTED_NAMES = [
  'adr',
  'design-doc',
  'runbook',
  'roadmap',
  'api-spec',
  'system-design',
  'agent-system',
  'design-system',
  'postmortem',
  'data-model',
  'deck',
  'migration-plan',
  'threat-model',
  'service-overview',
  'release-notes',
  'test-plan',
  'onboarding',
  'status-update',
];

describe('DOC_TEMPLATES', () => {
  it('contains exactly the 18 known templates', () => {
    expect(Object.keys(DOC_TEMPLATES).sort()).toEqual([...EXPECTED_NAMES].sort());
  });

  it('every template starts with a meta block and validates with zero errors', () => {
    for (const [name, template] of Object.entries(DOC_TEMPLATES)) {
      expect(template.startsWith('```meta\n'), `${name} starts with meta`).toBe(true);
      const doc = parseDocument(template, name);
      const diags = validateDocument(doc, `${name}.md`);
      const errors = diags.filter((d) => d.level === 'error');
      expect(errors, `${name}: ${JSON.stringify(errors, null, 2)}`).toEqual([]);
    }
  });

  /**
   * A YAML flow mapping splits on commas, so an unquoted value containing one
   * swallows the keys after it — `mitigation: A, owner: X` parses as a single
   * `mitigation` string. It still validates (those fields are optional), so
   * only the rendered text gives it away. This catches it at the source.
   */
  it('never lets a quoted value swallow the keys after it', () => {
    const swallowed = /(\w+): "[^"]*, (?:owner|status|kind|tone|accent|icon|tag|done|type|trend|delta|note|color|desc|priority|lead|verdict|how|kicker|budget|window|target|current|sli|role|focus): /;
    for (const [name, template] of Object.entries(DOC_TEMPLATES)) {
      for (const [i, line] of template.split('\n').entries()) {
        expect(swallowed.test(line), `${name}:${String(i + 1)} — ${line}`).toBe(false);
      }
    }
  });

  it('isDocTemplate guards template names (and does not leak Object.prototype)', () => {
    for (const name of EXPECTED_NAMES) expect(isDocTemplate(name)).toBe(true);
    expect(isDocTemplate('sequence')).toBe(false);
    expect(isDocTemplate('hasOwnProperty')).toBe(false);
  });
});

describe('DOC_TEMPLATE_INFO', () => {
  it('covers exactly the same names, each with a non-empty title + description', () => {
    expect(Object.keys(DOC_TEMPLATE_INFO).sort()).toEqual(Object.keys(DOC_TEMPLATES).sort());
    for (const [name, info] of Object.entries(DOC_TEMPLATE_INFO)) {
      expect(info.title.trim().length, `${name} title`).toBeGreaterThan(0);
      expect(info.description.trim().length, `${name} description`).toBeGreaterThan(0);
    }
  });
});
