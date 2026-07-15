import { describe, expect, it } from 'vitest';

describe('tty module', () => {
  it('exports a boolean isInteractive', async () => {
    const { isInteractive } = await import('../tty.js');
    expect(typeof isInteractive).toBe('boolean');
  });
});
