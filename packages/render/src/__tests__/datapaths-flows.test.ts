/**
 * Direct-edit path tagging, second wave: flows & state, design system,
 * algorithms, and agentic renderers emit `data-bp` (one addressable YAML
 * value/item) and `data-bl` (array container) attributes whose paths match
 * the block's schema field names. The attributes are inert metadata — these
 * tests pin the contract the studio's direct-edit layer navigates by.
 */

import { describe, expect, it } from 'vitest';
import { renderAgentloop } from '../blocks/agentloop.js';
import { renderArray } from '../blocks/array.js';
import { renderBintree } from '../blocks/bintree.js';
import { renderContext } from '../blocks/context.js';
import { renderDfd } from '../blocks/dfd.js';
import { renderDodont } from '../blocks/dodont.js';
import { renderGallery } from '../blocks/gallery.js';
import { renderHashmap } from '../blocks/hashmap.js';
import { renderLinkedlist } from '../blocks/linkedlist.js';
import { renderPalette } from '../blocks/palette.js';
import { renderPrompt } from '../blocks/prompt.js';
import { renderState } from '../blocks/state.js';
import { renderSwimlane } from '../blocks/swimlane.js';
import { renderTrace } from '../blocks/trace.js';
import { renderTypescale } from '../blocks/typescale.js';

