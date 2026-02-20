"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Game, Player, Property, GameProperty } from "@/types/game";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { useExitGame, useGetGameByCode } from "@/context/ContractProvider";
import { ApiResponse } from "@/types/api";
import { useGameTrades } from "@/hooks/useGameTrades";
import { isAIPlayer, calculateAiFavorability } from "@/utils/gameUtils";

export interface UsePlayerSidebarProps {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  my_properties: Property[];
  me: Player | null;
}

export function usePlayerSidebar({
  game,
  properties,
  game_properties,
  my_properties,
  me,
}: UsePlayerSidebarProps) {
  const [showEmpire, setShowEmpire] = useState(false);
  const [showTrade, setShowTrade] = useState(false);
  const [tradeModal, setTradeModal] = useState<{ open: boolean; target: Player | null }>({
    open: false,
    target: null,
  });
  const [counterModal, setCounterModal] = useState<{ open: boolean; trade: any | null }>({
    open: false,
    trade: null,
  });
  const [aiResponsePopup, setAiResponsePopup] = useState<any | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [winner, setWinner] = useState<Player | null>(null);
  const [endGameCandidate, setEndGameCandidate] = useState<{
    winner: Player | null;
    position: number;
    balance: bigint;
  }>({ winner: null, position: 0, balance: BigInt(0) });
  const [offerProperties, setOfferProperties] = useState<number[]>([]);
  const [requestProperties, setRequestProperties] = useState<number[]>([]);
  const [offerCash, setOfferCash] = useState<number>(0);
  const [requestCash, setRequestCash] = useState<number>(0);
  const [showPlayerList, setShowPlayerList] = useState(true);
  const [showVictoryModal, setShowVictoryModal] = useState(false);
  const [claimModalOpen, setClaimModalOpen] = useState(false);

  // Mobile: section open state (players, empire, trades)
  const [sectionOpen, setSectionOpen] = useState({
    players: true,
    empire: true,
    trades: false,
  });

  const { data: contractGame } = useGetGameByCode(game.code);
  const onChainGameId = contractGame?.id;

  const {
    exit: endGame,
    isPending: endGamePending,
    isSuccess: endGameSuccess,
    error: endGameError,
    txHash: endGameTxHash,
    reset: endGameReset,
  } = useExitGame(onChainGameId ?? BigInt(0));

  const toggleEmpire = useCallback(() => setShowEmpire((p) => !p), []);
  const toggleTrade = useCallback(() => setShowTrade((p) => !p), []);
  const isNext = !!me && game.next_player_id === me.user_id;

  const {
    openTrades,
    tradeRequests,
    aiTradePopup,
    closeAiTradePopup,
    refreshTrades,
  } = useGameTrades({
    gameId: game?.id,
    myUserId: me?.user_id,
    players: game?.players ?? [],
  });

  const totalActiveTrades = openTrades.length + tradeRequests.length;

  useEffect(() => {
    if (!game || game.status !== "FINISHED" || !me) return;

    let theWinner: Player | null = null;

    if (game.winner_id != null) {
      theWinner = game.players.find((p) => p.user_id === game.winner_id) ?? null;
    }
    if (!theWinner) {
      const activePlayers = game.players.filter((player) => {
        if ((player.balance ?? 0) > 0) return true;
        return game_properties.some(
          (gp) =>
            gp.address?.toLowerCase() === player.address?.toLowerCase() &&
            gp.mortgaged !== true
        );
      });
      if (activePlayers.length === 1) theWinner = activePlayers[0];
    }

    if (theWinner && winner?.user_id !== theWinner.user_id) {
      toast.success(`${theWinner.username} wins the game! 🎉🏆`);
      setWinner(theWinner);
      setEndGameCandidate({
        winner: theWinner,
        position: theWinner.position ?? 0,
        balance: BigInt(theWinner.balance ?? 0),
      });
      setShowVictoryModal(true);
      if (me?.user_id === theWinner.user_id) {
        toast.success("You are the Monopoly champion! 🏆");
      }
    }
  }, [game.players, game.winner_id, game_properties, game.status, me, winner]);

  useEffect(() => {
    setSectionOpen((prev) => ({
      ...prev,
      players: true,
      empire: my_properties.length > 0,
      trades: totalActiveTrades > 0,
    }));
  }, [my_properties.length, totalActiveTrades]);

  const resetTradeFields = useCallback(() => {
    setOfferCash(0);
    setRequestCash(0);
    setOfferProperties([]);
    setRequestProperties([]);
  }, []);

  const toggleSelect = useCallback(
    (id: number, arr: number[], setter: React.Dispatch<React.SetStateAction<number[]>>) => {
      setter((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    },
    []
  );

  const startTrade = useCallback(
    (targetPlayer: Player) => {
      if (!isNext) {
        toast.error("Not your turn!");
        return;
      }
      setTradeModal({ open: true, target: targetPlayer });
      resetTradeFields();
    },
    [isNext, resetTradeFields]
  );

  const sortedPlayers = useMemo(
    () =>
      [...(game?.players ?? [])].sort(
        (a, b) => (a.turn_order ?? Infinity) - (b.turn_order ?? Infinity)
      ),
    [game?.players]
  );

  const handleCreateTrade = useCallback(async () => {
    if (!me || !tradeModal.target) return;

    const targetPlayer = tradeModal.target;
    const isAI = isAIPlayer(targetPlayer);

    try {
      const payload = {
        game_id: game.id,
        player_id: me.user_id,
        target_player_id: targetPlayer.user_id,
        offer_properties: offerProperties,
        offer_amount: offerCash,
        requested_properties: requestProperties,
        requested_amount: requestCash,
        status: "pending",
      };

      const res = await apiClient.post<ApiResponse>("/game-trade-requests", payload);
      if (res?.data?.success) {
        toast.success("Trade sent successfully!");
        setTradeModal({ open: false, target: null });
        resetTradeFields();
        refreshTrades();

        if (isAI) {
          const sentTrade = {
            ...payload,
            id: res.data?.data?.id || Date.now(),
          };
          const favorability = calculateAiFavorability(sentTrade, properties);
          let decision: "accepted" | "declined" = "declined";
          let remark = "";

          if (favorability >= 30) {
            decision = "accepted";
            remark = "This is a fantastic deal! 🤖";
          } else if (favorability >= 10) {
            decision = Math.random() < 0.7 ? "accepted" : "declined";
            remark = decision === "accepted" ? "Fair enough, I'll take it." : "Not quite good enough.";
          } else if (favorability >= 0) {
            decision = Math.random() < 0.3 ? "accepted" : "declined";
            remark = decision === "accepted" ? "Okay, deal." : "Nah, too weak.";
          } else {
            remark = "This deal is terrible for me! 😤";
          }

          if (decision === "accepted") {
            await apiClient.post("/game-trade-requests/accept", { id: sentTrade.id });
            toast.success("AI accepted your trade instantly! 🎉");
            refreshTrades();
          }

          setAiResponsePopup({ trade: sentTrade, favorability, decision, remark });
        }
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to create trade");
    }
  }, [
    me,
    tradeModal.target,
    game.id,
    offerProperties,
    offerCash,
    requestProperties,
    requestCash,
    properties,
    resetTradeFields,
    refreshTrades,
  ]);

  const handleTradeAction = useCallback(
    async (id: number, action: "accepted" | "declined" | "counter") => {
      if (action === "counter") {
        const trade = tradeRequests.find((t) => t.id === id);
        if (trade) {
          setCounterModal({ open: true, trade });
          setOfferProperties(trade.requested_properties || []);
          setRequestProperties(trade.offer_properties || []);
          setOfferCash(trade.requested_amount || 0);
          setRequestCash(trade.offer_amount || 0);
        }
        return;
      }
      try {
        const res = await apiClient.post<ApiResponse>(
          `/game-trade-requests/${action === "accepted" ? "accept" : "decline"}`,
          { id }
        );
        if (res?.data?.success) {
          toast.success(`Trade ${action}`);
          closeAiTradePopup();
          refreshTrades();
        }
      } catch (error) {
        toast.error("Failed to update trade");
      }
    },
    [tradeRequests, closeAiTradePopup, refreshTrades]
  );

  const submitCounterTrade = useCallback(async () => {
    if (!counterModal.trade) return;
    try {
      const payload = {
        offer_properties: offerProperties,
        offer_amount: offerCash,
        requested_properties: requestProperties,
        requested_amount: requestCash,
        status: "counter",
      };
      const res = await apiClient.put<ApiResponse>(
        `/game-trade-requests/${counterModal.trade.id}`,
        payload
      );
      if (res?.data?.success) {
        toast.success("Counter offer sent");
        setCounterModal({ open: false, trade: null });
        resetTradeFields();
        refreshTrades();
      }
    } catch (error) {
      toast.error("Failed to send counter trade");
    }
  }, [
    counterModal.trade,
    offerProperties,
    offerCash,
    requestProperties,
    requestCash,
    resetTradeFields,
    refreshTrades,
  ]);

  const handleDevelopment = useCallback(
    async (id: number) => {
      if (!isNext || !me) return;
      try {
        const res = await apiClient.post<ApiResponse>("/game-properties/development", {
          game_id: game.id,
          user_id: me.user_id,
          property_id: id,
        });
        if (res?.data?.success) toast.success("Property developed successfully");
      } catch (error: any) {
        toast.error(error?.message || "Failed to develop property");
      }
    },
    [isNext, me, game.id]
  );

  const handleDowngrade = useCallback(
    async (id: number) => {
      if (!isNext || !me) return;
      try {
        const res = await apiClient.post<ApiResponse>("/game-properties/downgrade", {
          game_id: game.id,
          user_id: me.user_id,
          property_id: id,
        });
        if (res?.data?.success) toast.success("Property downgraded successfully");
        else toast.error(res.data?.message ?? "Failed to downgrade property");
      } catch (error: any) {
        toast.error(error?.message || "Failed to downgrade property");
      }
    },
    [isNext, me, game.id]
  );

  const handleMortgage = useCallback(
    async (id: number) => {
      if (!isNext || !me) return;
      try {
        const res = await apiClient.post<ApiResponse>("/game-properties/mortgage", {
          game_id: game.id,
          user_id: me.user_id,
          property_id: id,
        });
        if (res?.data?.success) toast.success("Property mortgaged successfully");
        else toast.error(res.data?.message ?? "Failed to mortgage property");
      } catch (error: any) {
        toast.error(error?.message || "Failed to mortgage property");
      }
    },
    [isNext, me, game.id]
  );

  const handleUnmortgage = useCallback(
    async (id: number) => {
      if (!isNext || !me) return;
      try {
        const res = await apiClient.post<ApiResponse>("/game-properties/unmortgage", {
          game_id: game.id,
          user_id: me.user_id,
          property_id: id,
        });
        if (res?.data?.success) toast.success("Property unmortgaged successfully");
        else toast.error(res.data?.message ?? "Failed to unmortgage property");
      } catch (error: any) {
        toast.error(error?.message || "Failed to unmortgage property");
      }
    },
    [isNext, me, game.id]
  );

  const handlePropertyTransfer = useCallback(
    async (propertyId: number, newPlayerId: number, _player_address: string) => {
      if (!propertyId || !newPlayerId) {
        toast("Cannot transfer: missing property or player");
        return;
      }
      try {
        const response = await apiClient.put<ApiResponse>(`/game-properties/${propertyId}`, {
          game_id: game.id,
          player_id: newPlayerId,
        });
        if (response.data?.success) {
          toast.success("Property transferred successfully! 🎉");
        } else {
          throw new Error(response.data?.message || "Transfer failed");
        }
      } catch (error: any) {
        const message =
          error.response?.data?.message ||
          error.message ||
          "Failed to transfer property";
        toast.error(message);
        console.error("Property transfer failed:", error);
      }
    },
    [game.id]
  );

  const handleDeleteGameProperty = useCallback(
    async (id: number) => {
      if (!id) return;
      try {
        const res = await apiClient.delete<ApiResponse>(`/game-properties/${id}`, {
          data: { game_id: game.id },
        });
        if (res?.data?.success)
          toast.success("Property returned to bank successfully");
        else toast.error(res.data?.message ?? "Failed to return property");
      } catch (error: any) {
        toast.error(error?.message || "Failed to return property");
      }
    },
    [game.id]
  );

  const getGamePlayerId = useCallback(
    (walletAddress: string | undefined): number | null => {
      if (!walletAddress) return null;
      const ownedProp = game_properties.find(
        (gp) => gp.address?.toLowerCase() === walletAddress.toLowerCase()
      );
      return ownedProp?.player_id ?? null;
    },
    [game_properties]
  );

  const handleClaimProperty = useCallback(
    async (propertyId: number, player: Player) => {
      const gamePlayerId = getGamePlayerId(player.address);
      if (!gamePlayerId) {
        toast.error("Cannot claim: unable to determine your game player ID");
        return;
      }
      const toastId = toast.loading(`Claiming property #${propertyId}...`);
      try {
        const res = await apiClient.put<ApiResponse>(`/game-properties/${propertyId}`, {
          game_id: game.id,
          player_id: gamePlayerId,
        });
        if (res.data?.success) {
          toast.success(
            `You now own ${res.data.data?.property_name || `#${propertyId}`}!`,
            { id: toastId }
          );
        } else {
          throw new Error(res.data?.message || "Claim unsuccessful");
        }
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.message || err.message || "Failed to claim property";
        console.error("Claim failed:", err);
        toast.error(errorMessage, { id: toastId });
      }
    },
    [game.id, getGamePlayerId]
  );

  const handleFinalizeAndLeave = useCallback(async (skipRedirect?: boolean) => {
    const toastId = toast.loading(
      winner?.user_id === me?.user_id ? "Finalizing..." : "Finalizing game..."
    );
    try {
      // Backend already ended the game on-chain (bankruptcy/leave or finish-by-time); no wallet signature needed
      await apiClient.put(`/games/${game.id}`, {
        status: "FINISHED",
        winner_id: me?.user_id || null,
      });
      toast.success(
        winner?.user_id === me?.user_id
          ? "You won! Prize already distributed."
          : "Game completed — thanks for playing!",
        { id: toastId, duration: 5000 }
      );
      if (!skipRedirect) {
        setTimeout(() => {
          window.location.href = "/";
        }, 1500);
      }
    } catch (err: any) {
      toast.error(err?.message || "Something went wrong — try again later", {
        id: toastId,
        duration: 8000,
      });
    } finally {
      if (endGameReset) endGameReset();
    }
  }, [winner, me, game.id, endGameReset]);

  return {
    showEmpire,
    setShowEmpire,
    toggleEmpire,
    showTrade,
    setShowTrade,
    toggleTrade,
    tradeModal,
    setTradeModal,
    counterModal,
    setCounterModal,
    aiResponsePopup,
    setAiResponsePopup,
    selectedProperty,
    setSelectedProperty,
    winner,
    setWinner,
    showVictoryModal,
    setShowVictoryModal,
    myPosition: (() => {
      try {
        const p = game?.placements;
        if (!p || !me?.user_id) return undefined;
        const placements = typeof p === "string" ? (() => { try { return JSON.parse(p); } catch { return null; } })() : p;
        if (!placements || typeof placements !== "object") return undefined;
        const pos = placements[me.user_id] ?? placements[String(me.user_id)];
        return typeof pos === "number" ? pos : undefined;
      } catch {
        return undefined;
      }
    })(),
    endGameCandidate,
    claimModalOpen,
    setClaimModalOpen,
    offerProperties,
    setOfferProperties,
    requestProperties,
    setRequestProperties,
    offerCash,
    setOfferCash,
    requestCash,
    setRequestCash,
    showPlayerList,
    setShowPlayerList,
    sectionOpen,
    setSectionOpen,
    contractGame,
    onChainGameId,
    endGame,
    endGamePending,
    endGameSuccess,
    endGameError,
    endGameTxHash,
    endGameReset,
    openTrades,
    tradeRequests,
    aiTradePopup,
    closeAiTradePopup,
    refreshTrades,
    totalActiveTrades,
    isNext,
    sortedPlayers,
    resetTradeFields,
    toggleSelect,
    startTrade,
    handleCreateTrade,
    handleTradeAction,
    submitCounterTrade,
    handleDevelopment,
    handleDowngrade,
    handleMortgage,
    handleUnmortgage,
    handlePropertyTransfer,
    handleDeleteGameProperty,
    getGamePlayerId,
    handleClaimProperty,
    handleFinalizeAndLeave,
  };
}
