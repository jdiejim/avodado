/**
 * Post-publish gate: fails when any public workspace package's local version
 * is missing from the npm registry. `changeset publish` can skip a package
 * (e.g. a token without create-package rights on a first publish) while still
 * exiting 0 — this turns that silent gap red.
 *
 * Assumes the repo convention that main is always pre-versioned (no pending
 * changesets), so on main the registry must match the tree exactly.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const missing = [];

/** Freshly published versions can take a minute or two to propagate through
 *  the registry CDN (bit us at 0.31.0 and again at 0.32.1) — retry with
 *  backoff before declaring a package missing. */
const ATTEMPTS = 6;
const DELAYS_MS = [0, 15_000, 30_000, 45_000, 60_000, 60_000];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function viewVersion(name, version) {
  try {
    return execFileSync('npm', ['view', `${name}@${version}`, 'version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return ''; // 404 → not (yet) visible
  }
}

for (const dir of readdirSync(join(root, 'packages'))) {
  const file = join(root, 'packages', dir, 'package.json');
  if (!existsSync(file)) continue;
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  if (pkg.private === true) continue;
  let published = '';
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    if (DELAYS_MS[attempt] > 0) {
      console.error(
        `[verify-published] ${pkg.name}@${pkg.version} not visible yet — retrying in ${DELAYS_MS[attempt] / 1000}s (${attempt + 1}/${ATTEMPTS})`,
      );
      await sleep(DELAYS_MS[attempt]);
    }
    published = viewVersion(pkg.name, pkg.version);
    if (published === pkg.version) break;
  }
  if (published !== pkg.version) missing.push(`${pkg.name}@${pkg.version}`);
}

if (missing.length > 0) {
  console.error(`NOT ON REGISTRY after publish: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('verify-published: all public workspace packages are on the registry.');
