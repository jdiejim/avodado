/**
 * `createConfigWatcher` must see every location a theme change can land in:
 * the project root, `.avodado/themes/` (even created after startup), and the
 * global `~/.avodado` root + its `themes/` — that's what keeps the studio's
 * theme picker and canvas live.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createConfigWatcher, type ConfigWatcher } from '../io/watch.js';

const roots: string[] = [];
const watchers: ConfigWatcher[] = [];

function scaffold(): { cwd: string; globalRoot: string } {
  const base = join(tmpdir(), `avo-watch-${randomBytes(6).toString('hex')}`);
  const cwd = join(base, 'proj');
  const globalRoot = join(base, 'home', '.avodado');
  mkdirSync(cwd, { recursive: true });
  mkdirSync(globalRoot, { recursive: true });
  roots.push(base);
  return { cwd, globalRoot };
}

afterEach(() => {
  for (const w of watchers.splice(0)) w.close();
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

/**
 * Fires `trigger` and polls until `count` grows past `from`, re-firing every
 * ~400ms: freshly created fs.watch watchers arm asynchronously, so a write
 * racing the arming can be missed entirely. Re-triggering mirrors reality —
 * users act long after the watcher armed — and keeps the test deterministic.
 */
async function triggerAndWait(
  count: () => number,
  from: number,
  trigger: () => void,
  label: string,
): Promise<void> {
  const deadline = Date.now() + 8_000;
  let lastFire = 0;
  while (Date.now() < deadline) {
    if (count() > from) return;
    if (Date.now() - lastFire > 400) {
      lastFire = Date.now();
      trigger();
    }
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`${label}: no config-watcher event within 8s`);
}

describe('createConfigWatcher', () => {
  it('fires for project avodado.theme.json / avodado.config.* writes', async () => {
    const { cwd, globalRoot } = scaffold();
    let n = 0;
    watchers.push(createConfigWatcher(cwd, () => (n += 1), globalRoot));

    const writeTheme = (): void =>
      writeFileSync(join(cwd, 'avodado.theme.json'), '{ "theme": "dark" }\n');
    await triggerAndWait(() => n, 0, writeTheme, 'project theme write');

    const before = n;
    const writeConfig = (): void =>
      writeFileSync(join(cwd, 'avodado.config.json'), '{ "docsDir": "docs" }\n');
    await triggerAndWait(() => n, before, writeConfig, 'project config write');
  }, 20_000);

  it('ignores unrelated files in the project root', async () => {
    const { cwd, globalRoot } = scaffold();
    let n = 0;
    watchers.push(createConfigWatcher(cwd, () => (n += 1), globalRoot));
    writeFileSync(join(cwd, 'README.md'), 'hi\n');
    await new Promise((r) => setTimeout(r, 300));
    expect(n).toBe(0);
  });

  it('fires when a theme is installed into .avodado/themes/ created AFTER startup', async () => {
    const { cwd, globalRoot } = scaffold();
    let n = 0;
    watchers.push(createConfigWatcher(cwd, () => (n += 1), globalRoot));

    // Simulates `avo theme install --local` on a fresh project.
    const install = (): void => {
      mkdirSync(join(cwd, '.avodado', 'themes'), { recursive: true });
      writeFileSync(join(cwd, '.avodado', 'themes', 'ember.theme.json'), '{ "theme": "dark" }\n');
    };
    await triggerAndWait(() => n, 0, install, 'local install into new dir');
  }, 20_000);

  it('fires for the global active theme and global installs', async () => {
    const { cwd, globalRoot } = scaffold();
    mkdirSync(join(globalRoot, 'themes'), { recursive: true });
    let n = 0;
    watchers.push(createConfigWatcher(cwd, () => (n += 1), globalRoot));

    // `avo theme <name> --global` / `avo theme install --use`.
    const setGlobal = (): void =>
      writeFileSync(join(globalRoot, 'avodado.theme.json'), '{ "theme": "soft" }\n');
    await triggerAndWait(() => n, 0, setGlobal, 'global active write');

    const before = n;
    // `avo theme install` (global is the default destination).
    const installGlobal = (): void =>
      writeFileSync(join(globalRoot, 'themes', 'sunset.theme.json'), '{ "theme": "dark" }\n');
    await triggerAndWait(() => n, before, installGlobal, 'global install');
  }, 20_000);

  it('is inert (but closeable) when nothing exists to watch', () => {
    const base = join(tmpdir(), `avo-watch-${randomBytes(6).toString('hex')}`);
    roots.push(base);
    const w = createConfigWatcher(join(base, 'nope'), () => {}, join(base, 'nohome'));
    w.close(); // no throw
  });
});
