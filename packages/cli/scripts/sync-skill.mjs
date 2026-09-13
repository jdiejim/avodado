// Copies the repository's single authoring skill (skills/avodado/) into the
// CLI package as templates/skill/, so the published package carries it for
// `avo skill` and the MCP embed. Runs before every build; the copy is
// gitignored — skills/avodado/ is the only source of truth.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../../../skills/avodado');
const dst = resolve(here, '../templates/skill');

if (!existsSync(resolve(src, 'SKILL.md'))) {
  console.error(`sync-skill: no skill at ${src}`);
  process.exit(1);
}
rmSync(dst, { recursive: true, force: true });
mkdirSync(dirname(dst), { recursive: true });
cpSync(src, dst, { recursive: true });
console.log(`sync-skill: copied skills/avodado → packages/cli/templates/skill`);
