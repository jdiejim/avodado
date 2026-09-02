/**
 * Sequence frames, activation bars, self-loops and note boxes — geometry
 * pinned against the row model (message 42 · frame open 30 · else 26 ·
 * end 16 · note 42 + 13/extra line; lanes at x = 108, 334, 560).
 */

import { describe, expect, it } from 'vitest';
import { parse } from 'node-html-parser';
import { renderSequence } from '../blocks/sequence.js';

const ACTORS = [
  { id: 'A', name: 'A' },
  { id: 'B', name: 'B' },
  { id: 'C', name: 'C' },
];

type Msgs = NonNullable<Parameters<typeof renderSequence>[0]['messages']>;

function rects(html: string, cls: string): Array<{ x: number; y: number; w: number; h: number }> {
  const root = parse(html);
  return root.querySelectorAll(`rect.${cls}`).map((r) => ({
    x: Number(r.getAttribute('x')),
    y: Number(r.getAttribute('y')),
    w: Number(r.getAttribute('width')),
    h: Number(r.getAttribute('height')),
  }));
}

function lineYs(html: string): number[] {
  return parse(html)
    .querySelectorAll('line.msg-line')
    .map((l) => Number(l.getAttribute('y1')));
}

describe('sequence frames', () => {
  const messages: Msgs = [
    { from: 'A', to: 'B', label: 'call', activate: true }, // y 92
    { frame: 'alt', label: 'ok' }, // top edge 106
    { from: 'B', to: 'C', label: 'q', activate: true }, // y 164
    { from: 'C', to: 'B', label: 'r', kind: 'response', deactivate: true }, // y 206
    { else: 'fail' }, // divider 214
    { from: 'B', to: 'A', label: 'err', kind: 'error', deactivate: true }, // y 274
    { end: true }, // bottom edge 284
  ];
  const html = renderSequence({ actors: ACTORS, messages });

  it('rows take their own heights; message numbers skip the markers', () => {
    expect(lineYs(html)).toEqual([92, 164, 206, 274]);
    const badges = parse(html).querySelectorAll('.step-badge-text').map((t) => t.text);
    expect(badges).toEqual(['1', '2', '3', '4']);
  });

  it('the frame spans the lifelines its messages touch (± 18) from the open row to the end row', () => {
    const [frame] = rects(html, 'seq-frame');
    // A (108) … C (560): 90 … 578; open edge 106, end edge 284.
    expect(frame).toEqual({ x: 90, y: 106, w: 488, h: 178 });
  });

  it('draws the tab, the guard, and a dashed else divider with its guard', () => {
    const root = parse(html);
    expect(root.querySelector('.seq-frame-tab-text')?.text).toBe('ALT');
    const guards = root.querySelectorAll('.seq-frame-guard').map((g) => g.text);
    expect(guards).toEqual(['[ok]', '[fail]']);
    const div = root.querySelector('line.seq-frame-else');
    expect(div?.getAttribute('x1')).toBe('90');
    expect(div?.getAttribute('x2')).toBe('578');
    expect(div?.getAttribute('y1')).toBe('214');
  });

  it('frame bodies are drawn before the lifelines, tabs after', () => {
    const body = html.indexOf('class="seq-frame"');
    const lifeline = html.indexOf('class="lifeline"');
    const tab = html.indexOf('class="seq-frame-tab"');
    const msgs = html.indexOf('data-bl="messages"');
    expect(body).toBeLessThan(lifeline);
    expect(lifeline).toBeLessThan(tab);
    expect(tab).toBeLessThan(msgs);
  });

  it('explicit activation opens on `to` at the message row and closes on `from` at the deactivate row', () => {
    const bars = rects(html, 'activation');
    // B: opened at 92 (call), closed at 274 (err) — padded 6 each side.
    expect(bars).toContainEqual({ x: 330, y: 86, w: 8, h: 194 });
    // C: opened at 164 (q), closed at 206 (r).
    expect(bars).toContainEqual({ x: 556, y: 158, w: 8, h: 54 });
    expect(bars).toHaveLength(2);
  });

  it('frame markers carry data paths and the step list mirrors the frame', () => {
    const withSummaries = renderSequence({
      actors: ACTORS,
      messages: messages.map((m) => ('from' in m ? { ...m, summary: `step ${m.label}` } : m)),
    });
    const root = parse(withSummaries);
    expect(withSummaries).toContain('<g data-bp="messages.1">');
    expect(withSummaries).toContain('<g data-bp="messages.4">');
    const lis = root.querySelectorAll('.seq-steps li');
    expect(lis.map((li) => li.classNames)).toEqual(['', 'step-frame', '', '', 'step-frame else', 'err']);
    expect(lis[1]?.text).toBe('ALTok');
    expect(lis[4]?.text).toBe('elsefail');
    expect(lis.map((li) => li.querySelector('.step-n')?.text ?? '')).toEqual(['1', '', '2', '3', '', '4']);
  });
});

