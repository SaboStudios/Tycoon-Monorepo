import JoinRoomForm from "@/components/settings/JoinRoomForm";
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
  return (
    <section className="min-h-screen w-full bg-[var(--tycoon-bg)] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--tycoon-border)] bg-[var(--tycoon-card-bg)] p-6 shadow-xl">
        <h1 className="font-orbitron text-2xl font-bold text-[var(--tycoon-accent)] text-center mb-6">
          Join Room
        </h1>
        <div className="rounded-lg border border-[var(--tycoon-border)] bg-[var(--tycoon-bg)] p-6">
          <JoinRoomForm />
        </div>
      </div>
    </section>
  );
}
