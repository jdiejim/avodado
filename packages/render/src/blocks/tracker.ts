/**
 * Renders a tracker block — task table with status pills, optional priority,
 * owner, and due date columns.
 *
 * Doc-studio extras: optional `owner` (rendered as a column) and `due` (also
 * a column). Done rows get a strikethrough via `.trk tr.done .trk-task`.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

export function renderTracker(data: BlockDataMap['tracker']): string {
  const items = data.items ?? [];
  const hasOwner = items.some((i) => i.owner !== undefined);
  const hasDue = items.some((i) => i.due !== undefined);

  const headCells = ['<th>Task</th>', '<th>Status</th>', '<th>Priority</th>'];
  if (hasOwner) headCells.push('<th>Owner</th>');
  if (hasDue) headCells.push('<th>Due</th>');

  let h = `<table class="trk"><thead><tr>${headCells.join('')}</tr></thead><tbody>`;
  for (const it of items) {
    const st = it.status ?? 'todo';
    const pr = it.priority;
    const prCell =
      pr !== undefined ? `<span class="pri ${pr}">${escapeHtml(pr)}</span>` : '';
    const rowCls = st === 'done' ? ' class="done"' : '';
    const cells = [
      `<td class="trk-task">${escapeHtml(it.task)}</td>`,
      `<td><span class="st ${st}">${escapeHtml(st)}</span></td>`,
      `<td>${prCell}</td>`,
    ];
    if (hasOwner) cells.push(`<td>${escapeHtml(it.owner ?? '')}</td>`);
    if (hasDue) cells.push(`<td>${escapeHtml(it.due ?? '')}</td>`);
    h += `<tr${rowCls}>${cells.join('')}</tr>`;
  }
  return h + `</tbody></table>`;
}
