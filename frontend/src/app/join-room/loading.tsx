"use client";

import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { JOIN_ROOM_I18N } from "@/lib/join-room/i18n-keys";

/**
 * SW-FE-036 — Join Room: CLS / LCP skeleton
 */
export default function JoinRoomLoading() {
  const { t } = useTranslation("common");

  return (
    <section
      aria-busy="true"
      aria-label={t(JOIN_ROOM_I18N.loadingAria)}
      className="min-h-screen w-full bg-[var(--tycoon-bg)] flex flex-col items-center justify-center px-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--tycoon-border)] bg-[var(--tycoon-card-bg)] p-6 shadow-xl">
        <Skeleton className="mx-auto mb-6 h-8 w-36" />
        <div className="rounded-lg border border-[var(--tycoon-border)] bg-[var(--tycoon-bg)] p-6 space-y-5">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-9 w-full" />
            <div className="min-h-[1.25rem]" />
          </div>
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    </section>
  );
}
