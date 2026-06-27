import JoinRoomPageContent from "@/components/settings/JoinRoomPageContent";
import { generatePageMetadata } from "@/lib/metadata";
import type { Metadata } from "next";
import type React from "react";

export const metadata: Metadata = generatePageMetadata({
  title: "Join Room",
  description:
    "Join an existing Tycoon game room. Enter the room code and start playing with friends.",
  canonicalPath: "/join-room",
  keywords: ["join game", "multiplayer room", "game lobby", "online gaming"],
});

/**
 * Server component that renders the Join Room page.
 * Handles metadata generation and delegates content rendering to the client component.
 *
 * @returns The rendered Join Room page
 */
export default function JoinRoomPage(): React.ReactNode {
  return <JoinRoomPageContent />;
}
