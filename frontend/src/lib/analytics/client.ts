import {
  AnalyticsEventName,
  AnalyticsEventPayload,
  sanitizeAnalyticsPayload,
} from "./taxonomy";
import { resolveAnalyticsProviders } from "./providers";
import { parseAnalyticsEnabledFlag } from "./allowlist";
import { hasAnalyticsConsent } from "./consent";

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

/**
 * Master switch. Deny-by-default: only NEXT_PUBLIC_ENABLE_ANALYTICS="true"
 * enables analytics; an invalid value (rejected at build time) fails closed.
 */
function isAnalyticsSwitchOn(): boolean {
  try {
    return parseAnalyticsEnabledFlag(process.env.NEXT_PUBLIC_ENABLE_ANALYTICS);
  } catch {
    return false;
  }
}

function isDebugEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true";
}

/**
 * Whether there is anything to ask consent for: the master switch is on and
 * at least one provider (or the dev-only debug sink) would receive events.
 */
export function isAnalyticsConfigured(): boolean {
  return isAnalyticsSwitchOn() && (providers.length > 0 || isDebugEnabled());
}

/** Events may leave the client only when configured AND consent is granted. */
export function canTrack(): boolean {
  return typeof window !== "undefined" && isAnalyticsConfigured() && hasAnalyticsConsent();
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

export function track(
  event: AnalyticsEventName,
  payload: Record<string, unknown> = {},
): void {
  if (!canTrack()) {
    return;
  }

  const safePayload = sanitizeAnalyticsPayload(event, payload);

  providers.forEach((provider) => {
    if (!provider.enabled) {
      return;
    }
    try {
      provider.track(event, safePayload);
    } catch {
      // A broken third-party global must never break the player-facing flow.
    }
  });

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
