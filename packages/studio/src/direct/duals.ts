/**
 * Dual-representation helpers. Some blocks render one YAML value TWICE — a
 * sequence message is both a diagram arrow row and a "Step-by-step" `<li>`,
 * and both carry the same `data-bp` path. These pure rules let the direct
 * layer treat such twins as one thing (shared hover, click-to-flash) and
 * decide when to prompt for step descriptions.
 *
 * Kept free of React/DOM so every rule is unit-testable.
 */

/**
 * Indices of `target`'s twin elements: entries whose path EQUALS the target
 * path, excluding the element the pointer is on (`selfIndex`, -1 for none).
 */
export function twinIndices(
  paths: readonly string[],
  target: string,
  selfIndex: number,
): number[] {
  if (target === '') return [];
  const out: number[] = [];
  for (let i = 0; i < paths.length; i++) {
    if (i !== selfIndex && paths[i] === target) out.push(i);
  }
  return out;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/**
 * Whether a block should show the "＋ Add step descriptions" ghost chip:
 * a sequence with at least one message and NO summaries yet. The first
 * committed summary makes the renderer's Step-by-step list appear.
 */
export function needsStepPrompt(kind: string, data: unknown): boolean {
  if (kind !== 'sequence') return false;
  const messages = asRecord(data)?.['messages'];
  if (!Array.isArray(messages)) return false;
  const real = messages.filter(isSequenceMessage);
  if (real.length === 0) return false;
  return real.every((m) => {
    const summary = asRecord(m)?.['summary'];
    return typeof summary !== 'string' || summary === '';
  });
}

/**
 * True for a real sequence message; false for a frame marker (`frame` /
 * `else` / `end`), which has no arrow, no step number and no summary.
 */
export function isSequenceMessage(item: unknown): boolean {
  const rec = asRecord(item);
  if (rec === null) return true;
  return !('frame' in rec || 'else' in rec || 'end' in rec);
}

/**
 * The diagram number of the message at `index` — messages count from 1,
 * frame markers are skipped — so the "n note" hint and the Step-by-step ①
 * agree. Returns `index + 1` when `messages` is not an array.
 */
export function sequenceStepNumber(messages: unknown, index: number): number {
  if (!Array.isArray(messages)) return index + 1;
  let n = 0;
  for (let i = 0; i <= index && i < messages.length; i++) {
    if (isSequenceMessage(messages[i])) n += 1;
  }
  return n;
}
