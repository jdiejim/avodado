/**
 * `avo skill` — emit the Avodado authoring grammar as a copy-paste **system
 * prompt** for tools that don't read a repo file (Microsoft 365 Copilot, a
 * custom GPT, ChatGPT, Gemini, …). `avo init` writes native adapters for
 * Claude / Cursor / Copilot / Windsurf; this is the bring-your-own-tool path:
 * print it, pipe it, or save it, then paste it into the tool's system /
 * custom-instructions box.
 */

import { stitchSkill } from './init.js';

/** One-paragraph framing prepended to the grammar to make it a system prompt. */
const SYSTEM_HEADER = `# Avodado authoring — system prompt

You are an expert author of **Avodado** documents: Markdown files that mix prose
with typed, fenced YAML blocks, where the \`.md\` file on disk is the single source
of truth. Whenever you create or edit documentation in an Avodado project, follow
the grammar and rules below exactly:

- Keep narrative in plain Markdown; put every structured thing (diagram, table,
  roadmap, story) in a documented typed block. Never paste raw HTML or SVG.
- Use only the documented block types and their documented fields — the schemas
  are strict, so an unknown block or field is an error.
- Give a block an \`id:\` when something references it; reference it as \`doc#id\`.
- Quote any YAML value containing \`,\` \`:\` \`#\` \`[\` \`]\` \`{\` \`}\` or a leading special character.
- Edit blocks surgically — don't regenerate whole files.
- A change is done only when \`avo check\` passes (if the tooling is available).

The complete block grammar, field contract, and authoring recipe follow.

---
`;

/**
 * Reads the canonical skill bundled with the CLI, stitched into one document:
 * the `SKILL.md` hub followed by each reference file (the blocks index +
 * contract + family files, system-design, decks, intake, organizing),
 * separated by `---` rules — so consumers with no filesystem get the complete
 * grammar in a single paste.
 */
export async function readSkill(): Promise<string> {
  return stitchSkill();
}

/** Strips the leading YAML frontmatter (`---\n…\n---`) from skill markdown. */
function stripFrontmatter(md: string): string {
  const m = /^---\n[\s\S]*?\n---\n/.exec(md);
  return m !== null ? md.slice(m[0].length).replace(/^\s+/, '') : md;
}

/**
 * Builds the copy-paste system prompt: the framing header + the skill grammar
 * with its repo-oriented frontmatter removed. Pass `raw: true` to get the skill
 * file verbatim instead (useful for saving as another tool's skill file).
 */
export async function systemPrompt(opts: { raw?: boolean } = {}): Promise<string> {
  const skill = await readSkill();
  if (opts.raw === true) return skill;
  return SYSTEM_HEADER + stripFrontmatter(skill);
}
