"use client";

import { useEffect } from "react";

import { initErrorTracking } from "@/lib/errors/tracking";

/**
 * Initialises the production error-tracking SDK on the client.
 *
 * No-op unless `NEXT_PUBLIC_SENTRY_DSN` is set and the app is running in
 * production (or `NEXT_PUBLIC_SENTRY_DEBUG=true`). The SDK is dynamically
 * imported inside `initErrorTracking`, so it stays out of the main bundle when
 * tracking is disabled.
 */
export function ErrorTrackingProvider() {
  useEffect(() => {
    void initErrorTracking();
  }, []);

  return null;
}
