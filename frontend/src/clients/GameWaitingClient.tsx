"use client";

import React, { useState, useEffect } from "react";
import GameWaiting from "@/components/game/GameWaiting";

export default function GameWaitingClient(): React.JSX.Element {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <section className="w-full h-screen flex items-center justify-center bg-[#010F10]">
        <div className="flex flex-col items-center space-y-6">
          <div className="relative">
            <div className="animate-spin rounded-full h-24 w-24 border-t-2 border-b-2 border-[#00F0FF]"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 bg-[#00F0FF]/10 rounded-full animate-pulse"></div>
            </div>
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-[#00F0FF] text-2xl font-black font-orbitron tracking-[0.3em] animate-pulse">
              ENTERING LOBBY
            </h1>
            <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase animate-bounce">
              Verifying Credentials...
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <main className="w-full min-h-screen overflow-x-hidden bg-[#010F10]">
      <GameWaiting />
    </main>
  );
}
