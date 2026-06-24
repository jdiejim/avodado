import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { renderCallout } from '../blocks/callout.js';
import { renderErd } from '../blocks/erd.js';
import { renderFlow } from '../blocks/flow.js';
import { renderKanban } from '../blocks/kanban.js';
import { renderSequence } from '../blocks/sequence.js';
import { renderTable } from '../blocks/table.js';
import { renderTimeline } from '../blocks/timeline.js';
import { renderTracker } from '../blocks/tracker.js';
import { renderUserStory } from '../blocks/userstory.js';
import { renderCover } from '../blocks/meta.js';

describe('block renderers — DOM signatures', () => {
  it('callout sets a tone class (note/tip/warn/danger)', () => {
    const html = renderCallout({ tone: 'warn', title: 'T', body: 'B' });
    const root = parse(html);
    const callout = root.querySelector('.callout');
    expect(callout?.classNames).toContain('warn');
    expect(root.querySelector('.callout-title')?.text).toBe('T');
    expect(root.querySelector('.callout-body')?.text).toBe('B');
  });

  it('callout falls back to tone label when title is absent', () => {
    const html = renderCallout({ tone: 'tip' });
    const root = parse(html);
    expect(root.querySelector('.callout-title')?.text).toBe('Tip');
  });

  it('callout defaults to note tone', () => {
    const html = renderCallout({});
    const root = parse(html);
    expect(root.querySelector('.callout')?.classNames).toContain('note');
  });

  it('table emits a pres-table with header + body rows', () => {
    const html = renderTable({
      columns: ['A', 'B'],
      rows: [
        ['1', '2'],
        ['3', '4'],
      ],
    });
    const root = parse(html);
    expect(root.querySelector('table.pres-table')).toBeTruthy();
    expect(root.querySelectorAll('thead th')).toHaveLength(2);
    expect(root.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(root.querySelectorAll('tbody td')).toHaveLength(4);
  });

  it('table cell with tone gets the cell-pos / cell-neg class', () => {
    const html = renderTable({
      columns: ['Result'],
      rows: [[{ v: 'pass', tone: 'pos' }], [{ v: 'fail', tone: 'neg' }]],
    });
    const root = parse(html);
    const cells = root.querySelectorAll('tbody td');
    expect(cells[0]?.classNames).toContain('cell-pos');
    expect(cells[1]?.classNames).toContain('cell-neg');
  });

  it('table column with align=r highlights right-aligned columns', () => {
    const html = renderTable({
      columns: [{ label: 'Name' }, { label: 'Count', align: 'r' }],
      rows: [['x', 1]],
    });
    const root = parse(html);
    const ths = root.querySelectorAll('thead th');
    expect(ths[1]?.classNames).toContain('r');
    const tds = root.querySelectorAll('tbody td');
    expect(tds[1]?.classNames).toContain('r');
  });

  it('sequence emits lane heads + lifelines + message lines', () => {
    const html = renderSequence({
      actors: [
        { id: 'C', name: 'Client' },
        { id: 'S', name: 'Server' },
      ],
      messages: [{ from: 'C', to: 'S', label: 'ping', kind: 'sync' }],
    });
    const root = parse(html);
    expect(root.querySelectorAll('.lane-head').length).toBeGreaterThanOrEqual(2);
    expect(root.querySelectorAll('.lane-head-text').length).toBe(2);
    expect(root.querySelectorAll('.lifeline').length).toBe(2);
    expect(root.querySelectorAll('.msg-line').length).toBe(1);
    expect(root.querySelector('title')?.text).toContain('Sequence');
  });

  it('sequence external actor gets the .ext modifier', () => {
    const html = renderSequence({
      actors: [
        { id: 'U', name: 'User', external: true },
        { id: 'S', name: 'Server' },
      ],
      messages: [],
    });
    const root = parse(html);
    const heads = root.querySelectorAll('.lane-head');
    expect(heads[0]?.classNames).toContain('ext');
  });

  it('sequence self-message renders a step badge', () => {
    const html = renderSequence({
      actors: [{ id: 'A', name: 'A' }],
      messages: [{ from: 'A', to: 'A', label: 'self' }],
    });
    const root = parse(html);
    expect(root.querySelector('.step-badge')).toBeTruthy();
  });

  it('erd emits entity boxes, PK/FK markers, relation paths', () => {
    const html = renderErd({
      entities: [
        {
          name: 'orders',
          columns: [
            { name: 'id', type: 'uuid', pk: true },
            { name: 'user_id', type: 'uuid', fk: true },
          ],
        },
        { name: 'items', columns: [{ name: 'id', type: 'uuid', pk: true }] },
      ],
      relations: [{ from: 'orders', to: 'items', card: '1:N' }],
    });
    const root = parse(html);
    const svg = root.querySelector('svg');
    const pkLabels = svg?.querySelectorAll('.er-key').filter((n) => !n.classNames.includes('fk'));
    const fkLabels = svg?.querySelectorAll('.er-key.fk');
    expect(pkLabels?.length).toBeGreaterThanOrEqual(2);
    expect(fkLabels?.length).toBe(1);
    expect(root.querySelectorAll('.er-head-text').length).toBe(2);
  });

  it('flow auto-lays-out when nodes omit col/row', () => {
    // No coordinates anywhere — dagre should place all four nodes.
    const html = renderFlow({
      nodes: [
        { id: 'a', label: 'Start', kind: 'start' },
        { id: 'b', label: 'Work' },
        { id: 'c', label: 'Check', kind: 'decision' },
        { id: 'd', label: 'End', kind: 'end' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'd' },
      ],
    });
    const root = parse(html);
    // every node label is rendered
    expect(root.querySelectorAll('.fc-label').length).toBeGreaterThanOrEqual(4);
    // a real viewBox was computed (not the 1x1 fallback)
    const vb = root.querySelector('svg')?.getAttribute('viewBox') ?? '';
    const [, , w, h] = vb.split(' ').map(Number);
    expect(w).toBeGreaterThan(100);
    expect(h).toBeGreaterThan(100);
  });

  it('userstory renders statement, chips, criteria, links', () => {
    const html = renderUserStory({
      role: 'shopper',
      want: 'pay quickly',
      soThat: 'I complete checkout',
      priority: 'High',
      points: 3,
      criteria: [{ given: 'g', when: 'w', then: 't' }],
      links: [{ mode: 'sequence', label: 'Flow' }],
    });
    const root = parse(html);
    expect(root.querySelector('.story-stmt')?.text).toContain('shopper');
    expect(root.querySelectorAll('.story-chip')).toHaveLength(2);
    expect(root.querySelector('.ac-item .gwt')).toBeTruthy();
    expect(root.querySelector('.link-chip')?.text).toContain('Flow');
  });

  it('userstory falls back to defaults for missing role/want/soThat', () => {
    const html = renderUserStory({});
    const root = parse(html);
    expect(root.querySelector('.story-stmt')?.text).toContain('user');
  });

  it('timeline assigns status class to each dot', () => {
    const html = renderTimeline({
      items: [
        { label: 'a', status: 'done' },
        { label: 'b', status: 'current' },
        { label: 'c', status: 'next' },
        { label: 'd', status: 'future' },
        { label: 'e' },
      ],
    });
    const root = parse(html);
    const dots = root.querySelectorAll('.tl-dot');
    expect(dots[0]?.classNames).toContain('done');
    expect(dots[1]?.classNames).toContain('current');
    expect(dots[2]?.classNames).toContain('next');
    expect(dots[3]?.classNames).toContain('future');
    expect(dots[4]?.classNames).toContain('future');
    const labels = root.querySelectorAll('.tl-label');
    expect(labels[0]?.text).toBe('a');
  });

  it('kanban renders one column per spec.columns entry', () => {
    const html = renderKanban({
      columns: [
        { label: 'Backlog', cards: [{ title: 'A' }, { title: 'B', tag: 'urgent' }] },
        { label: 'Doing', cards: [] },
        { label: 'Done', cards: [{ title: 'C' }] },
      ],
    });
    const root = parse(html);
    const heads = root.querySelectorAll('.kan-head');
    expect(heads.map((h) => h.text)).toEqual(['Backlog', 'Doing', 'Done']);
    expect(root.querySelectorAll('.kan-card')).toHaveLength(3);
    expect(root.querySelector('.kan-card-tag')?.text).toBe('urgent');
  });

  it('tracker pills carry status class; done rows get tr.done; priority + owner + due render', () => {
    const html = renderTracker({
      items: [
        {
          task: 'finished thing',
          status: 'done',
          priority: 'high',
          owner: 'alice',
          due: '2026-01-01',
        },
        { task: 'todo thing', owner: 'bob' },
      ],
    });
    const root = parse(html);
    const rows = root.querySelectorAll('tbody tr');
    expect(rows[0]?.classNames).toContain('done');
    expect(rows[0]?.querySelector('.st.done')).toBeTruthy();
    expect(rows[0]?.querySelector('.pri.high')).toBeTruthy();
    expect(rows[1]?.querySelector('.st.todo')).toBeTruthy();
    // owner + due columns appear because at least one item carries them
    const heads = root.querySelectorAll('thead th');
    const headLabels = heads.map((h) => h.text);
    expect(headLabels).toContain('Owner');
    expect(headLabels).toContain('Due');
  });

  it('cover renders title, tag, and optional subtitle', () => {
    const html = renderCover({ title: 'Hello', subtitle: 'Sub', tag: 'TAG' });
    const root = parse(html);
    expect(root.querySelector('.cover-title')?.text).toBe('Hello');
    expect(root.querySelector('.cover-sub')?.text).toBe('Sub');
    expect(root.querySelector('.cover-meta .accent')?.text).toBe('TAG');
  });

  it('cover falls back to "Untitled" with no meta', () => {
    const html = renderCover(undefined);
    const root = parse(html);
    expect(root.querySelector('.cover-title')?.text).toBe('Untitled');
    expect(root.querySelector('.cover-sub')).toBeFalsy();
  });
});
