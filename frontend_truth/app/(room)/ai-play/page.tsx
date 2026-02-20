"use client";

import AiBoard from "@/components/game/ai-board/ai-board";
import MobileAiBoard from "@/components/game/ai-board/mobile/ai-board";
import GamePlayers from "@/components/game/ai-player/ai-player";
import GamePlayersMobile from "@/components/game/ai-player/mobile/ai-player";

import { apiClient } from "@/lib/api";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Game, GameProperty, Player, Property } from "@/types/game";
import { useAccount } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiResponse } from "@/types/api";
import { useMediaQuery } from "@/components/useMediaQuery";

import { LayoutGrid, Users, Loader2, AlertCircle } from "lucide-react";
import { useIsRegistered } from "@/context/ContractProvider";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";

/** Shown when the game has ended and we have no game data (e.g. deep link to cancelled game). User goes home when they click. */
function GameEndedRedirect({ onGoHome }: { onGoHome: () => void }) {
  return (
    <div className="w-full h-screen bg-[#010F10] flex flex-col items-center justify-center text-center px-8">
      <h2 className="text-2xl font-bold text-cyan-400 mb-2">Game over</h2>
      <p className="text-gray-400 mb-6">This game has ended.</p>
      <button
        onClick={onGoHome}
        className="px-8 py-4 bg-[#00F0FF] text-[#010F10] font-bold rounded-lg hover:bg-[#00F0FF]/80 transition-all"
      >
        Go home
      </button>
    </div>
  );
}

