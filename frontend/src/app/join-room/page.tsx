import JoinRoomPageContent from "@/components/settings/JoinRoomPageContent";
import { generatePageMetadata } from "@/lib/metadata";
import type { Metadata } from "next";

export const metadata: Metadata = generatePageMetadata({
  title: "Join Room",
  description:
    "Join an existing Tycoon game room. Enter the room code and start playing with friends.",
  canonicalPath: "/join-room",
  keywords: ["join game", "multiplayer room", "game lobby", "online gaming"],
});

export default function JoinRoomPage() {
  return <JoinRoomPageContent />;
}
