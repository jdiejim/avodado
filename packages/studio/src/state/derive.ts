/**
 * Memoised derivation of the parsed/validated/rendered views of the current
 * source. Lives outside React so every component shares one computation per
 * (source, slug, theme, themeVars) tuple — the store holds only the raw
 * strings, and this module turns them into a {@link Document}, diagnostics,
 * and per-segment HTML.
 */

import {
  parseDocument,
  validateDocument,
  type Diagnostic,
  type Document,
} from '@avodado/core';
import {
  DEFAULT_THEME,
  renderDocumentSegments,
  themes,
  type DocumentSegmentsResult,
  type ThemeName,
} from '@avodado/render';

/** Everything derivable from the current source. */
export interface Derived {
  readonly doc: Document;
  readonly diagnostics: readonly Diagnostic[];
  /** `null` only if the renderer itself threw (a renderer bug, not user error). */
  readonly rendered: DocumentSegmentsResult | null;
  readonly renderError: string | null;
}

/** Narrows an arbitrary string (e.g. from `/api/meta`) to a ThemeName. */
export function asThemeName(value: string | undefined, fallback: ThemeName): ThemeName {
  return value !== undefined && value in themes ? (value as ThemeName) : fallback;
}

// ── Theme choice ─────────────────────────────────────────────────────────────
// The picker's value is a CHOICE string: a built-in ThemeName, `saved:<slug>`
// (an installed theme from /api/meta's savedThemes), or `custom` (whatever
// avodado.theme.json resolves to). A choice resolves to the (base, vars) pair
// that rendering actually consumes.

/** The picker value representing the project's own avodado.theme.json. */
export const CUSTOM_CHOICE = 'custom';
/** Prefix namespacing saved-theme picker values, so slugs can't collide with built-ins. */
export const SAVED_PREFIX = 'saved:';

/** A theme choice resolved to what the renderer needs. */
export interface ResolvedTheme {
  readonly theme: ThemeName;
  readonly themeVars?: Readonly<Record<string, string>>;
}

/** The slice of `/api/meta` the theme-choice helpers read. */
export interface ThemeMeta {
  readonly theme?: string;
  readonly themeVars?: Readonly<Record<string, string>>;
  readonly active?: {
    readonly kind: 'builtin' | 'saved' | 'custom' | 'none';
    readonly id?: string;
    readonly name?: string;
  };
  readonly savedThemes?: ReadonlyArray<{
    readonly slug: string;
    readonly name: string;
    readonly theme?: string;
    readonly themeVars?: Readonly<Record<string, string>>;
  }>;
}

/** The choice that mirrors what's on disk — what the select shows after (re)sync. */
export function diskChoice(meta: ThemeMeta | null): string {
  const active = meta?.active;
  if (active?.kind === 'saved' && active.id !== undefined) {
    const hit = meta?.savedThemes?.some((t) => t.slug === active.id) ?? false;
    return hit ? `${SAVED_PREFIX}${active.id}` : CUSTOM_CHOICE;
  }
  if (active?.kind === 'custom') return CUSTOM_CHOICE;
  // builtin / none / older server: fall back to the resolved base name. A
  // var-carrying theme without `active` info still needs its vars applied.
  if (active === undefined && meta?.themeVars !== undefined) return CUSTOM_CHOICE;
  return asThemeName(active?.id ?? meta?.theme, DEFAULT_THEME);
}

/**
 * Resolves a choice to (base theme, vars). Picking a BUILT-IN is a pure
 * preview of that built-in (no disk vars overlaid) — the disk theme is its
 * own picker entry now, so mixing the two would be dishonest.
 */
export function resolveChoice(choice: string, meta: ThemeMeta | null): ResolvedTheme {
  if (choice.startsWith(SAVED_PREFIX)) {
    const slug = choice.slice(SAVED_PREFIX.length);
    const hit = meta?.savedThemes?.find((t) => t.slug === slug);
    if (hit !== undefined) {
      return {
        theme: asThemeName(hit.theme, DEFAULT_THEME),
        ...(hit.themeVars !== undefined ? { themeVars: hit.themeVars } : {}),
      };
    }
    // The saved theme vanished from meta — fall through to the disk theme.
    choice = CUSTOM_CHOICE;
  }
  if (choice === CUSTOM_CHOICE) {
    return {
      theme: asThemeName(meta?.theme, DEFAULT_THEME),
      ...(meta?.themeVars !== undefined ? { themeVars: meta.themeVars } : {}),
    };
  }
  return { theme: asThemeName(choice, DEFAULT_THEME) };
}

/** Whether two meta snapshots resolve the DISK theme identically (base + vars + identity). */
export function sameDiskTheme(a: ThemeMeta | null, b: ThemeMeta | null): boolean {
  if (a === null || b === null) return a === b;
  const ra = resolveChoice(diskChoice(a), a);
  const rb = resolveChoice(diskChoice(b), b);
  return (
    diskChoice(a) === diskChoice(b) &&
    ra.theme === rb.theme &&
    JSON.stringify(ra.themeVars ?? null) === JSON.stringify(rb.themeVars ?? null)
  );
}

/**
 * Whether the rendered document paints a dark surface — selection outlines
 * and direct-edit highlights swap to high-contrast colors on it (navy on
 * near-black is invisible). Decided by the theme name, or by a themeVars
 * override that darkens the paper (`--white`).
 */
export function docSurface(
  theme: string,
  themeVars?: Readonly<Record<string, string>>,
): 'dark' | 'light' {
  if (theme === 'dark') return 'dark';
  const paper = themeVars?.['--white'];
  if (paper !== undefined) {
    const m = /^#([0-9a-f]{6})$/i.exec(paper.trim());
    if (m !== null) {
      const n = parseInt(m[1] ?? '', 16);
      // Perceived brightness (0-255); below mid-gray reads as a dark surface.
      const lum = 0.299 * ((n >> 16) & 0xff) + 0.587 * ((n >> 8) & 0xff) + 0.114 * (n & 0xff);
      if (lum < 110) return 'dark';
    }
  }
  return 'light';
}

interface CacheEntry {
  source: string;
  slug: string;
  theme: ThemeName;
  themeVars: Readonly<Record<string, string>> | undefined;
  value: Derived;
}

let cache: CacheEntry | null = null;

/**
 * Parses, validates, and renders `source`. Memoised on all four inputs
 * (reference equality for `themeVars` — the store keeps it stable).
 */
export function derive(
  source: string,
  slug: string,
  theme: ThemeName,
  themeVars?: Readonly<Record<string, string>>,
): Derived {
  if (
    cache !== null &&
    cache.source === source &&
    cache.slug === slug &&
    cache.theme === theme &&
    cache.themeVars === themeVars
  ) {
    return cache.value;
  }
  const doc = parseDocument(source, slug);
  const diagnostics = validateDocument(doc, `${slug}.md`);
  let rendered: DocumentSegmentsResult | null = null;
  let renderError: string | null = null;
  try {
    rendered = renderDocumentSegments(doc, {
      theme,
      ...(themeVars !== undefined ? { themeVars } : {}),
    });
  } catch (err) {
    renderError = err instanceof Error ? err.message : String(err);
  }
  const value: Derived = { doc, diagnostics, rendered, renderError };
  cache = { source, slug, theme, themeVars, value };
  return value;
}
