import { describe, expect, it } from "vitest";
import { getChartPalette, getContrastRatio } from "./chart-palette";

describe("getChartPalette", () => {
  it("keeps dark chart text highly legible against the dark chart background", () => {
    const palette = getChartPalette("dark");

    expect(getContrastRatio(palette.foreground, palette.background)).toBeGreaterThanOrEqual(12);
  });

  it("keeps every dark chart series color readable against the dark chart background", () => {
    const palette = getChartPalette("dark");

    palette.series.forEach((seriesColor) => {
      expect(getContrastRatio(seriesColor, palette.background)).toBeGreaterThanOrEqual(3);
    });
  });

  it("keeps light chart text readable against the light chart background", () => {
    const palette = getChartPalette("light");

    expect(getContrastRatio(palette.foreground, palette.background)).toBeGreaterThanOrEqual(7);
  });
});
