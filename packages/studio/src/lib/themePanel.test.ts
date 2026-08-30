import { describe, expect, it } from 'vitest';
import { themes } from '@avodado/render';
import { swatchFor, themeCards } from './themePanel.js';
import type { ThemeMeta } from '../state/derive.js';

const savedMeta: ThemeMeta = {
  theme: 'textbook',
  savedThemes: [
    { slug: 'acme', name: 'Acme brand', theme: 'minimal', themeVars: { '--highlight': '#ff0000' } },
    { slug: 'night', name: 'Night', theme: 'dark' },
  ],
};

describe('themeCards', () => {
  it('lists the built-ins first, in registry order, labeled', () => {
    const cards = themeCards(null, 'textbook');
    const builtins = Object.keys(themes);
    expect(cards.map((c) => c.choice)).toEqual(builtins);
    expect(cards[0]?.label).toBe(themes.textbook.label);
  });

  it('appends saved themes with namespaced choices', () => {
    const cards = themeCards(savedMeta, 'textbook');
    const saved = cards.slice(Object.keys(themes).length);
    expect(saved.map((c) => c.choice)).toEqual(['saved:acme', 'saved:night']);
    expect(saved.map((c) => c.label)).toEqual(['Acme brand', 'Night']);
  });

  it('marks exactly the current choice active', () => {
    const cards = themeCards(savedMeta, 'saved:acme');
    expect(cards.filter((c) => c.active).map((c) => c.choice)).toEqual(['saved:acme']);
  });

  it('shows a project-theme card only when custom is on disk or chosen', () => {
    expect(themeCards(savedMeta, 'textbook').some((c) => c.choice === 'custom')).toBe(false);

    const customMeta: ThemeMeta = {
      ...savedMeta,
      active: { kind: 'custom', name: 'avodado.theme.json' },
    };
    const withCustom = themeCards(customMeta, 'custom');
    const custom = withCustom.find((c) => c.choice === 'custom');
    expect(custom?.label).toBe('avodado.theme.json');
    expect(custom?.active).toBe(true);

    // Chosen but meta lags (no active info): the card must stay visible.
    const lagging = themeCards(savedMeta, 'custom').find((c) => c.choice === 'custom');
    expect(lagging?.label).toBe('Project theme');
  });

  it('swatches merge the base theme vars under the saved overrides', () => {
    const cards = themeCards(savedMeta, 'textbook');
    const acme = cards.find((c) => c.choice === 'saved:acme');
    // --highlight overridden by the saved theme; --white from its minimal base.
    expect(acme?.swatch.accent).toBe('#ff0000');
    expect(acme?.swatch.paper).toBe(themes.minimal.vars['--white']);
  });
});

describe('swatchFor', () => {
  it('falls back to the renderer root values for textbook', () => {
    expect(swatchFor({ theme: 'textbook' })).toEqual({
      paper: '#fcfbf7',
      primary: '#233a5e',
      accent: '#9c4a2f',
    });
  });

  it('reads a dark surface from the theme vars', () => {
    expect(swatchFor({ theme: 'dark' }).paper).toBe(themes.dark.vars['--white']);
  });
});
