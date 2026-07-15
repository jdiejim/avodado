/**
 * File-import wiring — the impure half of drag-drop / "Import…" imports.
 * Reads the dropped/picked file, asks `importFile.ts` for a plan, and turns
 * it into store actions: insert a filled block at the gap (CSV), arm the
 * OpenAPI confirm dialog (new doc), or toast the failure.
 *
 * "Insert as table instead" is deliberately NOT a toast action: the toast
 * names the auto-picked block and why, and ⌘Z + re-import (or the Edit
 * Sheet) covers the rare disagreement — one undo step, no extra UI.
 */

import { openapiToMarkdown } from '@avodado/core';
import { useStudio } from '../state/store.js';
import { insertBlockAt } from './actions.js';
import { planImport } from './importFile.js';

/** The slice of `File` this module needs — mockable in tests. */
export interface ImportableFile {
  readonly name: string;
  text: () => Promise<string>;
}

/**
 * Imports a file at gap `index`: CSV inserts the suggested block right there
 * (no Edit Sheet — the block arrives filled; the toast carries the
 * suggestion reason and ⌘Z undoes); OpenAPI arms the create-doc confirm;
 * anything else toasts. Edit-mode only.
 */
export async function importFileAt(file: ImportableFile, index: number): Promise<void> {
  const s = useStudio.getState();
  if (s.mode !== 'edit') return;
  let text: string;
  try {
    text = await file.text();
  } catch (err) {
    s.toast(`Could not read ${file.name}: ${(err as Error).message}`, 'error');
    return;
  }
  const plan = planImport(file.name, text);
  const st = useStudio.getState();
  switch (plan.kind) {
    case 'block': {
      if (st.currentSlug === null) {
        st.toast('Open a doc before importing a CSV.', 'error');
        return;
      }
      insertBlockAt(index, plan.type, plan.body, { openSheet: false });
      const undoHint = plan.type === 'table' ? '' : ' · ⌘Z to undo';
      st.toast(`Imported ${file.name} as ${plan.type} — ${plan.reason}${undoHint}`);
      if (plan.warnings.length > 0) {
        const first = plan.warnings[0] ?? '';
        const more = plan.warnings.length > 1 ? ` (+${plan.warnings.length - 1} more)` : '';
        st.toast(`CSV import warning: ${first}${more}`);
      }
      return;
    }
    case 'openapi': {
      st.requestImport({
        title: plan.title,
        defaultSlug: plan.defaultSlug,
        create: (slug) => {
          const idSlug = slug.split('/').pop() ?? slug;
          void useStudio.getState().newDoc(slug, openapiToMarkdown(plan.spec, { slug: idSlug }));
        },
      });
      return;
    }
    case 'unrecognized':
      st.toast(plan.message);
      return;
    case 'error':
      st.toast(plan.message, 'error');
      return;
  }
}

/**
 * The "Import…" menu entry: opens the OS file picker (csv / yaml / json) and
 * routes the pick through {@link importFileAt} at gap `index`.
 */
export function openImportFilePicker(index: number): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv,.yaml,.yml,.json';
  input.style.display = 'none';
  input.onchange = () => {
    const file = input.files?.[0];
    input.remove();
    if (file !== undefined) void importFileAt(file, index);
  };
  document.body.append(input);
  input.click();
}
