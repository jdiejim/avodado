/**
 * Renders an `endpoint` block — a Swagger-style API endpoint card: a method +
 * path header, optional summary/description/auth, and tables for parameters,
 * request-body fields, and responses, plus optional request/response examples.
 */

import type { BlockDataMap } from '@avodado/core';
import { escapeHtml } from '../escape.js';

type EndpointData = BlockDataMap['endpoint'];
type Param = NonNullable<EndpointData['params']>[number];
type Field = NonNullable<EndpointData['body']>[number];
type Resp = NonNullable<EndpointData['responses']>[number];

/**
 * Render-time JSON syntax highlighting: wraps keys, strings, numbers, and
 * literals in coloured spans. Escapes both matched tokens and the gaps between
 * them, so the result is safe to drop into a `<pre>`. Non-JSON text (e.g. a
 * curl line) passes through escaped, just without colour.
 */
function highlightJson(src: string): string {
  const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  let out = '';
  let last = 0;
  for (let m = re.exec(src); m !== null; m = re.exec(src)) {
    out += esc(src.slice(last, m.index));
    const str = m[1];
    const colon = m[2];
    const kw = m[3];
    const num = m[4];
    if (str !== undefined) {
      out +=
        colon !== undefined
          ? `<span class="j-key">${esc(str)}</span>${colon}`
          : `<span class="j-str">${esc(str)}</span>`;
    } else if (kw !== undefined) {
      out += `<span class="j-kw">${esc(kw)}</span>`;
    } else if (num !== undefined) {
      out += `<span class="j-num">${esc(num)}</span>`;
    } else {
      out += esc(m[0]);
    }
    last = re.lastIndex;
  }
  out += esc(src.slice(last));
  return out;
}

function statusClass(status: string | number): string {
  const c = String(status).trim();
  if (c.startsWith('3')) return 'ep-3xx';
  if (c.startsWith('4')) return 'ep-4xx';
  if (c.startsWith('5')) return 'ep-5xx';
  return 'ep-2xx';
}

const reqTag = (required: boolean | undefined): string =>
  required === true ? ` <span class="ep-req">required</span>` : '';

function paramTable(params: readonly Param[]): string {
  const rows = params
    .map(
      (p) =>
        `<tr><td class="ep-name">${escapeHtml(p.name)}${reqTag(p.required)}</td>` +
        `<td class="ep-type">${escapeHtml(p.in ?? '')}</td>` +
        `<td class="ep-type">${escapeHtml(p.type ?? '')}</td>` +
        `<td>${escapeHtml(p.desc ?? '')}</td></tr>`,
    )
    .join('');
  return (
    `<table class="ep-table"><thead><tr><th>Name</th><th>In</th><th>Type</th><th>Description</th></tr></thead>` +
    `<tbody>${rows}</tbody></table>`
  );
}

function fieldTable(fields: readonly Field[]): string {
  const rows = fields
    .map(
      (f) =>
        `<tr><td class="ep-name">${escapeHtml(f.name)}${reqTag(f.required)}</td>` +
        `<td class="ep-type">${escapeHtml(f.type ?? '')}</td>` +
        `<td>${escapeHtml(f.desc ?? '')}</td></tr>`,
    )
    .join('');
  return (
    `<table class="ep-table"><thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>` +
    `<tbody>${rows}</tbody></table>`
  );
}

function responseTable(responses: readonly Resp[]): string {
  const rows = responses
    .map((r) => {
      const ex =
        r.example !== undefined
          ? `<tr><td></td><td colspan="2"><pre class="ep-ex">${highlightJson(r.example)}</pre></td></tr>`
          : '';
      return (
        `<tr><td><span class="ep-status ${statusClass(r.status)}">${escapeHtml(String(r.status))}</span></td>` +
        `<td colspan="2">${escapeHtml(r.desc ?? '')}</td></tr>${ex}`
      );
    })
    .join('');
  return (
    `<table class="ep-table"><thead><tr><th>Status</th><th colspan="2">Description</th></tr></thead>` +
    `<tbody>${rows}</tbody></table>`
  );
}

export function renderEndpoint(data: BlockDataMap['endpoint']): string {
  const head =
    `<div class="ep-head">` +
    `<span class="ep-method ${data.method.toLowerCase()}">${escapeHtml(data.method)}</span>` +
    `<span class="ep-path">${escapeHtml(data.path)}</span>` +
    (data.auth !== undefined ? `<span class="ep-auth">${escapeHtml(data.auth)}</span>` : '') +
    `</div>`;

  const body: string[] = [];
  if (data.title !== undefined) body.push(`<div class="ep-title">${escapeHtml(data.title)}</div>`);
  if (data.description !== undefined) body.push(`<p class="ep-desc">${escapeHtml(data.description)}</p>`);

  const params = data.params ?? [];
  if (params.length > 0) body.push(`<div class="ep-section">Parameters</div>${paramTable(params)}`);

  const fields = data.body ?? [];
  if (fields.length > 0) body.push(`<div class="ep-section">Request body</div>${fieldTable(fields)}`);

  const responses = data.responses ?? [];
  if (responses.length > 0)
    body.push(`<div class="ep-section">Responses</div>${responseTable(responses)}`);

  if (data.request !== undefined)
    body.push(`<div class="ep-section">Example request</div><pre class="ep-ex">${highlightJson(data.request)}</pre>`);
  if (data.response !== undefined)
    body.push(`<div class="ep-section">Example response</div><pre class="ep-ex">${highlightJson(data.response)}</pre>`);

  return `<div class="endpoint">${head}<div class="ep-body">${body.join('')}</div></div>`;
}
