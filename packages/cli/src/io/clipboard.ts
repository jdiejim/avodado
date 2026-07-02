/**
 * OS clipboard helper for commands that print copy-paste text (`avo skill`,
 * `avo design <slug>`).
 */

import { spawnSync } from 'node:child_process';

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
