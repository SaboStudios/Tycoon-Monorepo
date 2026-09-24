"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { track, registerAnalyticsDebugHandle, getViewEventForPath } from "@/lib/analytics";

export function AnalyticsProvider() {
  const pathname = usePathname();
  const lastTrackedPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    registerAnalyticsDebugHandle();
  }, []);

  useEffect(() => {
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
  }, [pathname]);

  return null;
}
