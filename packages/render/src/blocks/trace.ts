/**
 * Renders a `trace` block — an agent / session execution transcript as a
 * vertical list of turns. Each turn gets a role chip (USER navy · ASSISTANT
 * violet · TOOL teal · SYSTEM gray) and a content card; a hairline connector
 * runs down the left between turns.
 *
 * Assistant `thinking` renders first as small italic text with a dotted left
 * border; tool turns show the tool name in bold mono plus `args` / `result`
 * as small mono chips ("args:" / "→"). Multi-line strings preserve their
 * line breaks (`white-space: pre-wrap`).
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

type TraceData = BlockDataMap['trace'];
type Turn = TraceData['turns'][number];

const ROLE_LABEL: Record<Turn['role'], string> = {
  user: 'USER',
  assistant: 'ASSISTANT',
  tool: 'TOOL',
  system: 'SYSTEM',
};

function renderTurn(turn: Turn): string {
  const parts: string[] = [];
  if (turn.thinking !== undefined && turn.thinking.length > 0) {
    parts.push(`<div class="tr-think">${escapeHtml(turn.thinking)}</div>`);
  }
  if (turn.tool !== undefined && turn.tool.length > 0) {
    parts.push(`<div class="tr-tool-name">${escapeHtml(turn.tool)}</div>`);
  }
  if (turn.args !== undefined && turn.args.length > 0) {
    parts.push(
      `<div class="tr-io"><span class="tr-io-label">args:</span><code class="tr-mono">${escapeHtml(turn.args)}</code></div>`,
    );
  }
  if (turn.result !== undefined && turn.result.length > 0) {
    parts.push(
      `<div class="tr-io"><span class="tr-io-label">→</span><code class="tr-mono">${escapeHtml(turn.result)}</code></div>`,
    );
  }
  if (turn.text !== undefined && turn.text.length > 0) {
    parts.push(`<div class="tr-text">${escapeHtml(turn.text)}</div>`);
  }
  return (
    `<div class="tr-turn tr-${turn.role}">` +
    `<span class="tr-chip">${ROLE_LABEL[turn.role]}</span>` +
    `<div class="tr-card">${parts.join('')}</div>` +
    `</div>`
  );
}

export function renderTrace(data: TraceData): string {
  const head =
    data.title !== undefined ? `<div class="tr-head">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined
      ? `<p class="tr-desc">${escapeHtml(data.description)}</p>`
      : '';
  const turns = data.turns.map(renderTurn).join('');
  return `<div class="trace">${head}${desc}<div class="tr-list">${turns}</div></div>`;
}
