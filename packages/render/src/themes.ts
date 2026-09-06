/**
 * Theme system. Each theme is a set of CSS variable overrides applied via
 * `style="--paper: …; --accent: …"` on the `.docskin` root element. The full
 * stylesheet (see {@link houseCss}) reads those variables.
 *
 * Themes are written in the skin's ROLE tokens only (`packages/render/DESIGN.md`):
 * `--paper --paper-2 --ink --muted --soft --rule --rule-solid --accent
 * --accent-tint --link --negative --negative-tint`, plus `--radius` and the
 * font stacks. The legacy names (`--navy`, `--charcoal`, `--gray`, …) are
 * aliases of those roles in `css.ts`, so they follow automatically.
 *
 * Every `soft`, `muted`, `accent`, and `link` value clears 4.5:1 against the
 * theme's own `--paper-2` (the darkest light surface text sits on), so the
 * contrast audit passes under any preset.
 *
 * Adding a new theme = add an entry here. No CSS changes needed.
 */

/** Built-in theme names. */
export type ThemeName = 'textbook' | 'minimal' | 'teal' | 'slate' | 'dark' | 'soft';

/** Default theme used when none is specified. */
export const DEFAULT_THEME: ThemeName = 'textbook';

interface ThemeDef {
  /** Human-readable label, for UI surfaces. */
  readonly label: string;
  /** CSS variable overrides applied at the `.docskin` root. */
  readonly vars: Readonly<Record<string, string>>;
}

/** The built-in themes. */
export const themes: Readonly<Record<ThemeName, ThemeDef>> = {
  // Default: the editorial skin as defined in css.ts — warm-neutral paper,
  // near-black ink, one rust accent. No overrides needed.
  textbook: {
    label: 'Editorial',
    vars: {},
  },
  // Clean, modern, white: pure white paper, neutral grays, a single blue
  // accent, a touch more rounding.
  minimal: {
    label: 'Minimal',
    vars: {
      '--paper': '#ffffff',
      '--paper-2': '#f4f4f4',
      '--ink': '#111111',
      '--muted': '#4a4a4a',
      '--soft': '#616161',
      '--rule': 'rgba(17,17,17,.12)',
      '--rule-solid': '#d9d9d9',
      '--accent': '#0062d6',
      '--accent-tint': 'rgba(0,98,214,.08)',
      '--link': '#0062d6',
      '--radius': '8px',
    },
  },
  // The editorial paper with a deep teal accent and a cyan link.
  teal: {
    label: 'Teal',
    vars: {
      '--accent': '#0f766e',
      '--accent-tint': 'rgba(15,118,110,.09)',
      '--link': '#0e7490',
    },
  },
  // Cool neutrals: blue-gray paper and ink, a dark teal accent, Helvetica display.
  slate: {
    label: 'Slate sans',
    vars: {
      '--paper': '#f5f6f8',
      '--paper-2': '#e9ecf0',
      '--ink': '#1e293b',
      '--muted': '#475569',
      '--soft': '#5c6879',
      '--rule': 'rgba(30,41,59,.14)',
      '--rule-solid': '#c5ccd6',
      '--accent': '#0d6d66',
      '--accent-tint': 'rgba(13,109,102,.09)',
      '--link': '#3b5f8a',
      '--font-display': '"Helvetica Neue", Arial, sans-serif',
    },
  },
  // Full dark mode: the skin's dark set, applied explicitly so a document can
  // be dark regardless of the reader's system preference. `document.ts` also
  // stamps `data-theme="dark"` so the series ramp and code tokens flip.
  dark: {
    label: 'Dark',
    vars: {
      '--paper': '#161b26',
      '--paper-2': '#222a39',
      '--ink': '#e6e9f2',
      '--muted': '#aeb5c3',
      '--soft': '#9aa3b3',
      '--rule': 'rgba(230,233,242,.14)',
      '--rule-solid': '#333f54',
      '--accent': '#f0865c',
      '--accent-tint': 'rgba(240,134,92,.14)',
      '--link': '#7fb0ff',
      '--negative': '#f5a39b',
      '--negative-tint': 'rgba(245,163,155,.14)',
      '--radius': '10px',
    },
  },
  // Soft modern light theme: white paper with a lavender secondary surface,
  // indigo accent, rounder corners.
  soft: {
    label: 'Soft',
    vars: {
      '--paper': '#ffffff',
      '--paper-2': '#efedf8',
      '--ink': '#1f2433',
      '--muted': '#4b4f66',
      '--soft': '#5f6476',
      '--rule': 'rgba(31,36,51,.12)',
      '--rule-solid': '#d8d6e6',
      '--accent': '#4338ca',
      '--accent-tint': 'rgba(67,56,202,.08)',
      '--link': '#4f46e5',
      '--radius': '12px',
      '--font-display': '"Helvetica Neue", Arial, sans-serif',
    },
  },
};

/**
 * Returns the CSS variable overrides for a theme as an inline-style string
 * (e.g. `"--accent:#0f766e;--link:#0e7490;"`). Empty string for the default
 * editorial theme.
 */
export function themeStyle(name: ThemeName): string {
  const vars = themes[name].vars;
  const parts: string[] = [];
  for (const k of Object.keys(vars)) parts.push(`${k}:${vars[k]};`);
  return parts.join('');
}
