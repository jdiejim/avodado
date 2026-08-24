/**
 * `lintProse` — STE-informed prose lint over a parsed document.
 *
 * Pure analysis, no I/O: takes a {@link Document}, returns {@link Diagnostic}s
 * (always level `warn`; the CLI decides whether to escalate). Checks:
 *
 * - `W_PROSE_LONG_SENTENCE` — over 20 words (procedural) / 25 (descriptive).
 * - `W_PROSE_LONG_PARAGRAPH` — over 3 sentences (procedural) / 6 (descriptive).
 *   Markdown paragraphs, `prose`/`pullquote` texts, and `steps` item text
 *   only. Block text fields (`description`, `lede`, `body`, `note`,
 *   `summary`, `subtitle` — `isField` units) are exempt: a sentence-count cap
 *   pressures authors to delete facts, and inside blocks completeness beats
 *   brevity. The skill's zone rules (SKILL.md "Prose rules",
 *   `reference/style-ste.md` "Where each level applies") are the authority.
 * - `W_PROSE_PASSIVE_STEP` — passive voice in `steps` item text only.
 * - `W_PROSE_TENSE` — perfect or progressive constructions.
 * - `W_PROSE_FILLER_OPENER` — a banned filler opener starts a sentence.
 * - `W_PROSE_TERM_DRIFT` — a word from a glossary term's `avoid` list appears
 *   in the doc's prose.
 *
 * Fields keep the form checks (long sentence, tense, filler opener, drift):
 * splitting or rewording fixes those without deleting facts.
 *
 * Deliberately omitted (see `checks.ts`): the noun-cluster check (needs POS
 * tagging to avoid false positives) and any dictionary/word-list check (the
 * STE dictionary is not redistributable; a substitute is noise).
 */

import type { Diagnostic, DiagnosticCode } from '../diagnostics.js';
import type { Document } from '../types.js';
import {
  findDrift,
  findFillerOpener,
  findPassive,
  findTense,
  messages,
  PARAGRAPH_LIMIT,
  quoteSpan,
  SENTENCE_LIMIT,
  splitSentences,
  type AvoidedTerm,
} from './checks.js';
import { collectProseUnits, type ProseUnit } from './surfaces.js';

/** The prose-lint diagnostic codes, in report order. */
export const PROSE_CHECK_CODES = [
  'W_PROSE_LONG_SENTENCE',
  'W_PROSE_LONG_PARAGRAPH',
  'W_PROSE_PASSIVE_STEP',
  'W_PROSE_TENSE',
  'W_PROSE_FILLER_OPENER',
  'W_PROSE_TERM_DRIFT',
] as const satisfies readonly DiagnosticCode[];

/** A prose-lint diagnostic code. */
export type ProseCheckCode = (typeof PROSE_CHECK_CODES)[number];

/** Options for {@link lintProse}. */
export interface ProseLintOptions {
  /** Run only these checks. Default: all of {@link PROSE_CHECK_CODES}. */
  readonly checks?: readonly ProseCheckCode[];
}

/** Reads the declared avoid-lists out of the doc's glossary blocks. */
function collectAvoidedTerms(doc: Document): AvoidedTerm[] {
  const out: AvoidedTerm[] = [];
  for (const seg of doc.segments) {
    if (seg.kind !== 'glossary') continue;
    const data = seg.data;
    if (typeof data !== 'object' || data === null || Array.isArray(data)) continue;
    const terms = (data as { terms?: unknown }).terms;
    if (!Array.isArray(terms)) continue;
    for (const t of terms) {
      if (typeof t !== 'object' || t === null || Array.isArray(t)) continue;
      const { term, avoid } = t as { term?: unknown; avoid?: unknown };
      if (typeof term !== 'string' || !Array.isArray(avoid)) continue;
      for (const a of avoid) {
        if (typeof a === 'string' && a.trim().length > 0) out.push({ avoid: a, term });
      }
    }
  }
  return out;
}

/**
 * Lints a document's prose. Returns diagnostics — never throws for expected
 * conditions, and never reports above level `warn`.
 *
 * @param doc - The parsed document (same input as `validateDocument`).
 * @param file - The file path to use in diagnostics.
 * @param opts - Optional check filter.
 */
export function lintProse(doc: Document, file: string, opts: ProseLintOptions = {}): Diagnostic[] {
  const enabled = new Set<ProseCheckCode>(opts.checks ?? PROSE_CHECK_CODES);
  const diagnostics: Diagnostic[] = [];
  const units = collectProseUnits(doc);
  const avoided = enabled.has('W_PROSE_TERM_DRIFT') ? collectAvoidedTerms(doc) : [];

  const push = (
    code: ProseCheckCode,
    unit: ProseUnit,
    offset: number,
    msg: { message: string; hint: string },
    value: string,
  ): void => {
    const loc = unit.locate(offset);
    diagnostics.push({
      file,
      ...(loc.line !== undefined ? { line: loc.line } : {}),
      ...(loc.column !== undefined ? { column: loc.column } : {}),
      level: 'warn',
      code,
      message: msg.message,
      hint: msg.hint,
      value,
    });
  };

  for (const unit of units) {
    const sentences = splitSentences(unit.text);

    // Block text fields are exempt from the paragraph cap: they must stay
    // complete, and a sentence-count cap pressures fact deletion.
    if (
      enabled.has('W_PROSE_LONG_PARAGRAPH') &&
      !unit.isField &&
      sentences.length > PARAGRAPH_LIMIT[unit.context]
    ) {
      push(
        'W_PROSE_LONG_PARAGRAPH',
        unit,
        sentences[0]?.start ?? 0,
        messages.longParagraph(sentences.length, unit.context),
        quoteSpan(unit.text),
      );
    }

    for (const s of sentences) {
      const span = quoteSpan(s.text);

      if (enabled.has('W_PROSE_LONG_SENTENCE') && s.words > SENTENCE_LIMIT[unit.context]) {
        push('W_PROSE_LONG_SENTENCE', unit, s.start, messages.longSentence(s.words, span, unit.context), span);
      }

      if (enabled.has('W_PROSE_PASSIVE_STEP') && unit.isStep && findPassive(s.text)) {
        push('W_PROSE_PASSIVE_STEP', unit, s.start, messages.passiveStep(span), span);
      }

      if (enabled.has('W_PROSE_TENSE')) {
        const form = findTense(s.text);
        if (form !== undefined) {
          push('W_PROSE_TENSE', unit, s.start, messages.tense(form, span), span);
        }
      }

      if (enabled.has('W_PROSE_FILLER_OPENER')) {
        const opener = findFillerOpener(s.text);
        if (opener !== undefined) {
          push('W_PROSE_FILLER_OPENER', unit, s.start, messages.fillerOpener(opener), span);
        }
      }
    }

    // Drift never fires inside a glossary block: its text may name the
    // avoided words on purpose ("do not write X").
    if (avoided.length > 0 && unit.kind !== 'glossary') {
      for (const m of findDrift(unit.text, avoided)) {
        const sentence = sentences.find((s) => m.start >= s.start && m.start < s.end);
        const span = quoteSpan(sentence?.text ?? unit.text);
        push(
          'W_PROSE_TERM_DRIFT',
          unit,
          m.start,
          messages.termDrift(m.word, span, m.avoided.term),
          m.word,
        );
      }
    }
  }

  return diagnostics;
}
