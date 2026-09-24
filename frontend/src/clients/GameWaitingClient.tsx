"use client";

import React, { useState, useEffect } from "react";
import GameWaiting from "@/components/game/GameWaiting";
import { Spinner } from "@/components/ui/spinner";

/**
 * Client wrapper for the game waiting page.
 * Handles mock loading (e.g. "ENTERING LOBBY...") and mock registration check.
 * Always assumes registered for demo. Renders GameWaiting inside page content.
 */
export default function GameWaitingClient(): React.JSX.Element {
  const [loading, setLoading] = useState(true);
  // Mock: assume user is registered for demo
  const isRegistered = true;

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center overflow-x-hidden bg-[#010F10]">
        <div className="flex flex-col items-center gap-6">
          <Spinner size="lg" />
          <div className="text-center space-y-2">
            <h1 className="text-[#00F0FF] text-2xl font-black font-orbitron tracking-[0.3em] animate-pulse">
              ENTERING LOBBY...
            </h1>
            <p className="text-[#869298] text-xs font-bold tracking-widest uppercase">
              {isRegistered ? "Verifying credentials..." : "Checking registration..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isRegistered) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center overflow-x-hidden bg-[#010F10]">
        <p className="text-[#00F0FF] font-orbitron text-center px-4">
          Please register to join the game.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#010F10]">
      <GameWaiting />
    </div>
  );
}
