/**
 * Loads `chiltepin.config.{ts,json,yml}` from the project root.
 *
 * Defaults are returned if no config is found, so most users never need a
 * config file.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as yamlParse } from 'yaml';
import { createJiti } from 'jiti';

/** Loaded configuration. */
interface ChiltepinConfig {
  /** Where docs live (relative to project root). Defaults to `docs`. */
  readonly docsDir: string;
  /** Where rendered output goes (relative to project root). Defaults to `dist`. */
  readonly outDir: string;
  /** Build the rich site index (TLDR, grouped doc map, cross-reference graph).
   * Defaults to `true` (absent = on); set `false` — or pass `--no-rich-index` —
   * to keep the plain card grid. */
  readonly richIndex: boolean;
  /**
   * The colour scheme of every rendered page: `dark` (default — the look),
   * `light`, or `system` (the reader's OS decides). Print is always light.
   */
  readonly colorScheme: 'dark' | 'light' | 'system';
}

const DEFAULTS: ChiltepinConfig = {
  docsDir: 'docs',
  outDir: 'dist',
  richIndex: true,
  colorScheme: 'dark',
};

const CONFIG_EXTENSIONS = ['ts', 'js', 'mjs', 'json', 'yml', 'yaml'];

/** Current names first; the pre-rename `avodado.config.*` still loads, with a warning. */
const CONFIG_FILES = [
  ...CONFIG_EXTENSIONS.map((ext) => `chiltepin.config.${ext}`),
  ...CONFIG_EXTENSIONS.map((ext) => `avodado.config.${ext}`),
];

/** True for the legacy (pre-rename) config filename. */
export const isLegacyConfigName = (name: string): boolean => name.startsWith('avodado.config.');

let warnedLegacy = false;

/**
 * Returns the filename of the config found in `cwd`, or `undefined` when the
 * directory isn't a Chiltepin project (used by the smart bare `chiltepin`).
 */
export function findConfig(cwd: string): string | undefined {
  return CONFIG_FILES.find((name) => existsSync(resolve(cwd, name)));
}

/** Loads a config file from `cwd`, returning defaults if none exists. */
export async function loadConfig(cwd: string): Promise<ChiltepinConfig> {
  for (const name of CONFIG_FILES) {
    const path = resolve(cwd, name);
    if (!existsSync(path)) continue;
    if (isLegacyConfigName(name) && !warnedLegacy) {
      warnedLegacy = true;
      process.stderr.write(
        `${name} is the old name — rename it to ${name.replace('avodado', 'chiltepin')}. It still loads for now.\n`,
      );
    }
    const raw = await readConfig(path);
    return mergeWithDefaults(raw);
  }
  return DEFAULTS;
}

async function readConfig(path: string): Promise<unknown> {
  if (path.endsWith('.json')) {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
  }
  if (path.endsWith('.yml') || path.endsWith('.yaml')) {
    return yamlParse(readFileSync(path, 'utf8')) as unknown;
  }
  const jiti = createJiti(import.meta.url);
  const mod = (await jiti.import(path)) as { default?: unknown };
  return mod.default ?? mod;
}

function mergeWithDefaults(raw: unknown): ChiltepinConfig {
  if (raw === null || typeof raw !== 'object') return DEFAULTS;
  const r = raw as {
    docsDir?: unknown;
    outDir?: unknown;
    richIndex?: unknown;
    colorScheme?: unknown;
  };
  const scheme =
    r.colorScheme === 'light' || r.colorScheme === 'system' || r.colorScheme === 'dark'
      ? r.colorScheme
      : DEFAULTS.colorScheme;
  return {
    docsDir: typeof r.docsDir === 'string' ? r.docsDir : DEFAULTS.docsDir,
    outDir: typeof r.outDir === 'string' ? r.outDir : DEFAULTS.outDir,
    richIndex: typeof r.richIndex === 'boolean' ? r.richIndex : DEFAULTS.richIndex,
    colorScheme: scheme,
  };
}
