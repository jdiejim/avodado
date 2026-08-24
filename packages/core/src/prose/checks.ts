/**
 * The prose checks: six conservative analyzers over {@link ProseUnit}s.
 *
 * Precision policy: a false positive is a bug; a false negative is fine.
 * Every pattern here errs toward silence — small stop lists guard the
 * ambiguous cases, and anything uncertain is not flagged.
 *
 * Deliberate omissions:
 * - No noun-cluster check. Without part-of-speech tagging it cannot meet the
 *   zero-false-positive bar.
 * - No dictionary / approved-word-list check. The ASD-STE100 dictionary is
 *   not redistributable, and a home-grown list is noise.
 */

import type { ProseContext } from './surfaces.js';
import { countWords, maskInline, quoteSpan, splitSentences } from './text.js';

/* ── Limits ────────────────────────────────────────────────────────────── */

/** Sentence word limits per context. */
export const SENTENCE_LIMIT: Readonly<Record<ProseContext, number>> = {
  procedural: 20,
  descriptive: 25,
};

/** Paragraph sentence limits per context. */
export const PARAGRAPH_LIMIT: Readonly<Record<ProseContext, number>> = {
  procedural: 3,
  descriptive: 6,
};

/* ── Message builders (each message follows full STE) ──────────────────── */

export interface CheckMessage {
  readonly message: string;
  readonly hint: string;
}

export const messages = {
  longSentence(words: number, span: string, context: ProseContext): CheckMessage {
    return {
      message: `Long sentence: ${words} words in "${span}".`,
      hint: `Split it. Keep each ${context === 'procedural' ? 'instruction sentence to 20' : 'descriptive sentence to 25'} words or fewer.`,
    };
  },
  longParagraph(sentences: number, context: ProseContext): CheckMessage {
    return {
      message: `Long paragraph: ${sentences} sentences in one paragraph.`,
      hint: `Split it. Keep a ${context === 'procedural' ? 'procedural paragraph to 3' : 'descriptive paragraph to 6'} sentences or fewer.`,
    };
  },
  passiveStep(span: string): CheckMessage {
    return {
      message: `Passive voice in a step: "${span}".`,
      hint: 'Write the step in active voice. Start with the verb, for example "Run the check".',
    };
  },
  tense(form: 'perfect' | 'progressive', span: string): CheckMessage {
    return {
      message: `${form === 'perfect' ? 'Perfect' : 'Progressive'} tense: "${span}".`,
      hint: 'Use a simple tense: past, present, or future.',
    };
  },
  fillerOpener(opener: string): CheckMessage {
    return {
      message: `Filler opener: "${opener}".`,
      hint: 'Delete the opener. Start the sentence with the fact it carries.',
    };
  },
  termDrift(word: string, span: string, term: string): CheckMessage {
    return {
      message: `Term drift: "${word}" appears in "${span}". The glossary approves "${term}".`,
      hint: `Replace "${word}" with "${term}".`,
    };
  },
} as const;

/* ── Tokenization ──────────────────────────────────────────────────────── */

/** Lowercased word tokens of a sentence, code/URLs/refs masked away. */
export function tokens(sentence: string): string[] {
  return maskInline(sentence)
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((t) => t.length > 0);
}

/* ── Passive voice (steps only) ────────────────────────────────────────── */

/** Auxiliaries that open a passive construction. */
const PASSIVE_AUX = new Set(['is', 'are', 'was', 'were', 'be', 'been', 'being', 'get', 'gets', 'got']);

/**
 * Irregular past participles of transitive verbs common in technical text.
 * This is a grammar pattern list, not a vocabulary check.
 */
const IRREGULAR_PARTICIPLES = new Set([
  'sent', 'made', 'given', 'taken', 'written', 'built', 'seen', 'shown',
  'known', 'found', 'kept', 'held', 'put', 'read', 'told', 'thrown',
  'broken', 'chosen', 'brought', 'bought', 'caught', 'taught', 'run',
  'stored', 'hidden', 'frozen', 'drawn', 'driven', 'understood', 'paid',
]);

/** Participles used only for the perfect-tense check (intransitive forms). */
const PERFECT_EXTRA_PARTICIPLES = new Set([
  'been', 'gone', 'done', 'come', 'become', 'begun', 'risen', 'fallen',
  'grown', 'met', 'sat', 'stood', 'left', 'lost', 'set', 'said', 'felt',
  'meant', 'thought', 'won',
]);

/**
 * Common `-ed` forms that read as adjectives after a copula ("the setup is
 * complicated"). Present here so an ambiguous copula + adjective never flags.
 */
const ADJECTIVAL_ED = new Set([
  'tired', 'interested', 'excited', 'worried', 'concerned', 'complicated',
  'sophisticated', 'dedicated', 'detailed', 'limited', 'related', 'unrelated',
  'outdated', 'deprecated', 'advanced', 'experienced', 'expected', 'unexpected',
  'distributed', 'automated', 'unchanged', 'undefined', 'nested', 'red',
]);

/** True when `w` reads as a past participle for the passive check. */
function isPassiveParticiple(w: string): boolean {
  if (IRREGULAR_PARTICIPLES.has(w)) return true;
  return /^[a-z]+ed$/.test(w) && w.length >= 4 && !ADJECTIVAL_ED.has(w);
}

/** True when `w` reads as a past participle for the perfect-tense check. */
function isPerfectParticiple(w: string): boolean {
  return isPassiveParticiple(w) || PERFECT_EXTRA_PARTICIPLES.has(w);
}

