/**
 * Renders an `envelope` block — back-of-envelope capacity math, the classic
 * "step 2" of a system-design write-up. Assumptions (the givens) sit in a
 * compact label-over-value grid, separated by a hairline from the derivation
 * rows (label · calc chip · → · result). The optional `result` renders as a
 * full-width highlighted band — the bottom line of the estimate.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

type EnvelopeData = BlockDataMap['envelope'];
type Assumption = EnvelopeData['assumptions'][number];
type Step = EnvelopeData['steps'][number];

function renderAssumption(a: Assumption, i: number): string {
  return (
    `<div class="env-given"${bp(`assumptions.${i}`)}>` +
    `<div class="env-g-label"${bp(`assumptions.${i}.label`)}>${escapeHtml(a.label)}</div>` +
    `<div class="env-g-value"${bp(`assumptions.${i}.value`)}>${escapeHtml(a.value)}</div>` +
    `</div>`
  );
}

function renderStep(s: Step, i: number): string {
  return (
    `<div class="env-step"${bp(`steps.${i}`)}>` +
    `<span class="env-s-label"${bp(`steps.${i}.label`)}>${escapeHtml(s.label)}</span>` +
    `<span class="env-s-calc"${bp(`steps.${i}.calc`)}>${escapeHtml(s.calc)}</span>` +
    `<span class="env-s-arrow" aria-hidden="true">→</span>` +
    `<span class="env-s-result"${bp(`steps.${i}.result`)}>${escapeHtml(s.result)}</span>` +
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
  const givens = data.assumptions.map((a, i) => renderAssumption(a, i)).join('');
  const steps = data.steps.map((s, i) => renderStep(s, i)).join('');
  const result =
    data.result !== undefined
      ? `<div class="env-result"${bp('result')}>` +
        `<div class="env-r-label"${bp('result.label')}>${escapeHtml(data.result.label)}</div>` +
        `<div class="env-r-value"${bp('result.value')}>${escapeHtml(data.result.value)}</div>` +
        `</div>`
      : '';
  return (
    `<div class="envelope">` +
    head +
    desc +
    `<div class="env-card">` +
    `<div class="env-givens"${bl('assumptions')}>${givens}</div>` +
    `<div class="env-steps"${bl('steps')}>${steps}</div>` +
    result +
    `</div>` +
    `</div>`
  );
}