describe('nested and unclosed frames', () => {
  it('a nested frame is inset 12px inside its parent and the parent grows around it', () => {
    const html = renderSequence({
      actors: ACTORS,
      messages: [
        { from: 'A', to: 'B', label: 'a' }, // 92
        { frame: 'alt', label: 'outer' }, // 106
        { frame: 'loop', label: 'inner' }, // 136
        { from: 'B', to: 'C', label: 'b' }, // 194
        { end: true }, // 204
        { from: 'A', to: 'B', label: 'c' }, // 252
        { end: true }, // 262
      ],
    });
    const [outer, inner] = rects(html, 'seq-frame');
    expect(inner).toEqual({ x: 316, y: 136, w: 262, h: 68 });
    // Outer: A…C padded = 90…578, then the inner's right edge + 12 = 590.
    expect(outer).toEqual({ x: 90, y: 106, w: 500, h: 156 });
    if (outer === undefined || inner === undefined) throw new Error('two frames expected');
    expect(inner.x).toBeGreaterThanOrEqual(outer.x + 12);
    expect(inner.x + inner.w).toBeLessThanOrEqual(outer.x + outer.w - 12);
  });

  it('an unclosed frame runs to the last row; a stray else/end draws nothing', () => {
    const html = renderSequence({
      actors: ACTORS,
      messages: [
        { end: true }, // stray: draws nothing, still a 16px row
        { else: 'stray' }, // stray: 26px row
        { frame: 'opt', label: 'open' }, // top 92 + 14 = 106
        { from: 'A', to: 'B', label: 'x' }, // 164
      ],
    });
    const frames = rects(html, 'seq-frame');
    expect(frames).toHaveLength(1);
    // Last row ends at cursor 164; bottom edge = cursor + 6.
    expect(frames[0]).toEqual({ x: 90, y: 106, w: 262, h: 64 });
    expect(parse(html).querySelectorAll('.seq-frame-else')).toHaveLength(0);
  });
});

describe('auto activation', () => {
  it('a bar opens on an incoming sync call and closes at the reply to the caller; reply-only actors get none', () => {
    const html = renderSequence({
      actors: ACTORS,
      messages: [
        { from: 'A', to: 'B', label: 'call' }, // 92
        { from: 'B', to: 'C', label: 'q' }, // 134
        { from: 'C', to: 'B', label: 'r', kind: 'response' }, // 176
        { from: 'B', to: 'A', label: 'done', kind: 'response' }, // 218
      ],
    });
    const bars = rects(html, 'activation');
    expect(bars).toEqual([
      { x: 330, y: 86, w: 8, h: 138 },
      { x: 556, y: 128, w: 8, h: 54 },
    ]);
  });

  it('with no reply, the bar closes at the actor\'s last outgoing message; the first actor can have a bar', () => {
    const html = renderSequence({
      actors: ACTORS,
      messages: [
        { from: 'B', to: 'A', label: 'notify', kind: 'async' }, // 92 → bar on A
        { from: 'A', to: 'C', label: 'forward' }, // 134 → A's last outgoing; bar on C
        { from: 'A', to: 'B', label: 'ack', kind: 'response' }, // 176 → closes A
      ],
    });
    const bars = rects(html, 'activation');
    expect(bars).toContainEqual({ x: 104, y: 86, w: 8, h: 96 });
    // C never replies or sends: the bar just marks the receipt.
    expect(bars).toContainEqual({ x: 556, y: 128, w: 8, h: 12 });
  });

  it('a frame-less list renders the same rows as before', () => {
    const html = renderSequence({
      actors: ACTORS,
      messages: [
        { from: 'A', to: 'B', label: 'one' },
        { from: 'B', to: 'C', label: 'two' },
        { from: 'C', to: 'A', label: 'three', kind: 'response' },
      ],
    });
    expect(lineYs(html)).toEqual([92, 134, 176]);
    // 92 + 3 × 42 + 12 = 230 bottom, + 6 — the pre-frames geometry.
    expect(html).toContain('viewBox="0 0 668 236"');
    expect(html).toContain('<g data-bp="messages.0">');
    expect(html).toContain('<g data-bp="messages.2">');
  });
});

