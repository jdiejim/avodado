/**
 * Entry point for the Avodado VS Code extension.
 *
 * Responsibilities:
 * - Register the `Avodado: Show Preview to the Side` command + editor-title button
 * - Maintain a `DiagnosticCollection` that surfaces parse/schema/dangling-ref
 *   errors as squiggly underlines in the Problems panel
 * - Re-validate on edit / open / save (debounced)
 * - Provide quick commands for cycling the preview theme and validating all
 *   workspace docs at once
 */

import * as vscode from 'vscode';
import { checkDocument } from './avodadoCheck';
import { AvodadoQuickFixProvider } from './quickFix';
import { PreviewPanel } from './preview';

const DIAGNOSTIC_DEBOUNCE_MS = 250;

export function activate(context: vscode.ExtensionContext): void {
  const collection = vscode.languages.createDiagnosticCollection('avodado');
  context.subscriptions.push(collection);

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { language: 'markdown' },
      new AvodadoQuickFixProvider(),
      AvodadoQuickFixProvider.metadata,
    ),
  );

  const debounced = new Map<string, ReturnType<typeof setTimeout>>();
  const refresh = (doc: vscode.TextDocument): void => {
    if (doc.languageId !== 'markdown') return;
    const key = doc.uri.toString();
    const existing = debounced.get(key);
    if (existing !== undefined) clearTimeout(existing);
    debounced.set(
      key,
      setTimeout(() => {
        try {
          collection.set(doc.uri, checkDocument(doc));
        } catch {
          // parsing failed catastrophically — clear stale diagnostics
          collection.delete(doc.uri);
        }
      }, DIAGNOSTIC_DEBOUNCE_MS),
    );
  };

  // Run on already-open docs
  for (const doc of vscode.workspace.textDocuments) refresh(doc);

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(refresh),
    vscode.workspace.onDidChangeTextDocument((e) => refresh(e.document)),
    vscode.workspace.onDidCloseTextDocument((doc) => collection.delete(doc.uri)),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('avodado.showPreview', () => {
      const editor = vscode.window.activeTextEditor;
      if (editor === undefined || editor.document.languageId !== 'markdown') {
        void vscode.window.showInformationMessage('Open a Markdown file to preview.');
        return;
      }
      PreviewPanel.showOrFocus(context, editor);
    }),

    vscode.commands.registerCommand('avodado.cycleTheme', async () => {
      const cfg = vscode.workspace.getConfiguration('avodado');
      const current = cfg.get<string>('theme', 'textbook');
      const order = ['textbook', 'minimal', 'teal', 'plum', 'slate'];
      const next = order[(order.indexOf(current) + 1) % order.length] ?? 'textbook';
      await cfg.update('theme', next, vscode.ConfigurationTarget.Global);
      void vscode.window.setStatusBarMessage(`Avodado preview theme: ${next}`, 1500);
    }),

    vscode.commands.registerCommand('avodado.checkAll', async () => {
      const cfg = vscode.workspace.getConfiguration('avodado');
      const glob = cfg.get<string>('validate.glob', 'docs/**/*.md');
      const uris = await vscode.workspace.findFiles(glob);
      let errors = 0;
      for (const uri of uris) {
        const doc = await vscode.workspace.openTextDocument(uri);
        const diags = checkDocument(doc);
        collection.set(uri, diags);
        errors += diags.filter((d) => d.severity === vscode.DiagnosticSeverity.Error).length;
      }
      if (errors === 0) {
        void vscode.window.showInformationMessage(
          `Avodado: ${uris.length} file(s) validated, no errors.`,
        );
      } else {
        void vscode.window.showErrorMessage(
          `Avodado: ${errors} error(s) across ${uris.length} file(s). See Problems panel.`,
        );
      }
    }),
  );
}

export function deactivate(): void {
  // VS Code disposes context.subscriptions automatically.
}
