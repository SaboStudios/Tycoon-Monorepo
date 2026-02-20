"use client";

import GameBoard from "@/components/game/board/game-board";
import GameRoom from "@/components/game/game-room";
import GamePlayers from "@/components/game/player/player";
import MobileGamePlayers from "@/components/game/player/mobile/player";
import { apiClient } from "@/lib/api";
import toast from "react-hot-toast";
import { socketService } from "@/lib/socket";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Game, GameProperty, Player, Property } from "@/types/game";
import { useAccount } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiResponse } from "@/types/api";
import { useMediaQuery } from "@/components/useMediaQuery";
import MobileGameLayout from "@/components/game/board/mobile/board-mobile";
import { GameDurationCountdown } from "@/components/game/GameDurationCountdown";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
const fetchMessageCount = async (gameId: string | number): Promise<unknown[]> => {
  const res = await apiClient.get<{ data?: unknown[] | { data?: unknown[] } }>(`/messages/game/${gameId}`);
  const payload = (res as { data?: { data?: unknown[] } })?.data;
  const list = Array.isArray(payload) ? payload : (payload as { data?: unknown[] })?.data;
  return Array.isArray(list) ? list : [];
};

const SOCKET_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_SOCKET_URL ||
        (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, ""))
    : "";

export default function GamePlayPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [gameCode, setGameCode] = useState<string>("");

  const isMobile = useMediaQuery("(max-width: 768px)");

  const { address } = useAccount();
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  const myAddress = guestUser?.address ?? address;

  useEffect(() => {
    const code = searchParams.get("gameCode") || localStorage.getItem("gameCode");
    if (code && code.length === 6) setGameCode(code);
  }, [searchParams]);

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
            "Failed to load game"
        );
      }
      return res.data.data;
    },
    enabled: !!gameCode,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (!gameCode || !SOCKET_URL) return;
    const socket = socketService.connect(SOCKET_URL);
    socketService.joinGameRoom(gameCode);
    const onGameUpdate = (data: { gameCode: string }) => {
      if (data.gameCode === gameCode) {
        refetchGame();
        queryClient.invalidateQueries({ queryKey: ["game_properties"] });
      }
    };
    socketService.onGameUpdate(onGameUpdate);
    return () => {
      socketService.removeListener("game-update", onGameUpdate);
      socketService.leaveGameRoom(gameCode);
    };
  }, [gameCode, queryClient, refetchGame]);

  // Don't allow AI game codes on multiplayer page — redirect to AI board
  useEffect(() => {
    if (!game || !gameCode) return;
    if (game.is_ai === true) {
      router.replace(`/ai-play?gameCode=${encodeURIComponent(gameCode)}`);
    }
  }, [game, gameCode, router]);

  const me = useMemo(() => {
    if (!game?.players || !myAddress) return null;
    return game.players.find(
      (pl: Player) => pl.address?.toLowerCase() === myAddress.toLowerCase()
    ) || null;
  }, [game, myAddress]);

  const {
    data: properties = [],
    isLoading: propertiesLoading,
    isError: propertiesError,
  } = useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse>("/properties");
      return res.data?.success ? res.data.data : [];
    }
  });

  const {
    data: game_properties = [],
    isLoading: gamePropertiesLoading,
    isError: gamePropertiesError,
  } = useQuery<GameProperty[]>({
    queryKey: ["game_properties", game?.id],
    queryFn: async () => {
      if (!game?.id) return [];
      const res = await apiClient.get<ApiResponse>(
        `/game-properties/game/${game.id}`
      );
      return res.data?.success ? res.data.data : [];
    },
    enabled: !!game?.id,
    refetchInterval: 10000,
  });

  const my_properties: Property[] = useMemo(() => {
    if (!game_properties?.length || !properties?.length || !myAddress) return [];

    const propertyMap = new Map(properties.map((p) => [p.id, p]));

    return game_properties
      .filter((gp) => gp.address?.toLowerCase() === myAddress.toLowerCase())
      .map((gp) => propertyMap.get(gp.property_id))
      .filter((p): p is Property => !!p)
      .sort((a, b) => a.id - b.id);
  }, [game_properties, properties, myAddress]);

  const [activeTab, setActiveTab] = useState<'board' | 'players' | 'chat'>('board');
  const [focusTrades, setFocusTrades] = useState(false);
  const [lastReadMessageCount, setLastReadMessageCount] = useState(0);

  /** Backend finishes game (assigns winner) before modals show; then refetch so UI sees FINISHED. */
  const finishGameByTime = useCallback(async () => {
    if (!game?.id || game?.status !== "RUNNING") return;
    try {
      await apiClient.post(`/games/${game.id}/finish-by-time`);
      await refetchGame();
    } catch (e: any) {
      console.error("Finish by time failed:", e);
      const msg = e?.response?.data?.error || e?.response?.data?.message || e?.message || "Could not end game by time. Please try again.";
      toast.error(msg);
    }
  }, [game?.id, game?.status, refetchGame]);

  const gameId = game?.code ?? game?.id ?? "";
  const { data: messages = [] } = useQuery({
    queryKey: ["messages", gameId],
    queryFn: () => fetchMessageCount(gameId),
    enabled: !!gameId && isMobile,
    refetchInterval: 4000,
    staleTime: 2000,
  });
  const unreadCount = activeTab !== "chat" ? Math.max(0, messages.length - lastReadMessageCount) : 0;

  useEffect(() => {
    if (activeTab === "chat" && Array.isArray(messages)) {
      setLastReadMessageCount(messages.length);
    }
  }, [activeTab, messages.length]);

  if (gameLoading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center text-lg font-medium text-white">
        Loading game...
      </div>
    );
  }

  // AI game opened on multiplayer URL — redirect runs in useEffect; avoid rendering multiplayer UI
  if (game && game.is_ai === true) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center text-lg font-medium text-white">
        Redirecting to AI game...
      </div>
    );
  }

  if (gameError) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center text-lg font-medium text-white">
        {gameQueryError?.message ?? "Failed to load game"}
      </div>
    );
  }

  if (isMobile) {
    if (!game) return null;

    return (
      <main className="w-full h-dvh max-h-dvh min-h-0 flex flex-col overflow-hidden bg-[#010F10] pt-[calc(80px+env(safe-area-inset-top,0px))]" >
        {/* Persistent countdown so finish-by-time fires even when user is on players/chat tab */}
        {game?.duration && Number(game.duration) > 0 && (
          <div className="shrink-0 flex justify-center py-2">
            <GameDurationCountdown game={game} compact onTimeUp={finishGameByTime} />
          </div>
        )}
        <div className={`flex-1 w-full min-h-0 flex flex-col ${activeTab === 'chat' ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'} ${activeTab !== 'chat' ? 'pb-20' : ''}`}>
          {activeTab === 'board' && (
            <MobileGameLayout
              game={game}
              properties={properties}
              game_properties={game_properties}
              me={me}
              myAddress={myAddress ?? undefined}
              onGameUpdated={() => refetchGame()}
              onFinishByTime={finishGameByTime}
              onViewTrades={() => {
                setActiveTab('players');
                setFocusTrades(true);
              }}
            />
          )}
          {activeTab === 'players' && (
            <MobileGamePlayers
              game={game}
              properties={properties}
              game_properties={game_properties}
              my_properties={my_properties}
              me={me}
              focusTrades={focusTrades}
              onViewedTrades={() => setFocusTrades(false)}
            />
          )}
          {activeTab === 'chat' && (
            <GameRoom game={game} me={me} isMobile />
          )}
        </div>

        <nav className="fixed bottom-0 left-0 right-0 h-20 pb-safe bg-[#010F10]/95 backdrop-blur-xl border-t border-[#003B3E] flex items-center justify-around z-50 shadow-2xl">
          <button
            onClick={() => setActiveTab('board')}
            className={`flex flex-col items-center justify-center flex-1 py-3 transition-all ${
              activeTab === 'board' ? 'text-cyan-400 scale-110' : 'text-gray-500'
            }`}
          >
            <span className="text-2xl leading-none" aria-hidden>🎲</span>
            <span className="text-xs mt-1 font-semibold tracking-wide">Board</span>
          </button>
          <button
            onClick={() => setActiveTab('players')}
            className={`flex flex-col items-center justify-center flex-1 py-3 transition-all ${
              activeTab === 'players' ? 'text-cyan-400 scale-110' : 'text-gray-500'
            }`}
          >
            <span className="text-2xl leading-none" aria-hidden>👥</span>
            <span className="text-xs mt-1 font-semibold tracking-wide">Players</span>
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`relative flex flex-col items-center justify-center flex-1 py-3 transition-all ${
              activeTab === 'chat' ? 'text-cyan-400 scale-110' : 'text-gray-500'
            }`}
          >
            <span className="relative inline-block">
              <span className="text-2xl leading-none" aria-hidden>💬</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 left-6 min-w-[18px] h-[18px] rounded-full bg-cyan-400 text-[#010F10] text-xs font-bold flex items-center justify-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </span>
            <span className="text-xs mt-1 font-semibold tracking-wide">Chat</span>
          </button>
        </nav>
      </main>
    );
  }

  return game && !propertiesLoading && !gamePropertiesLoading ? (
    <main className="w-full h-screen max-h-screen overflow-hidden relative flex flex-row lg:gap-2 lg:[gap:28px]">
      <GamePlayers
        game={game}
        properties={properties}
        game_properties={game_properties}
        my_properties={my_properties}
        me={me}
      />

      <div className="lg:flex-1 w-full">
        <GameBoard
          game={game}
          properties={properties}
          game_properties={game_properties}
          me={me}
          onGameUpdated={() => refetchGame()}
          onFinishByTime={finishGameByTime}
        />
      </div>
      <GameRoom game={game} me={me} />
    </main>
  ) : (
    <></>
  );
}