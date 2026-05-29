import type { ResolvedTheme } from "./constants";
import type { ApiErrorCode } from "@/lib/api/errors";

/**
 * Visual severity level for an API error.
 *
 * - `critical`  — auth failures, forbidden; user must act before continuing
 * - `warning`   — validation, conflict, not-found; user can correct and retry
 * - `transient` — network, timeout, server; likely recoverable without user action
 */
export type ErrorSeverity = "critical" | "warning" | "transient";

/**
 * Theme-aware color tokens for rendering an API error in the UI.
 *
 * All values are hex strings. Components should use these instead of
 * hard-coding colors so that light/dark mode is handled consistently.
 */
export interface ErrorThemeTokens {
  /** Background fill for an error banner or alert box */
  background: string;
  /** Foreground text color */
  foreground: string;
  /** Border / accent color */
  border: string;
  /** Icon color */
  icon: string;
  /** Severity classification */
  severity: ErrorSeverity;
}

// ---------------------------------------------------------------------------
// Severity map — one source of truth for code → severity
// ---------------------------------------------------------------------------

/**
 * Maps every `ApiErrorCode` to a `ErrorSeverity`.
 *
 * Used both for color selection and for deciding how long a toast stays open.
 */
export const API_ERROR_SEVERITY: Record<ApiErrorCode, ErrorSeverity> = {
  UNAUTHORIZED: "critical",
  FORBIDDEN: "critical",
  NOT_FOUND: "warning",
  VALIDATION_ERROR: "warning",
  CONFLICT: "warning",
  RATE_LIMIT: "transient",
  INTERNAL_SERVER_ERROR: "transient",
  NETWORK_ERROR: "transient",
  TIMEOUT: "transient",
  UNKNOWN: "transient",
};

// ---------------------------------------------------------------------------
// Color palettes — per theme, per severity
// ---------------------------------------------------------------------------

type SeverityPalette = Record<ErrorSeverity, Omit<ErrorThemeTokens, "severity">>;

const ERROR_PALETTES: Record<ResolvedTheme, SeverityPalette> = {
  dark: {
    critical: {
      background: "#1A0A0A",
      foreground: "#FFB3B3",
      border: "#7F1D1D",
      icon: "#F87171",
    },
    warning: {
      background: "#1A1200",
      foreground: "#FDE68A",
      border: "#78350F",
      icon: "#FBBF24",
    },
    transient: {
      background: "#071318",
      foreground: "#A5D8E6",
      border: "#164E63",
      icon: "#38BDF8",
    },
  },
  light: {
    critical: {
      background: "#FEF2F2",
      foreground: "#991B1B",
      border: "#FECACA",
      icon: "#DC2626",
    },
    warning: {
      background: "#FFFBEB",
      foreground: "#92400E",
      border: "#FDE68A",
      icon: "#D97706",
    },
    transient: {
      background: "#F0F9FF",
      foreground: "#075985",
      border: "#BAE6FD",
      icon: "#0284C7",
    },
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return theme-aware color tokens for a given `ApiErrorCode`.
 *
 * @example
 * ```tsx
 * const tokens = getApiErrorTheme('UNAUTHORIZED', resolvedTheme);
 * <div style={{ background: tokens.background, color: tokens.foreground }}>
 *   Session expired
 * </div>
 * ```
 */
export function getApiErrorTheme(
  code: ApiErrorCode,
  theme: ResolvedTheme,
): ErrorThemeTokens {
  const severity = API_ERROR_SEVERITY[code] ?? "transient";
  const palette = ERROR_PALETTES[theme][severity];
  return { ...palette, severity };
}

/**
 * Return the `ErrorSeverity` for a given `ApiErrorCode`.
 *
 * Useful when only the severity classification is needed (e.g. for
 * deciding toast duration) without pulling in color tokens.
 */
export function getApiErrorSeverity(code: ApiErrorCode): ErrorSeverity {
  return API_ERROR_SEVERITY[code] ?? "transient";
}

/**
 * Return theme-aware color tokens for a given `ErrorSeverity` directly.
 *
 * Useful when the severity is already known (e.g. from a form validation
 * state) and the caller does not have an `ApiErrorCode`.
 */
export function getErrorThemeTokens(
  severity: ErrorSeverity,
  theme: ResolvedTheme,
): ErrorThemeTokens {
  const palette = ERROR_PALETTES[theme][severity];
  return { ...palette, severity };
}
