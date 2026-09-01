/**
 * Shared helpers for the Mermaid converters: line iteration with body-relative
 * 1-based line numbers, comment stripping, and the result shape.
 */

/** Result of converting one Mermaid body. Mirrors `YamlParseResult`. */
export type MermaidResult =
  | { readonly ok: true; readonly data: Record<string, unknown> }
  | {
      readonly ok: false;
      readonly message: string;
      /** 1-based line within the block body, if known. */
      readonly line?: number;
    };

/** One non-blank, non-comment body line with its 1-based body line number. */
export interface BodyLine {
  readonly text: string;
  readonly line: number;
}

/**
 * The body's meaningful lines: trimmed, blank lines and `%%` comment lines
 * dropped, each tagged with its 1-based line number within the body.
 */
export function bodyLines(text: string): BodyLine[] {
  const out: BodyLine[] = [];
  text.split('\n').forEach((raw, i) => {
    const t = raw.trim();
    if (t.length === 0 || t.startsWith('%%')) return;
    out.push({ text: t, line: i + 1 });
  });
  return out;
}

/** Strips one layer of matching double quotes. */
export function unquote(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
  return t;
}

/** A failed conversion at `line`. */
export function fail(message: string, line: number): MermaidResult {
  return { ok: false, message, line };
}

/** True when `text` starts with `word` as a whole word (case-sensitive). */
export function startsWithWord(text: string, word: string): boolean {
  return text === word || text.startsWith(word + ' ') || text.startsWith(word + '\t');
}
