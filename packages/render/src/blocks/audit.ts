/**
 * Renders an `audit` block — a findings register. A head row (title, then
 * scope · date · auditor as mono meta), a count strip with one chip per
 * severity present, then the findings as a table sorted by severity
 * (critical → info, stable within a severity so the author's order holds):
 * id · severity chip · title (+ area tag, ref) · evidence · fix · owner ·
 * status chip. A column no finding fills is not drawn.
 *
 * Skin (`DESIGN.md`): the severity chips reuse the `risk` encoding
 * (`.rk-sev-*`); `info` is the muted one. Status chips: open = negative
 * outline, fixing = the accent (the work happening now), fixed = `paper-2`,
 * accepted / wontfix = soft outline. Every row keeps its authored index in
 * `data-bp`, so a click after sorting still edits the right finding.
 */

import type { BlockDataMap } from 'chiltepin-core';
import { escapeHtml } from '../escape.js';
import { bl, bp } from '../paths.js';

type AuditData = BlockDataMap['audit'];
type Finding = AuditData['findings'][number];
type Severity = Finding['severity'];

/** Severity order, most severe first — also the order of the count strip. */
const SEVERITY_ORDER: readonly Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

const RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

/** Findings sorted by severity, author order within a severity; the authored index rides along. */
function sortFindings(findings: readonly Finding[]): { f: Finding; i: number }[] {
  return findings
    .map((f, i) => ({ f, i }))
    .sort((a, b) => RANK[a.f.severity] - RANK[b.f.severity] || a.i - b.i);
}

/** Count per severity, in {@link SEVERITY_ORDER}; zero counts are dropped. */
function severityCounts(findings: readonly Finding[]): { severity: Severity; n: number }[] {
  const n = new Map<Severity, number>();
  for (const f of findings) n.set(f.severity, (n.get(f.severity) ?? 0) + 1);
  return SEVERITY_ORDER.filter((s) => (n.get(s) ?? 0) > 0).map((s) => ({ severity: s, n: n.get(s) ?? 0 }));
}

function sevChip(sev: Severity, extra = ''): string {
  return `<span class="rk-sev rk-sev-${sev} au-sev${extra}">`;
}

export function renderAudit(data: AuditData): string {
  const findings = data.findings;
  const has = (k: 'id' | 'evidence' | 'fix' | 'owner' | 'status'): boolean =>
    findings.some((f) => f[k] !== undefined && String(f[k]).length > 0);
  const cols = {
    id: has('id'),
    evidence: has('evidence'),
    fix: has('fix'),
    owner: has('owner'),
    status: has('status'),
  };

  const meta: string[] = [];
  if (data.scope !== undefined) meta.push(`<span class="au-m"${bp('scope')}><span class="au-k">scope</span>${escapeHtml(data.scope)}</span>`);
  if (data.date !== undefined) meta.push(`<span class="au-m"${bp('date')}><span class="au-k">date</span>${escapeHtml(data.date)}</span>`);
  if (data.auditor !== undefined)
    meta.push(`<span class="au-m"${bp('auditor')}><span class="au-k">auditor</span>${escapeHtml(data.auditor)}</span>`);
  const head =
    data.title !== undefined || meta.length > 0
      ? `<div class="au-head">` +
        (data.title !== undefined ? `<span class="au-title"${bp('title')}>${escapeHtml(data.title)}</span>` : '') +
        (meta.length > 0 ? `<span class="au-meta">${meta.join('')}</span>` : '') +
        `</div>`
      : '';
  const desc = data.description !== undefined ? `<p class="au-desc"${bp('description')}>${escapeHtml(data.description)}</p>` : '';

  const counts = severityCounts(findings)
    .map(({ severity, n }) => `${sevChip(severity, ' au-count')}<b class="au-n">${n}</b> ${severity}</span>`)
    .join('');
  const strip = `<div class="au-counts"><span class="au-total t-sub">${findings.length} finding${findings.length === 1 ? '' : 's'}</span>${counts}</div>`;

  const th = (label: string, cls = ''): string => `<th${cls !== '' ? ` class="${cls}"` : ''}>${label}</th>`;
  const thead =
    `<thead><tr>` +
    (cols.id ? th('ID', 'au-c-id') : '') +
    th('Severity', 'au-c-sev') +
    th('Finding') +
    (cols.evidence ? th('Evidence') : '') +
    (cols.fix ? th('Fix') : '') +
    (cols.owner ? th('Owner', 'au-c-owner') : '') +
    (cols.status ? th('Status', 'au-c-status') : '') +
    `</tr></thead>`;

  const rows = sortFindings(findings)
    .map(({ f, i }) => {
      const p = `findings.${i}`;
      const area = f.area !== undefined ? `<span class="au-area"${bp(`${p}.area`)}>${escapeHtml(f.area)}</span>` : '';
      const ref = f.ref !== undefined ? `<span class="au-ref"${bp(`${p}.ref`)}>${escapeHtml(f.ref)}</span>` : '';
      const status =
        f.status !== undefined
          ? `<span class="rk-status au-st au-st-${f.status}"${bp(`${p}.status`)}>${escapeHtml(f.status)}</span>`
          : '';
      return (
        `<tr class="au-row au-sev-row-${f.severity}"${bp(p)}>` +
        (cols.id ? `<td class="au-id"${bp(`${p}.id`)}>${escapeHtml(f.id ?? '')}</td>` : '') +
        `<td class="au-c-sev">${sevChip(f.severity)}${escapeHtml(f.severity)}</span></td>` +
        `<td class="au-finding"><span class="au-ftitle"${bp(`${p}.title`)}>${escapeHtml(f.title)}</span>${area}${ref}</td>` +
        (cols.evidence ? `<td class="au-evidence"${bp(`${p}.evidence`)}>${escapeHtml(f.evidence ?? '')}</td>` : '') +
        (cols.fix ? `<td class="au-fix"${bp(`${p}.fix`)}>${escapeHtml(f.fix ?? '')}</td>` : '') +
        (cols.owner ? `<td class="au-owner"${bp(`${p}.owner`)}>${escapeHtml(f.owner ?? '')}</td>` : '') +
        (cols.status ? `<td class="au-c-status">${status}</td>` : '') +
        `</tr>`
      );
    })
    .join('');

  const table = `<div class="au-scroll"><table class="au-table">${thead}<tbody${bl('findings')}>${rows}</tbody></table></div>`;
  return `<div class="audit">${head}${desc}${strip}${table}</div>`;
}
