/**
 * Analytics client (#1761 / #2158).
 *
 * Deny-by-default, same as the rest of this module:
 *   - Nothing is sent unless `NEXT_PUBLIC_ENABLE_ANALYTICS === "true"` AND the
 *     configured provider ids are all on the allowlist (see allowlist.ts).
 *   - Nothing is sent unless consent has been explicitly granted (consent.ts).
 *   - Every payload is scrubbed for PII *before* it is queued or handed to a
 *     provider — consent gates whether an event is sent, the scrub decides
 *     which fields are ever safe to send at all. A player who grants consent
 *     must still never leak a wallet account id, email, access token, or raw
 *     room code through an event property.
 *
 * A throwing provider global (e.g. blocked by a browser extension) is caught
 * per-provider so it can never break the caller or the other providers.
 */
import {
  ANALYTICS_PROVIDER_IDS,
  AnalyticsConfigError,
  parseAnalyticsEnabledFlag,
  parseAnalyticsProviders,
  type AnalyticsProviderName,
} from "./allowlist";
import { hasAnalyticsConsent } from "./consent";

/** Property keys that are always dropped, regardless of value shape. */
const PII_KEY_PATTERN =
  /email|wallet[_-]?address|account[_-]?id|room[_-]?code|roomcode|token|secret|password|private[_-]?key|authorization|cookie|\bip\b|ip[_-]?address|user[_-]?agent/i;

type AnalyticsWindow = Window & {
  plausible?: (event: string, options: { props: Record<string, unknown> }) => void;
  posthog?: { capture?: (event: string, props: Record<string, unknown>) => void };
  gtag?: (command: "event", event: string, props: Record<string, unknown>) => void;
  __tycoonAnalytics?: { events: Array<{ event: string; props: Record<string, unknown> }> };
};

function getWindow(): AnalyticsWindow | null {
  return typeof window === "undefined" ? null : (window as AnalyticsWindow);
}

/** Strips a query string and fragment from a route-shaped value. */
function sanitizeRoute(value: string): string {
  return value.split("?")[0]!.split("#")[0]!;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Drops any key that looks like PII (see PII_KEY_PATTERN) and any value that
 * looks like an email address regardless of its key name, then sanitizes the
 * `route` property. Safe, non-PII keys (e.g. `sku`, `count`) pass through
 * unchanged. Runs before anything is queued or sent to a provider.
 */
export function scrubAnalyticsPayload(
  props: Record<string, unknown>,
): Record<string, unknown> {
  const scrubbed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (PII_KEY_PATTERN.test(key)) {
      continue;
    }
    if (key === "route" && typeof value === "string") {
      scrubbed[key] = sanitizeRoute(value);
      continue;
    }
    if (typeof value === "string" && EMAIL_PATTERN.test(value.trim())) {
      continue;
    }
    scrubbed[key] = value;
  }
  return scrubbed;
}

/**
 * Resolves and validates the build-time analytics config at call time
 * (rather than once at module load) so tests can stub env vars per case.
 * Fails closed: any config error is logged and treated as "not configured".
 */
export function isAnalyticsConfigured(): boolean {
  try {
    const enabled = parseAnalyticsEnabledFlag(process.env.NEXT_PUBLIC_ENABLE_ANALYTICS);
    if (!enabled) {
      return false;
    }
    const providers = parseAnalyticsProviders(process.env.NEXT_PUBLIC_ANALYTICS_PROVIDERS);
    return providers.length > 0;
  } catch (error) {
    if (error instanceof AnalyticsConfigError) {
      console.error(`[analytics] ${error.message}`);
      return false;
    }
    throw error;
  }
}

function resolveProviders(): AnalyticsProviderName[] {
  try {
    return parseAnalyticsProviders(process.env.NEXT_PUBLIC_ANALYTICS_PROVIDERS);
  } catch {
    return [];
  }
}

/** True only when the player has granted consent AND analytics is configured. */
export function canTrack(): boolean {
  return hasAnalyticsConsent() && isAnalyticsConfigured();
}

function enqueueForDebug(win: AnalyticsWindow, event: string, props: Record<string, unknown>): void {
  if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG !== "true") {
    return;
  }
  win.__tycoonAnalytics ??= { events: [] };
  win.__tycoonAnalytics.events.push({ event, props });
  // eslint-disable-next-line no-console
  console.log("[analytics]", event, props);
}

function sendToProvider(
  win: AnalyticsWindow,
  provider: AnalyticsProviderName,
  event: string,
  props: Record<string, unknown>,
): void {
  try {
    if (provider === "plausible") {
      win.plausible?.(event, { props });
    } else if (provider === "posthog") {
      win.posthog?.capture?.(event, props);
    } else if (provider === "ga4") {
      win.gtag?.("event", event, props);
    }
  } catch {
    // A provider global can throw (blocked by an extension, SDK bug, ...).
    // Never let one provider's failure stop the others or the caller.
  }
}

/**
 * Tracks an analytics event. No-ops (no queueing, no network call, no
 * console output) unless consent is granted and analytics is configured.
 * The payload is always scrubbed for PII before it is queued or dispatched.
 */
export function track(event: string, props: Record<string, unknown> = {}): void {
  if (!canTrack()) {
    return;
  }

  const win = getWindow();
  if (!win) {
    return;
  }

  const scrubbed = scrubAnalyticsPayload(props);
  enqueueForDebug(win, event, scrubbed);

  for (const provider of resolveProviders()) {
    sendToProvider(win, provider, event, scrubbed);
  }
}

export { ANALYTICS_PROVIDER_IDS };
