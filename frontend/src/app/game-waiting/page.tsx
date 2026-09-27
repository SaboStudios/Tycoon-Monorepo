import GameWaitingClient from "@/clients/GameWaitingClient";
import { generatePageMetadata } from "@/lib/metadata";
import type { Metadata } from "next";

export const metadata: Metadata = generatePageMetadata({
  title: "Waiting for Players",
  description:
    "Waiting for other players to join the game. Get ready to start your Tycoon adventure.",
  canonicalPath: "/game-waiting",
  keywords: ["game lobby", "waiting room", "multiplayer", "game start"],
});

export default function GameWaitingPage() {
  return <GameWaitingClient />;
}
