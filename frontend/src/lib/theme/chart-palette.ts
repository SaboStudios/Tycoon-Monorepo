import type { ResolvedTheme } from "./constants";

export type ChartPalette = {
  background: string;
  foreground: string;
  grid: string;
  series: string[];
};

const chartPalettes: Record<ResolvedTheme, ChartPalette> = {
  light: {
    background: "#F7FAFB",
    foreground: "#12262A",
    grid: "#BBD4D6",
    series: ["#006D77", "#00A7B5", "#1D4ED8", "#EA580C"],
  },
  dark: {
    background: "#07181B",
    foreground: "#E6FEFF",
    grid: "#2B5C60",
    series: ["#00F0FF", "#00FFA8", "#8AB4FF", "#FFB86C"],
  },
};

export function getChartPalette(theme: ResolvedTheme): ChartPalette {
  return chartPalettes[theme];
}

function hexToRgb(hex: string) {
  const normalizedHex = hex.replace("#", "");
  const value =
    normalizedHex.length === 3
      ? normalizedHex
          .split("")
          .map((char) => char + char)
          .join("")
      : normalizedHex;

  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function toRelativeLuminance(channel: number) {
  const normalizedChannel = channel / 255;

  return normalizedChannel <= 0.03928
    ? normalizedChannel / 12.92
    : ((normalizedChannel + 0.055) / 1.055) ** 2.4;
}

export function getContrastRatio(firstHex: string, secondHex: string) {
  const firstColor = hexToRgb(firstHex);
  const secondColor = hexToRgb(secondHex);
  const firstLuminance =
    0.2126 * toRelativeLuminance(firstColor.r) +
    0.7152 * toRelativeLuminance(firstColor.g) +
    0.0722 * toRelativeLuminance(firstColor.b);
  const secondLuminance =
    0.2126 * toRelativeLuminance(secondColor.r) +
    0.7152 * toRelativeLuminance(secondColor.g) +
    0.0722 * toRelativeLuminance(secondColor.b);
  const lighterLuminance = Math.max(firstLuminance, secondLuminance);
  const darkerLuminance = Math.min(firstLuminance, secondLuminance);

  return (lighterLuminance + 0.05) / (darkerLuminance + 0.05);
}
