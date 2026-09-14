/**
 * Resolves the chiltepin CLI's own version at runtime — shared by the `--version`
 * flag and the studio's `/api/meta` endpoint.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Reads the CLI's own version from the nearest package.json. Walks up from
 * this module so it works from both `dist/bin.js` and the source layout.
 */
export function cliVersion(): string {
  try {
    let dir = dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < 6; i++) {
      const p = join(dir, 'package.json');
      if (existsSync(p)) {
        const j = JSON.parse(readFileSync(p, 'utf8')) as { name?: string; version?: string };
        // The package was renamed twice (@avodado/cli -> avodado -> chiltepin); accept all so the
        // walk matches its own package.json and never a stray parent's.
        if (
          (j.name === 'chiltepin' || j.name === 'avodado' || j.name === '@avodado/cli') &&
          typeof j.version === 'string'
        ) {
          return j.version;
        }
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    /* fall through to the placeholder below */
  }
  return '0.0.0';
}
