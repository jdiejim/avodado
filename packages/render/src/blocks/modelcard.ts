/**
 * Renders a `modelcard` block — the endpoint card for a model. A head strip
 * (eyebrow `MODEL · v3.2.0`, the model name, the task on the right), a spec
 * strip of label → value cells (architecture, params, owner, license), then
 * the Mitchell et al. sections in a fixed order when present: intended use,
 * out of scope, training data, metrics (a table: name · value · split ·
 * note, value right-aligned tabular), limitations, ethics.
 *
 * Skin (`DESIGN.md`): paper on a hairline, like `endpoint` / `eventcontract`;
 * every chip carries a word, never a hue. No accent — a card has no focal
 * mark; the data is the point.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

type ModelData = BlockDataMap['modelcard'];
type Metric = NonNullable<ModelData['metrics']>[number];

function section(label: string): string {
  return `<div class="evc-section">${escapeHtml(label)}</div>`;
}

function bulletList(items: readonly string[], list: string): string {
  const lis = items.map((t, i) => `<li${bp(`${list}.${i}`)}>${escapeHtml(t)}</li>`).join('');
  return `<ul class="mc-list"${bl(list)}>${lis}</ul>`;
}

function metricsTable(metrics: readonly Metric[]): string {
  const hasSplit = metrics.some((m) => m.split !== undefined);
  const hasNote = metrics.some((m) => m.note !== undefined);
  const rows = metrics
    .map((m, i) => {
      const p = `metrics.${i}`;
      return (
        `<tr${bp(p)}>` +
        `<td class="evc-fname"${bp(`${p}.name`)}>${escapeHtml(m.name)}</td>` +
        `<td class="mc-value"${bp(`${p}.value`)}>${escapeHtml(String(m.value))}</td>` +
        (hasSplit ? `<td class="evc-type"${bp(`${p}.split`)}>${escapeHtml(m.split ?? '')}</td>` : '') +
        (hasNote ? `<td class="evc-desc"${bp(`${p}.note`)}>${escapeHtml(m.note ?? '')}</td>` : '') +
        `</tr>`
      );
    })
    .join('');
  return (
    `<table class="evc-table mc-metrics"><thead><tr><th>Metric</th><th class="mc-value">Value</th>` +
    (hasSplit ? `<th>Split</th>` : '') +
    (hasNote ? `<th>Note</th>` : '') +
    `</tr></thead><tbody${bl('metrics')}>${rows}</tbody></table>`
  );
}

export function renderModelcard(data: ModelData): string {
  const eyebrow =
    `<span class="evc-eyebrow t-eyebrow">MODEL` +
    (data.version !== undefined ? `<span class="evc-sep">·</span><span${bp('version')}>${escapeHtml(data.version)}</span>` : '') +
    `</span>`;
  const head =
    `<div class="evc-head">` +
    eyebrow +
    `<span class="evc-name"${bp('name')}>${escapeHtml(data.name)}</span>` +
    (data.task !== undefined ? `<span class="mc-task"${bp('task')}><span class="t-eyebrow">task</span>${escapeHtml(data.task)}</span>` : '') +
    `</div>`;

  const body: string[] = [];
  if (data.description !== undefined) body.push(`<p class="evc-desc-p"${bp('description')}>${escapeHtml(data.description)}</p>`);

  const spec: string[] = [];
  const cell = (k: string, v: string | undefined, path: string): void => {
    if (v === undefined) return;
    spec.push(`<div class="mc-cell"${bp(path)}><span class="mc-k t-eyebrow">${k}</span><span class="mc-v">${escapeHtml(v)}</span></div>`);
  };
  cell('architecture', data.architecture, 'architecture');
  cell('params', data.params, 'params');
  cell('owner', data.owner, 'owner');
  cell('license', data.license, 'license');
  if (spec.length > 0) body.push(`<div class="mc-spec">${spec.join('')}</div>`);

  const lists: readonly [string, string, readonly string[] | undefined][] = [
    ['Intended use', 'intendedUse', data.intendedUse],
    ['Out of scope', 'outOfScope', data.outOfScope],
    ['Training data', 'trainingData', data.trainingData],
  ];
  for (const [label, key, v] of lists) {
    if (v !== undefined && v.length > 0) body.push(section(label) + bulletList(v, key));
  }
  const metrics = data.metrics ?? [];
  if (metrics.length > 0) body.push(section('Metrics') + metricsTable(metrics));
  const tail: readonly [string, string, readonly string[] | undefined][] = [
    ['Limitations', 'limitations', data.limitations],
    ['Ethics', 'ethics', data.ethics],
  ];
  for (const [label, key, v] of tail) {
    if (v !== undefined && v.length > 0) body.push(section(label) + bulletList(v, key));
  }

  return `<div class="modelcard">${head}<div class="evc-body">${body.join('')}</div></div>`;
}
