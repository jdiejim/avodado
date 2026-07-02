/**
 * Renders an `envelope` block — back-of-envelope capacity math, the classic
 * "step 2" of a system-design write-up. Assumptions (the givens) sit in a
 * compact label-over-value grid, separated by a hairline from the derivation
 * rows (label · calc chip · → · result). The optional `result` renders as a
 * full-width highlighted band — the bottom line of the estimate.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

type EnvelopeData = BlockDataMap['envelope'];
type Assumption = EnvelopeData['assumptions'][number];
type Step = EnvelopeData['steps'][number];

function renderAssumption(a: Assumption): string {
  return (
    `<div class="env-given">` +
    `<div class="env-g-label">${escapeHtml(a.label)}</div>` +
    `<div class="env-g-value">${escapeHtml(a.value)}</div>` +
    `</div>`
  );
}

function renderStep(s: Step): string {
  return (
    `<div class="env-step">` +
    `<span class="env-s-label">${escapeHtml(s.label)}</span>` +
    `<span class="env-s-calc">${escapeHtml(s.calc)}</span>` +
    `<span class="env-s-arrow" aria-hidden="true">→</span>` +
    `<span class="env-s-result">${escapeHtml(s.result)}</span>` +
    `</div>`
  );
}

export function renderEnvelope(data: EnvelopeData): string {
  const head =
    data.title !== undefined ? `<div class="env-head">${escapeHtml(data.title)}</div>` : '';
  const desc =
    data.description !== undefined
      ? `<p class="env-desc">${escapeHtml(data.description)}</p>`
      : '';
  const givens = data.assumptions.map(renderAssumption).join('');
  const steps = data.steps.map(renderStep).join('');
  const result =
    data.result !== undefined
      ? `<div class="env-result">` +
        `<div class="env-r-label">${escapeHtml(data.result.label)}</div>` +
        `<div class="env-r-value">${escapeHtml(data.result.value)}</div>` +
        `</div>`
      : '';
  return (
    `<div class="envelope">` +
    head +
    desc +
    `<div class="env-card">` +
    `<div class="env-givens">${givens}</div>` +
    `<div class="env-steps">${steps}</div>` +
    result +
    `</div>` +
    `</div>`
  );
}
