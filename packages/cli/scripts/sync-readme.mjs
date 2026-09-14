/**
 * The npm page for `avodado` shows this package's README. Keep it the repo
 * README, with relative links and images rewritten to absolute GitHub URLs so
 * they render on npmjs.com. Runs at build (before `files` are packed).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..', '..');
const src = readFileSync(path.join(root, 'README.md'), 'utf8');
const RAW = 'https://raw.githubusercontent.com/jdiejim/avodado/main/';
const BLOB = 'https://github.com/jdiejim/avodado/blob/main/';
const TREE = 'https://github.com/jdiejim/avodado/tree/main/';

const out = src
  .replace(/src="\.\/([^"]+)"/g, (_, p) => `src="${RAW}${p}"`)
  .replace(/\]\(\.\/([^)]+)\)/g, (_, p) => `](${/\.[a-z]+$/i.test(p) ? BLOB : TREE}${p})`)
  .replace(/\]\(\.scratch\/([^)]+)\)/g, (_, p) => `](${TREE}.scratch/${p})`);

writeFileSync(path.join(here, '..', 'README.md'), `<!-- Generated from the repo README by scripts/sync-readme.mjs — edit the root README.md. -->\n${out}`);
