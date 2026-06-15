/**
 * Manages a single Avodado preview webview panel. The panel re-renders on
 * any change to the source document (debounced) and on theme changes.
 *
 * Only one panel exists at a time — invoking the preview command again
 * focuses the existing panel and re-targets it to the active editor.
 */

import * as vscode from 'vscode';
import { parseDocument } from '@avodado/core';
import { renderDocument, type ThemeName } from '@avodado/render';

const VALID_THEMES: ReadonlyArray<ThemeName> = ['minimal', 'teal', 'plum', 'slate'];

function readTheme(): ThemeName {
  const cfg = vscode.workspace.getConfiguration('avodado');
  const t = cfg.get<string>('theme', 'minimal');
  return (VALID_THEMES as readonly string[]).includes(t) ? (t as ThemeName) : 'minimal';
}

function render(text: string, slug: string, theme: ThemeName): string {
  try {
    const doc = parseDocument(text, slug);
    return renderDocument(doc, { theme });
  } catch (err) {
    return `<!doctype html><html><body><pre style="font-family:monospace;color:#991b1b;padding:24px;white-space:pre-wrap">Render failed:\n${escapeHtml((err as Error).message)}</pre></body></html>`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
  );
}

function basenameWithoutExt(p: string): string {
  const base = p.split(/[\\/]/).pop() ?? 'doc';
  return base.replace(/\.md$/i, '');
}

/**
 * Singleton preview panel. Re-renders on doc edits + theme changes; closes
 * cleanly when the user dismisses it.
 */
export class PreviewPanel {
  private static current: PreviewPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];
  private boundUri: vscode.Uri | undefined;
  private renderTimer: ReturnType<typeof setTimeout> | undefined;

  static showOrFocus(context: vscode.ExtensionContext, editor: vscode.TextEditor): void {
    if (this.current !== undefined) {
      this.current.panel.reveal(vscode.ViewColumn.Beside, true);
      this.current.bindTo(editor.document);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'avodadoPreview',
      'Avodado preview',
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: false, retainContextWhenHidden: true },
    );
    this.current = new PreviewPanel(panel, context, editor.document);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    _context: vscode.ExtensionContext,
    initialDoc: vscode.TextDocument,
  ) {
    this.panel = panel;

    panel.onDidDispose(
      () => {
        PreviewPanel.current = undefined;
        for (const d of this.disposables) d.dispose();
        if (this.renderTimer !== undefined) clearTimeout(this.renderTimer);
      },
      null,
      this.disposables,
    );

    vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (this.boundUri !== undefined && e.document.uri.toString() === this.boundUri.toString()) {
          this.scheduleRender();
        }
      },
      null,
      this.disposables,
    );

    vscode.workspace.onDidChangeConfiguration(
      (e) => {
        if (e.affectsConfiguration('avodado.theme')) this.scheduleRender();
      },
      null,
      this.disposables,
    );

    this.bindTo(initialDoc);
  }

  bindTo(doc: vscode.TextDocument): void {
    this.boundUri = doc.uri;
    this.panel.title = `Preview · ${basenameWithoutExt(doc.uri.fsPath)}.md`;
    this.scheduleRender();
  }

  private scheduleRender(): void {
    if (this.renderTimer !== undefined) clearTimeout(this.renderTimer);
    this.renderTimer = setTimeout(() => this.renderNow(), 150);
  }

  private renderNow(): void {
    if (this.boundUri === undefined) return;
    const doc = vscode.workspace.textDocuments.find(
      (d) => d.uri.toString() === this.boundUri?.toString(),
    );
    if (doc === undefined) return;
    const html = render(doc.getText(), basenameWithoutExt(doc.uri.fsPath), readTheme());
    this.panel.webview.html = html;
  }
}
