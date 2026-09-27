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
  return <GameSettingsClient />;
}
