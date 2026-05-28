"use client";

import React, { useState, useEffect } from "react";
import GameWaiting from "@/components/game/GameWaiting";
import { Spinner } from "@/components/ui/spinner";

type RegistrationState = "checking" | "registered" | "unregistered" | "error";

/**
 * Client wrapper for the game waiting page.
 * Handles mock loading and registration check with typed state.
 */
export default function GameWaitingClient(): React.JSX.Element {
  const [regState, setRegState] = useState<RegistrationState>("checking");

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        // Assume user is registered for demo
        setRegState("registered");
      } catch {
        setRegState("error");
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (regState === "checking") {
    return (
      <div className="flex min-h-screen w-full items-center justify-center overflow-x-hidden bg-[#010F10]">
        <div className="flex flex-col items-center gap-6">
          <Spinner size="lg" />
          <div className="text-center space-y-2">
            <h1 className="text-[#00F0FF] text-2xl font-black font-orbitron tracking-[0.3em] animate-pulse">
              ENTERING LOBBY...
            </h1>
            <p className="text-[#869298] text-xs font-bold tracking-widest uppercase">
              Verifying credentials...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (regState === "error") {
    return (
      <div className="flex min-h-screen w-full items-center justify-center overflow-x-hidden bg-[#010F10]">
        <p className="text-[#00F0FF] font-orbitron text-center px-4">
          Connection error. Please refresh and try again.
        </p>
      </div>
    );
  }

  if (regState === "unregistered") {
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
