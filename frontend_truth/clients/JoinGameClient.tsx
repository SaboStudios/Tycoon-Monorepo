"use client";
import JoinRoom from "@/components/settings/join-room";
import JoinRoomMobile from "@/components/settings/join-room-mobile";
import { useMediaQuery } from "@/components/useMediaQuery";


export default function JoinGameClient() {
  const isMobile = useMediaQuery("(max-width: 768px)");

  return (
    <main className="w-full">
      {isMobile ? <JoinRoomMobile /> : <JoinRoom />}
    </main>
  );
}