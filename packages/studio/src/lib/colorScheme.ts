/**
 * The studio's colour scheme: the project's `colorScheme` (from `/api/meta`),
 * resolved to `dark` or `light`. Dark is the default; `system` follows the
 * OS live. The resolved value is stamped on `<html data-theme>` so the chrome
 * (styles.css) and the rendered document (the render skin's tokens) switch
 * together, and Canvas passes it on as `data-doc-theme` for the selection
 * colours that ride on the doc surface.
 */

import { useEffect } from 'react';
import { useStudio } from '../state/store.js';
import { useSystemDark } from './systemDark.js';

type ResolvedScheme = 'dark' | 'light';

/** The scheme in force right now. */
export function useColorScheme(): ResolvedScheme {
  const configured = useStudio((s) => s.meta?.colorScheme ?? 'dark');
  const systemDark = useSystemDark();
  if (configured === 'system') return systemDark ? 'dark' : 'light';
  return configured;
}

/** Stamps the resolved scheme on the document root (call once, at the app root). */
export function useApplyColorScheme(): ResolvedScheme {
  const scheme = useColorScheme();
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset['theme'] = scheme;
  }, [scheme]);
  return scheme;
}
