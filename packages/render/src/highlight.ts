/**
 * Tiny multi-language syntax highlighter — emits HTML spans (`.kw`, `.str`,
 * `.num`, `.fn`, `.ty`, `.com`) wrapped around recognized tokens.
 *
 * Ported from `resources/doc-studio.jsx` `highlightCode`. Designed for the
 * `code` block and the SQL snippets in `seq-steps`. Not a full lexer — just
 * enough to make a snippet readable.
 */

import { escapeHtml } from './escape.js';

const KW = new Set(
  (
    'const let var function return if else for while do switch case break continue ' +
    'class extends new await async import from export default try catch finally throw ' +
    'typeof instanceof void delete yield static public private protected readonly ' +
    'abstract implements interface type enum namespace def elif lambda pass with raise ' +
    'except none true false and or not is in self nil func struct map range defer chan ' +
    'select fallthrough echo fi done local require module package this super ' +
    'create table alter add drop select insert update delete into values where join ' +
    'group order by limit primary key foreign references not null default unique index ' +
    'on check constraint cascade returning begin commit rollback'
  ).split(/\s+/),
);

const TY = new Set(
  (
    'string number boolean int integer float double bool char byte long short void ' +
    'object any unknown never bigint promise array list set optional uuid text varchar ' +
    'timestamptz timestamp date numeric decimal jsonb json serial bigserial smallint'
  ).split(/\s+/),
);

const TOKEN_RE =
  /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d[\w.]*)|([A-Za-z_$][\w$]*)/g;

/**
 * Highlights a code snippet, returning HTML-safe string.
 *
 * @param code - Source code (any language). HTML-escaped before token wrapping.
 */
export function highlightCode(code: string): string {
  if (code.length === 0) return '';
  const src = String(code);
  let out = '';
  let last = 0;
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(src)) !== null) {
    if (m.index > last) out += escapeHtml(src.slice(last, m.index));
    const t = m[0];
    if (m[1] !== undefined) {
      out += `<span class="com">${escapeHtml(t)}</span>`;
    } else if (m[2] !== undefined) {
      out += `<span class="str">${escapeHtml(t)}</span>`;
    } else if (m[3] !== undefined) {
      out += `<span class="num">${escapeHtml(t)}</span>`;
    } else {
      const lt = t.toLowerCase();
      if (KW.has(lt)) out += `<span class="kw">${escapeHtml(t)}</span>`;
      else if (TY.has(lt)) out += `<span class="ty">${escapeHtml(t)}</span>`;
      else if (src[TOKEN_RE.lastIndex] === '(')
        out += `<span class="fn">${escapeHtml(t)}</span>`;
      else out += escapeHtml(t);
    }
    last = TOKEN_RE.lastIndex;
  }
  if (last < src.length) out += escapeHtml(src.slice(last));
  return out;
}
