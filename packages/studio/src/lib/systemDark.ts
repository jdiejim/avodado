/**
 * Whether the system prefers a dark color scheme, as a React value that
 * follows the OS setting. The renderer's tokens flip on
 * `prefers-color-scheme` when no theme pins the paper, so the doc surface
 * (and the selection outlines that ride on it) must know the same thing.
 */

import { useEffect, useState } from 'react';

const QUERY = '(prefers-color-scheme: dark)';

/** One-shot read; `false` where `matchMedia` does not exist (tests). */
export function systemDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY).matches
    : false;
}

/** The system dark preference, updated live. */
export function useSystemDark(): boolean {
  const [dark, setDark] = useState(systemDark);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent): void => setDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return dark;
}
