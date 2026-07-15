/**
 * importFileAt wiring — mocked file reads against the real store: CSV drops
 * insert the suggested block at the gap (no Edit Sheet), OpenAPI drops arm
 * the confirm dialog, junk toasts, and non-edit modes are inert.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useStudio } from '../state/store.js';
import { importFileAt, type ImportableFile } from './importActions.js';

const DOC = '```meta\ntitle: T\n```\n\nHello prose.\n';

function file(name: string, text: string): ImportableFile {
  return { name, text: () => Promise.resolve(text) };
}

function resetStore(): void {
  useStudio.setState({
    currentSlug: 'guide',
    source: DOC,
    savedSource: DOC,
    baseHash: 'h1',
    dirty: false,
    mode: 'edit',
    selection: null,
    sheet: null,
    sheetDirty: false,
    sheetFresh: false,
    pendingImport: null,
    undoStack: [],
    redoStack: [],
    toasts: [],
    conflict: null,
    autosave: false, // keep the autosave timer from firing fetches
    loaded: true,
  });
}

beforeEach(resetStore);

describe('importFileAt', () => {
  it('inserts the suggested statustable at the drop gap without opening the sheet', async () => {
    await importFileAt(file('tasks.csv', 'task,status\nShip,done\nPlan,todo\n'), 2);
    const s = useStudio.getState();
    expect(s.source).toContain('```statustable');
    expect(s.source).toContain('status: done');
    expect(s.sheet).toBeNull(); // imported blocks arrive filled — no fill-in mode
    expect(s.selection).toBe(2);
    const toast = s.toasts.map((t) => t.message).join(' | ');
    expect(toast).toContain('statustable');
    expect(toast).toContain('status column'); // the suggestion reason is surfaced
  });

  it('one undo step reverts the whole import (the "insert as table instead" path)', async () => {
    await importFileAt(file('sales.csv', 'month,units\nJan,4\n'), 2);
    expect(useStudio.getState().source).toContain('```chart');
    useStudio.getState().undo();
    expect(useStudio.getState().source).toBe(DOC);
  });

  it('surfaces CSV parse warnings as a toast alongside the insert', async () => {
    await importFileAt(file('ragged.csv', 'name,role,team\nAda,eng\n'), 2);
    const s = useStudio.getState();
    expect(s.source).toContain('```table');
    expect(s.toasts.some((t) => t.message.includes('warning'))).toBe(true);
  });

  it('broken CSV → error toast, nothing inserted', async () => {
    await importFileAt(file('broken.csv', 'a,b\n"unclosed,1\n'), 2);
    const s = useStudio.getState();
    expect(s.source).toBe(DOC);
    expect(s.toasts.some((t) => t.tone === 'error')).toBe(true);
  });

  it('OpenAPI file arms the confirm dialog with title + prefilled slug', async () => {
    await importFileAt(
      file('spec.yaml', 'openapi: 3.0.0\ninfo:\n  title: Orders API\n  version: 1.0.0\n'),
      0,
    );
    const s = useStudio.getState();
    expect(s.source).toBe(DOC); // nothing inserted into the current doc
    expect(s.pendingImport?.title).toBe('Orders API');
    expect(s.pendingImport?.defaultSlug).toBe('orders-api');
    expect(typeof s.pendingImport?.create).toBe('function');
  });

  it('cancelImport discards the pending OpenAPI import', async () => {
    await importFileAt(file('spec.yaml', 'openapi: 3.0.0\ninfo: {title: X, version: "1"}\n'), 0);
    useStudio.getState().cancelImport();
    expect(useStudio.getState().pendingImport).toBeNull();
  });

  it('non-OpenAPI yaml → "not a recognized import format" toast, nothing armed', async () => {
    await importFileAt(file('config.yaml', 'name: config\n'), 0);
    const s = useStudio.getState();
    expect(s.pendingImport).toBeNull();
    expect(s.source).toBe(DOC);
    expect(s.toasts.some((t) => t.message.includes('not a recognized'))).toBe(true);
  });

  it('does nothing outside Edit mode', async () => {
    useStudio.setState({ mode: 'site' });
    await importFileAt(file('tasks.csv', 'task,status\nShip,done\n'), 1);
    const s = useStudio.getState();
    expect(s.source).toBe(DOC);
    expect(s.toasts).toEqual([]);
  });
});