describe('self-messages and notes', () => {
  it('a self-message is a loop path out 28 and down 14 with an arrowhead, its label to the right', () => {
    const html = renderSequence({ actors: ACTORS, messages: [{ from: 'B', to: 'B', label: 'tick' }] });
    const root = parse(html);
    const path = root.querySelector('path.msg-line');
    expect(path?.getAttribute('d')).toBe('M334,78 H362 V92 H337');
    expect(path?.classNames).toContain('self');
    expect(path?.getAttribute('marker-end')).toBe('url(#sqArrow)');
    const label = root.querySelector('text.msg-text');
    expect(label?.getAttribute('x')).toBe('370');
    expect(label?.text).toBe('tick');
    expect(root.querySelector('circle.step-badge')?.getAttribute('cy')).toBe('66');
  });

  it('a note over two actors spans both lifelines; a one-actor note sits beside its lifeline', () => {
    const over = renderSequence({
      actors: ACTORS,
      messages: [{ from: 'A', to: 'B', kind: 'note', label: 'hello' }],
    });
    expect(rects(over, 'seq-note')).toEqual([{ x: 78, y: 64, w: 286, h: 24 }]);
    expect(parse(over).querySelector('.seq-note-text')?.text).toBe('hello');
    expect(parse(over).querySelector('.step-badge')).toBeNull();

    const beside = renderSequence({
      actors: ACTORS,
      messages: [{ from: 'A', to: 'A', kind: 'note', label: 'hi', summary: 'a note with a step' }],
    });
    expect(rects(beside, 'seq-note')).toEqual([{ x: 120, y: 64, w: 72, h: 24 }]);
    // A summary keeps the badge so the step list can reference it.
    expect(parse(beside).querySelector('.step-badge')).not.toBeNull();
    expect(parse(beside).querySelector('.seq-steps .step-n')?.text).toBe('1');
  });

  it('a long note wraps to at most 3 lines and grows its row', () => {
    const html = renderSequence({
      actors: ACTORS,
      messages: [
        { from: 'A', to: 'B', kind: 'note', label: 'a note long enough to wrap onto a second and even a third line of text' },
        { from: 'A', to: 'B', label: 'after' },
      ],
    });
    expect(parse(html).querySelectorAll('.seq-note-text')).toHaveLength(3);
    // 42 + 2×13 = 68 for the note row, then the 42px message row.
    expect(lineYs(html)).toEqual([160]);
  });

  it('a note on the last lane moves to the left of its lifeline instead of running off the canvas', () => {
    const html = renderSequence({
      actors: ACTORS,
      messages: [{ from: 'C', to: 'C', kind: 'note', label: 'a note too wide to sit right of the last lane' }],
    });
    const [box] = rects(html, 'seq-note');
    if (box === undefined) throw new Error('note box expected');
    expect(box.x + box.w).toBeLessThanOrEqual(560 - 12);
    // A short one still sits to the right.
    const short = rects(renderSequence({ actors: ACTORS, messages: [{ from: 'C', to: 'C', kind: 'note', label: 'ok' }] }), 'seq-note');
    expect(short[0]?.x).toBe(572);
  });
});
