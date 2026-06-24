/**
 * `avo demo [format]` — render the bundled showcase doc (every block type) so a
 * user can see Avodado without writing anything. Defaults to opening an HTML
 * preview in the browser.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runSingle, type SingleFormat, type SingleResult } from './single.js';
import { templatesDir } from './init.js';

/** Renders the bundled demo doc to `format` and opens it (preview by default). */
export async function runDemo(opts: {
  readonly format?: SingleFormat;
  readonly preview?: boolean;
}): Promise<SingleResult> {
  const format = opts.format ?? 'html';
  const source = await readFile(join(templatesDir(), 'demo.md'), 'utf8');

  // Drop the demo doc in its own temp dir and render it from there, so it uses
  // the default theme and never touches the user's project.
  const dir = join(tmpdir(), 'avodado-demo');
  await mkdir(dir, { recursive: true });
  const input = join(dir, 'demo.md');
  await writeFile(input, source, 'utf8');

  return runSingle({
    cwd: dir,
    input,
    format,
    preview: opts.preview ?? true,
  });
}
