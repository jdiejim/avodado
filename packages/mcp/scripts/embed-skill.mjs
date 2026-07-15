// Inlines the canonical authoring skill — the SKILL.md hub plus its
// reference/*.md files, stitched into one document — into a TS module so the
// MCP server ships it self-contained (no runtime path dependency). Runs before
// build/typecheck. Order and separator match the CLI's stitchSkill().
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const skillDir = resolve(here, '../../cli/templates/.avodado/skill');
// Keep this list in sync with SKILL_REFERENCE_FILES in
// packages/cli/src/commands/init.ts (same files, same order, hub first).
const FILES = [
  'SKILL.md',
  'reference/blocks/INDEX.md',
  'reference/blocks/contract.md',
  'reference/blocks/narrative.md',
  'reference/blocks/tables-data.md',
  'reference/blocks/api.md',
  'reference/blocks/architecture.md',
  'reference/blocks/flows.md',
  'reference/blocks/data-model.md',
  'reference/blocks/charts-overviews.md',
  'reference/blocks/planning.md',
  'reference/blocks/business.md',
  'reference/blocks/design-system.md',
  'reference/blocks/algorithms.md',
  'reference/blocks/agentic.md',
  'reference/system-design.md',
  'reference/decks.md',
  'reference/intake.md',
  'reference/organizing.md',
];
const md = (
  FILES.map((f) => readFileSync(resolve(skillDir, f), 'utf8').trimEnd()).join('\n\n---\n\n') + '\n'
).replaceAll(
  'live beside this file — read them on demand',
  'are included in full below — read them on demand',
);
const out = resolve(here, '../src/skill.generated.ts');
writeFileSync(
  out,
  `// AUTO-GENERATED from packages/cli/templates/.avodado/skill/ (SKILL.md + reference/*.md, stitched) — do not edit.\n` +
    `export const SKILL_MD = ${JSON.stringify(md)};\n`,
);
console.log(`embedded stitched skill (${md.length} chars from ${FILES.length} files)`);
