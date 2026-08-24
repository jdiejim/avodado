/**
 * BuiltinSource — deterministic evidence extraction with no graph.
 *
 * A bounded fs walk plus per-language regexes. Nothing here parses ASTs; the
 * goal is countable, citable evidence (entrypoints, routes, schemas,
 * packages, externals, import in-degree), not full program understanding.
 * The walk skips vendored/generated dirs and caps file reads so a huge repo
 * stays fast; when the cap trips, the report says so in `notice`.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, posix, sep } from 'node:path';
import type {
  AuditStats,
  CollectedEvidence,
  EntrypointEvidence,
  ExternalEvidence,
  GodNodeEvidence,
  PackageEvidence,
  RouteEvidence,
  SchemaEvidence,
} from './types.js';

/** Hard cap on files read — keeps `avo audit` fast on big repos. */
export const FILE_CAP = 2000;

/** Directories never walked (rough .gitignore etiquette). */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.scratch',
  'graphify-out',
  'coverage',
  '.next',
  '.turbo',
  '__pycache__',
  '.venv',
  'venv',
  'vendor',
  'target',
  'out',
]);

/** Extensions whose contents we scan for routes/imports/externals. */
const CODE_EXTS = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'mts', 'cts', 'py', 'go', 'rb']);

/** Normalizes an extension into a language bucket (`tsx` → `ts`, …). */
function langOf(ext: string): string {
  switch (ext) {
    case 'tsx':
    case 'mts':
    case 'cts':
      return 'ts';
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'js';
    case 'yml':
      return 'yaml';
    default:
      return ext;
  }
}

/** Lowercased extension without the dot, or '' when there is none. */
function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  if (i <= 0) return '';
  return name.slice(i + 1).toLowerCase();
}

/** Always-forward-slash path relative to the audit root. */
function rel(root: string, abs: string): string {
  return relative(root, abs).split(sep).join('/');
}

interface WalkedFile {
  readonly abs: string;
  readonly rel: string;
  readonly ext: string;
}

/** Walks the tree breadth-first, skipping SKIP_DIRS, capped at FILE_CAP files. */
async function walk(root: string): Promise<{ files: WalkedFile[]; truncated: boolean }> {
  const files: WalkedFile[] = [];
  const queue: string[] = [root];
  let truncated = false;
  while (queue.length > 0 && !truncated) {
    const dir = queue.shift() as string;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue; // unreadable dir — skip, the audit is best-effort
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Hidden dirs (.git, .venv, …) and vendored/generated dirs stay out.
        if (!entry.name.startsWith('.') && !SKIP_DIRS.has(entry.name)) queue.push(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      if (files.length >= FILE_CAP) {
        truncated = true;
        break;
      }
      files.push({ abs, rel: rel(root, abs), ext: extOf(entry.name) });
    }
  }
  return { files, truncated };
}

/** External SDK / HTTP-client modules we recognize as "talks to a service". */
const KNOWN_EXTERNALS: readonly string[] = [
  'axios',
  'node-fetch',
  'got',
  'undici',
  'ky',
  'stripe',
  'openai',
  '@anthropic-ai/',
  '@aws-sdk/',
  'aws-sdk',
  '@octokit/',
  'twilio',
  '@sendgrid/',
  '@supabase/',
  'firebase',
  'pg',
  'mysql2',
  'mongodb',
  'mongoose',
  'redis',
  'ioredis',
  '@prisma/client',
  // Python
  'requests',
  'httpx',
  'boto3',
  'anthropic',
];

/** Path segments that mark test/fixture trees — no evidence harvested there. */
const TEST_SEGMENT_RE = /(^|\/)(__tests__|__fixtures__|__mocks__)(\/|$)/;

/** Test-file names: `*.test.*`, `*.spec.*`. */
const TEST_FILE_RE = /\.(test|spec)\./i;

/**
 * True for test/fixture paths. These files still count in `stats.files`,
 * but the audit never harvests evidence from them — a route literal inside
 * a test fixture is not a route the repo serves.
 */
export function isTestPath(rel: string): boolean {
  return TEST_SEGMENT_RE.test(rel) || TEST_FILE_RE.test(posix.basename(rel));
}

