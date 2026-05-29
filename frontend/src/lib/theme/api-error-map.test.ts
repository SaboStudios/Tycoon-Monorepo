import { describe, expect, it } from "vitest";
import type { ApiErrorCode } from "@/lib/api/errors";
import {
  API_ERROR_SEVERITY,
  getApiErrorSeverity,
  getApiErrorTheme,
  getErrorThemeTokens,
  type ErrorSeverity,
  type ErrorThemeTokens,
} from ".";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_CODES: ApiErrorCode[] = [
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_ERROR",
  "CONFLICT",
  "RATE_LIMIT",
  "INTERNAL_SERVER_ERROR",
  "NETWORK_ERROR",
  "TIMEOUT",
  "UNKNOWN",
];

const ALL_SEVERITIES: ErrorSeverity[] = ["critical", "warning", "transient"];
const ALL_THEMES = ["light", "dark"] as const;

function isHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

function assertValidTokens(tokens: ErrorThemeTokens) {
  expect(isHexColor(tokens.background)).toBe(true);
  expect(isHexColor(tokens.foreground)).toBe(true);
  expect(isHexColor(tokens.border)).toBe(true);
  expect(isHexColor(tokens.icon)).toBe(true);
  expect(ALL_SEVERITIES).toContain(tokens.severity);
}

// ---------------------------------------------------------------------------
// API_ERROR_SEVERITY — completeness
// ---------------------------------------------------------------------------

describe("API_ERROR_SEVERITY", () => {
  it("has a severity entry for every ApiErrorCode", () => {
    for (const code of ALL_CODES) {
      expect(API_ERROR_SEVERITY[code]).toBeDefined();
      expect(ALL_SEVERITIES).toContain(API_ERROR_SEVERITY[code]);
    }
  });

  it("classifies auth errors as critical", () => {
    expect(API_ERROR_SEVERITY.UNAUTHORIZED).toBe("critical");
    expect(API_ERROR_SEVERITY.FORBIDDEN).toBe("critical");
  });

  it("classifies user-correctable errors as warning", () => {
    expect(API_ERROR_SEVERITY.NOT_FOUND).toBe("warning");
    expect(API_ERROR_SEVERITY.VALIDATION_ERROR).toBe("warning");
    expect(API_ERROR_SEVERITY.CONFLICT).toBe("warning");
  });

  it("classifies transient/infrastructure errors as transient", () => {
    expect(API_ERROR_SEVERITY.RATE_LIMIT).toBe("transient");
    expect(API_ERROR_SEVERITY.INTERNAL_SERVER_ERROR).toBe("transient");
    expect(API_ERROR_SEVERITY.NETWORK_ERROR).toBe("transient");
    expect(API_ERROR_SEVERITY.TIMEOUT).toBe("transient");
    expect(API_ERROR_SEVERITY.UNKNOWN).toBe("transient");
  });
});

// ---------------------------------------------------------------------------
// getApiErrorSeverity
// ---------------------------------------------------------------------------

describe("getApiErrorSeverity", () => {
  it("returns the correct severity for every known code", () => {
    for (const code of ALL_CODES) {
      expect(getApiErrorSeverity(code)).toBe(API_ERROR_SEVERITY[code]);
    }
  });

  it("falls back to transient for an unknown future code", () => {
    expect(getApiErrorSeverity("FUTURE_CODE" as ApiErrorCode)).toBe("transient");
  });
});

// ---------------------------------------------------------------------------
// getApiErrorTheme — token shape
// ---------------------------------------------------------------------------

