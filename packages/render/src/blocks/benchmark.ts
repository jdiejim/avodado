/**
 * Renders a `benchmark` block — a scoreboard of measured results: one column
 * per subject, one row per metric, values in the cells.
 *
 * The best result in each row is **derived**, not authored: values are read as
 * numbers (leading currency/symbols and trailing units are ignored, so `$0.14`,
 * `310 ms` and `43.3%` all compare) and the winner is bolded and tinted with
 * its subject's tone. `better: low` flips the comparison for latency- and
 * cost-style metrics, `better: none` turns the highlight off, and a cell may
 * set `best: true` to force it (ties, or a winner that isn't a number).
 *
 * A row that measures the same metric under several conditions declares
 * `variants` and gives each subject an array of values; they stack inside the
 * cell with the variant name as a caption, and each condition is compared on
 * its own line. One subject may be `featured` — its column carries a rounded
 * outline through the whole table.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

type BenchmarkData = BlockDataMap['benchmark'];
type Subject = BenchmarkData['subjects'][number];
type Row = BenchmarkData['rows'][number];
type Cell = NonNullable<Row['cells']>[number];
type Value = Exclude<Cell, readonly unknown[]>;

/** Head of the metric column when the author names none. */
const DEFAULT_METRIC_LABEL = 'Benchmark';

/** Shown where a subject has no result for a row. */
const MISSING = '—';

/** One rendered measurement: the authored value plus where it came from. */
interface Slot {
  readonly text: string;
  readonly note?: string | undefined;
  readonly forced: boolean;
  readonly num: number | undefined;
  /** Data path of the authored value, for click-to-edit. */
  readonly path: string;
}

/** Reads a value out of its terse or object form. */
function slotOf(value: Value | undefined, path: string): Slot {
  if (value === undefined) return { text: MISSING, forced: false, num: undefined, path };
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value);
    return { text, forced: false, num: numberIn(text), path };
  }
  const text = value.value !== undefined ? String(value.value) : MISSING;
  return {
    text,
    ...(value.note !== undefined ? { note: value.note } : {}),
    forced: value.best === true,
    num: numberIn(text),
    path: value.value !== undefined ? `${path}.value` : path,
  };
}

/**
 * The number inside a measurement, or `undefined` when there isn't one.
 * Skips any leading non-numeric run (`$`, `~`, `<`) and stops at the unit, so
 * `$0.14`, `310 ms`, `1861` and `43.3%` all yield a comparable number. Values
 * with digits on both sides of the unit (`1h 20m`) don't compare — first wins.
 */
function numberIn(text: string): number | undefined {
  const m = /-?\d+(?:[.,]\d+)?/.exec(text.replace(/,(?=\d{3}\b)/g, ''));
  if (m === null) return undefined;
  const n = Number(m[0].replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

/** Every subject's slots for one row, grouped by variant line. */
function slotGrid(row: Row, subjects: readonly Subject[], ri: number): Slot[][] {
  const lines = Math.max(1, row.variants?.length ?? 1);
  return subjects.map((_, si) => {
    const cell = row.cells?.[si];
    const path = `rows.${ri}.cells.${si}`;
    if (Array.isArray(cell)) {
      return Array.from({ length: lines }, (_v, li) => slotOf(cell[li], `${path}.${li}`));
    }
    // A single value fills the first line; the rest of a variant row is blank.
    return Array.from({ length: lines }, (_v, li) =>
      li === 0 ? slotOf(cell as Value | undefined, path) : slotOf(undefined, path),
    );
  });
}

/** Indices of the winning subjects on one variant line (empty when none). */
function winners(grid: readonly Slot[][], line: number, better: Row['better']): ReadonlySet<number> {
  const out = new Set<number>();
  for (const [si, slots] of grid.entries()) {
    if (slots[line]?.forced === true) out.add(si);
  }
  if (better === 'none') return out;
  const nums = grid.map((slots) => slots[line]?.num);
  const present = nums.filter((n): n is number => n !== undefined);
  if (present.length < 2) return out; // nothing to win against
  const target = better === 'low' ? Math.min(...present) : Math.max(...present);
  nums.forEach((n, si) => {
    if (n === target) out.add(si);
  });
  return out;
}

export function renderBenchmark(data: BenchmarkData): string {
  const subjects = data.subjects;
  const rows = data.rows;

  const headCells = subjects
    .map((s, si) => {
      const cls = ['bm-subj', s.featured === true ? 'bm-feat' : ''].filter(Boolean).join(' ');
      const sub =
        s.sub !== undefined
          ? `<span class="bm-subj-sub"${bp(`subjects.${si}.sub`)}>${escapeHtml(s.sub)}</span>`
          : '';
      return `<th class="${cls}"${bp(`subjects.${si}`)}>${escapeHtml(s.label)}${sub}</th>`;
    })
    .join('');
  const head =
    `<tr${bl('subjects')}>` +
    `<th class="bm-metric">${escapeHtml(data.metricLabel ?? DEFAULT_METRIC_LABEL)}</th>` +
    `${headCells}</tr>`;

  const body = rows
    .map((row, ri) => {
      const grid = slotGrid(row, subjects, ri);
      const lines = grid[0]?.length ?? 1;
      const won = Array.from({ length: lines }, (_v, li) => winners(grid, li, row.better));

      const sub =
        row.sub !== undefined
          ? `<span class="bm-row-sub"${bp(`rows.${ri}.sub`)}>${escapeHtml(row.sub)}</span>`
          : '';
      const label =
        `<td class="bm-metric"${bp(`rows.${ri}`)}>` +
        `<span class="bm-row-label"${bp(`rows.${ri}.label`)}>${escapeHtml(row.label)}</span>${sub}</td>`;

      const cells = grid
        .map((slots, si) => {
          const subject = subjects[si];
          const tone = subject?.tone === 'muted' ? 'bm-muted' : 'bm-accent';
          const inner = slots
            .map((slot, li) => {
              const best = won[li]?.has(si) === true && slot.text !== MISSING;
              const cls = ['bm-slot', best ? `bm-best ${tone}` : ''].filter(Boolean).join(' ');
              const note =
                slot.note !== undefined
                  ? `<span class="bm-note">${escapeHtml(slot.note)}</span>`
                  : '';
              // The condition captions a measurement; there's nothing to
              // caption where a subject didn't run the benchmark.
              const variant = row.variants?.[li];
              const caption =
                variant !== undefined && slot.text !== MISSING
                  ? `<span class="bm-cap"${bp(`rows.${ri}.variants.${li}`)}>${escapeHtml(variant)}</span>`
                  : '';
              return (
                `<div class="${cls}"${bp(slot.path)}>${note}` +
                `<span class="bm-val">${escapeHtml(slot.text)}</span>${caption}</div>`
              );
            })
            .join('');
          const cls = ['bm-cell', subject?.featured === true ? 'bm-feat' : ''].filter(Boolean).join(' ');
          return `<td class="${cls}">${inner}</td>`;
        })
        .join('');
      return `<tr>${label}${cells}</tr>`;
    })
    .join('');

  const caption =
    data.title !== undefined ? `<div class="bm-head">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined
      ? `<p class="bm-desc"${bp('description')}>${escapeHtml(data.description)}</p>`
      : '';
  const note =
    data.note !== undefined
      ? `<p class="bm-foot"${bp('note')}>${escapeHtml(data.note)}</p>`
      : '';
  return (
    `<div class="benchmark">${caption}${desc}` +
    `<div class="bm-scroll"><table class="bm-table">` +
    `<thead>${head}</thead><tbody${bl('rows')}>${body}</tbody>` +
    `</table></div>${note}</div>`
  );
}
