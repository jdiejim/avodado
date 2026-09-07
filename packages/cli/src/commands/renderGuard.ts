/**
 * Render-failure attribution.
 *
 * A renderer is supposed to be a pure function of validated data, but a bad
 * value can still make one throw (an unbounded loop that hits V8's string cap,
 * a required field the schema rejected but the build rendered anyway). Left
 * alone, that surfaces from `avo build` as a bare `Invalid string length` with
 * no file, no line, and no block type.
 *
 * {@link renderFailure} turns any throw into a normal `E_RENDER` diagnostic
 * that names the document and, when it can find it, the exact block: on the
 * failure path only, each typed block is re-rendered on its own until one
 * throws the same way.
 */

import type { Diagnostic, Document, TypedSegment } from '@avodado/core';
import { htmlRenderers } from '@avodado/render';

/** The message of a thrown value, whatever it was. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Every typed block renderer, keyed by type, with the data types erased. */
const renderers = htmlRenderers as unknown as Readonly<
  Record<string, (data: unknown) => string>
>;

/**
 * Re-renders each typed block on its own and returns the first that throws.
 * `undefined` means no single block reproduces the failure — the crash came
 * from document-level assembly (slides, sections, the shell).
 */
export function failingBlock(doc: Document): TypedSegment | undefined {
  for (const seg of doc.segments) {
    if (seg.kind === 'markdown') continue;
    if (seg.data === undefined) continue;
    const render = renderers[seg.kind];
    if (render === undefined) continue;
    try {
      render(seg.data);
    } catch {
      return seg;
    }
  }
  return undefined;
}

/**
 * Builds the `E_RENDER` diagnostic for a failed render.
 *
 * @param doc - The document being rendered.
 * @param file - Its path, as diagnostics report it.
 * @param what - What was being produced, e.g. `page` or `slide deck`.
 * @param err - The thrown value.
 */
export function renderFailure(
  doc: Document,
  file: string,
  what: string,
  err: unknown,
): Diagnostic {
  const reason = errorMessage(err);
  const block = failingBlock(doc);
  if (block === undefined) {
    return {
      file,
      level: 'error',
      code: 'E_RENDER',
      message: `The ${what} could not be rendered: ${reason}`,
      hint: 'No single block reproduces the failure — the whole document does.',
    };
  }
  const label = block.sourceType ?? block.kind;
  return {
    file,
    line: block.line,
    level: 'error',
    code: 'E_RENDER',
    message: `The ${what} could not be rendered: the \`${label}\` block failed — ${reason}`,
    ...(block.id !== undefined ? { value: block.id } : {}),
    hint: 'Fix the values in this block, or remove it and re-run `avo build`.',
  };
}

/** Result of {@link guardRender}: the value, or the diagnostic that replaced it. */
export type GuardedRender<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly diagnostic: Diagnostic };

/** Runs `render`, converting a throw into an `E_RENDER` diagnostic. */
export function guardRender<T>(
  doc: Document,
  file: string,
  what: string,
  render: () => T,
): GuardedRender<T> {
  try {
    return { ok: true, value: render() };
  } catch (err) {
    return { ok: false, diagnostic: renderFailure(doc, file, what, err) };
  }
}
