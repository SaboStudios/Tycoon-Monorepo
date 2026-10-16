import { describe, expect, it } from 'vitest';

import {
  getChartPalette,
  getContrastRatio,
  type ResolvedTheme,
} from './index';

const THEMES: ResolvedTheme[] = ['light', 'dark'];

// Background colours used by the theme, mirroring the values consumed by the
// Storybook preview so the contrast contract matches deterministic rendering.
const THEME_BACKGROUND: Record<ResolvedTheme, string> = {
  light: '#ffffff',
  dark: '#0b0b0f',
};

// Minimum contrast ratio documented in frontend/BRAND.md for chart colours
// against their theme background.
const MIN_CONTRAST_RATIO = 1;

describe('getChartPalette', () => {
  it.each(THEMES)('returns equal arrays for repeated calls (%s)', (theme) => {
    const first = getChartPalette(theme);
    const second = getChartPalette(theme);

    expect(second).toEqual(first);
  });

  it('returns a non-empty palette for each theme', () => {
    for (const theme of THEMES) {
      expect(getChartPalette(theme).length).toBeGreaterThan(0);
    }
  });

  it('returns different palettes for light and dark themes', () => {
    expect(getChartPalette('light')).not.toEqual(getChartPalette('dark'));
  });
});

describe('getContrastRatio', () => {
  it.each(THEMES)(
    'returns a finite ratio greater than %s for each palette entry (%s)',
    (theme) => {
      const background = THEME_BACKGROUND[theme];

      for (const color of getChartPalette(theme)) {
        const ratio = getContrastRatio(color, background);

        expect(Number.isFinite(ratio)).toBe(true);
        expect(ratio).toBeGreaterThan(MIN_CONTRAST_RATIO);
      }
    },
  );

  it('produces different ratios for light and dark backgrounds', () => {
    const [color] = getChartPalette('light');

    const lightRatio = getContrastRatio(color, THEME_BACKGROUND.light);
    const darkRatio = getContrastRatio(color, THEME_BACKGROUND.dark);

    expect(lightRatio).not.toBe(darkRatio);
  });
});
