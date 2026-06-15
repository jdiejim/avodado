/**
 * Wraps `parseDocument` + `validateDocument` so the rest of the extension
 * deals in `vscode.Diagnostic[]` directly.
 *
 * Diagnostics carry precise ranges (using the core's line + column), the
 * actionable `hint` appended to the message, a help-link `code.target`, and
 * the raw `suggestions` stashed for the quick-fix provider to read back.
 *
 * Lives apart from `extension.ts` so it can be unit-tested in isolation if we
 * ever wire vitest to the extension (currently we skip extension-host tests
 * to keep the gate-loop fast).
 */

import * as vscode from 'vscode';
import { parseDocument, validateDocument, helpUrl, type Diagnostic } from '@avodado/core';

/** A vscode.Diagnostic that remembers the Avodado suggestions for quick-fixes. */
export interface AvodadoDiagnostic extends vscode.Diagnostic {
  avodadoSuggestions?: readonly string[];
}

/** Maps an Avodado diagnostic to the matching vscode.DiagnosticSeverity. */
function severity(level: Diagnostic['level']): vscode.DiagnosticSeverity {
  return level === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;
}

/** Builds a 0-based vscode.Range from a (1-based) Avodado diagnostic. */
function rangeFor(d: Diagnostic, doc: vscode.TextDocument): vscode.Range {
  const line = Math.max(0, (d.line ?? 1) - 1);
  const safeLine = Math.min(line, Math.max(0, doc.lineCount - 1));
  const lineText = doc.lineAt(safeLine).text;
  if (d.column !== undefined) {
    const startCol = Math.max(0, d.column - 1);
    const endCol =
      d.endColumn !== undefined ? Math.max(startCol + 1, d.endColumn - 1) : lineText.length;
    return new vscode.Range(safeLine, startCol, safeLine, Math.max(startCol + 1, endCol));
  }
  return new vscode.Range(safeLine, 0, safeLine, Math.max(1, lineText.length));
}

/**
 * Parses + validates the given text document and returns diagnostics ready
 * to drop into a `DiagnosticCollection`.
 */
export function checkDocument(doc: vscode.TextDocument): AvodadoDiagnostic[] {
  const source = doc.getText();
  const slug = pathToSlug(doc.uri.fsPath);
  const parsed = parseDocument(source, slug);
  const diags = validateDocument(parsed, doc.uri.fsPath);
  return diags.map((d) => {
    const range = rangeFor(d, doc);
    const message = d.hint !== undefined ? `${d.message}\n${d.hint}` : d.message;
    const out: AvodadoDiagnostic = new vscode.Diagnostic(range, message, severity(d.level));
    // `code` as an object gives VS Code a clickable help link in the hover.
    out.code = { value: d.code, target: vscode.Uri.parse(helpUrl(d.code)) };
    out.source = 'avodado';
    if (d.suggestions !== undefined && d.suggestions.length > 0) {
      out.avodadoSuggestions = d.suggestions;
    }
    return out;
  });
}

function pathToSlug(p: string): string {
  const parts = p.split(/[\\/]/);
  const base = parts[parts.length - 1] ?? 'doc';
  return base.replace(/\.md$/i, '');
}
