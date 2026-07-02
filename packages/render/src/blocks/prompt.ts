/**
 * Renders a `prompt` block — prompt anatomy as stacked cards, one per
 * segment. Each card gets a role kicker (SYSTEM gray · USER navy · ASSISTANT
 * violet · TOOL teal), an optional label, and the prompt text in a mono face
 * on a very light background. Any `{{variable}}` token in the text renders
 * as a highlighted amber chip; `vars` documents the variables in a legend
 * beneath.
 *
 * Variable parsing runs on the ESCAPED text (`{{[a-zA-Z0-9_.]+}}` — no
 * entities can appear inside), so the highlight cannot be used for injection.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

type PromptData = BlockDataMap['prompt'];
type Segment = PromptData['segments'][number];

const VAR_RE = /\{\{[a-zA-Z0-9_.]+\}\}/g;

/** Escapes text, then wraps `{{var}}` tokens in highlight chips. */
function highlightVars(text: string): string {
  return escapeHtml(text).replace(VAR_RE, (m) => `<span class="pr-var">${m}</span>`);
}

function renderSegment(seg: Segment): string {
  const label =
    seg.label !== undefined && seg.label.length > 0
      ? `<span class="pr-label">— ${escapeHtml(seg.label)}</span>`
      : '';
  return (
    `<div class="pr-seg pr-${seg.kind}">` +
    `<div class="pr-kicker">${seg.kind.toUpperCase()}${label}</div>` +
    `<div class="pr-text">${highlightVars(seg.text)}</div>` +
    `</div>`
  );
}

export function renderPrompt(data: PromptData): string {
  const head =
    data.title !== undefined ? `<div class="pr-head">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined
      ? `<p class="pr-desc">${escapeHtml(data.description)}</p>`
      : '';
  const segments = data.segments.map(renderSegment).join('');
  const vars = data.vars ?? [];
  const legend =
    vars.length > 0
      ? `<div class="pr-vars">${vars
          .map(
            (v) =>
              `<div class="pr-var-row"><span class="pr-var">{{${escapeHtml(v.name)}}}</span>` +
              (v.desc !== undefined && v.desc.length > 0
                ? `<span class="pr-var-desc">${escapeHtml(v.desc)}</span>`
                : '') +
              `</div>`,
          )
          .join('')}</div>`
      : '';
  return `<div class="prompt">${head}${desc}<div class="pr-list">${segments}</div>${legend}</div>`;
}
