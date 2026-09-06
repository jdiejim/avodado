/**
 * The look. There is exactly one: the editorial skin defined in `css.ts`
 * (`packages/render/DESIGN.md`) — warm-neutral paper, near-black ink, one rust
 * accent. Dark mode is not a theme: the tokens flip on the reader's
 * `prefers-color-scheme`, or when a host page stamps `data-theme="dark"`.
 *
 * This module keeps the shape a preset system needs (a name, a label, a set
 * of `:root` variable overrides) so presets can return without an API change.
 * Until then the single entry overrides nothing and `themeStyle()` is `''`.
 * Callers that need a one-off variable override use `RenderPartsOptions.themeVars`
 * — an internal escape hatch with no user-facing surface.
 */

/** The single look. */
export type ThemeName = 'textbook';

/** The look used when none is specified (there is only one). */
export const DEFAULT_THEME: ThemeName = 'textbook';

interface ThemeDef {
  /** Human-readable label, for UI surfaces. */
  readonly label: string;
  /** CSS variable overrides applied at the `.docskin` root. */
  readonly vars: Readonly<Record<string, string>>;
}

/** The looks. One entry: the editorial skin, which `css.ts` already defines. */
export const themes: Readonly<Record<ThemeName, ThemeDef>> = {
  textbook: {
    label: 'Editorial',
    vars: {},
  },
};

/**
 * Returns the CSS variable overrides for a look as a declaration string
 * (e.g. `"--accent:#0f766e;"`). Always `''` today — the editorial skin is
 * the stylesheet's own `:root`.
 */
export function themeStyle(name: ThemeName): string {
  const vars = themes[name].vars;
  const parts: string[] = [];
  for (const k of Object.keys(vars)) parts.push(`${k}:${vars[k]};`);
  return parts.join('');
}