export default function GamePlayPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [gameCode, setGameCode] = useState<string>("");
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { address } = useAccount();
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  const isGuest = !!guestUser;
  const {
    data: isUserRegistered,
    isLoading: isRegisteredLoading,
  } = useIsRegistered(address);

  useEffect(() => {
    const code = searchParams.get("gameCode") || localStorage.getItem("gameCode");
    if (code && code.length === 6) {
      setGameCode(code);
      localStorage.setItem("gameCode", code);
    }
  }, [searchParams]);

  // If not registered and not guest → show message and redirect option (guests can play AI without wallet)
  if (!isRegisteredLoading && isUserRegistered === false && !isGuest) {
    return (
      <div className="w-full h-screen bg-[#010F10] flex flex-col items-center justify-center gap-8 px-8 text-center">
        <AlertCircle className="w-20 h-20 text-red-400" />
        <div>
          <h2 className="text-3xl font-bold text-white mb-4">
            Registration Required
          </h2>
          <p className="text-lg text-gray-300 max-w-md">
            You need to register your wallet before joining or playing any game.
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

  const queryClient = useQueryClient();
  const {
    data: game,
    isLoading: gameLoading,
    isError: gameError,
    error: gameQueryError,
    refetch: refetchGame,
  } = useQuery<Game>({
    queryKey: ["game", gameCode],
    queryFn: async () => {
      if (!gameCode) throw new Error("No game code found");
      const res = await apiClient.get<ApiResponse>(`/games/code/${gameCode}`);
      if (!res.data?.success) {
        throw new Error(
          (res.data as { error?: string; message?: string })?.error ||
            (res.data as { error?: string; message?: string })?.message ||
            "Game not found"
        );
      }
      return res.data.data;
    },
    enabled: !!gameCode && (isUserRegistered === true || isGuest),
    refetchInterval: 5000,
    staleTime: 3000,
  });

  const me = useMemo<Player | null>(() => {
    const myAddress = guestUser?.address ?? address;
    if (!game?.players || !myAddress) return null;
    return (
      game.players.find(
        (pl: Player) => pl.address?.toLowerCase() === myAddress.toLowerCase()
      ) || null
    );
  }, [game, address, guestUser?.address]);

  const {
    data: properties = [],
    isLoading: propertiesLoading,
  } = useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse>("/properties");
      return res.data?.success ? res.data.data : [];
    },
    staleTime: Infinity,
  });

  const {
    data: game_properties = [],
  } = useQuery<GameProperty[]>({
    queryKey: ["game_properties", game?.id],
    queryFn: async () => {
      if (!game?.id) return [];
      const res = await apiClient.get<ApiResponse>(`/game-properties/game/${game.id}`);
      return res.data?.success ? res.data.data : [];
    },
    enabled: !!game?.id,
    refetchInterval: 15000,
  });

  const my_properties: Property[] = useMemo(() => {
    const myAddress = guestUser?.address ?? address;
    if (!game_properties.length || !properties.length || !myAddress) return [];

    const propertyMap = new Map(properties.map((p) => [p.id, p]));
    return game_properties
      .filter((gp) => gp.address?.toLowerCase() === myAddress.toLowerCase())
      .map((gp) => propertyMap.get(gp.property_id))
      .filter((p): p is Property => !!p)
      .sort((a, b) => a.id - b.id);
  }, [game_properties, properties, address, guestUser?.address]);

  const currentPlayer = useMemo<Player | null>(() => {
    if (!game?.next_player_id || !game?.players) return null;
    return game.players.find(p => p.user_id === game.next_player_id) || null;
  }, [game]);

  const isAITurn = useMemo<boolean>(() => {
    if (!currentPlayer) return false;
    const username = currentPlayer.username?.toLowerCase() || "";
    return username.includes("ai_") || username.includes("bot") || username.includes("computer");
  }, [currentPlayer]);

  const roll = null;

  /** Call when backend must be set to FINISHED + winner (e.g. when AI wins by time, or when human claims win). */
  const finishGameByTime = useCallback(async () => {
    if (!game?.id || !game?.is_ai || game?.status !== "RUNNING") return;
    try {
      await apiClient.post(`/games/${game.id}/finish-by-time`);
      await queryClient.invalidateQueries({ queryKey: ["game", gameCode] });
      await refetchGame();
    } catch (e) {
      console.error("Finish by time failed:", e);
    }
  }, [game?.id, game?.is_ai, game?.status, gameCode, queryClient, refetchGame]);

  // Don't allow multiplayer game codes on AI page — redirect to multiplayer board
  useEffect(() => {
    if (!game || !gameCode) return;
    if (game.is_ai === false || game.is_ai === undefined) {
      router.replace(`/game-play?gameCode=${encodeURIComponent(gameCode)}`);
    }
  }, [game, gameCode, router]);

  const [activeTab, setActiveTab] = useState<"board" | "players">("board");
  const [focusTrades, setFocusTrades] = useState(false);

  if (isRegisteredLoading || gameLoading || propertiesLoading) {
    return (
      <div className="w-full h-screen bg-[#010F10] flex flex-col items-center justify-center gap-4 text-cyan-300">
        <Loader2 className="w-12 h-12 animate-spin" />
        <p className="text-xl font-orbitron">Loading game...</p>
      </div>
    );
  }

  // Game ended (e.g. after claiming) — show friendly message and redirect, not an error
  const gameEnded = gameError && gameQueryError?.message === "Game ended";
  if (gameEnded) {
    return <GameEndedRedirect onGoHome={() => router.push("/")} />;
  }

  if (gameError || !game) {
    return (
      <div className="w-full h-screen bg-[#010F10] flex flex-col items-center justify-center text-center px-8">
        <h2 className="text-2xl font-bold text-red-400 mb-4">
          {gameQueryError?.message ?? "Game Not Found"}
        </h2>
        <p className="text-gray-300">
          Invalid or expired game code. Please check and try again.
        </p>
        <button
          onClick={() => router.push("/")}
          className="mt-8 px-8 py-4 bg-[#00F0FF] text-[#010F10] font-bold rounded-lg hover:bg-[#00F0FF]/80 transition-all"
        >
          Go Home
        </button>
      </div>
    );
  }

  // Multiplayer game opened on AI URL — redirect runs in useEffect; avoid rendering AI UI
  if (game.is_ai === false || game.is_ai === undefined) {
    return (
      <div className="w-full h-screen bg-[#010F10] flex flex-col items-center justify-center gap-4 text-cyan-300">
        <Loader2 className="w-12 h-12 animate-spin" />
        <p className="text-xl font-orbitron">Redirecting to multiplayer game...</p>
      </div>
    );
  }

  // Mobile Layout
  if (isMobile) {
    return (
      <main className="w-full h-screen flex flex-col overflow-hidden bg-[#010F10] mt-[100px]">
        <div className="flex-1 w-full min-h-0 overflow-y-auto overflow-x-hidden">
          {activeTab === "board" ? (
            <MobileAiBoard
              game={game}
              properties={properties}
              game_properties={game_properties}
              me={me}
              isGuest={isGuest}
              onFinishGameByTime={finishGameByTime}
              onViewTrades={() => {
                setActiveTab("players");
                setFocusTrades(true);
              }}
            />
          ) : (
            <GamePlayersMobile
              game={game}
              properties={properties}
              game_properties={game_properties}
              my_properties={my_properties}
              me={me}
              currentPlayer={currentPlayer}
              roll={roll}
              isAITurn={isAITurn}
              focusTrades={focusTrades}
              onViewedTrades={() => setFocusTrades(false)}
            />
          )}
        </div>

        <nav className="fixed bottom-0 left-0 right-0 h-20 pb-safe bg-[#010F10]/95 backdrop-blur-xl border-t border-[#003B3E] flex items-center justify-around z-50 shadow-2xl">
          <button
            onClick={() => {
              setActiveTab("board");
              setFocusTrades(false);
            }}
            className={`flex flex-col items-center justify-center flex-1 py-3 transition-all ${
              activeTab === "board"
                ? "text-[#00F0FF] scale-110"
                : "text-gray-500"
            }`}
          >
            <LayoutGrid size={26} />
            <span className="text-xs mt-1 font-orbitron">Board</span>
          </button>

          <button
            onClick={() => setActiveTab("players")}
            className={`flex flex-col items-center justify-center flex-1 py-3 transition-all ${
              activeTab === "players"
                ? "text-[#00F0FF] scale-110"
                : "text-gray-500"
            }`}
          >
            <Users size={26} />
            <span className="text-xs mt-1 font-orbitron">Players</span>
          </button>
        </nav>
      </main>
    );
  }

  // Desktop Layout
  return (
    <main className="w-full h-screen overflow-hidden relative flex flex-row bg-[#010F10] lg:gap-4 p-4">
      <div className="hidden lg:block w-80 flex-shrink-0">
        <GamePlayers
          game={game}
          properties={properties}
          game_properties={game_properties}
          my_properties={my_properties}
          me={me}
          currentPlayer={currentPlayer}
          roll={roll}
          isAITurn={isAITurn}
          focusTrades={focusTrades}
          onViewedTrades={() => setFocusTrades(false)}
          isGuest={isGuest}
        />
      </div>

      <div className="flex-1 min-w-0">
        <AiBoard
          game={game}
          properties={properties}
          game_properties={game_properties}
          me={me}
          isGuest={isGuest}
          onFinishGameByTime={finishGameByTime}
          onViewTrades={() => setFocusTrades(true)}
        />
      </div>

      <button
        onClick={() => setActiveTab("players")}
        className="lg:hidden fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#00F0FF]/90 backdrop-blur shadow-xl flex items-center justify-center z-40 border border-[#0FF0FC]"
      >
        <Users size={24} className="text-[#010F10]" />
      </button>
    </main>
  );
}