describe("getApiErrorTheme — token shape", () => {
  it.each(ALL_CODES)("returns valid hex tokens for code %s in dark theme", (code) => {
    assertValidTokens(getApiErrorTheme(code, "dark"));
  });

  it.each(ALL_CODES)("returns valid hex tokens for code %s in light theme", (code) => {
    assertValidTokens(getApiErrorTheme(code, "light"));
  });

  it("severity in returned tokens matches API_ERROR_SEVERITY", () => {
    for (const code of ALL_CODES) {
      for (const theme of ALL_THEMES) {
        const tokens = getApiErrorTheme(code, theme);
        expect(tokens.severity).toBe(API_ERROR_SEVERITY[code]);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// getApiErrorTheme — light vs dark contrast
// ---------------------------------------------------------------------------

describe("getApiErrorTheme — light vs dark produce distinct palettes", () => {
  it.each(ALL_CODES)(
    "light and dark tokens differ for code %s",
    (code) => {
      const light = getApiErrorTheme(code, "light");
      const dark = getApiErrorTheme(code, "dark");
      // At least one color token must differ between themes
      const differs =
        light.background !== dark.background ||
        light.foreground !== dark.foreground ||
        light.border !== dark.border ||
        light.icon !== dark.icon;
      expect(differs).toBe(true);
    },
  );
});

// ---------------------------------------------------------------------------
// getApiErrorTheme — same severity → same palette within a theme
// ---------------------------------------------------------------------------

describe("getApiErrorTheme — codes with same severity share palette", () => {
  it("UNAUTHORIZED and FORBIDDEN share the same dark palette", () => {
    const a = getApiErrorTheme("UNAUTHORIZED", "dark");
    const b = getApiErrorTheme("FORBIDDEN", "dark");
    expect(a.background).toBe(b.background);
    expect(a.foreground).toBe(b.foreground);
    expect(a.border).toBe(b.border);
    expect(a.icon).toBe(b.icon);
  });

  it("NETWORK_ERROR and TIMEOUT share the same light palette", () => {
    const a = getApiErrorTheme("NETWORK_ERROR", "light");
    const b = getApiErrorTheme("TIMEOUT", "light");
    expect(a.background).toBe(b.background);
    expect(a.foreground).toBe(b.foreground);
  });
});

// ---------------------------------------------------------------------------
// getErrorThemeTokens — direct severity lookup
// ---------------------------------------------------------------------------

describe("getErrorThemeTokens", () => {
  it.each(ALL_SEVERITIES)(
    "returns valid hex tokens for severity %s in dark theme",
    (severity) => {
      assertValidTokens(getErrorThemeTokens(severity, "dark"));
    },
  );

  it.each(ALL_SEVERITIES)(
    "returns valid hex tokens for severity %s in light theme",
    (severity) => {
      assertValidTokens(getErrorThemeTokens(severity, "light"));
    },
  );

  it("severity field in returned tokens matches the input severity", () => {
    for (const severity of ALL_SEVERITIES) {
      for (const theme of ALL_THEMES) {
        expect(getErrorThemeTokens(severity, theme).severity).toBe(severity);
      }
    }
  });

  it("is consistent with getApiErrorTheme for the same code", () => {
    for (const code of ALL_CODES) {
      for (const theme of ALL_THEMES) {
        const fromCode = getApiErrorTheme(code, theme);
        const fromSeverity = getErrorThemeTokens(API_ERROR_SEVERITY[code], theme);
        expect(fromCode.background).toBe(fromSeverity.background);
        expect(fromCode.foreground).toBe(fromSeverity.foreground);
        expect(fromCode.border).toBe(fromSeverity.border);
        expect(fromCode.icon).toBe(fromSeverity.icon);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Stale / disconnected / invalid state handling
// ---------------------------------------------------------------------------

describe("stale, disconnected, and invalid inputs", () => {
  it("getApiErrorTheme does not throw for an unknown future code", () => {
    expect(() =>
      getApiErrorTheme("FUTURE_CODE" as ApiErrorCode, "dark"),
    ).not.toThrow();
  });

  it("getApiErrorTheme returns valid tokens for an unknown future code", () => {
    assertValidTokens(getApiErrorTheme("FUTURE_CODE" as ApiErrorCode, "light"));
  });

  it("getApiErrorTheme returns transient tokens for an unknown future code", () => {
    const tokens = getApiErrorTheme("FUTURE_CODE" as ApiErrorCode, "dark");
    expect(tokens.severity).toBe("transient");
  });

  it("getErrorThemeTokens returns a new object each call (no shared reference)", () => {
    const a = getErrorThemeTokens("critical", "dark");
    const b = getErrorThemeTokens("critical", "dark");
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it("getApiErrorTheme returns a new object each call (no shared reference)", () => {
    const a = getApiErrorTheme("UNAUTHORIZED", "dark");
    const b = getApiErrorTheme("UNAUTHORIZED", "dark");
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// Accessibility — minimum contrast ratios (WCAG AA)
// ---------------------------------------------------------------------------

function hexToRgb(hex: string) {
  const v = hex.replace("#", "");
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

function relativeLuminance(channel: number) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function contrastRatio(hex1: string, hex2: string): number {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  const L1 =
    0.2126 * relativeLuminance(c1.r) +
    0.7152 * relativeLuminance(c1.g) +
    0.0722 * relativeLuminance(c1.b);
  const L2 =
    0.2126 * relativeLuminance(c2.r) +
    0.7152 * relativeLuminance(c2.g) +
    0.0722 * relativeLuminance(c2.b);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("accessibility — foreground/background contrast", () => {
  it.each(ALL_SEVERITIES)(
    "dark theme severity %s meets WCAG AA (≥4.5:1) for foreground on background",
    (severity) => {
      const tokens = getErrorThemeTokens(severity, "dark");
      expect(contrastRatio(tokens.foreground, tokens.background)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(ALL_SEVERITIES)(
    "light theme severity %s meets WCAG AA (≥4.5:1) for foreground on background",
    (severity) => {
      const tokens = getErrorThemeTokens(severity, "light");
      expect(contrastRatio(tokens.foreground, tokens.background)).toBeGreaterThanOrEqual(4.5);
    },
  );
});
