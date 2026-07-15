/**
 * The slash-vs-input guard: `/` opens the insert palette only outside
 * editable controls and only without modifiers.
 */

import { describe, expect, it } from 'vitest';
import { isEditableTarget, shouldOpenSlash } from './dom.js';

const input = { tagName: 'INPUT' } as unknown as EventTarget;
const textarea = { tagName: 'TEXTAREA' } as unknown as EventTarget;
const select = { tagName: 'SELECT' } as unknown as EventTarget;
const editable = { tagName: 'DIV', isContentEditable: true } as unknown as EventTarget;
const div = { tagName: 'DIV', isContentEditable: false } as unknown as EventTarget;

describe('isEditableTarget', () => {
  it('flags inputs, textareas, selects, and contenteditable hosts', () => {
    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(textarea)).toBe(true);
    expect(isEditableTarget(select)).toBe(true);
    expect(isEditableTarget(editable)).toBe(true);
  });

  it('passes plain elements and null through', () => {
    expect(isEditableTarget(div)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('shouldOpenSlash', () => {
  const base = { key: '/', metaKey: false, ctrlKey: false, altKey: false };

  it('opens on a bare / over the canvas', () => {
    expect(shouldOpenSlash({ ...base, target: div })).toBe(true);
    expect(shouldOpenSlash({ ...base, target: null })).toBe(true);
  });

  it('never fires while typing in a field', () => {
    expect(shouldOpenSlash({ ...base, target: input })).toBe(false);
    expect(shouldOpenSlash({ ...base, target: textarea })).toBe(false);
    expect(shouldOpenSlash({ ...base, target: editable })).toBe(false);
  });

  it('ignores other keys and modified slashes', () => {
    expect(shouldOpenSlash({ ...base, key: 'a', target: div })).toBe(false);
    expect(shouldOpenSlash({ ...base, metaKey: true, target: div })).toBe(false);
    expect(shouldOpenSlash({ ...base, ctrlKey: true, target: div })).toBe(false);
    expect(shouldOpenSlash({ ...base, altKey: true, target: div })).toBe(false);
  });
});
