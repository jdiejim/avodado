// Inlines the canonical authoring SKILL.md into a TS module so the MCP server
// ships it self-contained (no runtime path dependency). Runs before build/typecheck.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../../cli/templates/.avodado/skill/SKILL.md');
const md = readFileSync(src, 'utf8');
const out = resolve(here, '../src/skill.generated.ts');
writeFileSync(
  out,
  `// AUTO-GENERATED from packages/cli/templates/.avodado/skill/SKILL.md — do not edit.\n` +
    `export const SKILL_MD = ${JSON.stringify(md)};\n`,
);
console.log(`embedded skill (${md.length} chars)`);
