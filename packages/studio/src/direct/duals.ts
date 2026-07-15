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
  if (!Array.isArray(messages) || messages.length === 0) return false;
  return messages.every((m) => {
    const summary = asRecord(m)?.['summary'];
    return typeof summary !== 'string' || summary === '';
  });
}
