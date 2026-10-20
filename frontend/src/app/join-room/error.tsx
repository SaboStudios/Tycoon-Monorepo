"use client";

import { ErrorDisplay } from "@/components/ui/error-boundary";

/**
 * SW-FE-037 — Join Room: route-level error boundary.
 *
 * Catches render errors thrown inside the join-room route segment and
 * presents a contextual recovery UI (retry + home) instead of the
 * generic global 500 page.
 */
export default function JoinRoomError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[var(--tycoon-bg)] flex items-center justify-center p-4">
      <ErrorDisplay
        error={error}
        showTechnical={process.env.NODE_ENV === "development"}
        onRetry={reset}
      />
    </div>
  );
}
