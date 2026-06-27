import { describe, expect, it } from "vitest";
import {
  DARK_CHART_PALETTE,
  LIGHT_CHART_PALETTE,
  getChartPalette,
  getContrastRatio,
} from "./chart-palette";

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

// Tree-shake audit: named palette constants must be independently importable
// so bundlers can eliminate the unused theme at build time.
describe("tree-shake audit — named palette exports", () => {
  it("LIGHT_CHART_PALETTE is a standalone export with the expected shape", () => {
    expect(LIGHT_CHART_PALETTE).toMatchObject({
      background: expect.any(String),
      foreground: expect.any(String),
      grid: expect.any(String),
      series: expect.arrayContaining([expect.any(String)]),
    });
  });

  it("DARK_CHART_PALETTE is a standalone export with the expected shape", () => {
    expect(DARK_CHART_PALETTE).toMatchObject({
      background: expect.any(String),
      foreground: expect.any(String),
      grid: expect.any(String),
      series: expect.arrayContaining([expect.any(String)]),
    });
  });

  it("getChartPalette('light') returns the same reference as LIGHT_CHART_PALETTE", () => {
    expect(getChartPalette("light")).toBe(LIGHT_CHART_PALETTE);
  });

  it("getChartPalette('dark') returns the same reference as DARK_CHART_PALETTE", () => {
    expect(getChartPalette("dark")).toBe(DARK_CHART_PALETTE);
  });

  it("LIGHT_CHART_PALETTE and DARK_CHART_PALETTE are distinct objects", () => {
    expect(LIGHT_CHART_PALETTE).not.toBe(DARK_CHART_PALETTE);
  });
});
