"use client";

import { useEffect } from "react";

export function MSWProvider() {
  useEffect(() => {
    // Run the browser worker in local development, or whenever mocking is
    // explicitly forced on (e.g. the Playwright E2E run, which needs a
    // deterministic backend without spinning up the Nest API).
    const mockingForced =
      process.env.NEXT_PUBLIC_API_MOCKING === "enabled";
    if (
      typeof window === "undefined" ||
      (process.env.NODE_ENV !== "development" && !mockingForced)
    ) {
      return;
    }

    let cancelled = false;
    const modPromise = import("@/mocks/browser");

    void modPromise.then(({ worker }) => {
      if (cancelled) return;
      void worker.start({
        onUnhandledRequest: "bypass",
      });
    });

    return () => {
      cancelled = true;
      void modPromise.then(({ worker }) => worker.stop());
    };
  }, []);

  return null;
}
