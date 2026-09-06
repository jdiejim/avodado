/**
 * `createConfigWatcher` must see `avodado.config.*` writes at the project
 * root — that's what keeps `avo serve` and the studio's Site mode in step
 * with config changes — and nothing else.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createConfigWatcher, type ConfigWatcher } from '../io/watch.js';

const roots: string[] = [];
const watchers: ConfigWatcher[] = [];

function scaffold(): { cwd: string } {
  const base = join(tmpdir(), `avo-watch-${randomBytes(6).toString('hex')}`);
  const cwd = join(base, 'proj');
  mkdirSync(cwd, { recursive: true });
  roots.push(base);
  return { cwd };
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
  it('fires for project avodado.config.* writes, including files created after startup', async () => {
    const { cwd } = scaffold();
    let n = 0;
    watchers.push(createConfigWatcher(cwd, () => (n += 1)));

    const writeConfig = (): void =>
      writeFileSync(join(cwd, 'avodado.config.json'), '{ "docsDir": "docs" }\n');
    await triggerAndWait(() => n, 0, writeConfig, 'project config write');

    const before = n;
    const writeYaml = (): void => writeFileSync(join(cwd, 'avodado.config.yml'), 'docsDir: docs\n');
    await triggerAndWait(() => n, before, writeYaml, 'second config file');
  }, 20_000);

  it('ignores unrelated files in the project root', async () => {
    const { cwd } = scaffold();
    let n = 0;
    watchers.push(createConfigWatcher(cwd, () => (n += 1)));
    writeFileSync(join(cwd, 'README.md'), 'hi\n');
    writeFileSync(join(cwd, 'avodado.theme.json'), '{}\n'); // a leftover from older versions
    await new Promise((r) => setTimeout(r, 300));
    expect(n).toBe(0);
  });

  it('is inert (but closeable) when nothing exists to watch', () => {
    const base = join(tmpdir(), `avo-watch-${randomBytes(6).toString('hex')}`);
    roots.push(base);
    const w = createConfigWatcher(join(base, 'nope'), () => {});
    w.close(); // no throw
  });
});
