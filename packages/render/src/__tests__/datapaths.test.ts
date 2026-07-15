/**
 * Direct-edit path tagging: each first-wave renderer emits `data-bp` (one
 * addressable YAML value/item) and `data-bl` (array container) attributes
 * whose paths match the block's schema field names. The attributes are inert
 * metadata — these tests pin the contract the studio's direct-edit layer
 * navigates by.
 */

import { describe, expect, it } from 'vitest';
import { renderC4 } from '../blocks/c4.js';
import { renderCallout } from '../blocks/callout.js';
import { renderErd } from '../blocks/erd.js';
import { renderFlow } from '../blocks/flow.js';
import { renderKanban } from '../blocks/kanban.js';
import { renderSequence } from '../blocks/sequence.js';
import { renderStats } from '../blocks/stats.js';
import { renderTable } from '../blocks/table.js';
import { renderTimeline } from '../blocks/timeline.js';
import { renderUserStory } from '../blocks/userstory.js';

describe('data-path tagging (direct edit)', () => {
  it('sequence tags actors, messages, step-list items, and foot pills', () => {
    const html = renderSequence({
      actors: [
        { id: 'client', name: 'Client' },
        { id: 'api', name: 'API' },
      ],
      messages: [
        { from: 'client', to: 'api', label: 'GET /x', summary: 'Fetch X' },
        { from: 'api', to: 'client', label: '200 OK', kind: 'response' },
        { from: 'api', to: 'api', label: 'validate', kind: 'note' },
      ],
      foot: [{ label: 'Auth', value: 'Bearer' }],
    });
    expect(html).toContain('<g data-bl="actors">');
    expect(html).toContain('<g data-bp="actors.0">');
    expect(html).toContain('<g data-bp="actors.1">');
    expect(html).toContain('<g data-bl="messages">');
    expect(html).toContain('<g data-bp="messages.0">');
    expect(html).toContain('<g data-bp="messages.2">'); // the note row
    expect(html).toContain('<li data-bp="messages.0">'); // step list reuses message paths
    expect(html).toContain('data-bl="foot"');
    expect(html).toContain('<span data-bp="foot.0">');
  });

  it('table tags header cells, rows, cells, and the rows container', () => {
    const html = renderTable({
      columns: ['A', { label: 'B', align: 'r' }],
      rows: [
        ['a1', 1],
        ['a2', { v: 2, tone: 'pos' }],
      ],
      note: 'n',
    });
    expect(html).toContain('data-bp="columns.0"');
    expect(html).toContain('data-bp="columns.1"');
    expect(html).toContain('<tbody data-bl="rows">');
    expect(html).toContain('<tr data-bp="rows.1">');
    expect(html).toContain('data-bp="rows.0.0"');
    expect(html).toContain('data-bp="rows.1.1"');
    expect(html).toContain('data-bp="note"');
  });

  it('erd tags entity boxes, column rows, and both list containers', () => {
    const html = renderErd({
      entities: [
        { name: 'users', columns: [{ name: 'id', type: 'uuid', pk: true }, { name: 'email' }] },
        { name: 'orders', columns: [{ name: 'id', pk: true }, { name: 'user_id', fk: true }] },
      ],
      relations: [{ from: 'orders', to: 'users', card: 'N:1' }],
    });
    expect(html).toContain('<g data-bl="entities">');
    expect(html).toContain('data-bp="entities.0"');
    expect(html).toContain('data-bp="entities.1"');
    expect(html).toContain('<g data-bl="entities.0.columns">');
    expect(html).toContain('<g data-bp="entities.0.columns.1">');
    expect(html).toContain('<g data-bp="entities.1.columns.0">');
  });

  it('callout tags title and body', () => {
    const html = renderCallout({ tone: 'tip', title: 'T', body: 'B' });
    expect(html).toContain('<div class="callout-title" data-bp="title">');
    expect(html).toContain('<div class="callout-body" data-bp="body">');
  });

  it('stats tags cards, value/label, and the stats container', () => {
    const html = renderStats({
      stats: [
        { value: '12k', label: 'Users' },
        { value: 99, label: 'Uptime', delta: '+1', trend: 'up' },
      ],
    });
    expect(html).toContain('<div class="stat-row" data-bl="stats">');
    expect(html).toContain('data-bp="stats.0"');
    expect(html).toContain('data-bp="stats.1.value"');
    expect(html).toContain('data-bp="stats.0.label"');
  });

  it('timeline tags items, their fields, and the items container', () => {
    const html = renderTimeline({
      items: [
        { label: 'Kickoff', date: 'Q1', status: 'done' },
        { label: 'Launch', desc: 'Ship it' },
      ],
    });
    expect(html).toContain('<div class="tl" data-bl="items">');
    expect(html).toContain('data-bp="items.0"');
    expect(html).toContain('data-bp="items.0.date"');
    expect(html).toContain('data-bp="items.1.label"');
    expect(html).toContain('data-bp="items.1.desc"');
  });

  it('kanban tags columns (item + cards container), cards, and column labels', () => {
    const html = renderKanban({
      columns: [
        { label: 'Todo', cards: [{ title: 'A' }, { title: 'B', tag: 'api' }] },
        { label: 'Done', cards: [{ title: 'C' }] },
      ],
    });
    expect(html).toContain('<div class="kanban" data-bl="columns">');
    expect(html).toContain('data-bp="columns.0" data-bl="columns.0.cards"');
    expect(html).toContain('data-bp="columns.0.cards.1"');
    expect(html).toContain('data-bp="columns.1.cards.0"');
    expect(html).toContain('data-bp="columns.1.label"');
  });

  it('flow tags node groups, edges, and the nodes container', () => {
    const html = renderFlow({
      nodes: [
        { id: 'a', label: 'Start', kind: 'start', col: 1, row: 1 },
        { id: 'b', label: 'Work', col: 1, row: 2 },
      ],
      edges: [{ from: 'a', to: 'b', label: 'go' }],
    });
    expect(html).toContain('<g data-bl="nodes">');
    expect(html).toContain('data-bp="nodes.0"');
    expect(html).toContain('data-bp="nodes.1"');
    expect(html).toContain('data-bp="edges.0"');
  });

  it('userstory tags role/want/soThat, criteria, and link chips', () => {
    const html = renderUserStory({
      title: 'Story',
      role: 'user',
      want: 'edit inline',
      soThat: 'I see changes',
      tags: ['ux'],
      criteria: [{ given: 'a doc', when: 'I click', then: 'it edits' }],
      links: [{ label: 'Spec', mode: 'doc' }],
    });
    expect(html).toContain('<b data-bp="role">');
    expect(html).toContain('<b data-bp="want">');
    expect(html).toContain('<b data-bp="soThat">');
    expect(html).toContain('data-bp="title"');
    expect(html).toContain('data-bp="tags.0"');
    expect(html).toContain('data-bp="criteria.0"');
    expect(html).toContain('data-bp="criteria.0.when"');
    expect(html).toContain('data-bl="links"');
    expect(html).toContain('data-bp="links.0"');
  });

  it('c4 tags node groups, edges, and the nodes container', () => {
    const html = renderC4({
      nodes: [
        { id: 'u', kind: 'person', name: 'User', col: 1, row: 1 },
        { id: 's', kind: 'system', name: 'System', col: 1, row: 2 },
      ],
      edges: [{ from: 'u', to: 's', label: 'Uses' }],
    });
    expect(html).toContain('<g data-bl="nodes">');
    expect(html).toContain('data-bp="nodes.0"');
    expect(html).toContain('data-bp="nodes.1"');
    expect(html).toContain('data-bp="edges.0"');
  });

  it('escapes path attribute values through the shared escaper', () => {
    // Paths are renderer-authored (no user input), but the helper still escapes.
    const html = renderCallout({ title: 'x', body: 'y' });
    expect(html).not.toContain('data-bp="title" data-bp'); // sanity: single attr per element
  });
});

describe('shared-frame data paths (v7)', () => {
  it('the diagram frame tags the block description once for all framed blocks', () => {
    const html = renderSequence({
      description: 'How checkout works.',
      actors: [{ id: 'a', name: 'A' }],
      messages: [],
    });
    expect(html).toContain('<p class="diagram-desc" data-bp="description">');
  });
});
