/**
 * Loads `avodado.config.{ts,json,yml}` from the project root.
 *
 * Defaults are returned if no config is found, so most users never need a
 * config file.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as yamlParse } from 'yaml';
import { createJiti } from 'jiti';

/** Loaded configuration. */
export interface AvodadoConfig {
  /** Where docs live (relative to project root). Defaults to `docs`. */
  readonly docsDir: string;
  /** Where rendered output goes (relative to project root). Defaults to `dist`. */
  readonly outDir: string;
}

const DEFAULTS: AvodadoConfig = { docsDir: 'docs', outDir: 'dist' };

const CONFIG_FILES = [
  'avodado.config.ts',
  'avodado.config.js',
  'avodado.config.mjs',
  'avodado.config.json',
  'avodado.config.yml',
  'avodado.config.yaml',
];

/** Loads a config file from `cwd`, returning defaults if none exists. */
export async function loadConfig(cwd: string): Promise<AvodadoConfig> {
  for (const name of CONFIG_FILES) {
    const path = resolve(cwd, name);
    if (!existsSync(path)) continue;
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

function mergeWithDefaults(raw: unknown): AvodadoConfig {
  if (raw === null || typeof raw !== 'object') return DEFAULTS;
  const r = raw as { docsDir?: unknown; outDir?: unknown };
  return {
    docsDir: typeof r.docsDir === 'string' ? r.docsDir : DEFAULTS.docsDir,
    outDir: typeof r.outDir === 'string' ? r.outDir : DEFAULTS.outDir,
  };
}
