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
    <section className="min-h-screen w-full bg-[var(--tycoon-bg)] flex flex-col items-center justify-center py-8 px-4">
      <h1 className="font-orbitron text-2xl font-bold text-[var(--tycoon-accent)] text-center mb-6 sr-only">
        Game Play
      </h1>
      <GameBoard />
    </section>
  );
}
