/**
 * Renders a `steps` block — a numbered how-to / runbook stepper. Each step is
 * a navy numbered circle connected by a vertical rule, with a bold title, an
 * optional body line, an optional dark `<pre><code>` snippet (the house code
 * surface), and an optional italic note.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { highlightCode } from '../highlight.js';

type StepsData = BlockDataMap['steps'];
type Step = StepsData['items'][number];

function renderStep(step: Step, index: number): string {
  const body =
    step.body !== undefined ? `<p class="stp-text">${escapeHtml(step.body)}</p>` : '';
  const lang =
    step.lang !== undefined ? `<div class="stp-code-head">${escapeHtml(step.lang)}</div>` : '';
  const code =
    step.code !== undefined
      ? `<div class="stp-code">${lang}<pre><code>${highlightCode(step.code)}</code></pre></div>`
      : '';
  const note =
    step.note !== undefined ? `<p class="stp-note">${escapeHtml(step.note)}</p>` : '';
  return (
    `<li class="stp-item">` +
    `<span class="stp-num" aria-hidden="true">${index + 1}</span>` +
    `<div class="stp-body">` +
    `<div class="stp-title">${escapeHtml(step.title)}</div>` +
    body +
    code +
    note +
    `</div>` +
    `</li>`
  );
}

export function renderSteps(data: StepsData): string {
  const head =
    data.title !== undefined ? `<div class="stp-head">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined
      ? `<p class="stp-desc">${escapeHtml(data.description)}</p>`
      : '';
  const items = data.items.map((it, i) => renderStep(it, i)).join('');
  return `<div class="steps">${head}${desc}<ol class="stp-list">${items}</ol></div>`;
}
