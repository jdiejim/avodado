/**
 * Shared file-watching helpers for the long-running commands (`avo serve`,
 * `avo studio`).
 *
 * {@link createDocsWatcher} watches a docs directory recursively, with a
 * per-directory fallback for platforms without recursive `fs.watch` (one
 * non-recursive watcher per subdirectory, re-walked on {@link DocsWatcher.resync}
 * so new directories get picked up). {@link createConfigWatcher} watches the
 * project root and fires only for `avodado.config.*` files.
 *
 * Watcher errors never propagate — a vanished directory just stops being
 * watched until the next resync.
 */

import { watch, readdirSync, existsSync, type FSWatcher } from 'node:fs';
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

/** A running project-root config watcher. */
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
 * Watches the project root (non-recursively, filtering by name so a config
 * file created after startup counts) and fires `onEvent` for every
 * `avodado.config.*` change. Inert (but valid) when `cwd` can't be watched.
 */
export function createConfigWatcher(cwd: string, onEvent: () => void): ConfigWatcher {
  let watcher: FSWatcher | undefined;
  if (existsSync(cwd)) {
    try {
      watcher = watch(cwd, (_event, filename) => {
        if (filename !== null && /^avodado\.config\./.test(filename)) onEvent();
      });
      watcher.on('error', () => {
        watcher?.close();
        watcher = undefined;
      });
    } catch {
      /* vanished between existsSync and watch — stay inert */
    }
  }
  return {
    close(): void {
      watcher?.close();
      watcher = undefined;
    },
  };
}
