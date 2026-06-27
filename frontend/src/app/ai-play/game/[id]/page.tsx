import { Suspense } from "react";
import Link from "next/link";
import { Bot, ArrowLeft } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { generatePageMetadata } from "@/lib/metadata";
import type { Metadata } from "next";

export const metadata: Metadata = generatePageMetadata({
  title: "AI Game Room",
  description:
    "Join your AI-powered Tycoon game. Challenge intelligent opponents in strategic gameplay.",
  canonicalPath: "/ai-play/game",
  keywords: ["AI game", "game room", "tycoon game", "AI opponents", "strategy"],
});

interface PageProps {
  params: Promise<{ id: string }>;
}

interface AiGameContentProps {
  id: string;
}

export function AiGameContent({ id }: AiGameContentProps): React.ReactNode {
  const trimmedId = id ? id.trim() : "";
  const gameCode = trimmedId.toUpperCase();
  const isInvalid = gameCode.length === 0;

  if (isInvalid) {
    return (
      <section
        aria-label="Invalid game error"
        role="alert"
        className="w-full min-h-[calc(100dvh-87px)] flex flex-col items-center justify-center bg-[#010F10] px-4"
      >
        <div className="max-w-md w-full space-y-6 text-center bg-[#0A1A1B]/80 p-8 rounded-2xl border border-red-500/50 shadow-xl">
          <Bot aria-hidden="true" className="w-16 h-16 mx-auto text-red-400" />
          <h1 className="text-xl font-bold font-orbitron text-[#F0F7F7]">
            Invalid Game
          </h1>
          <p className="text-[#869298] text-sm">
            Game code is missing or invalid. Please start a new game from the AI
            settings.
          </p>
          <Link
            href="/play-ai"
            className="inline-flex items-center gap-2 bg-[#00F0FF]/20 text-[#00F0FF] px-6 py-3 rounded-lg font-orbitron font-bold border border-[#00F0FF]/50 hover:bg-[#00F0FF]/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to AI Arena
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="AI game loading"
      className="w-full min-h-[calc(100dvh-87px)] flex flex-col items-center justify-center bg-[#010F10] px-4"
    >
      <div
        aria-busy="true"
        aria-label={`Loading AI game ${gameCode}`}
        className="max-w-md w-full space-y-6 text-center bg-[#0A1A1B]/80 p-8 rounded-2xl border border-[#00F0FF]/50 shadow-xl backdrop-blur-md"
      >
        <Bot aria-hidden="true" className="w-16 h-16 mx-auto text-[#00F0FF]" />
        <h1 className="text-2xl sm:text-3xl font-bold font-orbitron text-[#F0F7F7] tracking-wider">
          AI Game – {gameCode}
        </h1>
        <p className="text-[#869298] text-sm">
          Game session initialized. Board loading...
        </p>
        <div
          role="status"
          aria-live="polite"
          aria-label="Loading spinner"
          className="pt-4"
        >
          <Spinner size="md" />
        </div>
        <Link
          href="/play-ai"
          className="inline-flex items-center gap-2 text-[#00F0FF] text-sm font-orbitron hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to AI Arena
        </Link>
      </div>
    </section>
  );
}

function AiGameLoading(): React.ReactNode {
  return (
    <section
      aria-label="Game loading"
      aria-busy="true"
      className="w-full min-h-[calc(100dvh-87px)] flex flex-col items-center justify-center bg-[#010F10] px-4"
    >
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" />
        <p
          role="status"
          aria-live="polite"
          className="text-[#00F0FF] text-lg font-semibold font-orbitron animate-pulse"
        >
          Loading game...
        </p>
      </div>
    </section>
  );
}

export default async function AiPlayGamePage({ params }: PageProps): Promise<React.ReactNode> {
  const { id } = await params;

  return (
    <Suspense fallback={<AiGameLoading />}>
      <AiGameContent id={id} />
    </Suspense>
  );
}
