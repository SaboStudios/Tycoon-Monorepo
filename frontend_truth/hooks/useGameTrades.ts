// hooks/useGameTrades.ts
import { useState, useEffect, useRef, useCallback } from "react";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";
import { Player } from "@/types/game";
import { isAIPlayer } from "@/utils/gameUtils";

interface UseGameTradesProps {
  gameId: number | undefined;
  myUserId: number | undefined;
  players: Player[];
}

export function useGameTrades({ gameId, myUserId, players }: UseGameTradesProps) {
  const [openTrades, setOpenTrades] = useState<any[]>([]);
  const [tradeRequests, setTradeRequests] = useState<any[]>([]);
  const [aiTradePopup, setAiTradePopup] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const processedAiTradeIds = useRef<Set<number>>(new Set());

  const fetchTrades = useCallback(async () => {
    if (!gameId || !myUserId) return;

    setIsLoading(true);
    try {
      const [_initiated, _incoming] = await Promise.all([
        apiClient.get<ApiResponse>(`/game-trade-requests/my/${gameId}/player/${myUserId}`),
        apiClient.get<ApiResponse>(`/game-trade-requests/incoming/${gameId}/player/${myUserId}`),
      ]);

      const initiated = _initiated.data?.data || [];
      const incoming = _incoming.data?.data || [];

      setOpenTrades(initiated);
      setTradeRequests(incoming);

      // Find pending AI trades that haven't been shown yet
      const pendingAiTrades = incoming.filter((t: any) => {
        if (t.status !== "pending") return false;
        if (processedAiTradeIds.current.has(t.id)) return false;

        const fromPlayer = players.find((p: Player) => p.user_id === t.player_id);
        return fromPlayer && isAIPlayer(fromPlayer);
      });

      if (pendingAiTrades.length > 0) {
        const trade = pendingAiTrades[0];
        setAiTradePopup(trade);
        processedAiTradeIds.current.add(trade.id);
      }
    } catch (err) {
      console.error("Error loading trades:", err);
    } finally {
      setIsLoading(false);
    }
  }, [gameId, myUserId, players]);

  // Poll every 5 seconds
  useEffect(() => {
    if (!gameId || !myUserId) return;

    fetchTrades(); // initial fetch
    const interval = setInterval(fetchTrades, 5000);

    return () => clearInterval(interval);
  }, [fetchTrades]);

  // Reset processed IDs when game changes
  useEffect(() => {
    processedAiTradeIds.current.clear();
  }, [gameId]);

  const closeAiTradePopup = () => setAiTradePopup(null);

  const refreshTrades = () => fetchTrades();

  return {
    openTrades,
    tradeRequests,
    aiTradePopup,
    closeAiTradePopup,
    isLoading,
    refreshTrades,
  };
}