/**
 * Detects passive voice in a sentence: a passive auxiliary followed directly
 * by a past participle. When unsure — an adjectival `-ed` form, or anything
 * between the auxiliary and the participle — it does not flag.
 */
export function findPassive(sentence: string): boolean {
  const toks = tokens(sentence);
  for (let i = 0; i < toks.length - 1; i++) {
    const aux = toks[i] as string;
    if (!PASSIVE_AUX.has(aux)) continue;
    const next = toks[i + 1] as string;
    if (isPassiveParticiple(next)) return true;
  }
  return false;
}

/* ── Tense (perfect and progressive) ───────────────────────────────────── */

const PERFECT_AUX = new Set(['has', 'have', 'had']);
const PROGRESSIVE_AUX = new Set(['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being']);

/**
 * `-ing` tokens that are nouns or adjectives in ordinary technical prose.
 * A token in this set never counts as a progressive verb.
 */
const ING_STOP = new Set([
  'during', 'string', 'everything', 'nothing', 'something', 'anything',
  'following', 'missing', 'existing', 'remaining', 'pending', 'interesting',
  'misleading', 'outstanding', 'ongoing', 'incoming', 'outgoing', 'upcoming',
  'underlying', 'corresponding', 'willing', 'according', 'meaning', 'setting',
  'warning', 'heading', 'wording', 'engineering', 'naming', 'tooling',
]);

/**
 * Subjects whose copula takes a gerund complement ("the goal is testing the
 * parser"). When the token before the auxiliary is one of these, the `-ing`
 * token is a noun, not a progressive verb — do not flag.
 */
const GERUND_SUBJECTS = new Set([
  'goal', 'purpose', 'point', 'task', 'plan', 'step', 'aim', 'focus',
  'priority', 'problem', 'issue', 'key', 'answer', 'solution', 'question',
  'idea', 'trick', 'part', 'risk', 'fix', 'alternative', 'option',
]);

export type TenseForm = 'perfect' | 'progressive';

/**
 * Detects a perfect (has/have/had + participle) or progressive (be-aux +
 * `-ing` token directly after the auxiliary) construction. Guarded by the
 * `-ing` stop set and the gerund-subject set; a hyphenated compound
 * ("load-bearing") is an adjective, and `so is <-ing>` is an inverted gerund
 * ("and so is placing two children on one side"). When unsure, do not flag.
 */
export function findTense(sentence: string): TenseForm | undefined {
  const toks = tokens(sentence);
  for (let i = 0; i < toks.length - 1; i++) {
    const aux = toks[i] as string;
    const next = toks[i + 1] as string;
    if (PERFECT_AUX.has(aux) && isPerfectParticiple(next)) return 'perfect';
    if (
      PROGRESSIVE_AUX.has(aux) &&
      next.length >= 5 &&
      next.endsWith('ing') &&
      !next.includes('-') &&
      !ING_STOP.has(next) &&
      !GERUND_SUBJECTS.has(toks[i - 1] ?? '') &&
      toks[i - 1] !== 'so'
    ) {
      return 'progressive';
    }
  }
  return undefined;
}

/* ── Filler openers ────────────────────────────────────────────────────── */

/** Banned sentence openers — exact prefix match, case-insensitive. */
export const FILLER_OPENERS = [
  'In this section',
  "It's important to note",
  'It is important to note',
  'This diagram shows',
  'This section',
  "Let's dive into",
  'At a high level',
  'The blocks below',
] as const;

/**
 * The banned opener a sentence starts with, or `undefined`. The prefix must
 * end at a word boundary ("This sectional…" never matches).
 */
export function findFillerOpener(sentence: string): string | undefined {
  const s = sentence.trimStart();
  const lower = s.toLowerCase();
  for (const opener of FILLER_OPENERS) {
    if (!lower.startsWith(opener.toLowerCase())) continue;
    const after = s[opener.length];
    if (after === undefined || !/[\p{L}\p{N}]/u.test(after)) return opener;
  }
  return undefined;
}

/* ── Term drift ────────────────────────────────────────────────────────── */

/** One avoided word/phrase and the glossary term that replaces it. */
export interface AvoidedTerm {
  readonly avoid: string;
  readonly term: string;
}

/** A term-drift match inside a unit's text. */
export interface DriftMatch {
  readonly avoided: AvoidedTerm;
  /** The matched text as written. */
  readonly word: string;
  /** Start offset of the match in the unit's text. */
  readonly start: number;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Finds declared avoided words in a text run — word-boundary,
 * case-insensitive, whitespace-flexible for phrases. Matches inside inline
 * code, URLs, and refs never count (the text is masked first).
 */
export function findDrift(text: string, avoided: readonly AvoidedTerm[]): DriftMatch[] {
  const masked = maskInline(text);
  const out: DriftMatch[] = [];
  for (const a of avoided) {
    const phrase = a.avoid.trim();
    if (phrase.length === 0) continue;
    const pattern = phrase.split(/\s+/).map(escapeRegExp).join('\\s+');
    const re = new RegExp(`(?<![\\p{L}\\p{N}])(${pattern})(?![\\p{L}\\p{N}])`, 'giu');
    for (;;) {
      const m = re.exec(masked);
      if (m === null) break;
      out.push({ avoided: a, word: text.slice(m.index, m.index + (m[1] as string).length), start: m.index });
    }
  }
  return out.sort((x, y) => x.start - y.start);
}

/* ── Shared helpers for lint.ts ────────────────────────────────────────── */

export { countWords, quoteSpan, splitSentences };
