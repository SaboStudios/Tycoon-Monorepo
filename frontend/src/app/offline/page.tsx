import Link from "next/link";
import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { generatePageMetadata } from "@/lib/metadata";

export const metadata: Metadata = generatePageMetadata({
  title: "Offline",
  description:
    "Tycoon is offline right now. Reconnect to keep live game state in sync and continue playing.",
  canonicalPath: "/offline",
  keywords: ["offline", "pwa", "tycoon"],
});

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#010F10] px-6 py-16 text-[#F0F7F7]">
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
        <div className="mt-8 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-[#00F0FF] px-4 py-2 font-orbitron text-xs font-semibold uppercase tracking-[0.16em] text-[#010F10] transition-colors hover:bg-[#86F8FF]"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
