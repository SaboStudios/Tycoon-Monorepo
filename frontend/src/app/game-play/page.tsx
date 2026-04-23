import GameBoard from "@/components/game/GameBoard";
import { generatePageMetadata } from "@/lib/metadata";
import type { Metadata } from "next";

export const metadata: Metadata = generatePageMetadata({
  title: "Play Game",
  description:
    "Play Tycoon online. Build your empire, trade properties, and become the ultimate tycoon.",
  canonicalPath: "/game-play",
  keywords: [
    "play tycoon",
    "board game",
    "property trading",
    "strategy game",
    "multiplayer game",
  ],
});

export default function GamePlayPage() {
  return (
    <section className="mx-auto flex min-h-screen w-full max-w-[min(100%,var(--shell-content-max-game))] flex-col items-center justify-center bg-[var(--tycoon-bg)] px-4 py-8">
      <h1 className="font-orbitron text-2xl font-bold text-[var(--tycoon-accent)] text-center mb-6 sr-only">
        Game Play
      </h1>
      <GameBoard />
    </section>
  );
}
