"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { track, registerAnalyticsDebugHandle, getViewEventForPath } from "@/lib/analytics";
import { useAnalyticsConsent } from "@/hooks/useAnalyticsConsent";

export function AnalyticsProvider() {
  const pathname = usePathname();
  const consent = useAnalyticsConsent();
  const lastTrackedPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    registerAnalyticsDebugHandle();
  }, []);

  useEffect(() => {
    // Nothing is emitted (or marked as tracked) before consent, so granting
    // consent on a page records that page's view exactly once.
    if (consent !== "granted" || !pathname) {
      return;
    }

    if (lastTrackedPathnameRef.current === pathname) {
      return;
    }

    const viewEvent = getViewEventForPath(pathname);

    if (!viewEvent) {
      return;
    }

    lastTrackedPathnameRef.current = pathname;

    track(viewEvent, {
      route: pathname,
      source: "app_router",
    });
  }, [pathname, consent]);

  return null;
}
