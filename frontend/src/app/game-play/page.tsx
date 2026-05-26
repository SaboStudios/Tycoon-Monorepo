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
    <main
      aria-label="Tycoon game play"
      className="mx-auto flex min-h-screen w-full max-w-[min(100%,var(--shell-content-max-game))] flex-col items-center justify-center bg-[var(--tycoon-bg)] px-4 py-8"
    >
      <a
        href="#game-board-region"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[var(--tycoon-accent)] focus:px-4 focus:py-2 focus:text-[var(--tycoon-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--tycoon-accent)] focus:ring-offset-2 focus:ring-offset-[var(--tycoon-bg)]"
      >
        Skip to game board
      </a>

      <h1 className="sr-only mb-6 text-center font-orbitron text-2xl font-bold text-[var(--tycoon-accent)]">
        Game Play
      </h1>

      <div
        id="game-status-announcer"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label="Game status updates"
        className="sr-only"
      />

      <section
        id="game-board-region"
        aria-label="Game board area"
        className="w-full rounded-xl focus-within:ring-2 focus-within:ring-[var(--tycoon-accent)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--tycoon-bg)] [&_*:focus-visible]:outline-none [&_*:focus-visible]:ring-2 [&_*:focus-visible]:ring-[var(--tycoon-accent)] [&_*:focus-visible]:ring-offset-2"
      >
        <GameBoard />
      </section>
    </main>
  );
}
