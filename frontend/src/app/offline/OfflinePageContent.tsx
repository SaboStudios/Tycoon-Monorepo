"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WifiOff } from "lucide-react";

const OFFLINE_STATUS_KEY = "tycoon.offline.last-known-status";

type NetworkStatus = "online" | "offline" | "unknown";

function readPersistedStatus(): NetworkStatus {
  if (typeof window === "undefined" || typeof window.sessionStorage === "undefined") {
    return "unknown";
  }

  const storedValue = sessionStorage.getItem(OFFLINE_STATUS_KEY);
  return storedValue === "online" || storedValue === "offline"
    ? storedValue
    : "unknown";
}

function writePersistedStatus(status: NetworkStatus): void {
  if (typeof window === "undefined" || typeof window.sessionStorage === "undefined") {
    return;
  }

  sessionStorage.setItem(OFFLINE_STATUS_KEY, status);
}

export default function OfflinePageContent(): React.JSX.Element {
  const [connectionStatus, setConnectionStatus] = useState<NetworkStatus>("unknown");
  const [lastKnownStatus, setLastKnownStatus] = useState<NetworkStatus>("unknown");

  useEffect(() => {
    const initialOnline =
      typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
        ? navigator.onLine
        : false;
    const initialStatus = initialOnline ? "online" : "offline";

    setConnectionStatus(initialStatus);
    setLastKnownStatus(readPersistedStatus());
    writePersistedStatus(initialStatus);

    const handleStatusChange = (isOnline: boolean) => {
      const nextStatus = isOnline ? "online" : "offline";
      setConnectionStatus(nextStatus);
      setLastKnownStatus(nextStatus);
      writePersistedStatus(nextStatus);
    };

    const handleOnline = () => handleStatusChange(true);
    const handleOffline = () => handleStatusChange(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const statusMessage =
    connectionStatus === "unknown"
      ? "Checking connectivity status..."
      : connectionStatus === "online"
      ? "A connection is available. Reload to restore live game state."
      : "You are currently offline. Reconnect to resume live multiplayer gameplay.";

  const persistedStatusCopy =
    lastKnownStatus === "unknown"
      ? "Connection history is unavailable."
      : `Last known connection state: ${lastKnownStatus}.`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#010F10] px-6 py-16 text-[#F0F7F7]">
      <div className="w-full max-w-xl rounded-[2rem] border border-[#00F0FF]/20 bg-[#07181B] p-8 text-center shadow-[0_25px_60px_rgba(0,0,0,0.35)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#00F0FF]/10 text-[#00F0FF]">
          <WifiOff className="h-7 w-7" />
        </div>
        <h1 className="mt-6 font-orbitron text-3xl font-bold uppercase tracking-[0.12em]">
          Offline Shell
        </h1>
        <p className="mt-4 text-sm leading-6 text-[#F0F7F7]/75 sm:text-base">
          The app shell is available, but live game state and network-backed data stay uncached on
          purpose to avoid stale session conflicts. Reconnect to resume multiplayer or wallet-driven
          flows safely.
        </p>
        <p
          role="status"
          aria-live="polite"
          className="mt-6 text-sm leading-6 text-[#A9F7F7]/90 sm:text-base"
          data-testid="offline-connection-status"
        >
          {statusMessage}
        </p>
        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[#86F8FF]/80">
          {persistedStatusCopy}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-[#00F0FF] px-4 py-2 font-orbitron text-xs font-semibold uppercase tracking-[0.16em] text-[#010F10] transition-colors hover:bg-[#86F8FF]"
          >
            Back to home
          </Link>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-md border border-[#00F0FF]/30 bg-[#010F10] px-4 py-2 font-orbitron text-xs font-semibold uppercase tracking-[0.16em] text-[#00F0FF] transition-colors hover:bg-[#00F0FF]/10"
          >
            Reload app
          </button>
        </div>
      </div>
    </div>
  );
}
