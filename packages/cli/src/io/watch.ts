/**
 * Shared file-watching helpers for the long-running commands (`avo serve`,
 * `avo studio`).
 *
 * {@link createDocsWatcher} watches a docs directory recursively, with a
 * per-directory fallback for platforms without recursive `fs.watch` (one
 * non-recursive watcher per subdirectory, re-walked on {@link DocsWatcher.resync}
 * so new directories get picked up). {@link createConfigWatcher} watches the
 * theme/config locations (project root, `.avodado/themes`, `~/.avodado` and
 * its `themes/`) and fires only for theme/config files.
 *
 * Watcher errors never propagate — a vanished directory just stops being
 * watched until the next resync.
 */

import { watch, readdirSync, existsSync, type FSWatcher } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** A running docs watcher. */
export interface DocsWatcher {
  /** Stops all underlying watchers. Idempotent. */
  close(): void;
  /**
   * Re-walks the directory tree so newly created subdirectories get watched.
   * No-op while the recursive watcher is active (it covers new dirs itself);
   * call after every event batch to keep the fallback mode complete.
   */
  resync(): void;
}

/** A running project-root config/theme watcher. */
export interface ConfigWatcher {
  /** Stops the watcher. Idempotent. */
  close(): void;
}

/** All directories under `root`, including `root` itself (for the watch fallback). */
function walkDirs(root: string): string[] {
  const out: string[] = [root];
  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const p = join(dir, e.name);
      out.push(p);
      walk(p);
    }
  };
  walk(root);
  return out;
}

/**
 * Watches `dirAbs` recursively, falling back to one non-recursive watcher per
 * subdirectory when recursive watch is unsupported (or errors later).
 *
 * `onEvent` receives the absolute path of the changed entry when the platform
 * reports a filename, else `undefined`. If `dirAbs` doesn't exist, the
 * returned watcher is inert.
 */
export function createDocsWatcher(
  dirAbs: string,
  onEvent: (absPath?: string) => void,
): DocsWatcher {
  const dirWatchers = new Map<string, FSWatcher>();
  let rootWatcher: FSWatcher | undefined;
  let usingFallback = false;

  /** Per-directory fallback: one non-recursive watcher per subdir. */
  const syncDirWatchers = (): void => {
    const dirs = new Set(walkDirs(dirAbs));
    for (const [dir, w] of dirWatchers) {
      if (!dirs.has(dir)) {
        w.close();
        dirWatchers.delete(dir);
      }
    }
    for (const dir of dirs) {
      if (dirWatchers.has(dir)) continue;
      try {
        const w = watch(dir, (_event, filename) => {
          onEvent(filename === null ? undefined : join(dir, filename));
        });
        w.on('error', () => dirWatchers.delete(dir));
        dirWatchers.set(dir, w);
      } catch {
        /* directory vanished between walk and watch — the next resync catches up */
      }
    }
  };

  if (existsSync(dirAbs)) {
    try {
      rootWatcher = watch(dirAbs, { recursive: true }, (_event, filename) => {
        onEvent(filename === null ? undefined : join(dirAbs, filename));
      });
      // An async watcher error (e.g. the dir vanished) must not crash the server.
      rootWatcher.on('error', () => {
        rootWatcher = undefined;
        usingFallback = true;
        syncDirWatchers();
      });
    } catch {
      // ERR_FEATURE_UNAVAILABLE_ON_PLATFORM (recursive watch unsupported).
      usingFallback = true;
      syncDirWatchers();
    }
  }

  return {
    resync(): void {
      if (usingFallback) syncDirWatchers();
    },
    close(): void {
      rootWatcher?.close();
      for (const w of dirWatchers.values()) w.close();
      dirWatchers.clear();
    },
  };
}

/**
 * Watches every location a theme/config change can land in (all
 * non-recursively, filtering by name so files created after startup count):
 *
 * - the project root, for `avodado.theme.*` / `avodado.config.*`;
 * - `.avodado/themes/` and `<globalRoot>/themes/`, for installed
 *   `*.theme.json` themes (they feed the studio's picker);
 * - `<globalRoot>` itself (`~/.avodado`), for the global active theme that
 *   `avo theme <name> --global` / `avo theme install --use` writes.
 *
 * Directories that appear later (e.g. the first `avo theme install --local`
 * creating `.avodado/themes/`, or the first global install creating
 * `~/.avodado` itself) are picked up two ways: parent-dir events trigger an
 * immediate resync, and a slow interval resync (a handful of `existsSync`
 * calls) covers dirs whose parents we don't watch plus fs.watch arming races.
 *
 * Inert (but valid) for any location that can't be watched.
 */
export function createConfigWatcher(
  cwd: string,
  onEvent: () => void,
  globalRoot: string = join(homedir(), '.avodado'),
): ConfigWatcher {
  const watchers = new Map<string, FSWatcher>();

  interface Target {
    readonly dir: string;
    /** Maps one fs event to `onEvent` and/or a resync for new child dirs. */
    readonly handle: (filename: string | null) => void;
  }
  const targets: readonly Target[] = [
    {
      dir: cwd,
      handle: (f) => {
        if (f !== null && /^avodado\.(theme|config)\./.test(f)) onEvent();
        if (f === null || f === '.avodado') resync(true);
      },
    },
    {
      // Only exists to notice `.avodado/themes/` being created later.
      dir: join(cwd, '.avodado'),
      handle: (f) => {
        if (f === null || f === 'themes') resync(true);
      },
    },
    {
      dir: join(cwd, '.avodado', 'themes'),
      handle: (f) => {
        if (f === null || f.endsWith('.theme.json')) onEvent();
      },
    },
    {
      dir: globalRoot,
      handle: (f) => {
        if (f !== null && /^avodado\.theme\./.test(f)) onEvent();
        if (f === null || f === 'themes') resync(true);
      },
    },
    {
      dir: join(globalRoot, 'themes'),
      handle: (f) => {
        if (f === null || f.endsWith('.theme.json')) onEvent();
      },
    },
  ];

  /**
   * (Re)establishes watchers for any target directory that exists but isn't
   * watched yet. With `fire`, a newly watchable themes dir also emits one
   * `onEvent` — the dir appearing almost always means a theme just landed in
   * it, and its own watcher attached too late to see that first write.
   */
  const resync = (fire: boolean): void => {
    for (const t of targets) {
      if (watchers.has(t.dir) || !existsSync(t.dir)) continue;
      try {
        const w = watch(t.dir, (_event, filename) => t.handle(filename));
        w.on('error', () => {
          w.close();
          watchers.delete(t.dir);
        });
        watchers.set(t.dir, w);
        if (fire) onEvent();
      } catch {
        /* vanished between existsSync and watch — a later resync catches up */
      }
    }
  };
  resync(false);
  // Slow safety net: discover watchable dirs whose creation we missed (an
  // unwatched parent, or an event racing the watcher getting armed). Firing
  // on discovery is right — a themes dir appearing means a theme just landed.
  const timer = setInterval(() => resync(true), 2_000);
  timer.unref();

  return {
    close(): void {
      clearInterval(timer);
      for (const w of watchers.values()) w.close();
      watchers.clear();
    },
  };
}
