/**
 * View-model for the Theme panel's swatch grid: the six built-in themes,
 * every installed (saved) theme from `/api/meta`, and a "project theme" card
 * when avodado.theme.json holds a custom resolution — the same option list
 * the old picker offered, as cards. Resolution reuses `state/derive.ts`; a
 * card's swatch is the three colors that identify a theme at a glance
 * (paper, primary ink, accent).
 */

import { themes, type ThemeName } from '@avodado/render';
import {
  CUSTOM_CHOICE,
  SAVED_PREFIX,
  resolveChoice,
  type ResolvedTheme,
  type ThemeMeta,
} from '../state/derive.js';

export interface ThemeSwatch {
  /** Page/card surface (`--white`). */
  readonly paper: string;
  /** Primary ink — headings, links, primary nodes (`--navy`). */
  readonly primary: string;
  /** Accent moment (`--highlight`). */
  readonly accent: string;
}

export interface ThemeCard {
  /** The store's theme-choice value this card applies via `setTheme`. */
  readonly choice: string;
  readonly label: string;
  readonly swatch: ThemeSwatch;
  readonly active: boolean;
}

/** The renderer's `:root` values (textbook) — fallback when a theme doesn't override. */
const ROOT_SWATCH = {
  '--white': '#fcfbf7',
  '--navy': '#233a5e',
  '--highlight': '#9c4a2f',
} as const;

type SwatchVar = keyof typeof ROOT_SWATCH;

/** The swatch a resolved (base + var overrides) theme paints. */
export function swatchFor(resolved: ResolvedTheme): ThemeSwatch {
  const pick = (k: SwatchVar): string =>
    resolved.themeVars?.[k] ?? themes[resolved.theme].vars[k] ?? ROOT_SWATCH[k];
  return { paper: pick('--white'), primary: pick('--navy'), accent: pick('--highlight') };
}

/**
 * The card list, in picker order: built-ins, then saved themes, then the
 * project's avodado.theme.json when it holds something (or is the current
 * choice — it must stay visible while active, even if meta lags).
 */
export function themeCards(meta: ThemeMeta | null, themeChoice: string): readonly ThemeCard[] {
  const cards: ThemeCard[] = (Object.keys(themes) as ThemeName[]).map((t) => ({
    choice: t,
    label: themes[t].label,
    swatch: swatchFor(resolveChoice(t, meta)),
    active: themeChoice === t,
  }));
  for (const saved of meta?.savedThemes ?? []) {
    const choice = `${SAVED_PREFIX}${saved.slug}`;
    cards.push({
      choice,
      label: saved.name,
      swatch: swatchFor(resolveChoice(choice, meta)),
      active: themeChoice === choice,
    });
  }
  if (meta?.active?.kind === 'custom' || themeChoice === CUSTOM_CHOICE) {
    cards.push({
      choice: CUSTOM_CHOICE,
      label: meta?.active?.name ?? 'Project theme',
      swatch: swatchFor(resolveChoice(CUSTOM_CHOICE, meta)),
      active: themeChoice === CUSTOM_CHOICE,
    });
  }
  return cards;
}
