import { AnalyticsEventName, AnalyticsEventPayload } from "./taxonomy";
import {
  AnalyticsConfigError,
  AnalyticsProviderName,
  parseAnalyticsProviders,
} from "./allowlist";

export type { AnalyticsProviderName } from "./allowlist";

export interface AnalyticsProvider {
  name: AnalyticsProviderName;
  enabled: boolean;
  track: (event: AnalyticsEventName, payload: AnalyticsEventPayload) => void;
}

type AnalyticsWindow = Window & {
  plausible?: (event: string, options?: { props?: AnalyticsEventPayload }) => void;
  gtag?: (command: string, event: string, payload: AnalyticsEventPayload) => void;
  posthog?: {
    capture: (event: string, payload: AnalyticsEventPayload) => void;
  };
};

function getBrowserWindow(): AnalyticsWindow | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window as AnalyticsWindow;
}

function createPlausibleProvider(): AnalyticsProvider {
  return {
    name: "plausible",
    enabled: true,
    track(event, payload) {
      getBrowserWindow()?.plausible?.(event, { props: payload });
    },
  };
}

function createGa4Provider(): AnalyticsProvider {
  return {
    name: "ga4",
    enabled: true,
    track(event, payload) {
      getBrowserWindow()?.gtag?.("event", event, payload);
    },
  };
}

function createPostHogProvider(): AnalyticsProvider {
  return {
    name: "posthog",
    enabled: true,
    track(event, payload) {
      getBrowserWindow()?.posthog?.capture(event, payload);
    },
  };
}

// Typed against the allowlist: adding an id to ANALYTICS_PROVIDER_IDS without
// a factory here is a compile error.
const providerFactories: Record<AnalyticsProviderName, () => AnalyticsProvider> = {
  plausible: createPlausibleProvider,
  ga4: createGa4Provider,
  posthog: createPostHogProvider,
};

/**
 * Resolve configured providers. Unknown ids fail the build via next.config.ts;
 * if one still reaches the browser (e.g. a misconfigured preview), analytics
 * fails closed — no providers, no telemetry — rather than crashing the page.
 */
export function resolveAnalyticsProviders(
  raw: string | undefined = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDERS,
): AnalyticsProvider[] {
  let names: AnalyticsProviderName[];
  try {
    names = parseAnalyticsProviders(raw);
  } catch (error) {
    if (error instanceof AnalyticsConfigError && process.env.NODE_ENV !== "production") {
      console.error(`[analytics] disabled: ${error.message}`);
    }
    return [];
  }

  return names.map((name) => providerFactories[name]());
}
