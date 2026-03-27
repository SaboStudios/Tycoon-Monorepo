"use client";

import { useEffect } from "react";

export function MSWProvider() {
  useEffect(() => {
    if (typeof window === "undefined" || process.env.NODE_ENV !== "development") {
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
