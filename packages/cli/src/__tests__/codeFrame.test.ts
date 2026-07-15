import { describe, expect, it } from 'vitest';
import { renderCodeFrame } from '../ui/codeFrame.js';

// Strip ANSI so assertions read the raw layout regardless of colour support.
// ESC is built from its code point to avoid a control-char literal in source.
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
const strip = (s: string): string => s.replace(ANSI, '');

const LINES = ['messages:', '  - { from: Client, kind: bogus }'];

describe('renderCodeFrame', () => {
  it('shows the offending line with a caret underline at the column', () => {
    const frame = strip(renderCodeFrame({ lines: LINES, line: 2, column: 22, endColumn: 27 }));
    const rows = frame.split('\n');
    expect(rows[0]).toContain('1 | messages:'); // context line
    expect(rows[1]).toContain('2 |   - { from: Client, kind: bogus }');
    // caret row underlines columns 22..26 (5 carets)
    expect(rows[2]).toContain('^^^^^');
  });

  it('renders without a caret row when no column is given', () => {
    const frame = strip(renderCodeFrame({ lines: LINES, line: 2 }));
    expect(frame).not.toContain('^');
    expect(frame).toContain('2 |');
  });

  it('returns empty string for an out-of-range line', () => {
    expect(renderCodeFrame({ lines: LINES, line: 99 })).toBe('');
    expect(renderCodeFrame({ lines: LINES, line: 0 })).toBe('');
  });

  it('places a single caret when endColumn is absent', () => {
    const frame = strip(renderCodeFrame({ lines: LINES, line: 1, column: 1 }));
    const caretRow = frame.split('\n').at(-1) ?? '';
    expect(caretRow).toContain('^');
    expect(caretRow).not.toContain('^^');
  });
});
