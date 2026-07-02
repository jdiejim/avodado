/**
 * Renders an `agentloop` block — the canonical LLM agent-loop diagram, in
 * pure SVG inside the diagram frame (tag AGENT, violet).
 *
 * Layout: the environment (user) card on the left, the agent card (violet,
 * sparkle glyph, mono model chip) in the centre, a vertical column of tool
 * cards on the right (capped at 5 + "+N more"), and a memory cylinder
 * (orange db family) beneath the agent when `memory` is present. Numbered
 * loop arrows: ① env→agent "prompt", ② agent→tools "tool call", ③ tools→agent
 * "result" (dashed return), ④ agent→env "response"; agent↔memory is a dashed
 * "read/write" link. `stop` renders as a foot pill below the diagram.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { nodeGlyph } from '../svg/blockStyle.js';
import { wrapText } from '../svg/wrapText.js';
import { diagramFrame } from './frame.js';

type AgentloopData = BlockDataMap['agentloop'];
type Tool = NonNullable<AgentloopData['tools']>[number];

const WIDTH = 660;
const ENV_X = 16;
const ENV_W = 118;
const ENV_H = 56;
const AGENT_X = 232;
const AGENT_W = 176;
const TOOL_X = 512;
const TOOL_W = 134;
const TOOL_GAP = 10;
const MAX_TOOLS = 5;

/** Violet agent family (matches blockStyle's ml/llm/agent kind). */
const VIOLET = { accent: '#7c3aed', fill: '#ede9fe', text: '#4a1772' };
/** Client-blue env family (matches blockStyle's user/browser kind). */
const BLUE = { accent: '#0e54a1', fill: '#e5eff8', text: '#0a3a6e' };
/** Orange db family for the memory cylinder (matches blockStyle's store kind). */
const ORANGE = { accent: '#f7952c', fill: '#fde7cd', text: '#7a3d00' };

/** A circled step numeral + its mono label, positioned above an arrow. */
function loopBadge(n: number, x: number, y: number, label: string): string {
  return (
    `<circle cx="${x}" cy="${y}" r="8" class="step-badge"/>` +
    `<text x="${x}" y="${y + 3.5}" class="step-badge-text">${n}</text>` +
    `<text x="${x + 13}" y="${y + 3.5}" class="al-lbl">${escapeHtml(label)}</text>`
  );
}

/** Wraps a tool's desc to fit the card (max 2 lines). */
function toolDescLines(tool: Tool): string[] {
  return wrapText(tool.desc, 22, 2);
}

function toolCardH(tool: Tool): number {
  const lines = toolDescLines(tool).length;
  return lines === 0 ? 26 : 28 + lines * 13;
}

