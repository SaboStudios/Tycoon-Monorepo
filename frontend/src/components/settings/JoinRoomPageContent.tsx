"use client";

import { useTranslation } from "react-i18next";
import JoinRoomForm from "@/components/settings/JoinRoomForm";
import { JOIN_ROOM_I18N } from "@/lib/join-room/i18n-keys";

export default function JoinRoomPageContent(): React.JSX.Element {
  const { t } = useTranslation("common");

  return (
    <section className="min-h-screen w-full bg-[var(--tycoon-bg)] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--tycoon-border)] bg-[var(--tycoon-card-bg)] p-6 shadow-xl">
        <h1 className="font-orbitron text-2xl font-bold text-[var(--tycoon-accent)] text-center mb-6">
          {t(JOIN_ROOM_I18N.title)}
        </h1>
        <div className="rounded-lg border border-[var(--tycoon-border)] bg-[var(--tycoon-bg)] p-6">
          <JoinRoomForm />
        </div>
      </div>
    </section>
  );
}
