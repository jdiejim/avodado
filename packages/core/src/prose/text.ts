/**
 * Text mechanics for the prose linter: inline masking, sentence splitting,
 * word counting, paragraph splitting.
 *
 * All masking is LENGTH-PRESERVING: a masked buffer has the same character
 * offsets as the original text, so sentence spans found on the masked buffer
 * map straight back to the original for quoting.
 */

/** Sentence terminator characters. */
const TERMINATORS = new Set(['.', '!', '?']);

/**
 * Characters that may close a sentence after its terminator — quotes,
 * brackets, and markdown emphasis markers. `He said "stop." Then` and
 * `**Bold kicker.** Next sentence` both split.
 */
const CLOSERS = new Set(['"', "'", '”', '’', ')', ']', '»', '*', '_']);

/**
 * Abbreviations whose trailing dots never end a sentence. Matched
 * case-insensitively; the dots are masked before boundary detection.
 */
const ABBREVIATIONS = ['e.g.', 'i.e.', 'vs.', 'etc.', 'cf.', 'et al.'];

/** A non-terminator placeholder that survives whitespace checks. */
const DOT_MASK = '\u0001';

/** Replaces every non-newline character of `s` with a space. */
function blank(s: string): string {
  return s.replace(/[^\n]/g, ' ');
}

/**
 * Masks inline code spans, URLs, and `doc#id` references with spaces.
 * The result has the same length as the input; newlines are preserved.
 */
export function maskInline(text: string): string {
  return (
    text
      // Inline code: backtick runs (`` `x` ``, ``` ``x`` ```). A span may
      // wrap across soft line breaks (CommonMark) but never a blank line.
      .replace(/(``+)[\s\S]*?\1|`(?:[^`\n]|\n(?![ \t]*\n))*`/g, blank)
      // URLs.
      .replace(/\bhttps?:\/\/[^\s)\]>]+/g, blank)
      .replace(/\bwww\.[^\s)\]>]+/g, blank)
      // doc#id references (`orders-api#happy-path`).
      .replace(/[A-Za-z0-9][A-Za-z0-9._/-]*#[A-Za-z0-9_-]+/g, blank)
  );
}

/** Masks the dots of known abbreviations so they never split a sentence. */
function protectAbbreviations(masked: string): string {
  let out = masked;
  for (const abbr of ABBREVIATIONS) {
    // Build a case-insensitive literal regex for the abbreviation.
    const pattern = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(pattern, 'gi'), (m) => m.replace(/\./g, DOT_MASK));
  }
  return out;
}

/** True when the token contains at least one letter or digit. */
function isWordToken(token: string): boolean {
  return /[\p{L}\p{N}]/u.test(token);
}

/**
 * Counts words in a MASKED slice: whitespace tokens that carry at least one
 * letter or digit. Masked regions (code, URLs, refs) are spaces, so they
 * count as zero words.
 */
export function countWords(maskedSlice: string): number {
  return maskedSlice.split(/\s+/).filter(isWordToken).length;
}

/** One sentence found in a text run. Offsets index the ORIGINAL text. */
export interface SentenceSpan {
  /** The sentence text (trimmed), from the original input. */
  readonly text: string;
  /** Start offset of the trimmed sentence in the input. */
  readonly start: number;
  /** Exclusive end offset in the input. */
  readonly end: number;
  /** Word count after masking inline code, URLs, and refs. */
  readonly words: number;
}

/**
 * Splits a text run into sentences.
 *
 * A sentence ends at a run of `.` / `!` / `?` followed by whitespace or the
 * end of the text. Dots inside abbreviations (e.g., i.e., vs., etc.), decimals
 * (`3.5`), versions (`v1.2`), file names (`demo.md`), inline code, links, and
 * `doc#id` refs never split — a dot with a non-space character after it is not
 * a boundary, and abbreviation dots are masked away first.
 */
export function splitSentences(text: string): SentenceSpan[] {
  const masked = maskInline(text);
  const guarded = protectAbbreviations(masked);
  const spans: SentenceSpan[] = [];
  let start = 0;

  const push = (from: number, to: number): void => {
    // Trim against the ORIGINAL text so quoted spans read naturally.
    let s = from;
    let e = to;
    while (s < e && /\s/.test(text[s] as string)) s++;
    while (e > s && /\s/.test(text[e - 1] as string)) e--;
    if (s >= e) return;
    const words = countWords(masked.slice(s, e));
    if (words === 0) return;
    spans.push({ text: text.slice(s, e), start: s, end: e, words });
  };

  for (let i = 0; i < guarded.length; i++) {
    if (!TERMINATORS.has(guarded[i] as string)) continue;
    let j = i;
    while (j + 1 < guarded.length && TERMINATORS.has(guarded[j + 1] as string)) j++;
    // Closing quotes/brackets/emphasis markers ride with the sentence:
    // `stop." Then` and `kicker.** Next` are boundaries.
    let k = j;
    while (k + 1 < guarded.length && CLOSERS.has(guarded[k + 1] as string)) k++;
    const next = guarded[k + 1];
    if (next === undefined || /\s/.test(next)) {
      push(start, k + 1);
      start = k + 1;
    }
    i = k;
  }
  push(start, guarded.length);
  return spans;
}

/** One paragraph of a multi-paragraph text run. */
export interface ParagraphSpan {
  /** The paragraph text. */
  readonly text: string;
  /** Start offset in the input. */
  readonly start: number;
}

/** Splits a text run into paragraphs on blank lines. */
export function splitParagraphs(text: string): ParagraphSpan[] {
  const out: ParagraphSpan[] = [];
  const re = /\n[ \t]*\n+/g;
  let last = 0;
  for (;;) {
    const m = re.exec(text);
    const end = m === null ? text.length : m.index;
    const chunk = text.slice(last, end);
    if (chunk.trim().length > 0) out.push({ text: chunk, start: last });
    if (m === null) break;
    last = re.lastIndex;
  }
  return out;
}

/** Quote-truncation limit for diagnostic spans. */
const SPAN_LIMIT = 80;

/**
 * A span ready to quote in a diagnostic: newlines collapse to spaces and
 * anything past 80 characters truncates with an ellipsis.
 */
export function quoteSpan(s: string): string {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > SPAN_LIMIT ? `${flat.slice(0, SPAN_LIMIT - 1)}…` : flat;
}
