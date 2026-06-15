/**
 * Theme system. Each theme is a set of CSS variable overrides applied via
 * `style="--navy: …; --blue: …"` on the `.docskin` root element. The full
 * stylesheet (see {@link houseCss}) reads those variables.
 *
 * Adding a new theme = add an entry here. No CSS changes needed.
 *
 * Ported verbatim from `resources/doc-studio.jsx` `THEMES`.
 */

/** Built-in theme names. */
export type ThemeName = 'minimal' | 'teal' | 'plum' | 'slate' | 'dark' | 'soft';

/** Default theme used when none is specified. */
export const DEFAULT_THEME: ThemeName = 'minimal';

interface ThemeDef {
  /** Human-readable label, for UI surfaces. */
  readonly label: string;
  /** CSS variable overrides applied at the `.docskin` root. */
  readonly vars: Readonly<Record<string, string>>;
}

/** The six built-in themes. */
export const themes: Readonly<Record<ThemeName, ThemeDef>> = {
  // Default: clean, modern, white. Near-black ink, a single blue accent
  // (#0070f3), geometric sans, subtle rounding — the base :root tokens, no
  // overrides needed.
  minimal: {
    label: 'Minimal',
    vars: {},
  },
  teal: {
    label: 'Teal',
    vars: {
      '--navy': '#0f766e',
      '--blue': '#0e7490',
      '--highlight': '#f59e0b',
    },
  },
  plum: {
    label: 'Plum',
    vars: {
      '--navy': '#6b21a8',
      '--blue': '#7c3aed',
      '--highlight': '#db2777',
    },
  },
  slate: {
    label: 'Slate sans',
    vars: {
      '--navy': '#334155',
      '--blue': '#475569',
      '--highlight': '#0d9488',
      '--font-display': '"Helvetica Neue", Arial, sans-serif',
    },
  },
  // Full dark mode. Surfaces (--white) and ink (--charcoal) flip; neutrals are
  // remapped so hairlines/edges read as light-on-dark. Accent hues are brightened
  // for contrast. Node "chip" pastels (in the SVG palette) stay light by design —
  // they read as colored cards on the dark canvas.
  dark: {
    label: 'Dark',
    vars: {
      '--white': '#161b26', // surfaces: page + cards + diagram bg
      '--charcoal': '#e6e9f2', // primary ink + structural strokes
      '--slate': '#c2c9d6', // secondary text
      '--gray': '#94a0b4', // muted text / dashed edges
      '--light-gray': '#222a39', // subtle panels / zone fills / bars
      '--rule': '#333f54', // hairlines / borders
      '--navy': '#5b9cff', // primary accent (headings, links, primary nodes)
      '--navy-tint': '#1e2a44',
      '--blue': '#7fb0ff',
      '--light-blue': '#16233a',
      '--highlight': '#f7a64a',
      '--highlight-soft': '#3a2c17',
      '--positive': '#3ecf7a',
      '--positive-soft': '#16301f',
      '--negative': '#ff6b6b',
      '--negative-soft': '#3a1d1d',
      '--purple': '#b78bff',
      '--purple-soft': '#271d3a',
      '--teal': '#4fd1c5',
      '--teal-soft': '#13302d',
      '--radius': '14px',
    },
  },
  // Soft modern light theme: rounded surfaces, indigo accent, warm-gray ink.
  soft: {
    label: 'Soft',
    vars: {
      '--navy': '#4f46e5',
      '--blue': '#6366f1',
      '--charcoal': '#1f2433',
      '--slate': '#4b5366',
      '--gray': '#8b93a7',
      '--rule': '#e6e8ef',
      '--light-gray': '#f5f6fa',
      '--highlight': '#f59e0b',
      '--radius': '16px',
      '--font-display': '"Helvetica Neue", Arial, sans-serif',
    },
  },
};

/**
 * Returns the CSS variable overrides for a theme as an inline-style string
 * (e.g. `"--navy:#0f766e;--blue:#0e7490;"`). Empty string for the default
 * minimal theme.
 */
export function themeStyle(name: ThemeName): string {
  const vars = themes[name].vars;
  const parts: string[] = [];
  for (const k of Object.keys(vars)) parts.push(`${k}:${vars[k]};`);
  return parts.join('');
}
