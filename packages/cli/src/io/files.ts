/**
 * File-system helpers: glob expansion, document reading, slug derivation.
 *
 * Slug rule: a doc's slug is its path relative to the docs root, stripped of
 * `.md` and normalised to forward slashes. Files outside the docs root fall
 * back to their basename without `.md`.
 *
 * Encoding rule: a document is UTF-8. A file that is not gets `source: ''` and
 * an `encodingError`, which the callers turn into an `E_ENCODING` diagnostic —
 * validating mojibake and calling it clean is worse than refusing to read it.
 */

import { readFile, realpath } from 'node:fs/promises';
import { basename, relative, resolve, sep } from 'node:path';
import fg from 'fast-glob';
import type { Diagnostic } from '@avodado/core';

/** A document file on disk, with derived slug. */
export interface DocFile {
  /** Absolute path on disk. */
  readonly absolute: string;
  /** Path relative to cwd (used in diagnostics). */
  readonly file: string;
  /** Slug derived from path under the docs root. */
  readonly slug: string;
  /** Raw markdown source. Empty when {@link encodingError} is set. */
  readonly source: string;
  /** Why the bytes on disk are not a UTF-8 document, when they are not. */
  readonly encodingError?: string;
  /** 1-based line the bad bytes sit on, when known. */
  readonly encodingLine?: number;
}

/**
 * Expands one or more glob patterns to a list of {@link DocFile}s with read
 * content and derived slugs.
 *
 * Symlinks are not followed, and files that still resolve to the same inode
 * (a hard link, or a link named by two patterns) are loaded once — a `docs/loop
 * -> .` cycle otherwise yields the same document under dozens of slugs and a
 * pile of invented duplicate-id errors.
 *
 * @param patterns - One or more glob patterns (relative to `cwd`).
 * @param cwd - The working directory the patterns resolve from.
 * @param docsRoot - The docs root the slug is derived against.
 */
export async function loadDocs(
  patterns: readonly string[],
  cwd: string,
  docsRoot: string,
): Promise<DocFile[]> {
  const matches = await fg(patterns as string[], {
    cwd,
    absolute: true,
    onlyFiles: true,
    dot: false,
    followSymbolicLinks: false,
  });
  const docsRootAbs = resolve(cwd, docsRoot);

  // One entry per real path. A symlinked directory that fast-glob still walked
  // (because the link sits in the pattern itself) collapses back to one doc.
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const absolute of matches) {
    let real: string;
    try {
      real = await realpath(absolute);
    } catch {
      real = absolute;
    }
    if (seen.has(real)) continue;
    seen.add(real);
    unique.push(absolute);
  }

  const files = await Promise.all(
    unique.map(async (absolute): Promise<DocFile> => {
      const file = relative(cwd, absolute);
      const slug = deriveSlug(absolute, docsRootAbs);
      const decoded = decodeUtf8(await readFile(absolute));
      return { absolute, file, slug, ...decoded };
    }),
  );
  files.sort((a, b) => a.file.localeCompare(b.file));
  return files;
}

/** Turns the encoding failures in a doc set into diagnostics. */
export function encodingDiagnostics(docs: readonly DocFile[]): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const d of docs) {
    if (d.encodingError === undefined) continue;
    out.push({
      file: d.file,
      ...(d.encodingLine !== undefined ? { line: d.encodingLine } : {}),
      level: 'error',
      code: 'E_ENCODING',
      message: d.encodingError,
      hint: 'Re-save the file as UTF-8 (no byte order mark).',
    });
  }
  return out;
}

/** Byte order marks that prove the file is not UTF-8, longest first. */
const BOMS: ReadonlyArray<{ readonly bytes: readonly number[]; readonly label: string }> = [
  { bytes: [0xff, 0xfe, 0x00, 0x00], label: 'UTF-32 LE' },
  { bytes: [0x00, 0x00, 0xfe, 0xff], label: 'UTF-32 BE' },
  { bytes: [0xff, 0xfe], label: 'UTF-16 LE' },
  { bytes: [0xfe, 0xff], label: 'UTF-16 BE' },
];

const startsWith = (buf: Buffer, bytes: readonly number[]): boolean =>
  buf.length >= bytes.length && bytes.every((b, i) => buf[i] === b);

/**
 * Decodes document bytes as UTF-8. A UTF-8 byte order mark is stripped (it is
 * valid UTF-8, but it would push the first fence off line 1); anything else
 * that is not UTF-8 comes back as an error instead of replacement characters.
 */
export function decodeUtf8(buf: Buffer): {
  source: string;
  encodingError?: string;
  encodingLine?: number;
} {
  for (const bom of BOMS) {
    if (startsWith(buf, bom.bytes)) {
      return {
        source: '',
        encodingError: `The file is not UTF-8: it starts with a ${bom.label} byte order mark.`,
        encodingLine: 1,
      };
    }
  }
  const body = startsWith(buf, [0xef, 0xbb, 0xbf]) ? buf.subarray(3) : buf;
  const bad = firstInvalidUtf8(body);
  if (bad !== undefined) {
    let line = 1;
    for (let i = 0; i < bad; i += 1) if (body[i] === 0x0a) line += 1;
    return {
      source: '',
      encodingError: `The file is not UTF-8: byte ${bad} is not part of a valid UTF-8 sequence.`,
      encodingLine: line,
    };
  }
  return { source: body.toString('utf8') };
}

/**
 * Returns the offset of the first byte that breaks UTF-8, or `undefined` when
 * the buffer decodes cleanly. Rejects over-long encodings, surrogate halves,
 * and values above U+10FFFF, so `TextDecoder`'s replacement character can
 * never stand in for real data.
 */
function firstInvalidUtf8(buf: Buffer): number | undefined {
  const len = buf.length;
  let i = 0;
  while (i < len) {
    const b = buf[i] as number;
    if (b < 0x80) {
      i += 1;
      continue;
    }
    let need: number;
    let cp: number;
    if (b >= 0xc2 && b <= 0xdf) {
      need = 1;
      cp = b & 0x1f;
    } else if (b >= 0xe0 && b <= 0xef) {
      need = 2;
      cp = b & 0x0f;
    } else if (b >= 0xf0 && b <= 0xf4) {
      need = 3;
      cp = b & 0x07;
    } else {
      return i; // continuation byte in lead position, or an over-long lead
    }
    if (i + need > len - 1) return i; // truncated sequence at end of file
    for (let k = 1; k <= need; k += 1) {
      const c = buf[i + k] as number;
      if ((c & 0xc0) !== 0x80) return i;
      cp = (cp << 6) | (c & 0x3f);
    }
    if (need === 2 && (cp < 0x800 || (cp >= 0xd800 && cp <= 0xdfff))) return i;
    if (need === 3 && (cp < 0x10000 || cp > 0x10ffff)) return i;
    i += need + 1;
  }
  return undefined;
}

function deriveSlug(absolute: string, docsRootAbs: string): string {
  const rel = relative(docsRootAbs, absolute);
  const inside = !rel.startsWith('..') && !rel.startsWith(sep) && rel.length > 0;
  const path = inside ? rel : basename(absolute);
  return path.replace(/\\/g, '/').replace(/\.md$/i, '');
}
