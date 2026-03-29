import { AnalyticsEventName, AnalyticsEventPayload } from "./taxonomy";

export type AnalyticsProviderName = "plausible" | "ga4" | "posthog";

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

const providerFactories: Record<AnalyticsProviderName, () => AnalyticsProvider> = {
  plausible: createPlausibleProvider,
  ga4: createGa4Provider,
  posthog: createPostHogProvider,
};

export function resolveAnalyticsProviders(): AnalyticsProvider[] {
  const configuredProviders = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDERS;

  if (!configuredProviders) {
    return [];
  }

  return configuredProviders
    .split(",")
    .map((providerName) => providerName.trim().toLowerCase() as AnalyticsProviderName)
    .filter((providerName): providerName is AnalyticsProviderName => providerName in providerFactories)
    .map((providerName) => providerFactories[providerName]());
}
