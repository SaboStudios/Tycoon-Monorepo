import {
  AnalyticsEventName,
  AnalyticsEventPayload,
  sanitizeAnalyticsPayload,
} from "./taxonomy";
import { resolveAnalyticsProviders } from "./providers";

type DebugEvent = {
  event: AnalyticsEventName;
  payload: AnalyticsEventPayload;
  providerNames: string[];
  timestamp: string;
};

type AnalyticsDebugWindow = Window & {
  __tycoonAnalytics?: {
    track: (event: AnalyticsEventName, payload?: Record<string, unknown>) => void;
    events: DebugEvent[];
  };
};

const providers = resolveAnalyticsProviders();

function isAnalyticsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_ANALYTICS !== "false";
}

function isDebugEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true";
}

function publishDebugEvent(debugEvent: DebugEvent) {
  if (typeof window === "undefined" || !isDebugEnabled()) {
    return;
  }

  const analyticsWindow = window as AnalyticsDebugWindow;
  const existingEvents = analyticsWindow.__tycoonAnalytics?.events ?? [];

  analyticsWindow.__tycoonAnalytics = {
    track,
    events: [...existingEvents, debugEvent],
  };

  console.debug("[analytics]", debugEvent);
}

function dispatchTelemetryEvent(event: AnalyticsEventName, payload: AnalyticsEventPayload) {
  if (typeof window === "undefined") {
    return;
  }

  if (!isAnalyticsEnabled()) {
    return;
  }

  const customEvent = new CustomEvent("tycoon:telemetry", {
    detail: { event, payload },
  });

  window.dispatchEvent(customEvent);
}

export function track(
  event: AnalyticsEventName,
  payload: Record<string, unknown> = {},
): void {
  if (!isAnalyticsEnabled()) {
    return;
  }

  const safePayload = sanitizeAnalyticsPayload(event, payload);

  providers.forEach((provider) => {
    if (provider.enabled) {
      provider.track(event, safePayload);
    }
  });

  dispatchTelemetryEvent(event, safePayload);

  publishDebugEvent({
    event,
    payload: safePayload,
    providerNames: providers.map((provider) => provider.name),
    timestamp: new Date().toISOString(),
  });
}

export function registerAnalyticsDebugHandle() {
  if (typeof window === "undefined" || !isDebugEnabled()) {
    return;
  }

  const analyticsWindow = window as AnalyticsDebugWindow;

  analyticsWindow.__tycoonAnalytics = {
    track,
    events: analyticsWindow.__tycoonAnalytics?.events ?? [],
  };
}
