/**
 * Repairs the one YAML trap that survives every warning: an unquoted comma
 * inside an inline map.
 *
 *   - { id: hold, kind: process, label: Hold as BACKORDERED, email ETA }
 *   - { label: Followers of one account, value: 1,000,000 followers }
 *
 * YAML reads the text after the comma as a second key with no value, and a
 * digit group becomes a number, so the original text is gone once parsed.
 * The repair therefore runs on the source line before the YAML parser sees
 * it: a `{ … }` map that sits on one line is split at its top-level commas,
 * and a cell that has no `key:` of its own is folded back into the cell
 * before it by quoting the joined text —
 *
 *   label: "Hold as BACKORDERED, email ETA"     value: "1,000,000 followers"
 *
 * Only that shape is touched. A cell with a key (`colour: red`) may be a
 * typo of a real field and still surfaces as an unknown-field error. Quoted
 * text, nested `[ … ]` and `{ … }`, and maps that span lines are left as
 * written. Pure: same string when nothing needed a repair.
 */

const MAP_LINE = /^(\s*(?:-\s+)?(?:[\w.-]+:\s+)?)\{(.*)\}(\s*)$/;

interface Cell {
  /** Text of the cell, trimmed. */
  readonly text: string;
  /** Index of the `:` that ends the key, or -1 when the cell has no key. */
  readonly keyEnd: number;
}

/** Splits the inside of a flow map at its top-level commas, quote-aware. */
function splitCells(inner: string): Cell[] {
  const cells: Cell[] = [];
  let depth = 0;
  let quote: string | undefined;
  let start = 0;
  let keyEnd = -1;
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (quote !== undefined) {
      if (ch === '\\' && quote === '"') i += 1;
      else if (ch === quote) quote = undefined;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '[' || ch === '{') depth += 1;
    else if (ch === ']' || ch === '}') depth -= 1;
    else if (depth === 0 && ch === ':' && keyEnd < 0 && (i + 1 === inner.length || /\s/.test(inner[i + 1] ?? ''))) {
      keyEnd = i - start;
    } else if (depth === 0 && ch === ',') {
      cells.push({ text: inner.slice(start, i), keyEnd });
      start = i + 1;
      keyEnd = -1;
    }
  }
  cells.push({ text: inner.slice(start), keyEnd });
  return cells.map((c) => {
    const lead = c.text.length - c.text.trimStart().length;
    return { text: c.text.trim(), keyEnd: c.keyEnd < 0 ? -1 : c.keyEnd - lead };
  });
}

function quoteValue(text: string): string {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** A plain scalar that YAML would read as one word run — safe to extend. */
function isPlain(value: string): boolean {
  return value.length > 0 && !/^["'[{]/.test(value);
}

function rescueMap(inner: string): string | undefined {
  const cells = splitCells(inner);
  if (cells.length < 2 || !cells.some((c) => c.keyEnd < 0)) return undefined;
  const out: Array<{ key: string; value: string; folded: boolean }> = [];
  for (const cell of cells) {
    const last = out[out.length - 1];
    if (cell.keyEnd < 0 && cell.text.length > 0 && last !== undefined && isPlain(last.value)) {
      const digits = /\d$/.test(last.value) && /^\d/.test(cell.text);
      last.value = `${last.value}${digits ? ',' : ', '}${cell.text}`;
      last.folded = true;
      continue;
    }
    if (cell.keyEnd < 0) return undefined; // a keyless first cell or an empty cell: not our shape
    out.push({ key: cell.text.slice(0, cell.keyEnd + 1), value: cell.text.slice(cell.keyEnd + 1).trim(), folded: false });
  }
  if (!out.some((c) => c.folded)) return undefined;
  return out.map((c) => `${c.key} ${c.folded ? quoteValue(c.value) : c.value}`).join(', ');
}

function rescueLine(line: string): string {
  const m = MAP_LINE.exec(line);
  if (m === null) return line;
  const [, head = '', inner = '', tail = ''] = m;
  const fixed = rescueMap(inner);
  return fixed === undefined ? line : `${head}{ ${fixed} }${tail}`;
}

/**
 * Folds comma-split cells of single-line inline maps back into the field
 * they belong to, across a whole block body. Runs before the YAML parse.
 */
export function rescueInlineCommas(raw: string): string {
  if (!raw.includes('{')) return raw;
  return raw.split('\n').map(rescueLine).join('\n');
}
