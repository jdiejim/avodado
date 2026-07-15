/** Tiny localStorage-backed one-shot flags (safe in private mode). */

const SLASH_USED_KEY = 'avodado-studio-slash-used';

/** True once the user has ever opened the slash menu (kills the "/ next" hint). */
export function slashUsed(): boolean {
  try {
    return window.localStorage.getItem(SLASH_USED_KEY) === '1';
  } catch {
    return true;
  }
}

/** Records that the slash menu has been used. */
export function markSlashUsed(): void {
  try {
    window.localStorage.setItem(SLASH_USED_KEY, '1');
  } catch {
    /* private mode */
  }
}