export function renderAgentloop(data: AgentloopData): string {
  const tools = data.tools ?? [];
  const visibleTools = tools.slice(0, MAX_TOOLS);
  const hiddenTools = tools.length - visibleTools.length;
  const hasTools = visibleTools.length > 0;
  const memory = data.memory;
  const env = data.env ?? 'User';

  // Agent card height: name row, optional model chip, optional wrapped note.
  const noteLines = wrapText(data.agent.note, 28, 3);
  const hasModel = data.agent.model !== undefined && data.agent.model.length > 0;
  const agentH = Math.max(
    56,
    36 + (hasModel ? 22 : 0) + (noteLines.length > 0 ? noteLines.length * 13 + 8 : 0),
  );

  // Tools column height (cards + gaps + optional "+N more" line).
  const toolsColH = hasTools
    ? visibleTools.reduce((acc, t) => acc + toolCardH(t), 0) +
      TOOL_GAP * (visibleTools.length - 1) +
      (hiddenTools > 0 ? 18 : 0)
    : 0;

  const top = 10;
  const centerY = Math.round(top + Math.max(agentH, toolsColH, ENV_H, 64) / 2);
  const agentY = Math.round(centerY - agentH / 2);
  const envY = Math.round(centerY - ENV_H / 2);
  const toolsTop = Math.round(centerY - toolsColH / 2);
  const bandBottom = Math.max(agentY + agentH, envY + ENV_H, hasTools ? toolsTop + toolsColH : 0);

  // Memory cylinder (only when `memory:` is present; empty list → just a label).
  const memItems = memory ?? [];
  const hasMemory = memory !== undefined;
  const memW = 176;
  const memH = hasMemory ? Math.max(44, 32 + memItems.length * 15) : 0;
  const memX = Math.round(AGENT_X + (AGENT_W - memW) / 2);
  const memTop = bandBottom + 46;
  const height = hasMemory ? memTop + memH + 8 : bandBottom + 12;

  let s = `<svg viewBox="0 0 ${WIDTH} ${height}" width="${WIDTH}" height="${height}" role="img"><title>Agent loop</title>`;

  // Environment card (left).
  s +=
    `<rect x="${ENV_X}" y="${envY}" width="${ENV_W}" height="${ENV_H}" rx="10" fill="${BLUE.fill}" stroke="${BLUE.accent}" stroke-width="1.3" filter="url(#gshadow)"/>` +
    nodeGlyph('user', ENV_X + Math.round(ENV_W / 2) - 8, envY + 10, BLUE.accent) +
    `<text x="${ENV_X + Math.round(ENV_W / 2)}" y="${envY + ENV_H - 12}" text-anchor="middle" class="al-env" fill="${BLUE.text}">${escapeHtml(env)}</text>`;

  // Agent card (centre).
  s += `<rect x="${AGENT_X}" y="${agentY}" width="${AGENT_W}" height="${agentH}" rx="11" fill="${VIOLET.fill}" stroke="${VIOLET.accent}" stroke-width="1.4" filter="url(#gshadow)"/>`;
  s += nodeGlyph('agent', AGENT_X + 12, agentY + 12, VIOLET.accent);
  s += `<text x="${AGENT_X + 36}" y="${agentY + 24}" class="al-name" fill="${VIOLET.text}">${escapeHtml(data.agent.name)}</text>`;
  let cursorY = agentY + 34;
  if (hasModel) {
    const model = data.agent.model ?? '';
    const chipW = Math.min(AGENT_W - 24, 16 + model.length * 6);
    s +=
      `<rect x="${AGENT_X + 12}" y="${cursorY}" width="${chipW}" height="16" rx="8" fill="#fff" stroke="${VIOLET.accent}" stroke-width="1"/>` +
      `<text x="${AGENT_X + 12 + Math.round(chipW / 2)}" y="${cursorY + 11.5}" text-anchor="middle" class="al-chip" fill="${VIOLET.accent}">${escapeHtml(model)}</text>`;
    cursorY += 22;
  }
  noteLines.forEach((line, i) => {
    s += `<text x="${AGENT_X + 12}" y="${cursorY + 10 + i * 13}" class="al-note">${escapeHtml(line)}</text>`;
  });

  // Tools column (right).
  if (hasTools) {
    let ty = toolsTop;
    for (const tool of visibleTools) {
      const h = toolCardH(tool);
      s += `<rect x="${TOOL_X}" y="${ty}" width="${TOOL_W}" height="${h}" rx="8" fill="var(--teal-soft)" stroke="var(--teal)" stroke-width="1.1"/>`;
      s += `<text x="${TOOL_X + 11}" y="${ty + 17}" class="al-tool-name">${escapeHtml(tool.name)}</text>`;
      toolDescLines(tool).forEach((line, li) => {
        s += `<text x="${TOOL_X + 11}" y="${ty + 31 + li * 13}" class="al-tool-desc">${escapeHtml(line)}</text>`;
      });
      ty += h + TOOL_GAP;
    }
    if (hiddenTools > 0) {
      s += `<text x="${TOOL_X + 11}" y="${ty + 2}" class="al-more">+${hiddenTools} more</text>`;
    }
  }

  // Loop arrows. ① prompt (env → agent) above, ④ response (agent → env) below.
  const yIn = centerY - 13;
  const yOut = centerY + 13;
  s += `<line x1="${ENV_X + ENV_W}" y1="${yIn}" x2="${AGENT_X - 4}" y2="${yIn}" class="al-edge" marker-end="url(#gArrow)"/>`;
  s += loopBadge(1, ENV_X + ENV_W + 18, yIn - 13, 'prompt');
  s += `<line x1="${AGENT_X}" y1="${yOut}" x2="${ENV_X + ENV_W + 4}" y2="${yOut}" class="al-edge" marker-end="url(#gArrow)"/>`;
  s += loopBadge(4, ENV_X + ENV_W + 18, yOut + 17, 'response');

  // ② tool call (agent → tools), ③ result (dashed return).
  if (hasTools) {
    s += `<line x1="${AGENT_X + AGENT_W}" y1="${yIn}" x2="${TOOL_X - 4}" y2="${yIn}" class="al-edge" marker-end="url(#gArrow)"/>`;
    s += loopBadge(2, AGENT_X + AGENT_W + 18, yIn - 13, 'tool call');
    s += `<line x1="${TOOL_X}" y1="${yOut}" x2="${AGENT_X + AGENT_W + 4}" y2="${yOut}" class="al-edge dashed" marker-end="url(#gSoft)"/>`;
    s += loopBadge(3, AGENT_X + AGENT_W + 18, yOut + 17, 'result');
  }

  // Memory cylinder + dashed read/write link.
  if (hasMemory) {
    const cx = AGENT_X + Math.round(AGENT_W / 2);
    s += `<line x1="${cx}" y1="${agentY + agentH + 3}" x2="${cx}" y2="${memTop - 8}" class="al-edge dashed" marker-start="url(#gSoft)" marker-end="url(#gSoft)"/>`;
    s += `<text x="${cx + 8}" y="${Math.round((agentY + agentH + memTop) / 2) + 3}" class="al-lbl">read/write</text>`;
    const ry = 7;
    s +=
      `<path d="M${memX} ${memTop + ry} a ${Math.round(memW / 2)} ${ry} 0 0 1 ${memW} 0 V ${memTop + memH - ry} a ${Math.round(memW / 2)} ${ry} 0 0 1 -${memW} 0 Z" fill="${ORANGE.fill}" stroke="${ORANGE.accent}" stroke-width="1.3"/>` +
      `<ellipse cx="${memX + Math.round(memW / 2)}" cy="${memTop + ry}" rx="${Math.round(memW / 2)}" ry="${ry}" fill="${ORANGE.fill}" stroke="${ORANGE.accent}" stroke-width="1.3"/>`;
    s += `<text x="${memX + Math.round(memW / 2)}" y="${memTop + 27}" text-anchor="middle" class="al-mem" fill="${ORANGE.text}">memory</text>`;
    memItems.forEach((item, i) => {
      const line = wrapText(item, 28, 1)[0] ?? '';
      s += `<text x="${memX + Math.round(memW / 2)}" y="${memTop + 41 + i * 15}" text-anchor="middle" class="al-mem-item">${escapeHtml(line)}</text>`;
    });
  }

  s += `</svg>`;

  const foot =
    data.stop !== undefined && data.stop.length > 0
      ? `<div class="al-foot"><span class="al-foot-label">stops when:</span> <span>${escapeHtml(data.stop)}</span></div>`
      : '';

  return diagramFrame(
    {
      tag: 'AGENT',
      tagBg: '#7c3aed',
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { desc: data.description } : {}),
      ...(foot.length > 0 ? { footerHtml: foot } : {}),
    },
    s,
  );
}
