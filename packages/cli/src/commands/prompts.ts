/**
 * `avo prompt` — ready-to-paste prompts that tell an AI agent to author an
 * Avodado doc of a given kind, each wired to a Document Playbook in the skill.
 * Built-ins ship here; users add their own under `.avodado/prompts/*.md`.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

/** Directory holding saved custom prompts, relative to the project root. */
export const PROMPTS_DIR = '.avodado/prompts';

/** A reusable prompt: a short slug, a human label, and the paste-able text. */
export interface PromptDef {
  readonly slug: string;
  readonly label: string;
  readonly text: string;
}

const tail = 'Use only documented Avodado blocks and their fields, give referenceable blocks an `id:`, then run `avo check` and fix every diagnostic before finishing.';

/** Built-in example prompts, one per Document Playbook. */
export const BUILTIN_PROMPTS: readonly PromptDef[] = [
  {
    slug: 'adr',
    label: 'ADR — architecture decision record',
    text: `Write an Avodado ADR for the decision: <DECISION>.\nFollow the ADR playbook: meta (tag "ADR-NNN") → a short prose Context → an \`options\` block weighing the alternatives (mark the chosen one tone: chosen) → a \`callout\` titled "Decision" → a \`proscons\` or \`table\` of Consequences → a \`tracker\` of follow-ups.\n${tail}`,
  },
  {
    slug: 'situation',
    label: 'Situation → Resolution write-up',
    text: `Write an Avodado situation→resolution doc for: <PROBLEM>.\nFollow the playbook: meta → prose Situation → a \`drivers\` block of the forces at play → a \`callout: warn\` for the Complication → an \`options\` block of approaches explored (chosen one tone: chosen) → a \`spec\` block describing the chosen approach → a \`composition\` or \`sequence\` showing how it works.\n${tail}`,
  },
  {
    slug: 'roadmap',
    label: 'Roadmap / delivery plan',
    text: `Write an Avodado roadmap for: <INITIATIVE>.\nFollow the playbook: meta → a \`stats\` strip of targets → a \`timeline\` of phases (or \`gantt\` if there are real dates) → a \`kanban\` of Now / Next / Later → a \`tracker\` of workstreams.\n${tail}`,
  },
  {
    slug: 'cloud',
    label: 'Cloud architecture',
    text: `Write an Avodado cloud-architecture doc for: <SYSTEM>.\nFollow the playbook: meta → a \`drivers\` block of requirements/NFRs → a \`c4\` (level: context) → an \`infra\` topology diagram → a \`sequence\` of the key request → a \`table\` of stack choices → a \`callout\` of trade-offs. Omit \`col\`/\`row\` on diagram nodes — layout is automatic.\n${tail}`,
  },
  {
    slug: 'rbac',
    label: 'Access model / RBAC',
    text: `Write an Avodado access-model doc for: <APP/SYSTEM>.\nFollow the playbook: meta → a \`drivers\` block of requirements → \`layers\` or \`composition\` for the model → an \`options\` block of approaches → a \`spec\` of the chosen approach → an \`anatomy\` of the permission string → a \`matrix\` of role × capability → a \`sequence\` of the authz flow → \`userstory\` blocks for the backlog.\n${tail}`,
  },
  {
    slug: 'api',
    label: 'API / endpoint spec',
    text: `Write an Avodado API spec for: <SERVICE>.\nFollow the playbook: meta → one \`endpoint\` block per route → a \`sequence\` of the request flow → an \`erd\` of the data touched → a \`table\` of status codes. (Or run \`avo sync openapi <spec>\` to generate it from an OpenAPI file.)\n${tail}`,
  },
  {
    slug: 'design',
    label: 'Design doc / RFC',
    text: `Write an Avodado design doc (RFC) for: <PROPOSAL>.\nFollow the playbook: meta → prose Problem → a \`mece\` breakdown of the problem → an \`options\` block of alternatives → a \`c4\` or \`block\` of the proposed design → a \`sequence\`/\`flow\` of behavior → a \`tracker\` of open questions.\n${tail}`,
  },
  {
    slug: 'runbook',
    label: 'Runbook / procedure',
    text: `Write an Avodado runbook for: <PROCEDURE>.\nFollow the playbook: meta → a \`callout\` of when to use it → a \`flow\` or \`swimlane\` of the procedure → \`code\` blocks of commands → a \`table\` mapping symptom → action.\n${tail}`,
  },
  {
    slug: 'presentation',
    label: 'Presentation / slide deck',
    text: `Write an Avodado slide deck about <TOPIC> (renders with \`avo slides\`).\nEach \`#\`/\`##\` heading starts a new slide and is its title; everything under it (prose + blocks) stays on that slide. Open with a \`meta\` cover, then one heading per slide with one focused block — \`drivers\` / \`stats\` / \`pyramid\` / \`quadrant\` / \`timeline\` or a diagram. One strong visual per slide, not dense prose. Force vertical alignment when needed with a heading marker: \`## Title {top}\`, \`## Title {center}\`, or \`## Title {bottom}\`.\n${tail}`,
  },
  {
    slug: 'slides',
    label: 'Slides — format a doc into a deck',
    text: `Reformat the Avodado document <DOC> so it presents well as slides (\`avo slides\`), keeping the content but improving pagination.\nSlide rules: each \`#\`/\`##\` heading is one slide and its title; put that slide's prose + blocks under its heading; aim for one idea per slide (a heading + one strong block) — split or merge headings to achieve that. Vertical alignment is automatic (light slides center, heavy slides top); override per slide with a heading marker \`{top}\` / \`{center}\` / \`{bottom}\`. Do NOT use \`---\` as a slide break (it renders as a rule). Keep \`meta\` as the cover.\n${tail}`,
  },
];

