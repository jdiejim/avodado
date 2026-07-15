import { describe, expect, it } from 'vitest';
import {
  dropGapIndex,
  fenceBody,
  isFileDrag,
  looksLikeOpenApi,
  planImport,
  slugFromTitle,
} from './importFile.js';

describe('isFileDrag — the file-vs-block drag discriminator', () => {
  it('is true only when the drag carries Files', () => {
    expect(isFileDrag(['Files'])).toBe(true);
    expect(isFileDrag(['application/x-moz-file', 'Files'])).toBe(true);
  });

  it('is false for the canvas block DnD payload (text/plain)', () => {
    expect(isFileDrag(['text/plain'])).toBe(false);
  });

  it('is false for empty / missing type lists', () => {
    expect(isFileDrag([])).toBe(false);
    expect(isFileDrag(null)).toBe(false);
    expect(isFileDrag(undefined)).toBe(false);
  });

  it('accepts DOM-style iterables, not just arrays', () => {
    expect(isFileDrag(new Set(['Files']))).toBe(true);
  });
});

describe('looksLikeOpenApi', () => {
  it('matches a top-level openapi: key (YAML)', () => {
    expect(looksLikeOpenApi('openapi: 3.0.3\ninfo:\n  title: X\n')).toBe(true);
  });

  it('matches swagger: and quoted JSON keys', () => {
    expect(looksLikeOpenApi('swagger: "2.0"\n')).toBe(true);
    expect(looksLikeOpenApi('{\n  "openapi": "3.1.0",\n  "info": {}\n}')).toBe(true);
  });

  it('rejects plain YAML/JSON without the marker key', () => {
    expect(looksLikeOpenApi('name: config\nports:\n  - 8080\n')).toBe(false);
    expect(looksLikeOpenApi('{"name": "package", "version": "1.0.0"}')).toBe(false);
    // the word inside a value is not a key
    expect(looksLikeOpenApi('description: openapi is cool\n')).toBe(false);
  });
});

describe('fenceBody — fence-stripping for insertBlock', () => {
  it('strips the fence lines and the trailing newline', () => {
    expect(fenceBody('```table\ncolumns: [a, b]\nrows:\n  - [1, 2]\n```\n')).toBe(
      'columns: [a, b]\nrows:\n  - [1, 2]',
    );
  });

  it('works without a trailing newline and returns non-fences unchanged', () => {
    expect(fenceBody('```chart\nkind: bar\n```')).toBe('kind: bar');
    expect(fenceBody('kind: bar')).toBe('kind: bar');
  });
});

describe('slugFromTitle', () => {
  it('slugifies a spec title', () => {
    expect(slugFromTitle('Orders API')).toBe('orders-api');
    expect(slugFromTitle('  Petstore — v2 (beta) ')).toBe('petstore-v2-beta');
  });

  it('falls back to api for empty/symbol-only titles', () => {
    expect(slugFromTitle('')).toBe('api');
    expect(slugFromTitle('™©')).toBe('api');
  });
});

describe('dropGapIndex', () => {
  const segs = [
    { top: 0, bottom: 100 },
    { top: 100, bottom: 300 },
    { top: 300, bottom: 340 },
  ];

  it('maps a pointer Y to the nearest gap (midpoint rule)', () => {
    expect(dropGapIndex(10, segs)).toBe(0); // above seg 0's midpoint
    expect(dropGapIndex(60, segs)).toBe(1); // past seg 0's midpoint
    expect(dropGapIndex(250, segs)).toBe(2);
    expect(dropGapIndex(999, segs)).toBe(3); // below everything → end
  });

  it('respects minIndex (the locked gap above the meta cover)', () => {
    expect(dropGapIndex(10, segs, 1)).toBe(1);
    expect(dropGapIndex(999, segs, 1)).toBe(3);
    expect(dropGapIndex(0, [], 0)).toBe(0);
  });
});

describe('planImport — suggestion-to-insert wiring', () => {
  it('CSV with a status column → statustable plan with a fence-free body', () => {
    const plan = planImport('tasks.csv', 'task,status\nShip,done\nPlan,todo\n');
    expect(plan.kind).toBe('block');
    if (plan.kind !== 'block') return;
    expect(plan.type).toBe('statustable');
    expect(plan.reason).toContain('status');
    expect(plan.body).not.toContain('```');
    expect(plan.body).toContain('columns: [task]');
    expect(plan.body).toContain('status: done');
  });

  it('numeric CSV → chart plan; mixed-text CSV → table plan', () => {
    const chart = planImport('sales.csv', 'month,units\nJan,4\nFeb,7\n');
    expect(chart.kind).toBe('block');
    if (chart.kind === 'block') expect(chart.type).toBe('chart');

    const table = planImport('team.csv', 'name,role,team\nAda,eng,core\n');
    expect(table.kind).toBe('block');
    if (table.kind === 'block') {
      expect(table.type).toBe('table');
      expect(table.body).toContain('columns: [name, role, team]');
    }
  });

  it('ragged CSV keeps its warnings on the plan', () => {
    const plan = planImport('r.csv', 'a,b,c\n1,2\n');
    expect(plan.kind).toBe('block');
    if (plan.kind === 'block') expect(plan.warnings.length).toBeGreaterThan(0);
  });

  it('broken CSV (unterminated quote) → error plan, nothing insertable', () => {
    const plan = planImport('broken.csv', 'a,b\n"unclosed,1\n');
    expect(plan.kind).toBe('error');
    if (plan.kind === 'error') expect(plan.message).toContain('unterminated');
  });

  it('empty CSV → error plan', () => {
    expect(planImport('empty.csv', '\n\n').kind).toBe('error');
  });

  it('OpenAPI yaml → openapi plan with title + default slug', () => {
    const plan = planImport(
      'spec.yaml',
      'openapi: 3.0.0\ninfo:\n  title: Orders API\n  version: 1.0.0\n',
    );
    expect(plan.kind).toBe('openapi');
    if (plan.kind !== 'openapi') return;
    expect(plan.title).toBe('Orders API');
    expect(plan.defaultSlug).toBe('orders-api');
  });

  it('OpenAPI json is detected too', () => {
    const plan = planImport(
      'spec.json',
      '{"openapi": "3.1.0", "info": {"title": "Ping", "version": "1"}}',
    );
    expect(plan.kind).toBe('openapi');
  });

  it('non-OpenAPI yaml/json → unrecognized (toast copy, not an error)', () => {
    const plan = planImport('config.yaml', 'name: config\nports: [8080]\n');
    expect(plan.kind).toBe('unrecognized');
    if (plan.kind === 'unrecognized') expect(plan.message).toContain('not a recognized');
  });

  it('sniffs-as-OpenAPI but fails validation → error plan', () => {
    const plan = planImport('bad.yaml', 'openapi: 3.0.0\ninfo: { version: "1" }\n');
    expect(plan.kind).toBe('error');
  });

  it('unclaimed extensions → unrecognized', () => {
    expect(planImport('notes.md', '# hi').kind).toBe('unrecognized');
    expect(planImport('archive.zip', '').kind).toBe('unrecognized');
  });
});
