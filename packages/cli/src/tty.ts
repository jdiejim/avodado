/**
 * TTY-awareness helpers. The CLI renders Ink only when stdout is a TTY and the
 * environment is not CI; otherwise it falls back to plain, log-friendly output
 * so logs stay parseable.
 */

/** True when the process is running interactively (TTY, not CI, not CHILTEPIN_PLAIN). */
export const isInteractive: boolean =
  process.stdout.isTTY === true &&
  process.env['CI'] !== 'true' &&
  process.env['CHILTEPIN_PLAIN'] !== '1';