/** A saved custom prompt on disk. */
export interface SavedPrompt {
  readonly slug: string;
  readonly label: string;
  readonly file: string;
}

/** Resolves the on-disk path for a saved prompt by slug. */
export function savedPromptPath(cwd: string, slug: string): string {
  return resolve(cwd, PROMPTS_DIR, `${slug}.md`);
}

/** Lists saved custom prompts in `.avodado/prompts/*.md`, sorted by slug. */
export function listSavedPrompts(cwd: string): SavedPrompt[] {
  const dir = resolve(cwd, PROMPTS_DIR);
  if (!existsSync(dir)) return [];
  const out: SavedPrompt[] = [];
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith('.md')) continue;
    const slug = entry.replace(/\.md$/, '');
    const file = join(dir, entry);
    let label = slug;
    try {
      const first = readFileSync(file, 'utf8').split('\n').find((l) => l.trim() !== '');
      if (first !== undefined) label = first.replace(/^#+\s*/, '').slice(0, 60);
    } catch {
      /* keep slug */
    }
    out.push({ slug, label, file });
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

/** Reads a saved prompt's text. */
export function readSavedPrompt(file: string): string {
  return readFileSync(file, 'utf8');
}

/**
 * Copies text to the OS clipboard via the platform's native tool (pbcopy /
 * clip / xclip / wl-copy). Returns true on success; never throws.
 */
export function copyToClipboard(text: string): boolean {
  const candidates: ReadonlyArray<readonly [string, readonly string[]]> =
    process.platform === 'darwin'
      ? [['pbcopy', []]]
      : process.platform === 'win32'
        ? [['clip', []]]
        : [
            ['wl-copy', []],
            ['xclip', ['-selection', 'clipboard']],
            ['xsel', ['--clipboard', '--input']],
          ];
  for (const [cmd, args] of candidates) {
    try {
      const r = spawnSync(cmd, [...args], { input: text });
      if (r.status === 0) return true;
    } catch {
      /* try the next tool */
    }
  }
  return false;
}

/** Scaffold content for a new custom prompt. */
export function newPromptContents(name: string): string {
  return `Write an Avodado document for: <WHAT>.\n\n# ${name}\n\nDescribe the doc's job, then list the block stack to use (see the Document\nplaybooks in .avodado/skill/SKILL.md). End with: run \`avo check\` and fix all\ndiagnostics.\n`;
}
