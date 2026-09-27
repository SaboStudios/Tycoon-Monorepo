import GameRoomLoadingClient from "@/clients/GameRoomLoadingClient";
import { generatePageMetadata } from "@/lib/metadata";
import type { Metadata } from "next";

export const metadata: Metadata = generatePageMetadata({
  title: "Loading Game Room",
  description:
    "Loading your Tycoon game room. Please wait while we prepare your game.",
  canonicalPath: "/game-room-loading",
  keywords: ["game loading", "room loading", "tycoon game"],
});

export default function GameRoomLoadingPage() {
  return <GameRoomLoadingClient />;
}