/** JS/TS import + require specifiers in a file. */
function importSpecifiers(text: string): string[] {
  const out: string[] = [];
  const re = /(?:\bfrom\s+|\bimport\s+|\brequire\(\s*)['"]([^'"\n]+)['"]/g;
  for (const m of text.matchAll(re)) out.push(m[1] as string);
  return out;
}

// Express / Fastify / Hono style: app . get(<quoted path>, …).
const JS_ROUTE_RE =
  /\b(?:app|router|server|fastify|api)\s*\.\s*(get|post|put|patch|delete|options|head)\s*\(\s*['"`]([^'"`\n]+)['"`]/g;

// FastAPI decorators: @app . get(<quoted path>).
const FASTAPI_ROUTE_RE = /@\w+\.(get|post|put|patch|delete)\(\s*['"]([^'"\n]+)['"]/g;

// Flask decorators: @app . route(<quoted path>, methods=[…]).
const FLASK_ROUTE_RE = /@\w+\.route\(\s*['"]([^'"\n]+)['"]([^)\n]*)/g;

/**
 * Collects builtin evidence for `root`. Pure-ish: reads the fs, writes
 * nothing, returns a value (the CLI owns exit codes and printing).
 */
export async function collectBuiltin(root: string): Promise<CollectedEvidence> {
  const { files, truncated } = await walk(root);

  // Stats: files walked + language histogram.
  const languages: Record<string, number> = {};
  for (const f of files) {
    if (f.ext === '') continue;
    if (f.ext.length > 6) continue; // not a real extension
    const lang = langOf(f.ext);
    languages[lang] = (languages[lang] ?? 0) + 1;
  }

  const entrypoints: EntrypointEvidence[] = [];
  const routes: RouteEvidence[] = [];
  const schemas: SchemaEvidence[] = [];
  const packages: PackageEvidence[] = [];
  const externals = new Map<string, ExternalEvidence>();
  const composeServices: { name: string; file: string }[] = [];
  // import target (posix path, no ext) → set of importer files
  const importers = new Map<string, Set<string>>();
  const seenEntry = new Set<string>();
  let readmeLines: number | undefined;
  let readmeFile: string | undefined;

  const addEntry = (file: string, why: string): void => {
    if (seenEntry.has(file)) return;
    seenEntry.add(file);
    entrypoints.push({ file, why });
  };

  const fileSet = new Set(files.map((f) => f.rel));

  for (const f of files) {
    // Test/fixture files count in stats but never yield evidence — a route
    // or SDK import inside a test fixture is not something the repo serves.
    if (isTestPath(f.rel)) continue;
    const base = posix.basename(f.rel);

    // — Schemas: recognized by name/extension, no read needed.
    if (f.ext === 'prisma') schemas.push({ file: f.rel, kind: 'prisma' });
    else if (f.ext === 'proto') schemas.push({ file: f.rel, kind: 'proto' });
    else if (f.ext === 'sql' && /(^|\/)migrations?\//.test(f.rel))
      schemas.push({ file: f.rel, kind: 'sql' });
    else if (/^(openapi|swagger)\./i.test(base) && ['yaml', 'yml', 'json'].includes(f.ext))
      schemas.push({ file: f.rel, kind: 'openapi' });
    else if (/^drizzle\.config\./.test(base)) schemas.push({ file: f.rel, kind: 'other' });

    // — Conventional entrypoints.
    if (/^src\/index\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f.rel)) addEntry(f.rel, 'src/index convention');
    if (/^(main|app|manage)\.py$/.test(f.rel)) addEntry(f.rel, 'python entry convention');
    if (/^cmd\/[^/]+\/main\.go$/.test(f.rel)) addEntry(f.rel, 'Go cmd/ convention');

    // — Root README (onboarding rule input).
    if (f.rel.toLowerCase() === 'readme.md') {
      try {
        const text = await readFile(f.abs, 'utf8');
        // Count newline-terminated lines: a trailing newline does not add one.
        const lines = text.split('\n');
        if (lines[lines.length - 1] === '') lines.pop();
        readmeLines = lines.length;
        readmeFile = f.rel;
      } catch {
        /* unreadable README counts as absent */
      }
    }

    // — package.json: package list + main/bin/start entrypoints.
    if (base === 'package.json') {
      try {
        const pkg = JSON.parse(await readFile(f.abs, 'utf8')) as Record<string, unknown>;
        const dir = posix.dirname(f.rel);
        if (typeof pkg['name'] === 'string') {
          packages.push({ name: pkg['name'], dir: dir === '.' ? '.' : dir });
        }
        const inPkg = (p: string): string => posix.normalize(posix.join(dir === '.' ? '' : dir, p));
        if (typeof pkg['main'] === 'string') addEntry(inPkg(pkg['main']), 'package.json main');
        const bin = pkg['bin'];
        if (typeof bin === 'string') addEntry(inPkg(bin), 'package.json bin');
        else if (bin !== null && typeof bin === 'object') {
          for (const v of Object.values(bin as Record<string, unknown>)) {
            if (typeof v === 'string') addEntry(inPkg(v), 'package.json bin');
          }
        }
        const scripts = pkg['scripts'];
        if (scripts !== null && typeof scripts === 'object') {
          const start = (scripts as Record<string, unknown>)['start'];
          if (typeof start === 'string') {
            const m = start.match(/(\S+\.(?:[mc]?[jt]sx?|py))\b/);
            if (m !== null) addEntry(inPkg(m[1] as string), 'package.json start script');
          }
        }
      } catch {
        /* invalid package.json — no evidence from it */
      }
    }

    // — docker-compose services.
    if (/^(docker-)?compose(\.[\w-]+)?\.ya?ml$/.test(base) && posix.dirname(f.rel) === '.') {
      try {
        const lines = (await readFile(f.abs, 'utf8')).split('\n');
        const start = lines.findIndex((l) => /^services:\s*$/.test(l));
        if (start >= 0) {
          for (let i = start + 1; i < lines.length; i += 1) {
            const line = lines[i] as string;
            if (/^\S/.test(line)) break; // left the services: mapping
            const m = line.match(/^ {2}([\w-]+):\s*$/);
            if (m !== null) composeServices.push({ name: m[1] as string, file: f.rel });
          }
        }
      } catch {
        /* skip */
      }
    }

    // — Code files: routes, externals, import in-degree.
    if (!CODE_EXTS.has(f.ext)) continue;
    let text: string;
    try {
      text = await readFile(f.abs, 'utf8');
    } catch {
      continue;
    }

    for (const m of text.matchAll(JS_ROUTE_RE)) {
      routes.push({ method: (m[1] as string).toUpperCase(), path: m[2] as string, file: f.rel });
    }
    if (f.ext === 'py') {
      for (const m of text.matchAll(FASTAPI_ROUTE_RE)) {
        routes.push({ method: (m[1] as string).toUpperCase(), path: m[2] as string, file: f.rel });
      }
      for (const m of text.matchAll(FLASK_ROUTE_RE)) {
        const methods = (m[2] as string).match(/methods\s*=\s*\[([^\]]*)\]/);
        const list =
          methods === null
            ? ['GET']
            : (methods[1] as string)
                .split(',')
                .map((s) => s.replace(/['"\s]/g, ''))
                .filter((s) => s !== '');
        for (const method of list) {
          routes.push({ method: method.toUpperCase(), path: m[1] as string, file: f.rel });
        }
      }
      // Python externals: `import requests` / `from httpx import …`.
      for (const m of text.matchAll(/^(?:import|from)\s+([\w.]+)/gm)) {
        const mod = (m[1] as string).split('.')[0] as string;
        if (KNOWN_EXTERNALS.includes(mod) && !externals.has(mod)) {
          externals.set(mod, { name: mod, file: f.rel });
        }
      }
      continue;
    }

    // JS/TS externals + local import graph.
    if (/\bfetch\s*\(/.test(text) && !externals.has('fetch')) {
      externals.set('fetch', { name: 'fetch', file: f.rel });
    }
    for (const spec of importSpecifiers(text)) {
      if (spec.startsWith('.')) {
        // Local import: resolve against the importer's dir, strip extension.
        const target = posix
          .normalize(posix.join(posix.dirname(f.rel), spec))
          .replace(/\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/, '')
          .replace(/\/index$/, '');
        let set = importers.get(target);
        if (set === undefined) {
          set = new Set();
          importers.set(target, set);
        }
        set.add(f.rel);
        continue;
      }
      const hit = KNOWN_EXTERNALS.find((k) =>
        k.endsWith('/') ? spec.startsWith(k) : spec === k || spec.startsWith(`${k}/`),
      );
      if (hit !== undefined) {
        const name = hit.endsWith('/') ? spec : hit;
        if (!externals.has(name)) externals.set(name, { name, file: f.rel });
      }
    }
  }

  // Next.js file-convention routes (pages/api and app-router route files).
  for (const f of files) {
    if (isTestPath(f.rel)) continue;
    const api = f.rel.match(/(?:^|\/)pages\/api\/(.+)\.(?:[jt]sx?)$/);
    if (api !== null) {
      const p = `/${(api[1] as string).replace(/\/index$/, '')}`;
      routes.push({ method: 'ANY', path: `/api${p === '/index' ? '' : p}`, file: f.rel });
      continue;
    }
    const appRoute = f.rel.match(/(?:^|\/)app\/(.*?)route\.(?:[jt]s)$/);
    if (appRoute !== null) {
      const p = `/${(appRoute[1] as string).replace(/\/$/, '')}`;
      routes.push({ method: 'ANY', path: p === '/' ? '/' : p, file: f.rel });
    }
  }

  // God nodes: local modules with the highest import in-degree.
  const godNodes: GodNodeEvidence[] = [...importers.entries()]
    .map(([target, set]) => ({ target, degree: set.size }))
    .filter((g) => g.degree >= 3)
    .sort((a, b) => b.degree - a.degree || a.target.localeCompare(b.target))
    .slice(0, 10)
    .map((g) => {
      // Prefer a real file for the citation: try the common extensions.
      const candidates = [
        g.target,
        ...['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].flatMap((e) => [
          `${g.target}.${e}`,
          `${g.target}/index.${e}`,
        ]),
      ];
      const file = candidates.find((c) => fileSet.has(c)) ?? g.target;
      return { name: g.target, degree: g.degree, file };
    });

  const stats: AuditStats = { files: files.length, languages };
  return {
    stats,
    evidence: { entrypoints, routes, schemas, packages, externals: [...externals.values()], godNodes },
    composeServices,
    readmeLines,
    readmeFile,
    truncated,
  };
}

/** True when `p` exists and is a directory (the audit's only hard precondition). */
export async function isUsableRoot(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}
