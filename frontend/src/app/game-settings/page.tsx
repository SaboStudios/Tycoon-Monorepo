import GameSettingsClient from "@/clients/GameSettingsClient";
import { generatePageMetadata } from "@/lib/metadata";
import type { Metadata } from "next";

export const metadata: Metadata = generatePageMetadata({
  title: "Game Settings",
  description:
    "Configure your Tycoon game settings. Set up game rules, player count, and start your game.",
  canonicalPath: "/game-settings",
  keywords: ["game settings", "game configuration", "setup game", "game rules"],
});

export default function GameSettingsPage() {
  return (
    <main
      aria-label="Game settings"
      className="relative min-h-screen w-full bg-gray-50/50 dark:bg-neutral-950"
    >
      <a
        href="#game-settings-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
      >
        Skip to game settings
      </a>

      <h1 className="sr-only">Game Settings</h1>

      <div
        id="game-settings-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label="Game settings status"
        className="sr-only"
      />

      <section
        id="game-settings-content"
        aria-label="Game settings form"
        className="[&_*:focus-visible]:outline-none [&_*:focus-visible]:ring-2 [&_*:focus-visible]:ring-indigo-600 [&_*:focus-visible]:ring-offset-2"
      >
        <GameSettingsClient />
      </section>
    </main>
  );
}
