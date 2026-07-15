/**
 * Tiny stdin helpers for one-off prompts outside of Ink (e.g. a post-action
 * "set as default?" confirmation). Kept separate from the Ink apps so plain
 * command handlers can ask a quick yes/no without mounting a React tree.
 */

import { createInterface } from 'node:readline';

/**
 * Asks a yes/no question on the terminal and resolves to the answer.
 * Returns `fallback` on empty input (just Enter) or when stdin isn't a TTY.
 *
 * @param question - Text shown before the `(Y/n)`/`(y/N)` hint.
 * @param fallback - Default when the user just presses Enter. Default: true.
 */
export async function confirm(question: string, fallback = true): Promise<boolean> {
  if (!process.stdin.isTTY) return fallback;
  const hint = fallback ? '(Y/n)' : '(y/N)';
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await new Promise<string>((res) => rl.question(`${question} ${hint} `, res)))
      .trim()
      .toLowerCase();
    if (answer === '') return fallback;
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}
