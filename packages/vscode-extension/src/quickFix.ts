/**
 * Quick-fix provider: when an Avodado diagnostic carries `suggestions`
 * (a misspelled field or enum value), offer a code action that replaces the
 * offending text in the diagnostic's range with the suggested value.
 */

import * as vscode from 'vscode';
import type { AvodadoDiagnostic } from './avodadoCheck';

export class AvodadoQuickFixProvider implements vscode.CodeActionProvider {
  static readonly metadata: vscode.CodeActionProviderMetadata = {
    providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
  };

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    for (const diag of context.diagnostics) {
      const suggestions = (diag as AvodadoDiagnostic).avodadoSuggestions;
      if (suggestions === undefined || suggestions.length === 0) continue;

      const current = document.getText(diag.range);
      for (const suggestion of suggestions) {
        const fix = new vscode.CodeAction(
          `Replace with "${suggestion}"`,
          vscode.CodeActionKind.QuickFix,
        );
        fix.diagnostics = [diag];
        fix.edit = new vscode.WorkspaceEdit();
        // If the diagnostic range spans a whole record (e.g. an unrecognized
        // key flagged at the object), replace just the bad token within it;
        // otherwise replace the range directly.
        const target = narrowToToken(current, suggestion);
        if (target !== undefined) {
          const start = document.offsetAt(diag.range.start) + target.index;
          const range = new vscode.Range(
            document.positionAt(start),
            document.positionAt(start + target.length),
          );
          fix.edit.replace(document.uri, range, suggestion);
        } else {
          fix.edit.replace(document.uri, diag.range, suggestion);
        }
        actions.push(fix);
      }
    }
    return actions;
  }
}

/**
 * Finds the closest existing identifier token in `text` to replace with
 * `suggestion`. Used when the diagnostic range is wider than the bad token
 * (e.g. an unrecognized key flagged on its containing object). Returns the
 * first identifier that differs from the suggestion, or `undefined` to fall
 * back to replacing the whole range.
 */
function narrowToToken(
  text: string,
  suggestion: string,
): { index: number; length: number } | undefined {
  // Only narrow when the range clearly contains more than one token.
  if (!/\s|[{}[\],]/.test(text)) return undefined;
  const idRe = /[A-Za-z_][\w-]*/g;
  let m: RegExpExecArray | null;
  let best: { index: number; length: number; dist: number } | undefined;
  while ((m = idRe.exec(text)) !== null) {
    const tok = m[0];
    if (tok === suggestion) continue;
    const dist = editDistance(tok, suggestion);
    if (best === undefined || dist < best.dist) {
      best = { index: m.index, length: tok.length, dist };
    }
  }
  return best !== undefined && best.dist <= 3
    ? { index: best.index, length: best.length }
    : undefined;
}

/** Small Levenshtein for picking the token a suggestion is meant to replace. */
function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0] ?? 0;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j] ?? 0;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min((dp[j] ?? 0) + 1, (dp[j - 1] ?? 0) + 1, prev + cost);
      prev = tmp;
    }
  }
  return dp[b.length] ?? 0;
}
