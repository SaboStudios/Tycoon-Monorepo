export { track, registerAnalyticsDebugHandle, canTrack, isAnalyticsConfigured } from "./client";
export { sanitizeAnalyticsPayload, getViewEventForPath, analyticsEventSchema } from "./taxonomy";
export type { AnalyticsEventName, AnalyticsEventPayload } from "./taxonomy";
export type { AnalyticsProviderName } from "./providers";
export { ANALYTICS_PROVIDER_IDS, parseAnalyticsProviders } from "./allowlist";
export {
  CONSENT_STORAGE_KEY,
  readConsent,
  setConsent,
  clearConsent,
  hasAnalyticsConsent,
  subscribeToConsent,
} from "./consent";
export type { ConsentDecision, ConsentState } from "./consent";