describe('data-path tagging (direct edit, second wave)', () => {
  it('state tags state groups, transitions, and the transition table with the same paths', () => {
    const html = renderState({
      states: [
        { id: 'a', name: 'Draft', col: 1, row: 1 },
        { id: 'b', name: 'Live', kind: 'wait', col: 2, row: 1 },
      ],
      transitions: [{ from: 'a', to: 'b', event: 'publish', guard: '[valid]' }],
    });
    expect(html).toContain('<g data-bl="states">');
    expect(html).toContain('data-bp="states.0"');
    expect(html).toContain('data-bp="states.1.name"');
    expect(html).toContain('data-bp="transitions.0"');
    // The transition table reuses the same transitions.N paths (dual representation).
    expect(html).toContain('<tbody data-bl="transitions">');
    expect(html).toContain('<tr data-bp="transitions.0">');
    expect(html).toContain('data-bp="transitions.0.event"');
    expect(html).toContain('data-bp="transitions.0.guard"');
  });

  it('dfd tags node groups, name/num fields, edges, and the nodes container', () => {
    const html = renderDfd({
      nodes: [
        { id: 'u', name: 'User', kind: 'external', col: 1, row: 1 },
        { id: 'p', name: 'Process', num: '1.0', col: 2, row: 1 },
      ],
      edges: [{ from: 'u', to: 'p', label: 'request' }],
    });
    expect(html).toContain('<g data-bl="nodes">');
    expect(html).toContain('data-bp="nodes.0"');
    expect(html).toContain('data-bp="nodes.1.name"');
    expect(html).toContain('data-bp="nodes.1.num"');
    expect(html).toContain('data-bp="edges.0"');
  });

  it('swimlane tags lanes, steps, links, and both list containers', () => {
    const html = renderSwimlane({
      lanes: [{ label: 'Customer' }, { label: 'Backend' }],
      steps: [
        { id: 's1', col: 1, lane: 0, label: 'Order' },
        { id: 's2', col: 2, lane: 1, label: 'Charge', kind: 'decision' },
      ],
      links: [{ from: 's1', to: 's2', label: 'submit' }],
    });
    expect(html).toContain('<g data-bl="lanes">');
    expect(html).toContain('data-bp="lanes.1"');
    expect(html).toContain('<g data-bl="steps">');
    expect(html).toContain('data-bp="steps.0"');
    expect(html).toContain('data-bp="steps.1"');
    expect(html).toContain('data-bp="links.0"');
  });

  it('palette tags swatch cards, value/name/usage, and the colors container', () => {
    const html = renderPalette({
      colors: [
        { name: 'Navy', value: '#0e54a1', usage: 'Primary actions' },
        { name: 'Amber', value: '#f7952c' },
      ],
    });
    expect(html).toContain('data-bl="colors"');
    expect(html).toContain('data-bp="colors.0"');
    expect(html).toContain('data-bp="colors.0.value"');
    expect(html).toContain('data-bp="colors.1.name"');
    expect(html).toContain('data-bp="colors.0.usage"');
  });

  it('typescale tags rows, name/note, the shared sample, and the items container', () => {
    const html = renderTypescale({
      sample: 'Grumpy wizards',
      items: [
        { name: 'Display', size: 40, note: 'Hero only' },
        { name: 'Body', size: 15 },
      ],
    });
    expect(html).toContain('data-bl="items"');
    expect(html).toContain('data-bp="items.0"');
    expect(html).toContain('data-bp="items.1.name"');
    expect(html).toContain('data-bp="items.0.note"');
    expect(html).toContain('data-bp="sample"');
  });

  it('dodont tags items and text/example under both dos and donts containers', () => {
    const html = renderDodont({
      dos: [{ text: 'Use sentence case', example: 'Save changes' }],
      donts: [{ text: 'Shout', example: 'SAVE CHANGES' }],
    });
    expect(html).toContain('data-bl="dos"');
    expect(html).toContain('data-bl="donts"');
    expect(html).toContain('data-bp="dos.0"');
    expect(html).toContain('data-bp="dos.0.text"');
    expect(html).toContain('data-bp="donts.0.example"');
  });

  it('array tags cells, values, pointer labels, the window, and the items container', () => {
    const html = renderArray({
      items: [{ value: '3' }, { value: '7', tone: 'active', label: 'mid' }, { value: '9' }],
      window: { from: 0, to: 1, label: 'search' },
    });
    expect(html).toContain('<g data-bl="items">');
    expect(html).toContain('<g data-bp="items.0">');
    expect(html).toContain('data-bp="items.1.value"');
    expect(html).toContain('data-bp="items.1.label"');
    expect(html).toContain('data-bp="window"');
    expect(html).toContain('data-bp="window.label"');
  });

  it('array unknown tone degrades to the neutral style instead of throwing', () => {
    // Invalid per schema (validate reports E_SCHEMA), but render is lenient.
    const html = renderArray({
      items: [{ value: '3', tone: 'highlighted' as 'active' }, { value: '7' }],
    });
    expect(html).toContain('data-bp="items.0"');
  });

  it('trace unknown role degrades to an uppercased chip instead of "undefined"', () => {
    const html = renderTrace({
      turns: [{ role: 'observer' as 'user', text: 'hi' }],
    });
    expect(html).toContain('OBSERVER');
    expect(html).not.toContain('undefined');
  });

  it('linkedlist tags node groups, values, marker labels, and the nodes container', () => {
    const html = renderLinkedlist({
      nodes: [{ value: '1', label: 'head' }, { value: '2' }],
    });
    expect(html).toContain('<g data-bl="nodes">');
    expect(html).toContain('data-bp="nodes.0"');
    expect(html).toContain('data-bp="nodes.1.value"');
    expect(html).toContain('data-bp="nodes.0.label"');
  });

  it('bintree tags node groups, values, and the nodes container', () => {
    const html = renderBintree({
      nodes: [
        { id: 'r', value: '8' },
        { id: 'l', value: '3', parent: 'r', side: 'left' },
        { id: 'x', value: '10', parent: 'r', side: 'right' },
      ],
    });
    expect(html).toContain('<g data-bl="nodes">');
    expect(html).toContain('data-bp="nodes.0"');
    expect(html).toContain('data-bp="nodes.2"');
    expect(html).toContain('data-bp="nodes.1.value"');
  });

  it('hashmap tags entry pills by source index and the entries container', () => {
    const html = renderHashmap({
      buckets: 4,
      entries: [
        { key: 'a', value: '1', bucket: 0 },
        { key: 'e', value: '5', bucket: 0 }, // chained collision
        { key: 'b', value: '2', bucket: 3 },
      ],
    });
    expect(html).toContain('<g data-bl="entries">');
    expect(html).toContain('<g data-bp="entries.0">');
    expect(html).toContain('<g data-bp="entries.1">');
    expect(html).toContain('<g data-bp="entries.2">');
  });

  it('agentloop tags agent fields, env/stop scalars, tools, and memory', () => {
    const html = renderAgentloop({
      agent: { name: 'Support bot', model: 'fable-5' },
      tools: [
        { name: 'search', desc: 'Query the KB' },
        { name: 'ticket', desc: 'File a ticket' },
      ],
      memory: ['user prefs'],
      env: 'Customer',
      stop: 'ticket filed',
    });
    expect(html).toContain('data-bp="agent.name"');
    expect(html).toContain('data-bp="agent.model"');
    expect(html).toContain('data-bp="env"');
    expect(html).toContain('data-bp="stop"');
    expect(html).toContain('<g data-bl="tools">');
    expect(html).toContain('<g data-bp="tools.1">');
    expect(html).toContain('data-bp="tools.0.name"');
    expect(html).toContain('<g data-bl="memory">');
    expect(html).toContain('data-bp="memory.0"');
  });

  it('trace tags turns, text/thinking/tool fields, and the turns container', () => {
    const html = renderTrace({
      turns: [
        { role: 'user', text: 'Refund order 42' },
        { role: 'assistant', thinking: 'Check the order first', text: 'Looking it up.' },
        { role: 'tool', tool: 'orders.get', args: '{"id":42}', result: '{"status":"paid"}' },
      ],
    });
    expect(html).toContain('data-bl="turns"');
    expect(html).toContain('data-bp="turns.0"');
    expect(html).toContain('data-bp="turns.0.text"');
    expect(html).toContain('data-bp="turns.1.thinking"');
    expect(html).toContain('data-bp="turns.2.tool"');
  });

  it('prompt tags segments, their label/text, vars, and both containers', () => {
    const html = renderPrompt({
      segments: [
        { kind: 'system', label: 'persona', text: 'You are terse.' },
        { kind: 'user', text: 'Summarize {{doc}}' },
      ],
      vars: [{ name: 'doc', desc: 'The source document' }],
    });
    expect(html).toContain('data-bl="segments"');
    expect(html).toContain('data-bp="segments.0"');
    expect(html).toContain('data-bp="segments.0.label"');
    expect(html).toContain('data-bp="segments.1.text"');
    expect(html).toContain('data-bl="vars"');
    expect(html).toContain('data-bp="vars.0"');
    expect(html).toContain('data-bp="vars.0.desc"');
  });

  it('context tags bar segments and legend rows with source-index paths', () => {
    const html = renderContext({
      window: 200,
      segments: [
        { label: 'system', tokens: 40 },
        { label: 'skipped', tokens: 0 }, // filtered out of the bar, index still reserved
        { label: 'history', tokens: 120, desc: 'prior turns' },
      ],
    });
    expect(html).toContain('<g data-bl="segments">');
    expect(html).toContain('data-bp="segments.0"');
    expect(html).toContain('data-bp="segments.2"'); // source index survives the zero-token filter
    expect(html).not.toContain('data-bp="segments.1"');
    // Legend rows reuse the same segments.N paths (dual representation).
    expect(html).toContain('<div class="ctx-legend" data-bl="segments">');
    expect(html).toContain('data-bp="segments.2.label"');
    expect(html).toContain('data-bp="segments.2.tokens"');
    expect(html).toContain('data-bp="segments.2.desc"');
    expect(html).toContain('data-bp="window"');
  });

  it('gallery tags cells, title/caption/code fields, and the items container', () => {
    const html = renderGallery({
      items: [
        { title: 'Note', caption: 'Plain cell' },
        { title: 'Snippet', lang: 'ts', code: 'const x = 1;' },
      ],
    });
    expect(html).toContain('data-bl="items"');
    expect(html).toContain('data-bp="items.0"');
    expect(html).toContain('data-bp="items.0.title"');
    expect(html).toContain('data-bp="items.0.caption"');
    expect(html).toContain('data-bp="items.1.code"');
  });
});
