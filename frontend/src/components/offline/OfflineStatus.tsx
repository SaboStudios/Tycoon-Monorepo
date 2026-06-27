"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const OFFLINE_PERSISTENCE_KEY = "tycoon.offline.last-known-status";

export default function OfflineStatus() {
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine,
  );
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem(OFFLINE_PERSISTENCE_KEY);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateNetworkStatus = () => {
      const nextOnline = navigator.onLine;
      const timestamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      setIsOnline(nextOnline);
      setLastCheckedAt(timestamp);
      window.sessionStorage.setItem(OFFLINE_PERSISTENCE_KEY, timestamp);
    };

    updateNetworkStatus();
    window.addEventListener("online", updateNetworkStatus);
    window.addEventListener("offline", updateNetworkStatus);

    return () => {
      window.removeEventListener("online", updateNetworkStatus);
      window.removeEventListener("offline", updateNetworkStatus);
    };
  }, []);

  const statusLabel = isOnline
    ? "Your connection has returned. Refresh to resume live gameplay."
    : "Live game state is unavailable until connectivity returns.";

  const actionLabel = isOnline ? "Refresh page" : "Retry connection";

  return (
    <section
      aria-labelledby="offline-status-title"
      className="mt-8 rounded-[1.75rem] border border-[#00F0FF]/10 bg-[#031212] p-6 text-left"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#00F0FF]/10 text-[#00F0FF]">
          <AlertTriangle className="h-5 w-5" />
        </div>

        <div>
          <p
            id="offline-status-title"
            className="text-sm font-semibold uppercase tracking-[0.14em] text-[#F0F7F7]"
          >
            Connection status
          </p>
          <p
            className="mt-2 text-sm leading-6 text-[#F0F7F7]/75"
            aria-live="polite"
            aria-atomic="true"
          >
            {statusLabel}
          </p>
          <p className="mt-2 text-xs text-[#86F8FF]/80">
            {lastCheckedAt
              ? `Last checked at ${lastCheckedAt}.`
              : "Checking network status…"}
          </p>
        </div>
      </div>

      <div className="mt-6 flex justify-center">
        <Button
          onClick={() => window.location.reload()}
          className="bg-[#00F0FF] text-[#010F10] hover:bg-[#86F8FF]"
          type="button"
        >
          <RefreshCw className="h-4 w-4" />
          {actionLabel}
        </Button>
      </div>
    </section>
  );
}
