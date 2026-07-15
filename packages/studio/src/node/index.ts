/**
 * Node-only entry for `@avodado/studio` — the ONLY module in this package that
 * may touch `node:` APIs. The published package ships the built app as static
 * assets under `dist/app/`; the CLI (`avo studio`) imports this entry to find
 * them and serve them alongside the file-bridge API.
 *
 * Everything under `src/` outside this folder runs in the browser.
 */

import { fileURLToPath } from 'node:url';

/** URL of the built app's asset root (`dist/app/`), relative to this module. */
export const assetsRoot = new URL('./app/', import.meta.url);

/**
 * Absolute filesystem path of the built app's asset root.
 *
 * @returns The directory containing `index.html` and the hashed JS/CSS assets.
 */
export function assetsPath(): string {
  return fileURLToPath(assetsRoot);
}
