/**
 * Direct-edit path tagging for the planning / business card & list renderers:
 * each emits `data-bp` (one addressable YAML value/item) and `data-bl` (array
 * container) attributes whose paths match the block's schema field names. The
 * attributes are inert metadata — these tests pin the contract the studio's
 * direct-edit layer navigates by.
 */

import { describe, expect, it } from 'vitest';
import { renderAgenda } from '../blocks/agenda.js';
import { renderChangelog } from '../blocks/changelog.js';
import { renderCvt } from '../blocks/cvt.js';
import { renderDrivers } from '../blocks/drivers.js';
import { renderInventory } from '../blocks/inventory.js';
import { renderOkr } from '../blocks/okr.js';
import { renderPersona } from '../blocks/persona.js';
import { renderProsCons } from '../blocks/proscons.js';
import { renderRisk } from '../blocks/risk.js';
import { renderStatustable } from '../blocks/statustable.js';
import { renderStories } from '../blocks/stories.js';
import { renderSwot } from '../blocks/swot.js';
import { renderTeam } from '../blocks/team.js';

describe('data-path tagging (direct edit, planning blocks)', () => {
  it('statustable with legacy tracker items tags rows, cells, and the items container', () => {
    const html = renderStatustable({
      items: [
        { task: 'Ship it', status: 'doing', priority: 'high', owner: 'JJ', due: 'Fri' },
        { task: 'Review', status: 'todo' },
      ],
    });
    expect(html).toContain('<tbody data-bl="items">');
    expect(html).toContain('data-bp="items.0"');
    expect(html).toContain('data-bp="items.0.task"');
    expect(html).toContain('data-bp="items.0.owner"');
    expect(html).toContain('data-bp="items.1.status"');
  });

  it('statustable tags rows, cells, statuses, subtasks, and their containers', () => {
    const html = renderStatustable({
      description: 'Weekly roll-up.',
      columns: ['Task', 'Update'],
      statuses: [
        { label: 'on track', color: 'green' },
        { label: 'at risk', color: 'amber' },
        { label: 'blocked', color: 'red' },
        { label: 'in review', color: 'purple' },
      ],
      rows: [
        {
          cells: ['Parent', 'Update text'],
          status: 'at risk',
          subtasks: [{ cells: ['Child', 'Child update'], status: 'blocked' }],
        },
        { cells: ['Solo', 'Fine'], status: 'on track' },
      ],
    });
    expect(html).toContain('data-bl="rows"');
    expect(html).toContain('data-bp="description"');
    expect(html).toContain('data-bp="columns.1"');
    expect(html).toContain('data-bp="rows.0"');
    expect(html).toContain('data-bp="rows.0.cells.1"');
    expect(html).toContain('data-bp="rows.0.status"');
    // Each parent's <tbody> group is its subtasks' container ("+ add subtask").
    expect(html).toContain('data-bl="rows.0.subtasks"');
    expect(html).toContain('data-bl="rows.1.subtasks"');
    expect(html).toContain('data-bp="rows.0.subtasks.0"');
    expect(html).toContain('data-bp="rows.0.subtasks.0.cells.0"');
    expect(html).toContain('data-bp="rows.0.subtasks.0.status"');
    // The legend tags the vocabulary list and each label/color.
    expect(html).toContain('data-bl="statuses"');
    expect(html).toContain('data-bp="statuses.3"');
    expect(html).toContain('data-bp="statuses.3.label"');
    expect(html).toContain('data-bp="statuses.3.color"');
  });

  it('okr tags objectives, nested KRs, and both list containers', () => {
    const html = renderOkr({
      items: [
        {
          objective: 'Grow',
          owner: 'JJ',
          krs: [
            { kr: 'Ship v1', progress: 0.5, status: 'on-track' },
            { kr: 'Onboard 10', progress: 0.2 },
          ],
        },
      ],
    });
    expect(html).toContain('<div class="okr-list" data-bl="items">');
    expect(html).toContain('data-bp="items.0"');
    expect(html).toContain('data-bp="items.0.objective"');
    expect(html).toContain('data-bl="items.0.krs"');
    expect(html).toContain('data-bp="items.0.krs.1"');
    expect(html).toContain('data-bp="items.0.krs.0.kr"');
  });

  it('swot tags each quadrant as a container and its entries', () => {
    const html = renderSwot({
      strengths: ['fast', 'small'],
      weaknesses: ['young'],
      opportunities: [],
      threats: ['incumbents'],
    });
    expect(html).toContain('data-bl="strengths"');
    expect(html).toContain('data-bl="opportunities"'); // empty quadrant still a container
    expect(html).toContain('data-bp="strengths.1"');
    expect(html).toContain('data-bp="weaknesses.0"');
    expect(html).toContain('data-bp="threats.0"');
  });

  it('persona tags cards, scalar fields, and nested string lists', () => {
    const html = renderPersona({
      personas: [
        {
          name: 'Ana Dev',
          role: 'Engineer',
          quote: 'Docs rot.',
          goals: ['ship', 'learn'],
          frustrations: ['stale docs'],
          tools: ['vim'],
        },
      ],
    });
    expect(html).toContain('<div class="pa-grid" data-bl="personas">');
    expect(html).toContain('data-bp="personas.0"');
    expect(html).toContain('data-bp="personas.0.name"');
    expect(html).toContain('data-bl="personas.0.goals"');
    expect(html).toContain('data-bp="personas.0.goals.1"');
    expect(html).toContain('data-bp="personas.0.frustrations.0"');
    expect(html).toContain('data-bp="personas.0.tools.0"');
  });

  it('changelog tags releases, versions, and nested change items', () => {
    const html = renderChangelog({
      releases: [
        {
          version: '1.2.0',
          date: '2026-07-01',
          tag: 'minor',
          items: [
            { type: 'added', text: 'Direct edit' },
            { text: 'Cleanup' },
          ],
        },
      ],
    });
    expect(html).toContain('<div class="cg-rail" data-bl="releases">');
    expect(html).toContain('data-bp="releases.0"');
    expect(html).toContain('data-bp="releases.0.version"');
    expect(html).toContain('data-bl="releases.0.items"');
    expect(html).toContain('data-bp="releases.0.items.1"');
    expect(html).toContain('data-bp="releases.0.items.0.text"');
  });

  it('team tags member cards, names, and the members container', () => {
    const html = renderTeam({
      members: [
        { name: 'Ana Dev', role: 'Eng', focus: 'Render' },
        { name: 'Bo Ops' },
      ],
    });
    expect(html).toContain('<div class="tem-grid" data-bl="members">');
    expect(html).toContain('data-bp="members.0"');
    expect(html).toContain('data-bp="members.0.role"');
    expect(html).toContain('data-bp="members.1.name"');
  });

  it('risk tags row-cards, risk text, and the items container', () => {
    const html = renderRisk({
      items: [
        { risk: 'Scope creep', likelihood: 'high', impact: 'med', mitigation: 'Freeze', owner: 'JJ', status: 'open' },
        { risk: 'Churn', likelihood: 'low', impact: 'low' },
      ],
    });
    expect(html).toContain('<div class="rk-list" data-bl="items">');
    expect(html).toContain('data-bp="items.0"');
    expect(html).toContain('data-bp="items.0.risk"');
    expect(html).toContain('data-bp="items.0.mitigation"');
    expect(html).toContain('data-bp="items.1.risk"');
  });

  it('agenda tags rows, times, titles, and the items container', () => {
    const html = renderAgenda({
      items: [
        { time: '09:00', duration: '30m', title: 'Standup', owner: 'JJ', desc: 'Sync' },
        { title: 'Retro' },
      ],
    });
    expect(html).toContain('<div class="agenda" data-bl="items">');
    expect(html).toContain('data-bp="items.0"');
    expect(html).toContain('data-bp="items.0.time"');
    expect(html).toContain('<span data-bp="items.1.title">');
    expect(html).toContain('data-bp="items.0.owner"');
  });

  it('stories tags story items, narrative fields, criteria, and links', () => {
    const html = renderStories({
      items: [
        {
          id: 'S-1',
          title: 'Inline edit',
          role: 'a writer',
          want: 'to edit blocks in place',
          soThat: 'docs stay fresh',
          criteria: [{ given: 'a doc', when: 'I click', then: 'it edits' }],
          links: [{ label: 'Spec' }],
        },
        { want: 'a fallback heading' },
      ],
    });
    expect(html).toContain('<div class="st-list" data-bl="items">');
    expect(html).toContain('data-bp="items.0"');
    expect(html).toContain('data-bp="items.0.title"'); // summary heading shows title
    expect(html).toContain('data-bp="items.1.want"'); // fallback heading tracks want
    expect(html).toContain('data-bp="items.0.role"');
    expect(html).toContain('data-bl="items.0.criteria"');
    expect(html).toContain('data-bp="items.0.criteria.0"');
    expect(html).toContain('data-bl="items.0.links"');
    expect(html).toContain('data-bp="items.0.links.0"');
  });

  it('drivers tags cards, titles, and the items container', () => {
    const html = renderDrivers({
      items: [
        { title: 'Latency', body: 'Must be fast', tag: 'perf' },
        { title: 'Trust' },
      ],
    });
    expect(html).toContain('<div class="dv-grid" data-bl="items">');
    expect(html).toContain('data-bp="items.0"');
    expect(html).toContain('data-bp="items.0.title"');
    expect(html).toContain('data-bp="items.0.body"');
    expect(html).toContain('data-bp="items.1.title"');
  });

  it('cvt tags both panels (object + list container), labels, and entries', () => {
    const html = renderCvt({
      current: { label: 'Now', items: ['manual docs'] },
      target: { items: ['live docs', 'inline edit'] },
      note: 'Q3',
    });
    expect(html).toContain('data-bp="current" data-bl="current.items"');
    expect(html).toContain('data-bp="target" data-bl="target.items"');
    expect(html).toContain('data-bp="current.label"');
    expect(html).toContain('data-bp="current.items.0"');
    expect(html).toContain('data-bp="target.items.1"');
    expect(html).toContain('data-bp="note"');
  });

  it('proscons tags both columns, their labels, and entries', () => {
    const html = renderProsCons({
      prosLabel: 'For',
      pros: ['simple', 'fast'],
      cons: ['new'],
    });
    expect(html).toContain('data-bl="pros"');
    expect(html).toContain('data-bl="cons"');
    expect(html).toContain('data-bp="prosLabel"');
    expect(html).toContain('data-bp="consLabel"'); // default label still addressable
    expect(html).toContain('data-bp="pros.1"');
    expect(html).toContain('data-bp="cons.0"');
  });

  it('inventory tags rows, names, statuses, and the items container', () => {
    const html = renderInventory({
      items: [
        { name: 'Renderer', status: 'stable', tag: 'core', note: 'v1' },
        { name: 'Studio', status: 'beta' },
      ],
    });
    expect(html).toContain('<div class="inv-list" data-bl="items">');
    expect(html).toContain('data-bp="items.0"');
    expect(html).toContain('data-bp="items.0.name"');
    expect(html).toContain('data-bp="items.1.status"');
    expect(html).toContain('data-bp="items.0.note"');
  });
});
