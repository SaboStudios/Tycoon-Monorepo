"use client";

import { useState, useMemo, useCallback } from "react";
import { Game, Player, Property, GameProperty } from "@/types/game";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { useEndAIGameAndClaim, useGetGameByCode } from "@/context/ContractProvider";
import { ApiResponse } from "@/types/api";
import { getContractErrorMessage } from "@/lib/utils/contractErrors";
import { useGameTrades } from "@/hooks/useGameTrades";
import { isAIPlayer, calculateAiFavorability, getAiSlotFromPlayer } from "@/utils/gameUtils";

export interface UseAiPlayerLogicProps {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  my_properties: Property[];
  me: Player | null;
  currentPlayer: Player | null;
  isAITurn: boolean;
}

export function useAiPlayerLogic({
  game,
  properties,
  game_properties,
  my_properties,
  me,
  currentPlayer,
  isAITurn,
}: UseAiPlayerLogicProps) {
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
    validWin?: boolean; // true if winner has >= 20 turns, false otherwise
  }>({ winner: null, position: 0, balance: BigInt(0), validWin: true });

  const [offerProperties, setOfferProperties] = useState<number[]>([]);
  const [requestProperties, setRequestProperties] = useState<number[]>([]);
  const [offerCash, setOfferCash] = useState<number>(0);
  const [requestCash, setRequestCash] = useState<number>(0);

  const { data: contractGame } = useGetGameByCode(game.code);
  const onChainGameId = contractGame?.id;

  const endGameHook = useEndAIGameAndClaim(
    onChainGameId ?? BigInt(0),
    endGameCandidate.position,
    BigInt(endGameCandidate.balance),
    // Use validWin: if winner has < 20 turns, pass false to prevent spam, but still show them as winner
    endGameCandidate.winner ? (endGameCandidate.validWin !== false) : false
  );

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

  const toggleEmpire = useCallback(() => {}, []); // no-op; caller manages showEmpire
  const toggleTrade = useCallback(() => {}, []); // no-op; caller manages showTrade
  const isNext = !!me && game.next_player_id === me.user_id;

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

          // Optional Celo agent: try agent-registry first; fallback to built-in logic (no functions discarded)
          const slot = getAiSlotFromPlayer(targetPlayer);
          console.log("[useAiPlayerLogic] Trade to AI:", { 
            targetPlayer: targetPlayer.username, 
            slot, 
            turnOrder: targetPlayer.turn_order 
          });
          if (slot != null) {
            try {
              console.log("[useAiPlayerLogic] Calling agent-registry for slot", slot);
              const agentRes = await apiClient.post<{
                success: boolean;
                data?: { action: string };
                useBuiltIn?: boolean;
              }>("/agent-registry/decision", {
                gameId: game.id,
                slot,
                decisionType: "trade",
                context: {
                  tradeOffer: sentTrade,
                  myBalance: targetPlayer.balance ?? 0,
                  myProperties: game_properties
                    .filter((gp) => gp.address?.toLowerCase() === targetPlayer.address?.toLowerCase())
                    .map((gp) => ({
                      ...properties.find((p) => p.id === gp.property_id),
                      ...gp,
                    })),
                  opponents: (game.players ?? []).filter((p) => p.user_id !== targetPlayer.user_id),
                },
              });
              console.log("[useAiPlayerLogic] Agent response:", agentRes?.data);
              if (agentRes?.data?.success && agentRes.data.useBuiltIn === false && agentRes.data.data?.action) {
                const action = agentRes.data.data.action.toLowerCase();
                if (action === "accept") {
                  decision = "accepted";
                  remark = "Celo agent accepted. 🤖";
                } else if (action === "decline") {
                  decision = "declined";
                  remark = "Celo agent declined.";
                }
              } else {
                console.log("[useAiPlayerLogic] Using built-in logic (agent returned useBuiltIn=true or no action)");
              }
            } catch (err) {
              console.error("[useAiPlayerLogic] Agent call failed:", err);
              // Agent unreachable or error: use built-in logic below
            }
          }

          if (remark === "") {
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
          }

          if (decision === "accepted") {
            await apiClient.post("/game-trade-requests/accept", { id: sentTrade.id });
            toast.success("AI accepted your trade instantly! 🎉");
            refreshTrades();
          }

          setAiResponsePopup({
            trade: sentTrade,
            favorability,
            decision,
            remark,
          });
        }
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to create trade");
    }
  }, [
    me,
    tradeModal.target,
    game.id,
    game.players,
    game_properties,
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
        if (res?.data?.success) toast.success("Property returned to bank successfully");
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
        console.error("Claim failed:", err);
        toast.error(getContractErrorMessage(err, "Failed to claim property"), { id: toastId });
      }
    },
    [game.id, getGamePlayerId]
  );

  const aiSellHouses = useCallback(
    async (needed: number) => {
      const improved = game_properties
        .filter(
          (gp) =>
            gp.address === currentPlayer?.address && (gp.development ?? 0) > 0
        )
        .sort((a, b) => {
          const pa = properties.find((p) => p.id === a.property_id);
          const pb = properties.find((p) => p.id === b.property_id);
          return (pb?.rent_hotel || 0) - (pa?.rent_hotel || 0);
        });

      let raised = 0;
      for (const gp of improved) {
        if (raised >= needed) break;
        const prop = properties.find((p) => p.id === gp.property_id);
        if (!prop?.cost_of_house) continue;

        const sellValue = Math.floor(prop.cost_of_house / 2);
        const houses = gp.development ?? 0;

        for (let i = 0; i < houses && raised < needed; i++) {
          try {
            await apiClient.post("/game-properties/downgrade", {
              game_id: game.id,
              user_id: currentPlayer!.user_id,
              property_id: gp.property_id,
            });
            raised += sellValue;
            toast(`AI sold a house on ${prop.name} (raised $${raised})`);
          } catch (err) {
            console.error("AI failed to sell house", err);
            break;
          }
        }
      }
      return raised;
    },
    [game_properties, currentPlayer, properties, game.id]
  );

  const aiMortgageProperties = useCallback(
    async (needed: number) => {
      const unmortgaged = game_properties
        .filter(
          (gp) =>
            gp.address === currentPlayer?.address &&
            !gp.mortgaged &&
            gp.development === 0
        )
        .map((gp) => ({ gp, prop: properties.find((p) => p.id === gp.property_id) }))
        .filter(({ prop }) => prop?.price)
        .sort((a, b) => (b.prop?.price || 0) - (a.prop?.price || 0));

      let raised = 0;
      for (const { gp, prop } of unmortgaged) {
        if (raised >= needed || !prop) continue;
        const mortgageValue = Math.floor(prop.price / 2);
        try {
          await apiClient.post("/game-properties/mortgage", {
            game_id: game.id,
            user_id: currentPlayer!.user_id,
            property_id: gp.property_id,
          });
          raised += mortgageValue;
          toast(`AI mortgaged ${prop.name} (raised $${raised})`);
        } catch (err) {
          console.error("AI failed to mortgage", err);
        }
      }
      return raised;
    },
    [game_properties, currentPlayer, properties, game.id]
  );

  return {
    // State
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
    endGameCandidate,
    setEndGameCandidate,
    offerProperties,
    setOfferProperties,
    requestProperties,
    setRequestProperties,
    offerCash,
    setOfferCash,
    requestCash,
    setRequestCash,
    // Contract / end game
    endGameHook,
    onChainGameId,
    // Trades
    openTrades,
    tradeRequests,
    aiTradePopup,
    closeAiTradePopup,
    refreshTrades,
    resetTradeFields,
    toggleSelect,
    startTrade,
    sortedPlayers,
    isNext,
    toggleEmpire,
    toggleTrade,
    // Handlers
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
    aiSellHouses,
    aiMortgageProperties,
  };
}
