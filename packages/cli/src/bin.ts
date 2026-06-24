/**
 * `avo` CLI entry point. Tsup adds the `#!/usr/bin/env node` shebang at build
 * time; this file is the JS that runs after.
 */

import { main } from './app.js';

/**
 * Resolves once the stream's userspace buffer is flushed to the OS. Without this,
 * `process.exit()` can terminate before a large piped write lands — truncating
 * output at the pipe buffer (e.g. `avo skill | pbcopy` cut off at 64 KiB).
 */
function flush(stream: NodeJS.WriteStream): Promise<void> {
  if (stream.writableLength === 0) return Promise.resolve();
  return new Promise((resolve) => stream.once('drain', resolve));
}

const code = await main(process.argv);
await Promise.all([flush(process.stdout), flush(process.stderr)]);
process.exit(code);
