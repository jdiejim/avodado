/**
 * The friendly theme fields the Theme Generator exposes — the same 11 colors
 * and 3 font slots `avo theme` writes into a `*.theme.json` file, each mapped
 * to the CSS variable the renderer reads (so the generator can live-preview by
 * feeding `themeVars` straight to the store). Kept in lockstep with
 * `COLOR_TO_VAR` / `FONT_TO_VAR` in `@avodado/cli`'s `io/theme.ts`.
 */

export interface ThemeColorField {
  /** Friendly name written to the theme file's `colors`. */
  readonly key: string;
  /** The CSS variable it drives (for live preview via `themeVars`). */
  readonly cssVar: string;
  readonly label: string;
  readonly hint: string;
  /** A sensible starting value (textbook-ish) for the color input. */
  readonly default: string;
}

export const THEME_COLORS: readonly ThemeColorField[] = [
  { key: 'primary', cssVar: '--navy', label: 'Primary', hint: 'headings, links, primary nodes', default: '#1f3a5f' },
  { key: 'secondary', cssVar: '--blue', label: 'Secondary', hint: 'secondary accents, consumer nodes', default: '#2563eb' },
  { key: 'accent', cssVar: '--highlight', label: 'Accent', hint: 'highlight pills, keys, "current"', default: '#c2683c' },
  { key: 'positive', cssVar: '--positive', label: 'Positive', hint: 'success, done, service nodes', default: '#2e7d32' },
  { key: 'negative', cssVar: '--negative', label: 'Negative', hint: 'errors, danger, forbidden', default: '#c62828' },
  { key: 'purple', cssVar: '--purple', label: 'Purple', hint: 'data, context, provider nodes', default: '#7c3aed' },
  { key: 'teal', cssVar: '--teal', label: 'Teal', hint: 'queues, topics, caches', default: '#0d9488' },
  { key: 'ink', cssVar: '--charcoal', label: 'Ink', hint: 'body text', default: '#2b2b2b' },
  { key: 'muted', cssVar: '--gray', label: 'Muted', hint: 'captions, dim text, external', default: '#6b7280' },
  { key: 'rule', cssVar: '--rule', label: 'Rule', hint: 'hairlines, borders, dividers', default: '#dcd6c8' },
  { key: 'paper', cssVar: '--white', label: 'Paper', hint: 'surfaces, card fills', default: '#faf6ee' },
];

export interface ThemeFontField {
  readonly key: string;
  readonly cssVar: string;
  readonly label: string;
  readonly placeholder: string;
}

export const THEME_FONTS: readonly ThemeFontField[] = [
  { key: 'display', cssVar: '--font-display', label: 'Display', placeholder: 'e.g. Georgia, serif' },
  { key: 'body', cssVar: '--font-body', label: 'Body', placeholder: 'e.g. system-ui, sans-serif' },
  { key: 'mono', cssVar: '--font-mono', label: 'Mono', placeholder: 'e.g. ui-monospace, monospace' },
];

/** The six built-in base themes a generated theme extends. */
export const BASE_THEMES = ['textbook', 'minimal', 'soft', 'dark', 'teal', 'slate'] as const;
