/**
 * Analytics provider allowlist — single source of truth (#1761).
 *
 * Deny-by-default: a provider id that is not listed here is rejected.
 *   - At build time `next.config.ts` calls `assertAnalyticsBuildEnv()`, so an
 *     unknown id in NEXT_PUBLIC_ANALYTICS_PROVIDERS fails `next build`.
 *   - At runtime `resolveAnalyticsProviders()` fails closed (no providers,
 *     no telemetry) instead of crashing the page.
 *
 * Adding a provider requires a code change + review here, a factory in
 * `providers.ts`, and an update to frontend/docs/SW-FE-1761-analytics-allowlist-consent.md.
 *
 * This module must stay dependency-free (no React / Next imports) because it
 * is imported by `next.config.ts` and by the repo-root `lib/analytics` shim.
 */

export const ANALYTICS_PROVIDER_IDS = ["plausible", "ga4", "posthog"] as const;

export type AnalyticsProviderName = (typeof ANALYTICS_PROVIDER_IDS)[number];

/** Upper bound on the raw env value; anything longer is treated as hostile. */
const MAX_PROVIDERS_ENV_LENGTH = 256;

export class AnalyticsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalyticsConfigError";
  }
}

export function isAnalyticsProviderName(value: string): value is AnalyticsProviderName {
  return (ANALYTICS_PROVIDER_IDS as readonly string[]).includes(value);
}

/**
 * Parse NEXT_PUBLIC_ANALYTICS_PROVIDERS. Empty/undefined disables analytics.
 * Ids are trimmed, lower-cased and de-duplicated; any unknown id throws so a
 * typo can never silently disable (or misroute) telemetry.
 */
export function parseAnalyticsProviders(raw: string | undefined): AnalyticsProviderName[] {
  const value = (raw ?? "").trim();
  if (value === "") {
    return [];
  }

  if (value.length > MAX_PROVIDERS_ENV_LENGTH) {
    throw new AnalyticsConfigError(
      `NEXT_PUBLIC_ANALYTICS_PROVIDERS is longer than ${MAX_PROVIDERS_ENV_LENGTH} characters.`,
    );
  }

  const names = value
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name !== "");

  const unknown = names.filter((name) => !isAnalyticsProviderName(name));
  if (unknown.length > 0) {
    throw new AnalyticsConfigError(
      `Unknown NEXT_PUBLIC_ANALYTICS_PROVIDERS value(s): ${unknown.join(", ")}. ` +
        `Allowed values: ${ANALYTICS_PROVIDER_IDS.join(", ")}.`,
    );
  }

  return Array.from(new Set(names)) as AnalyticsProviderName[];
}

/**
 * NEXT_PUBLIC_ENABLE_ANALYTICS is a strict boolean. Only the literal "true"
 * enables analytics; unset/empty/"false" disables it. Anything else throws so
 * "yes" / "1" / "TRUE " are caught at build time instead of being guessed at.
 */
export function parseAnalyticsEnabledFlag(raw: string | undefined): boolean {
  const value = (raw ?? "").trim();
  if (value === "" || value === "false") {
    return false;
  }
  if (value === "true") {
    return true;
  }
  throw new AnalyticsConfigError(
    `NEXT_PUBLIC_ENABLE_ANALYTICS must be "true" or "false" (got "${value.slice(0, 32)}").`,
  );
}

export interface AnalyticsBuildEnv {
  NEXT_PUBLIC_ENABLE_ANALYTICS?: string;
  NEXT_PUBLIC_ANALYTICS_PROVIDERS?: string;
}

/**
 * Build-time gate called from next.config.ts. Throws on any invalid value so
 * `next build` fails instead of shipping an unvetted analytics configuration.
 */
export function assertAnalyticsBuildEnv(env: AnalyticsBuildEnv): {
  enabled: boolean;
  providers: AnalyticsProviderName[];
} {
  const enabled = parseAnalyticsEnabledFlag(env.NEXT_PUBLIC_ENABLE_ANALYTICS);
  const providers = parseAnalyticsProviders(env.NEXT_PUBLIC_ANALYTICS_PROVIDERS);
  return { enabled, providers };
}
