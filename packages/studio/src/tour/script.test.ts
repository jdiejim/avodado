import { describe, expect, it } from 'vitest';
import {
  resumeStepFor,
  tourReducer,
  TOUR_IDLE,
  TOUR_STEPS,
  type TourEvent,
  type TourState,
} from './script.js';

function run(events: TourEvent[], from: TourState = TOUR_IDLE): TourState {
  return events.reduce(tourReducer, from);
}

const stepIndex = (id: string): number => TOUR_STEPS.findIndex((s) => s.id === id);

describe('the tour script', () => {
  it('has ~9 steps with unique ids and resolvable advance rules', () => {
    expect(TOUR_STEPS.length).toBe(9);
    expect(new Set(TOUR_STEPS.map((s) => s.id)).size).toBe(TOUR_STEPS.length);
    for (const s of TOUR_STEPS) {
      expect(s.target.length, s.id).toBeGreaterThan(0);
      expect(s.title.length, s.id).toBeGreaterThan(0);
    }
    // The interactive spine: insert → fill → done → part → move → micro.
    expect(TOUR_STEPS.map((s) => s.advance)).toEqual([
      null,
      'insert',
      'field-commit',
      'sheet-done',
      'part-select',
      'part-move',
      'micro-close',
      null,
      null,
    ]);
  });
});

describe('tourReducer — step advancement on synthetic events', () => {
  it('starts at step 0 and walks the whole script on matching real actions', () => {
    let s = run([{ type: 'start' }]);
    expect(s).toEqual({ status: 'running', step: 0 });
    s = tourReducer(s, { type: 'next' }); // welcome → insert
    for (const action of [
      'insert',
      'field-commit',
      'sheet-done',
      'part-select',
      'part-move',
      'micro-close',
    ] as const) {
      s = tourReducer(s, { type: 'action', action });
      expect(s.status).toBe('running');
    }
    expect(s.step).toBe(stepIndex('save'));
    s = run([{ type: 'next' }, { type: 'next' }], s); // save → finish → done
    expect(s.status).toBe('finished');
  });

  it('ignores stray actions that do not match the current step', () => {
    const s = run([{ type: 'start' }, { type: 'action', action: 'part-move' }]);
    expect(s).toEqual({ status: 'running', step: 0 });
    // Actions also do nothing while interrupted or idle.
    const parked = run([{ type: 'break' }], { status: 'running', step: 4 });
    expect(tourReducer(parked, { type: 'action', action: 'part-select' })).toEqual(parked);
    expect(tourReducer(TOUR_IDLE, { type: 'action', action: 'insert' })).toEqual(TOUR_IDLE);
  });

  it('back never leaves the script; next past the last step finishes', () => {
    expect(run([{ type: 'start' }, { type: 'back' }])).toEqual({ status: 'running', step: 0 });
    const last: TourState = { status: 'running', step: TOUR_STEPS.length - 1 };
    expect(tourReducer(last, { type: 'next' }).status).toBe('finished');
  });

  it('break parks the tour keeping the step; resume returns (clamped)', () => {
    const parked = run([{ type: 'break' }], { status: 'running', step: 5 });
    expect(parked).toEqual({ status: 'interrupted', step: 5 });
    expect(tourReducer(parked, { type: 'resume', step: 4 })).toEqual({
      status: 'running',
      step: 4,
    });
    expect(tourReducer(parked, { type: 'resume', step: 99 }).step).toBe(TOUR_STEPS.length - 1);
    // break is meaningless outside running; resume outside interrupted.
    expect(tourReducer(TOUR_IDLE, { type: 'break' })).toEqual(TOUR_IDLE);
    expect(
      tourReducer({ status: 'running', step: 2 }, { type: 'resume', step: 0 }),
    ).toEqual({ status: 'running', step: 2 });
  });

  it('skip exits from running and interrupted; close clears finished', () => {
    expect(run([{ type: 'skip' }], { status: 'running', step: 3 })).toEqual(TOUR_IDLE);
    expect(run([{ type: 'skip' }], { status: 'interrupted', step: 3 })).toEqual(TOUR_IDLE);
    expect(run([{ type: 'close' }], { status: 'finished', step: 8 })).toEqual(TOUR_IDLE);
  });
});

describe('resumeStepFor — where Resume lands', () => {
  const fill = stepIndex('fill');
  const done = stepIndex('done');
  const insert = stepIndex('insert');
  const part = stepIndex('part');
  const move = stepIndex('move');

  it('sheet steps resume in place while the sheet is still open', () => {
    expect(resumeStepFor({ current: fill, sheetOpen: true, hasBlock: true })).toBe(fill);
    expect(resumeStepFor({ current: done, sheetOpen: true, hasBlock: true })).toBe(done);
  });

  it('a closed sheet falls back to the part step (block exists) or insert', () => {
    expect(resumeStepFor({ current: fill, sheetOpen: false, hasBlock: true })).toBe(part);
    expect(resumeStepFor({ current: done, sheetOpen: false, hasBlock: false })).toBe(insert);
  });

  it('block steps without the block fall back to insert; others resume in place', () => {
    expect(resumeStepFor({ current: move, sheetOpen: false, hasBlock: false })).toBe(insert);
    expect(resumeStepFor({ current: move, sheetOpen: false, hasBlock: true })).toBe(move);
    expect(resumeStepFor({ current: 0, sheetOpen: false, hasBlock: false })).toBe(0);
    expect(resumeStepFor({ current: stepIndex('save'), sheetOpen: false, hasBlock: false })).toBe(
      stepIndex('save'),
    );
  });
});
