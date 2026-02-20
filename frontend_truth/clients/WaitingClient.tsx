"use client";

import React, { Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useIsRegistered } from "@/context/ContractProvider";
import { Loader2, AlertCircle } from "lucide-react";

// Dynamically import components to avoid SSR issues
const GameWaiting = dynamic(() => import("@/components/settings/game-waiting"), {
  ssr: false,
});

const GameWaitingMobile = dynamic(() => import("@/components/settings/game-waiting-mobile"), {
  ssr: false,
});

// Fallback while components are loading/hydrating
function LoadingFallback() {
  return (
    <div className="min-h-screen bg-settings bg-cover bg-fixed flex items-center justify-center">
      <p className="text-[#00F0FF] text-3xl font-orbitron animate-pulse tracking-wider">
        ENTERING LOBBY...
      </p>
    </div>
  );
}

// New fallback for registration check loading
function RegistrationLoading() {
  return (
    <div className="min-h-screen bg-[#010F10] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-[#00F0FF] mx-auto mb-4" />
        <p className="text-xl text-cyan-300 font-orbitron">Checking registration...</p>
      </div>
    </div>
  );
}

// Full-screen message for unregistered users
function NotRegisteredScreen() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#010F10] flex flex-col items-center justify-center gap-8 px-8 text-center">
      <AlertCircle className="w-20 h-20 text-red-400" />
      <div>
        <h2 className="text-3xl font-bold text-white mb-4">
          Registration Required
        </h2>
        <p className="text-lg text-gray-300 max-w-md">
          You need to register your wallet before entering the game lobby.
        </p>
      </div>
      <button
        onClick={() => router.push("/")}
        className="px-8 py-4 bg-[#00F0FF] text-[#010F10] font-bold rounded-lg hover:bg-[#00F0FF]/80 transition-all transform hover:scale-105"
      >
        Go to Home Page
      </button>
    </div>
  );
}

export default function GameWaitingClient() {
  const { address } = useAccount();
  const router = useRouter();

  const {
    data: isUserRegistered,
    isLoading: isRegisteredLoading,
  } = useIsRegistered(address);

  // While checking registration status
  if (isRegisteredLoading) {
    return <RegistrationLoading />;
  }

  // User is not registered → block access
  if (isUserRegistered === false) {
    return <NotRegisteredScreen />;
  }

  // User is registered → proceed to lobby with Suspense loading
  return (
    <Suspense fallback={<LoadingFallback />}>
      <>
        {/* Desktop Version */}
        <div className="hidden md:block">
          <GameWaiting />
        </div>

        {/* Mobile Version */}
        <div className="block md:hidden">
          <GameWaitingMobile />
        </div>
      </>
    </Suspense>
  );
}