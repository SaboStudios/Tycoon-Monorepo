"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast, Toaster } from "react-hot-toast";

import {
  Game,
  GameProperty,
  Property,
  Player,
  PROPERTY_ACTION,
} from "@/types/game";
import { apiClient } from "@/lib/api";

// Child components
import BoardSquare from "./board-square";
import CenterArea from "./center-area";
import { ApiResponse } from "@/types/api";
import { useEndAIGameAndClaim, useGetGameByCode } from "@/context/ContractProvider";
import { BankruptcyModal } from "../modals/bankruptcy";
import { CardModal } from "../modals/cards";
import { PropertyActionModal } from "../modals/property-action";
import CollectibleInventoryBar from "@/components/collectibles/collectibles-invetory";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Crown, Trophy, Wallet, HeartHandshake } from "lucide-react";
import { usePropertyActions } from "@/hooks/usePropertyActions";
import { useGameTrades } from "@/hooks/useGameTrades";
import TradeAlertPill from "../TradeAlertPill";
import { GameDurationCountdown } from "../GameDurationCountdown";

/** Convert dice total (2–12) to die1+die2 for display when we only have the total (e.g. from API). */
function totalToDice(total: number): { die1: number; die2: number; total: number } {
  const t = Math.max(2, Math.min(12, Math.round(total)));
  if (t === 2) return { die1: 1, die2: 1, total: 2 };
  if (t === 12) return { die1: 6, die2: 6, total: 12 };
  const die1 = Math.min(6, Math.max(1, Math.floor(t / 2)));
  return { die1, die2: t - die1, total: t };
}
import { MONOPOLY_STATS, BOARD_SQUARES, ROLL_ANIMATION_MS, MOVE_ANIMATION_MS_PER_SQUARE, JAIL_POSITION, getDiceValues, BUILD_PRIORITY } from "../constants";
import { getContractErrorMessage } from "@/lib/utils/contractErrors";
import { isAIPlayer } from "@/utils/gameUtils";

const calculateBuyScore = (
  property: Property,
  player: Player,
  gameProperties: GameProperty[],
  allProperties: Property[]
): number => {
  if (!property.price || property.type !== "property") return 0;

  const price = property.price!;
  const baseRent = property.rent_site_only || 0;
  const cash = player.balance ?? 0;

  let score = 30;

  if (cash < price * 1.5) score -= 80;
  else if (cash < price * 2) score -= 40;
  else if (cash > price * 4) score += 35;
  else if (cash > price * 3) score += 15;

  const group = Object.values(MONOPOLY_STATS.colorGroups).find((g) => g.includes(property.id));
  if (group && !["railroad", "utility"].includes(property.color!)) {
    const owned = group.filter((id) =>
      gameProperties.find((gp) => gp.property_id === id)?.address === player.address
    ).length;

    if (owned === group.length - 1) score += 120;
    else if (owned === group.length - 2) score += 60;
    else if (owned >= 1) score += 25;
  }

  if (property.color === "railroad") {
    const owned = gameProperties.filter((gp) =>
      gp.address === player.address &&
      allProperties.find((p) => p.id === gp.property_id)?.color === "railroad"
    ).length;
    score += owned * 22;
  }
  if (property.color === "utility") {
    const owned = gameProperties.filter((gp) =>
      gp.address === player.address &&
      allProperties.find((p) => p.id === gp.property_id)?.type === "utility"
    ).length;
    score += owned * 28;
  }

  const rank = (MONOPOLY_STATS.landingRank as Record<number, number>)[property.id] ?? 25;
  score += 35 - rank;

  const roi = baseRent / price;
  if (roi > 0.14) score += 30;
  else if (roi > 0.10) score += 15;

  if (group && group.length <= 3) {
    const opponentOwns = group.filter((id) => {
      const gp = gameProperties.find((gp) => gp.property_id === id);
      return gp && gp.address !== player.address && gp.address !== null;
    }).length;

    if (opponentOwns === group.length - 1) score += 70;
  }

  return Math.max(0, Math.min(95, score));
};

const AiBoard = ({
  game,
  properties,
  game_properties,
  me,
  isGuest = false,
  onFinishGameByTime,
  onViewTrades,
}: {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  me: Player | null;
  isGuest?: boolean;
  onFinishGameByTime?: () => Promise<void>;
  onViewTrades?: () => void;
}) => {
  const [players, setPlayers] = useState<Player[]>(game?.players ?? []);
  const [gameTimeUp, setGameTimeUp] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [claimAndLeaveInProgress, setClaimAndLeaveInProgress] = useState(false);
  const timeUpHandledRef = useRef(false);
  const [roll, setRoll] = useState<{ die1: number; die2: number; total: number } | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [pendingRoll, setPendingRoll] = useState(0);
  const [actionLock, setActionLock] = useState<"ROLL" | "END" | null>(null);
  const [buyPrompted, setBuyPrompted] = useState(false);
  const [animatedPositions, setAnimatedPositions] = useState<Record<number, number>>({});
  const [hasMovementFinished, setHasMovementFinished] = useState(false);
  const [strategyRanThisTurn, setStrategyRanThisTurn] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isSpecialMove, setIsSpecialMove] = useState(false);
  const [showPerksModal, setShowPerksModal] = useState(false);

  const [showCardModal, setShowCardModal] = useState(false);
  const [cardData, setCardData] = useState<{
    type: "chance" | "community";
    text: string;
    effect?: string;
    isGood: boolean;
  } | null>(null);
  const [cardPlayerName, setCardPlayerName] = useState("");
  const prevHistoryLength = useRef(game.history?.length ?? 0);

  const landedPositionThisTurn = useRef<number | null>(null);
  const turnEndInProgress = useRef(false);
  const lastToastMessage = useRef<string | null>(null);
  const rolledForPlayerId = useRef<number | null>(null);
  const [showBankruptcyModal, setShowBankruptcyModal] = useState(false);
  const [jailChoiceRequired, setJailChoiceRequired] = useState(false);
  const [turnEndScheduled, setTurnEndScheduled] = useState(false);
  const [endByNetWorthStatus, setEndByNetWorthStatus] = useState<{ vote_count: number; required_votes: number; voters: Array<{ user_id: number; username: string }> } | null>(null);
  const [endByNetWorthLoading, setEndByNetWorthLoading] = useState(false);

  const currentPlayerId = game.next_player_id ?? -1;
  const currentPlayer = players.find((p) => p.user_id === currentPlayerId);

  const isMyTurn = me?.user_id === currentPlayerId;
  const isAITurn = !!currentPlayer && isAIPlayer(currentPlayer);

  const { tradeRequests = [] } = useGameTrades({
    gameId: game?.id,
    myUserId: me?.user_id,
    players: game?.players ?? [],
  });
  const myIncomingTrades = useMemo(() => {
    if (!me) return [];
    return tradeRequests.filter(
      (t: { target_player_id: number; status: string }) =>
        t.target_player_id === me.user_id && t.status === "pending"
    );
  }, [tradeRequests, me]);

  const playerCanRoll = Boolean(
    isMyTurn && currentPlayer && (currentPlayer.balance ?? 0) > 0 && !gameTimeUp
  );

  const currentPlayerInJail = currentPlayer?.position === JAIL_POSITION && Boolean(currentPlayer?.in_jail);

  const meInJail = Boolean(
    isMyTurn && me && Number(me.position) === JAIL_POSITION && me.in_jail
  );
  const canPayToLeaveJail = meInJail && (me?.balance ?? 0) >= 50;

  

  const [endGameCandidate, setEndGameCandidate] = useState<{
    winner: Player | null;
    position: number;
    balance: bigint;
    validWin?: boolean; // true if winner has >= 20 turns, false otherwise
  }>({ winner: null, position: 0, balance: BigInt(0), validWin: true });

    // ── At the top of AiBoard component, with other hooks ──

  const currentProperty = useMemo(() => {
    return currentPlayer?.position
      ? properties.find((p) => p.id === currentPlayer.position) ?? null
      : null;
  }, [currentPlayer?.position, properties]);

  const justLandedProperty = useMemo(() => {
    if (landedPositionThisTurn.current === null) return null;
    return properties.find((p) => p.id === landedPositionThisTurn.current) ?? null;
  }, [landedPositionThisTurn.current, properties]);

const { data: contractGame } = useGetGameByCode(game.code);

// Extract the on-chain game ID (it's a bigint now)
const onChainGameId = contractGame?.id;

// Hook for ending an AI game and claiming rewards
const {
  write: endGame,
  isPending: endGamePending,
  isSuccess: endGameSuccess,
  error: endGameError,
  txHash: endGameTxHash,
  reset: endGameReset,
} = useEndAIGameAndClaim(
  onChainGameId ?? BigInt(0),                    // gameId: bigint (use 0n as fallback if undefined)
  endGameCandidate.position,              // finalPosition: number (uint8, 0-39)
  BigInt(endGameCandidate.balance),       // finalBalance: bigint
  // Use validWin: if winner has < 20 turns, pass false to prevent spam, but still show them as winner
  endGameCandidate.winner ? (endGameCandidate.validWin !== false) : false
);
  

  const buyScore = useMemo(() => {
    if (!isAITurn || !buyPrompted || !currentPlayer || !justLandedProperty) return null;
    return calculateBuyScore(justLandedProperty, currentPlayer, game_properties, properties);
  }, [isAITurn, buyPrompted, currentPlayer, justLandedProperty, game_properties, properties]);

  if (!game || !Array.isArray(properties) || properties.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white text-2xl">
        Loading game board...
      </div>
    );
  }

  // Show toasts only for successful property purchases and the purple trade notification (toast.custom)
  const showToast = useCallback((message: string, type: "success" | "error" | "default" = "default") => {
    if (type === "success" && (message.startsWith("You bought") || message.startsWith("AI bought") || (message.includes("bought") && message.endsWith("!")))) {
      toast.success(message);
    }
  }, []);

  const handleGameTimeUp = useCallback(async () => {
    if (timeUpHandledRef.current || game.status !== "RUNNING") return;
    timeUpHandledRef.current = true;
    setGameTimeUp(true);
    try {
      // Backend finishes the game (assigns winner) before we show the modal.
      const res = await apiClient.post<{
        success?: boolean;
        data?: { winner_id: number; game?: { players?: Player[] }; valid_win?: boolean; winner_turn_count?: number };
      }>(`/games/${game.id}/finish-by-time`);
      const data = res?.data?.data;
      const winnerId = data?.winner_id;
      if (winnerId == null) {
        throw new Error((res?.data as { error?: string })?.error ?? "Could not finish game by time");
      }
      const updatedPlayers = data?.game?.players ?? players;
      const winnerPlayer = updatedPlayers.find((p) => p.user_id === winnerId) ?? null;
      setWinner(winnerPlayer);
      const myPosition = me?.position ?? 0;
      const myBalance = BigInt(me?.balance ?? 0);
      const validWin = data?.valid_win !== false;
      if (winnerId === me?.user_id) {
        setEndGameCandidate({ winner: me!, position: myPosition, balance: myBalance, validWin });
      } else {
        setEndGameCandidate({ winner: null, position: myPosition, balance: myBalance, validWin: true });
      }
      await onFinishGameByTime?.(); // invalidate & refetch so parent has updated game
    } catch (e) {
      console.error("Time up / finish-by-time failed:", e);
      timeUpHandledRef.current = false;
      setGameTimeUp(false);
    }
  }, [game.id, game.status, me, players, onFinishGameByTime]);

  const handleFinalizeTimeUpAndLeave = useCallback(async () => {
    setShowExitPrompt(false);
    const isHumanWinner = winner?.user_id === me?.user_id;
    try {
      // 1) Claim on-chain first (winners and losers both call exit AI game to get rewards)
      await endGame();
      // 2) Then sync backend (mark game FINISHED). Both can call; backend is idempotent if already finished.
      try {
        await onFinishGameByTime?.();
      } catch (backendErr: any) {
        if (backendErr?.message?.includes("not running") || backendErr?.response?.data?.error === "Game is not running") {
          // Game already finished. On-chain claim succeeded; ignore.
        } else {
          throw backendErr;
        }
      }
      toast.success(isHumanWinner ? "Prize claimed! 🎉" : "Consolation collected — thanks for playing!");
      // Stay on modal; user chooses when to go home via "Go home" button
    } catch (err: any) {
      toast.error(getContractErrorMessage(err, "Something went wrong — try again later"));
    } finally {
      endGameReset();
    }
  }, [winner?.user_id, me?.user_id, onFinishGameByTime, endGame, endGameReset]);

  const handleClaimAndGoHome = useCallback(async () => {
    setClaimAndLeaveInProgress(true);
    const isHumanWinner = winner?.user_id === me?.user_id;
    try {
      // Guest: backend already claimed on-chain when finish-by-time ran; skip wallet call.
      if (!isGuest) {
        await endGame();
      }
      try {
        await onFinishGameByTime?.();
      } catch (backendErr: any) {
        if (backendErr?.message?.includes("not running") || backendErr?.response?.data?.error === "Game is not running") {
          // ignore
        } else {
          throw backendErr;
        }
      }
      toast.success(isHumanWinner ? "Prize claimed! 🎉" : "Consolation collected — thanks for playing!");
      window.location.href = "/";
    } catch (err: any) {
      toast.error(getContractErrorMessage(err, "Something went wrong — try again later"));
      setClaimAndLeaveInProgress(false);
    } finally {
      endGameReset();
    }
  }, [winner?.user_id, me?.user_id, isGuest, onFinishGameByTime, endGame, endGameReset]);

  // Sync players
  useEffect(() => {
    if (game?.players) setPlayers(game.players);
  }, [game?.players]);

  // Only show winner when backend has marked the game FINISHED (same as mobile).
  useEffect(() => {
    if (!game || game.status !== "FINISHED" || game.winner_id == null) return;

    const winnerPlayer = players.find((p) => p.user_id === game.winner_id) ?? (me?.user_id === game.winner_id ? me : null);
    if (!winnerPlayer) return;

    setWinner(winnerPlayer);
    const turnCount = winnerPlayer.turn_count ?? 0;
    const validWin = turnCount >= 20;
    setEndGameCandidate({
      winner: winnerPlayer,
      position: winnerPlayer.position ?? 0,
      balance: BigInt(winnerPlayer.balance ?? 0),
      validWin,
    });
  }, [game?.status, game?.winner_id, players, me]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await apiClient.get<ApiResponse>(`/games/code/${game.code}`);
        if (res?.data?.success && res.data.data?.players) {
          setPlayers(res.data.data.players);
        }
      } catch (err) {
        console.error("Sync failed:", err);
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [game.code]);

  // Reset turn state
  useEffect(() => {
    setRoll(null);
    setBuyPrompted(false);
    setIsRolling(false);
    setPendingRoll(0);
    landedPositionThisTurn.current = null;
    rolledForPlayerId.current = null;
    turnEndInProgress.current = false;
    lastToastMessage.current = null;
    setAnimatedPositions({});
    setHasMovementFinished(false);
    setStrategyRanThisTurn(false);
    setTurnEndScheduled(false);
  }, [currentPlayerId]);

  // Clear turnEndScheduled once it's no longer our turn (e.g. after refetch)
  useEffect(() => {
    if (!isMyTurn) setTurnEndScheduled(false);
  }, [isMyTurn]);

  const lockAction = useCallback((type: "ROLL" | "END") => {
    if (actionLock) return false;
    setActionLock(type);
    return true;
  }, [actionLock]);

  const unlockAction = useCallback(() => setActionLock(null), []);

  const END_TURN = useCallback(async (timedOut?: boolean) => {
    if (currentPlayerId === -1 || turnEndInProgress.current || !lockAction("END")) return;

    turnEndInProgress.current = true;

    try {
      await apiClient.post("/game-players/end-turn", {
        user_id: currentPlayerId,
        game_id: game.id,
        ...(timedOut === true && { timed_out: true }),
      });
      // Turn state visible on board — no toast
    } catch (err) {
      toast.error(getContractErrorMessage(err, "Failed to end turn"));
    } finally {
      unlockAction();
      turnEndInProgress.current = false;
    }
  }, [currentPlayerId, game.id, lockAction, unlockAction, showToast]);

  // Per-turn roll timer removed: no countdown or auto-end turn.

// ── Then your BUY_PROPERTY becomes: ──
const BUY_PROPERTY = useCallback(async (isAiAction = false) => {
  if (!currentPlayer?.position || actionLock || !justLandedProperty?.price) {
    showToast("Cannot buy right now", "error");
    return;
  }

  const playerBalance = currentPlayer.balance ?? 0;
  if (playerBalance < justLandedProperty.price) {
    showToast("Not enough money!", "error");
    return;
  }

  const buyerUsername = me?.username;
  

  if (!buyerUsername) {
    showToast("Cannot buy: your username is missing", "error");
    return;
  }

  try {
    showToast("Sending transaction...", "default");
    await apiClient.post("/game-properties/buy", {
      user_id: currentPlayer.user_id,
      game_id: game.id,
      property_id: justLandedProperty.id,
    });

    showToast(
      isAiAction 
        ? `AI bought ${justLandedProperty.name}!` 
        : `You bought ${justLandedProperty.name}!`, 
      "success"
    );

    setTurnEndScheduled(true);
    setBuyPrompted(false);
    landedPositionThisTurn.current = null;
    setTimeout(END_TURN, 800);

  } catch (err: any) {
    console.error("Buy failed:", err);
    toast.error(getContractErrorMessage(err, "Purchase failed"));
  }
}, [
  currentPlayer,
  justLandedProperty,
  actionLock,
  END_TURN,
  showToast,
  game.id,
]);

  const triggerLandingLogic = useCallback((newPosition: number, isSpecial = false) => {
  // Prevent double calls / race conditions
  if (landedPositionThisTurn.current !== null) return;

  landedPositionThisTurn.current = newPosition;
  setIsSpecialMove(isSpecial);

  // Force buy prompt check
  setRoll({ die1: 0, die2: 0, total: 0 }); // fake roll just to trigger useEffect
  setHasMovementFinished(true);

  // Optional: tiny delay for better UX
  setTimeout(() => {
    const square = properties.find(p => p.id === newPosition);
    if (square?.price != null) {
      const isOwned = game_properties.some(gp => gp.property_id === newPosition);
      if (!isOwned && ["land", "railway", "utility"].includes(PROPERTY_ACTION(newPosition) || "")) {
        setBuyPrompted(true);
        // Landed position visible — no toast
      }
    }
  }, 300);
}, [properties, game_properties, setBuyPrompted, setHasMovementFinished]);

const endTurnAfterSpecialMove = useCallback(() => {
  setBuyPrompted(false);
  landedPositionThisTurn.current = null;
  setIsSpecialMove(false);
  setTimeout(END_TURN, 800);
}, [END_TURN]);

  const handlePropertyTransfer = async (propertyId: number, newPlayerId: number) => {
    if (!propertyId || !newPlayerId) {
      toast("Cannot transfer: missing property or player");
      return;
    }

    const gp = game_properties.find(gp => gp.property_id === propertyId);
    if (!gp?.address) {
      toast("Cannot transfer: no current owner found");
      return;
    }

    const sellerPlayer = players.find(p => p.address?.toLowerCase() === gp.address?.toLowerCase());
    const buyerPlayer = players.find(p => p.user_id === newPlayerId);

    if (!sellerPlayer || !buyerPlayer) {
      toast("Cannot transfer: seller or buyer not found");
      return;
    }

    const sellerUsername = sellerPlayer.username;
    const buyerUsername = buyerPlayer.username;

    try {
      // Backend owns the transfer; game controller calls contract transferPropertyOwnership when needed
      const response = await apiClient.put<ApiResponse>(
        `/game-properties/${propertyId}`,
        {
          game_id: game.id,
          player_id: newPlayerId,
        }
      );

      if (response.data?.success) {
        toast.success("Property transferred successfully! 🎉");
      } else {
        throw new Error(response.data?.message || "Transfer failed");
      }
    } catch (error: any) {
      toast.error(getContractErrorMessage(error, "Failed to transfer property"));
      console.error("Property transfer failed:", error);
    }
  };

  // ── AI STRATEGY HELPERS ─────────────────────────────────────

  const getPlayerOwnedProperties = (playerAddress: string | undefined, game_properties: GameProperty[], properties: Property[]) => {
    if (!playerAddress) return [];
    return game_properties
      .filter(gp => gp.address?.toLowerCase() === playerAddress.toLowerCase())
      .map(gp => ({
        gp,
        prop: properties.find(p => p.id === gp.property_id)!,
      }))
      .filter(item => !!item.prop);
  };

  const getCompleteMonopolies = (playerAddress: string | undefined, game_properties: GameProperty[], properties: Property[]) => {
    if (!playerAddress) return [];

    const owned = getPlayerOwnedProperties(playerAddress, game_properties, properties);
    const monopolies: string[] = [];

    Object.entries(MONOPOLY_STATS.colorGroups).forEach(([groupName, ids]) => {
      if (groupName === "railroad" || groupName === "utility") return;

      const ownedInGroup = owned.filter(o => ids.includes(o.prop.id));
      if (ownedInGroup.length === ids.length) {
        const allUnmortgaged = ownedInGroup.every(o => !o.gp.mortgaged);
        if (allUnmortgaged) {
          monopolies.push(groupName);
        }
      }
    });

    return monopolies.sort((a, b) => BUILD_PRIORITY.indexOf(a) - BUILD_PRIORITY.indexOf(b));
  };

  const getNearCompleteOpportunities = (playerAddress: string | undefined, game_properties: GameProperty[], properties: Property[]) => {
    if (!playerAddress) return [];

    const owned = getPlayerOwnedProperties(playerAddress, game_properties, properties);
    const opportunities: {
      group: string;
      needs: number;
      missing: { id: number; name: string; ownerAddress: string | null; ownerName: string }[];
    }[] = [];

    Object.entries(MONOPOLY_STATS.colorGroups).forEach(([groupName, ids]) => {
      if (groupName === "railroad" || groupName === "utility") return;

      const ownedCount = owned.filter(o => ids.includes(o.prop.id)).length;
      const needs = ids.length - ownedCount;

      if (needs === 1 || needs === 2) {
        const missing = ids
          .filter(id => !owned.some(o => o.prop.id === id))
          .map(id => {
            const gp = game_properties.find(g => g.property_id === id);
            const prop = properties.find(p => p.id === id)!;
            const ownerName = gp?.address
              ? players.find(p => p.address?.toLowerCase() === gp.address?.toLowerCase())?.username || gp.address.slice(0, 8)
              : "Bank";
            return {
              id,
              name: prop.name,
              ownerAddress: gp?.address || null,
              ownerName,
            };
          });

        opportunities.push({ group: groupName, needs, missing });
      }
    });

    return opportunities.sort((a, b) => {
      if (a.needs !== b.needs) return a.needs - b.needs;
      return BUILD_PRIORITY.indexOf(a.group) - BUILD_PRIORITY.indexOf(b.group);
    });
  };

  const calculateTradeFavorability = (
    trade: { offer_properties: number[]; offer_amount: number; requested_properties: number[]; requested_amount: number },
    receiverAddress: string
  ) => {
    let score = 0;

    score += trade.offer_amount - trade.requested_amount;

    trade.requested_properties.forEach(id => {
      const prop = properties.find(p => p.id === id);
      if (!prop) return;
      score += prop.price || 0;

      const group = Object.values(MONOPOLY_STATS.colorGroups).find(g => g.includes(id));
      if (group && !["railroad", "utility"].includes(prop.color!)) {
        const currentOwned = group.filter(gid =>
          game_properties.find(gp => gp.property_id === gid && gp.address === receiverAddress)
        ).length;
        if (currentOwned === group.length - 1) score += 300;
        else if (currentOwned === group.length - 2) score += 120;
      }
    });

    trade.offer_properties.forEach(id => {
      const prop = properties.find(p => p.id === id);
      if (!prop) return;
      score -= (prop.price || 0) * 1.3;
    });

    return score;
  };

  const calculateFairCashOffer = (propertyId: number, completesSet: boolean, basePrice: number) => {
    return completesSet ? Math.floor(basePrice * 1.6) : Math.floor(basePrice * 1.3);
  };

  const getPropertyToOffer = (playerAddress: string, excludeGroups: string[] = []) => {
    const owned = getPlayerOwnedProperties(playerAddress, game_properties, properties);
    const candidates = owned.filter(o => {
      const group = Object.keys(MONOPOLY_STATS.colorGroups).find(g =>
        MONOPOLY_STATS.colorGroups[g as keyof typeof MONOPOLY_STATS.colorGroups].includes(o.prop.id)
      );
      if (!group || excludeGroups.includes(group)) return false;
      if (o.gp.development! > 0) return false;
      return true;
    });

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => (a.prop.price || 0) - (b.prop.price || 0));
    return candidates[0];
  };

  const handleAiBuilding = async (player: Player) => {
    if (!player.address) return;

    const monopolies = getCompleteMonopolies(player.address, game_properties, properties);
    if (monopolies.length === 0) return;

    let built = false;

    for (const groupName of monopolies) {
      const ids = MONOPOLY_STATS.colorGroups[groupName as keyof typeof MONOPOLY_STATS.colorGroups];
      const groupGps = game_properties.filter(gp => ids.includes(gp.property_id) && gp.address === player.address);

      const developments = groupGps.map(gp => gp.development ?? 0);
      const minHouses = Math.min(...developments);
      const maxHouses = Math.max(...developments);

      if (maxHouses > minHouses + 1 || minHouses >= 5) continue;

      const prop = properties.find(p => ids.includes(p.id))!;
      const houseCost = prop.cost_of_house ?? 0;
      if (houseCost === 0) continue;

      const affordable = Math.floor((player.balance ?? 0) / houseCost);
      if (affordable < ids.length) continue;

      for (const gp of groupGps.filter(g => (g.development ?? 0) === minHouses)) {
        try {
          await apiClient.post("/game-properties/development", {
            game_id: game.id,
            user_id: player.user_id,
            property_id: gp.property_id,
          });
          showToast(`AI built on ${prop.name} (${groupName})`, "success");
          built = true;
          await new Promise(r => setTimeout(r, 600));
        } catch (err) {
          console.error("Build failed", err);
          break;
        }
      }

      if (built) break;
    }
  };

  const refreshGame = async () => {
    try {
      const res = await apiClient.get<ApiResponse>(`/games/code/${game.code}`);
      if (res?.data?.success) {
        setPlayers(res.data.data.players);
      }
    } catch (err) {
      console.error("Refresh failed", err);
    }
  };

  const handleAiStrategy = async () => {
    if (!currentPlayer || !isAITurn || strategyRanThisTurn) return;

    showToast(`${currentPlayer.username} is thinking... 🧠`, "default");

    const opportunities = getNearCompleteOpportunities(currentPlayer.address, game_properties, properties);
    let maxTradeAttempts = 1;

    for (const opp of opportunities) {
      if (maxTradeAttempts <= 0) break;

      for (const missing of opp.missing) {
        if (!missing.ownerAddress || missing.ownerAddress === "bank") continue;

        const targetPlayer = players.find(p => p.address?.toLowerCase() === missing.ownerAddress?.toLowerCase());
        if (!targetPlayer) continue;

        const basePrice = properties.find(p => p.id === missing.id)?.price || 200;
        const cashOffer = calculateFairCashOffer(missing.id, opp.needs === 1, basePrice);

        let offerProperties: number[] = [];
        if ((currentPlayer.balance ?? 0) < cashOffer + 300) {
          const toOffer = getPropertyToOffer(currentPlayer.address!, [opp.group]);
          if (toOffer) {
            offerProperties = [toOffer.prop.id];
            showToast(`AI offering ${toOffer.prop.name} in deal`, "default");
          }
        }

        const payload = {
          game_id: game.id,
          player_id: currentPlayer.user_id,
          target_player_id: targetPlayer.user_id,
          offer_properties: offerProperties,
          offer_amount: cashOffer,
          requested_properties: [missing.id],
          requested_amount: 0,
        };

        try {
          const res = await apiClient.post<ApiResponse>("/game-trade-requests", payload);
          if (res?.data?.success) {
            showToast(`AI offered $${cashOffer}${offerProperties.length ? " + property" : ""} for ${missing.name}`, "default");
            maxTradeAttempts--;

            if (isAIPlayer(targetPlayer)) {
              await new Promise(r => setTimeout(r, 800));
              const favorability = calculateTradeFavorability(
                { ...payload, requested_amount: 0 },
                targetPlayer.address!
              );

              if (favorability >= 50) {
                await apiClient.post("/game-trade-requests/accept", { id: res.data.data.id });
                showToast(`${targetPlayer.username} accepted deal! 🤝`, "success");
                await refreshGame();
              } else {
                await apiClient.post("/game-trade-requests/decline", { id: res.data.data.id });
                showToast(`${targetPlayer.username} declined`, "default");
              }
            } else {
              showToast(`Trade proposed to ${targetPlayer.username}`, "default");
            }
          }
        } catch (err) {
          console.error("Trade failed", err);
        }

        await new Promise(r => setTimeout(r, 1200));
      }
    }

    await handleAiBuilding(currentPlayer);
    setStrategyRanThisTurn(true);
    showToast(`${currentPlayer.username} ready to roll`, "default");
  };

  useEffect(() => {
    if (isAITurn && currentPlayer && !strategyRanThisTurn) {
      const timer = setTimeout(handleAiStrategy, 1000);
      return () => clearTimeout(timer);
    }
  }, [isAITurn, currentPlayer, strategyRanThisTurn]);

  const fetchGameState = useCallback(async () => {
    try {
      const res = await apiClient.get<ApiResponse>(`/games/code/${game.code}`);
      if (res?.data?.success && res.data.data?.players) {
        setPlayers(res.data.data.players);
      }
    } catch (err) {
      console.error("Fetch game failed:", err);
    }
  }, [game.code]);

  const isUntimed = !game?.duration || Number(game.duration) === 0;

  const fetchEndByNetWorthStatus = useCallback(async () => {
    if (!game?.id || !isUntimed) return;
    try {
      const res = await apiClient.post<ApiResponse>("/game-players/end-by-networth-status", { game_id: game.id });
      if (res?.data?.success && res.data.data) {
        setEndByNetWorthStatus({
          vote_count: res.data.data.vote_count,
          required_votes: res.data.data.required_votes,
          voters: res.data.data.voters ?? [],
        });
      } else {
        setEndByNetWorthStatus(null);
      }
    } catch {
      setEndByNetWorthStatus(null);
    }
  }, [game?.id, isUntimed]);

  const voteEndByNetWorth = useCallback(async () => {
    if (!me?.user_id || !game?.id || !isUntimed) return;
    setEndByNetWorthLoading(true);
    try {
      const res = await apiClient.post<ApiResponse>("/game-players/vote-end-by-networth", {
        game_id: game.id,
        user_id: me.user_id,
      });
      if (res?.data?.success && res.data.data) {
        const data = res.data.data;
        setEndByNetWorthStatus({
          vote_count: data.vote_count,
          required_votes: data.required_votes,
          voters: data.voters ?? [],
        });
        if (data.all_voted) {
          toast.success("Game ended by net worth");
          await fetchGameState();
          await onFinishGameByTime?.();
        } else {
          toast.success(`${data.vote_count}/${data.required_votes} voted to end by net worth`);
        }
      }
    } catch (err: unknown) {
      toast.error(getContractErrorMessage(err, "Failed to vote"));
    } finally {
      setEndByNetWorthLoading(false);
    }
  }, [game?.id, me?.user_id, isUntimed, fetchGameState, onFinishGameByTime]);

  useEffect(() => {
    if (!isUntimed || !game?.id) {
      setEndByNetWorthStatus(null);
      return;
    }
    fetchEndByNetWorthStatus();
  }, [game?.id, isUntimed, fetchEndByNetWorthStatus, game?.history?.length]);

  const ROLL_DICE = useCallback(async (forAI = false) => {
    if (isRolling || actionLock || !lockAction("ROLL")) return;

    setIsRolling(true);
    setRoll(null);
    setHasMovementFinished(false);

    setTimeout(async () => {
      const value = getDiceValues();
      if (!value) {
        showToast("DOUBLES! Roll again!", "success");
        setIsRolling(false);
        unlockAction();
        return;
      }

      setRoll(value);
      const playerId = forAI ? currentPlayerId : me!.user_id;
      const player = players.find((p) => p.user_id === playerId);
      if (!player) return;

      const currentPos = player.position ?? 0;
      const isInJail = Boolean(player.in_jail) && currentPos === JAIL_POSITION;
      const rolledDouble = value.die1 === value.die2;

      let newPos = currentPos;
      let shouldAnimate = false;

      if (!isInJail) {
        const totalMove = value.total + pendingRoll;
        newPos = (currentPos + totalMove) % BOARD_SQUARES;
        shouldAnimate = totalMove > 0;

        if (shouldAnimate) {
          const movePath: number[] = [];
          for (let i = 1; i <= totalMove; i++) {
            movePath.push((currentPos + i) % BOARD_SQUARES);
          }

          for (let i = 0; i < movePath.length; i++) {
            await new Promise((resolve) => setTimeout(resolve, MOVE_ANIMATION_MS_PER_SQUARE));
            setAnimatedPositions((prev) => ({
              ...prev,
              [playerId]: movePath[i],
            }));
          }
        }
      } else {
        if (rolledDouble) {
          const totalMove = value.total;
          newPos = (currentPos + totalMove) % BOARD_SQUARES;
          shouldAnimate = totalMove > 0;
          if (shouldAnimate) {
            const movePath: number[] = [];
            for (let i = 1; i <= totalMove; i++) {
              movePath.push((currentPos + i) % BOARD_SQUARES);
            }
            for (let i = 0; i < movePath.length; i++) {
              await new Promise((resolve) => setTimeout(resolve, MOVE_ANIMATION_MS_PER_SQUARE));
              setAnimatedPositions((prev) => ({
                ...prev,
                [playerId]: movePath[i],
              }));
            }
          }
        } else {
          // Human in jail, no doubles — backend will return still_in_jail; show Pay / Use card / Stay
          if (!forAI) {
            setHasMovementFinished(true);
            try {
              const res = await apiClient.post<{ data?: { still_in_jail?: boolean; rolled?: number } }>(
                "/game-players/change-position",
                {
                  user_id: playerId,
                  game_id: game.id,
                  position: currentPos,
                  rolled: value.total,
                  is_double: false,
                }
              );
              const data = (res?.data ?? res) as { still_in_jail?: boolean; rolled?: number } | undefined;
              await fetchGameState();
              if (data?.still_in_jail) {
                setJailChoiceRequired(true);
                setRoll(value);
              } else {
                setTimeout(END_TURN, 1000);
              }
            } catch (err) {
              toast.error(getContractErrorMessage(err, "Jail roll failed"));
              END_TURN();
            }
            setIsRolling(false);
            unlockAction();
            return;
          }
          showToast(
            `${player.username || "Player"} is in jail — rolled ${value.die1} + ${value.die2} = ${value.total} (no double)`,
            "default"
          );
        }
      }

      setHasMovementFinished(true);

      try {
        if (isInJail) landedPositionThisTurn.current = null;
        const res = await apiClient.post<{ data?: { still_in_jail?: boolean } }>(
          "/game-players/change-position",
          {
            user_id: playerId,
            game_id: game.id,
            position: newPos,
            rolled: value.total + pendingRoll,
            is_double: rolledDouble,
          }
        );
        const data = (res?.data ?? res) as { still_in_jail?: boolean } | undefined;
        if (data?.still_in_jail) {
          if (!forAI) {
            setJailChoiceRequired(true);
            setRoll(value);
            setPendingRoll(0);
            await fetchGameState();
            setIsRolling(false);
            unlockAction();
            return;
          }
          await apiClient.post("/game-players/stay-in-jail", { user_id: playerId, game_id: game.id });
          await fetchGameState();
          setPendingRoll(0);
          setIsRolling(false);
          unlockAction();
          return;
        }

        setPendingRoll(0);
        landedPositionThisTurn.current = isInJail ? (rolledDouble ? newPos : null) : newPos;

        if (!isInJail) {
          showToast(
            `${player.username || "Player"} rolled ${value.die1} + ${value.die2} = ${value.total}!`,
            "success"
          );
        }

        if (forAI) rolledForPlayerId.current = currentPlayerId;
      } catch (err) {
        console.error("Move failed:", err);
        toast.error(getContractErrorMessage(err, "Move failed"));
        END_TURN();
      } finally {
        setIsRolling(false);
        unlockAction();
      }
    }, ROLL_ANIMATION_MS);
  }, [
    isRolling, actionLock, lockAction, unlockAction,
    currentPlayerId, me, players, pendingRoll, game.id,
    showToast, END_TURN, fetchGameState,
  ]);

  useEffect(() => {
    if (!isAITurn || isRolling || actionLock || roll || rolledForPlayerId.current === currentPlayerId || !strategyRanThisTurn) return;
    const timer = setTimeout(() => ROLL_DICE(true), 1500);
    return () => clearTimeout(timer);
  }, [isAITurn, isRolling, actionLock, roll, currentPlayerId, ROLL_DICE, strategyRanThisTurn]);

  useEffect(() => {
    if (!roll || landedPositionThisTurn.current === null || !hasMovementFinished) {
      setBuyPrompted(false);
      return;
    }

    const pos = landedPositionThisTurn.current;
    const square = properties.find(p => p.id === pos);

    if (!square || square.price == null) {
      setBuyPrompted(false);
      return;
    }

    const isOwned = game_properties.some(gp => gp.property_id === pos);
    const action = PROPERTY_ACTION(pos);
    const isBuyableType = !!action && ["land", "railway", "utility"].includes(action);

    const canBuy = !isOwned && isBuyableType;

    setBuyPrompted(canBuy);

    if (canBuy && (currentPlayer?.balance ?? 0) < square.price) {
      showToast(`Not enough money to buy ${square.name}`, "error");
    }
  }, [
    roll,
    landedPositionThisTurn.current,
    hasMovementFinished,
    game_properties,
    properties,
    currentPlayer,
    showToast
  ]);

  // COMMENTED OUT: Card modal disabled
  // useEffect(() => {
  //   const history = game.history ?? [];
  //   if (history.length <= prevHistoryLength.current) return;

  //   // API returns history newest first (created_at desc)
  //   // Check the new entries (recent additions) to find card draws
  //   const newEntries = history.slice(0, history.length - prevHistoryLength.current);
  //   prevHistoryLength.current = history.length;

  //   // Search through new entries to find a card draw
  //   for (const newEntry of newEntries) {
  //     const comment =
  //       typeof newEntry === "string"
  //         ? newEntry
  //         : (newEntry as { comment?: string } | null)?.comment ?? "";
  //     const playerName =
  //       typeof newEntry === "object" && newEntry !== null && "player_name" in newEntry
  //         ? String((newEntry as { player_name?: string }).player_name ?? "Player")
  //         : "";

  //     // Match patterns like "drew chance: ..." or "PlayerName drew Chance: ..."
  //     // The backend format is: "drew chance: [card instruction]" or "drew community chest: [card instruction]"
  //     // Capture everything after the colon - the card instruction text
  //     const cardRegex = /drew\s+(chance|community\s+chest):\s*(.+)/i;
  //     const match = comment.match(cardRegex);
      
  //     if (!match || !match[2]) continue; // Not a card entry or no text, check next

  //     const [, typeStr, text] = match;
  //     // Remove any trailing "[Rolled X]" or similar patterns, but keep the card text
  //     const cardText = text.replace(/\s*\[Rolled\s+\d+\].*$/i, "").trim();
  //     if (!cardText) continue; // Empty card text, skip
      
  //     const type = typeStr.toLowerCase().includes("chance") ? "chance" : "community";
  //     const displayName = playerName.trim() || "Player";

  //     const lowerText = cardText.toLowerCase();
  //     const isGood =
  //       lowerText.includes("collect") ||
  //       lowerText.includes("receive") ||
  //       lowerText.includes("advance") ||
  //       lowerText.includes("get out of jail") ||
  //       lowerText.includes("matures") ||
  //       lowerText.includes("refund") ||
  //       lowerText.includes("prize") ||
  //       lowerText.includes("inherit");

  //     const effectMatch = cardText.match(/([+-]?\$\d+)|go to jail|move to .+|get out of jail free/i);
  //     const effect = effectMatch ? effectMatch[0] : undefined;

  //     setCardData({ type, text: cardText, effect, isGood });
  //     setCardPlayerName(displayName);
  //     setShowCardModal(true);

  //     // Extended timer to account for two-stage animation:
  //     // Stage 1: "drew" message (7 seconds) + Stage 2: card content (8 seconds) = 15 seconds total
  //     const timer = setTimeout(() => setShowCardModal(false), 15000);
  //     return () => clearTimeout(timer);
  //   }
  // }, [game.history]);

  useEffect(() => {
    if (!isAITurn || !buyPrompted || !currentPlayer || !justLandedProperty || buyScore === null) return;

    const timer = setTimeout(async () => {
      const shouldBuy =
        buyScore >= 72 &&
        (currentPlayer.balance ?? 0) > justLandedProperty.price * 1.8;

      if (shouldBuy) {
        showToast(`AI bought ${justLandedProperty.name} (score: ${buyScore}%)`, "success");
        await BUY_PROPERTY(true);
      } else {
        showToast(`AI passed on ${justLandedProperty.name} (score: ${buyScore}%)`, "default");
        setTimeout(END_TURN, 900);
      }
    }, 900);

    return () => clearTimeout(timer);
  }, [isAITurn, buyPrompted, currentPlayer, justLandedProperty, buyScore, BUY_PROPERTY, END_TURN, showToast]);

  useEffect(() => {
    if (actionLock || isRolling || buyPrompted || !roll) return;

    const timer = setTimeout(() => {
      END_TURN();
    }, isAITurn ? 1000 : 1200);

    return () => clearTimeout(timer);
  }, [roll, buyPrompted, isRolling, actionLock, isAITurn, END_TURN]);

  const playersByPosition = useMemo(() => {
    const map = new Map<number, Player[]>();
    players.forEach((p) => {
      const pos = animatedPositions[p.user_id] !== undefined ? animatedPositions[p.user_id] : (p.position ?? 0);
      if (!map.has(pos)) map.set(pos, []);
      map.get(pos)!.push(p);
    });
    return map;
  }, [players, animatedPositions]);

  /** Roll to show in center: local roll when set, or current player's roll from API (so we see AI/human roll). */
  const displayRoll = useMemo((): { die1: number; die2: number; total: number } | null => {
    if (roll) return roll;
    const otherRolled = currentPlayer?.rolled;
    if (otherRolled != null && Number(otherRolled) >= 2 && Number(otherRolled) <= 12) {
      return totalToDice(Number(otherRolled));
    }
    return null;
  }, [roll, currentPlayer?.rolled]);

  const propertyOwner = (id: number) => {
    const gp = game_properties.find((gp) => gp.property_id === id);
    return gp ? players.find((p) => p.address === gp.address)?.username || null : null;
  };

  const developmentStage = (id: number) =>
    game_properties.find((gp) => gp.property_id === id)?.development ?? 0;

  const isPropertyMortgaged = (id: number) =>
    game_properties.find((gp) => gp.property_id === id)?.mortgaged === true;

  const handlePayToLeaveJail = useCallback(async () => {
    if (!me || !game?.id) return;
    try {
      await apiClient.post("/game-players/pay-to-leave-jail", {
        game_id: game.id,
        user_id: me.user_id,
      });
      setJailChoiceRequired(false);
      toast.success("Paid $50. You may now roll.");
      await fetchGameState();
    } catch (err) {
      toast.error(getContractErrorMessage(err, "Pay jail fine failed"));
    }
  }, [me, game?.id, fetchGameState]);

  const handleUseGetOutOfJailFree = useCallback(
    async (cardType: "chance" | "community_chest") => {
      if (!me || !game?.id) return;
      try {
        await apiClient.post("/game-players/use-get-out-of-jail-free", {
          game_id: game.id,
          user_id: me.user_id,
          card_type: cardType,
        });
        setJailChoiceRequired(false);
        toast.success("Used Get Out of Jail Free. You may now roll.");
        await fetchGameState();
      } catch (err) {
        toast.error(getContractErrorMessage(err, "Use card failed"));
      }
    },
    [me, game?.id, fetchGameState]
  );

  const handleStayInJail = useCallback(async () => {
    if (!me || !game?.id) return;
    try {
      await apiClient.post("/game-players/stay-in-jail", { user_id: me.user_id, game_id: game.id });
      setJailChoiceRequired(false);
      await fetchGameState();
      END_TURN();
    } catch (err) {
      toast.error(getContractErrorMessage(err, "Stay in jail failed"));
    }
  }, [me, game?.id, fetchGameState, END_TURN]);

  const hasChanceJailCard = (me?.chance_jail_card ?? 0) >= 1;
  const hasCommunityChestJailCard = (me?.community_chest_jail_card ?? 0) >= 1;

  const handleRollDice = () => ROLL_DICE(false);
  const handleBuyProperty = () => BUY_PROPERTY(false);
  const handleSkipBuy = () => {
    setTurnEndScheduled(true);
    setBuyPrompted(false);
    landedPositionThisTurn.current = null;
    setTimeout(END_TURN, 900);
  };

  const handleDeclareBankruptcy = async () => {
    showToast("Declaring bankruptcy...", "default");

    try {
      if (endGame) await endGame();

      const opponent = players.find(p => p.user_id !== me?.user_id);
      await apiClient.put(`/games/${game.id}`, {
        status: "FINISHED",
        winner_id: opponent?.user_id || null,
      });

      showToast("Game over! You have declared bankruptcy.", "error");
      setShowBankruptcyModal(true);
    } catch (err) {
      toast.error(getContractErrorMessage(err, "Failed to end game"));
    }
  };

  const { handleDevelopment, handleDowngrade, handleMortgage, handleUnmortgage } = usePropertyActions(
    game.id,
    me?.user_id,
    isMyTurn
  );

  const handlePropertyClick = (square: Property) => {
    const gp = game_properties.find(gp => gp.property_id === square.id);
    if (gp?.address === me?.address) {
      setSelectedProperty(square);
    } else {
      showToast("You don't own this property", "error");
    }
  };

    // Toggle function for the sparkle button
  const togglePerksModal = () => {
    setShowPerksModal(prev => !prev);
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 text-white p-4 flex flex-col lg:flex-row gap-4 items-start justify-center relative">
      {/* Trade notification bell - takes user to incoming trades in sidebar */}
      <div className="fixed top-4 right-6 z-40">
        <TradeAlertPill
          incomingCount={myIncomingTrades.length}
          onViewTrades={onViewTrades}
        />
      </div>
      <div className="flex justify-center items-start w-full lg:w-2/3 max-w-[800px] mt-[-1rem]">
        <div className="w-full bg-[#010F10] aspect-square rounded-lg relative shadow-2xl shadow-cyan-500/10">
          <div className="grid grid-cols-11 grid-rows-11 w-full h-full gap-[2px] box-border">
            <CenterArea
              isMyTurn={isMyTurn}
              isAITurn={isAITurn}
              currentPlayer={currentPlayer}
              playerCanRoll={playerCanRoll}
              isRolling={isRolling}
              roll={displayRoll}
              buyPrompted={buyPrompted}
              currentProperty={justLandedProperty || currentProperty}
              currentPlayerBalance={currentPlayer?.balance ?? 0}
              buyScore={buyScore}
              history={game.history ?? []}
              onRollDice={handleRollDice}
              onBuyProperty={handleBuyProperty}
              onSkipBuy={handleSkipBuy}
              onDeclareBankruptcy={handleDeclareBankruptcy}
              isPending={false}
              timerSlot={game?.duration && Number(game.duration) > 0 ? (
                <GameDurationCountdown game={game} onTimeUp={handleGameTimeUp} />
              ) : null}
              gameTimeUp={gameTimeUp}
              inJail={meInJail}
              jailChoiceRequired={jailChoiceRequired}
              canPayToLeaveJail={canPayToLeaveJail}
              hasChanceJailCard={hasChanceJailCard}
              hasCommunityChestJailCard={hasCommunityChestJailCard}
              onPayToLeaveJail={handlePayToLeaveJail}
              onUseGetOutOfJailFree={handleUseGetOutOfJailFree}
              onStayInJail={handleStayInJail}
              turnEndScheduled={turnEndScheduled}
              isUntimed={isUntimed}
              endByNetWorthStatus={endByNetWorthStatus}
              endByNetWorthLoading={endByNetWorthLoading}
              onVoteEndByNetWorth={voteEndByNetWorth}
              me={me}
            />

            {properties.map((square) => {
              const allPlayersHere = playersByPosition.get(square.id) ?? [];
              const playersHere = allPlayersHere;

              return (
                <BoardSquare
                  key={square.id}
                  square={square}
                  playersHere={playersHere}
                  currentPlayerId={currentPlayerId}
                  owner={propertyOwner(square.id)}
                  devLevel={developmentStage(square.id)}
                  mortgaged={isPropertyMortgaged(square.id)}
                  onClick={() => handlePropertyClick(square)}
                />
              );
            })}
          </div>
        </div>
      </div>

         {/* Sparkle Button - Now toggles the modal */}
            <button
              onClick={togglePerksModal}
              className="fixed bottom-20 left-6 z-40 w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 shadow-2xl shadow-cyan-500/50 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
            >
              <Sparkles className="w-8 h-8 text-black" />
            </button>
      
            {/* Perks Overlay: Dark backdrop + Corner Perks Panel */}
            <AnimatePresence>
              {showPerksModal && (
                <>
                  {/* Backdrop - covers entire screen */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowPerksModal(false)}
                    className="fixed inset-0 bg-black/70 z-50"
                  />
      
                  {/* Perks Panel - ONLY in bottom-right corner, small and fixed */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 50 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="fixed bottom-6 left-6 z-50 w-80 max-h-[80vh]"
                  >
                    <div >
                      <div className="p-5 border-b border-cyan-900/50 flex items-center justify-between left-6">
                        <h2 className="text-2xl font-bold flex items-center gap-3">
                          <Sparkles className="w-8 h-8 text-[#00F0FF]" />
                          My Perks
                        </h2>
                        <button
                          onClick={() => setShowPerksModal(false)}
                          className="text-gray-400 hover:text-white p-1"
                        >
                          <X className="w-6 h-6" />
                        </button>
                      </div>
                      
                        <CollectibleInventoryBar
                          game={game}
                          game_properties={game_properties}
                          isMyTurn={isMyTurn}
                          ROLL_DICE={ROLL_DICE}
                          END_TURN={END_TURN}
                          triggerSpecialLanding={triggerLandingLogic}
                          endTurnAfterSpecial={endTurnAfterSpecialMove}
                        />
                      
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

      {/* <CardModal
        isOpen={showCardModal}
        onClose={() => setShowCardModal(false)}
        card={cardData}
        playerName={cardPlayerName}
      /> */}

      <BankruptcyModal
        isOpen={showBankruptcyModal}
        tokensAwarded={0.5}
        onReturnHome={() => window.location.href = "/"}
      />

      <PropertyActionModal
        property={selectedProperty}
        onClose={() => setSelectedProperty(null)}
        onDevelop={handleDevelopment}
        onDowngrade={handleDowngrade}
        onMortgage={handleMortgage}
        onUnmortgage={handleUnmortgage}
      />

      {/* Time's up: Winner / Loser modal — matches mobile AI game-modals */}
      <AnimatePresence>
        {winner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[100] p-4 overflow-y-auto"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/90 via-violet-950/60 to-cyan-950/70" />
            {winner.user_id === me?.user_id ? (
              <motion.div
                initial={{ scale: 0.88, y: 24, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                className="relative w-full max-w-md rounded-[2rem] overflow-hidden border-2 border-cyan-400/50 bg-gradient-to-b from-indigo-900/95 via-violet-900/90 to-slate-950/95 shadow-2xl shadow-cyan-900/30 text-center"
              >
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.18),transparent)]" />
                <div className="relative z-10 p-8 sm:p-10">
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                    className="mb-6 relative"
                  >
                    <Crown className="w-20 h-20 sm:w-24 sm:h-24 mx-auto text-cyan-300 drop-shadow-[0_0_40px_rgba(34,211,238,0.7)]" />
                    <motion.div
                      className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2"
                      animate={{ opacity: [0.4, 0.8, 0.4] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Sparkles className="w-6 h-6 text-cyan-400/80" />
                    </motion.div>
                  </motion.div>
                  <motion.h1
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-4xl sm:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-200 to-cyan-300 mb-2"
                  >
                    YOU WIN
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 }}
                    className="text-lg text-slate-200 mb-2"
                  >
                    You had the highest net worth when time ran out.
                  </motion.p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-cyan-200/90 text-base mb-6"
                  >
                    Well played — you earned this one.
                  </motion.p>
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleClaimAndGoHome}
                    disabled={claimAndLeaveInProgress || endGamePending}
                    className="w-full py-4 px-6 rounded-2xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 text-slate-900 font-bold text-lg shadow-lg shadow-cyan-900/40 border border-cyan-300/40 transition-all disabled:cursor-wait"
                  >
                    {claimAndLeaveInProgress || endGamePending ? "Claiming…" : "Claim & go home"}
                  </motion.button>
                  <p className="text-sm text-slate-500 mt-6">Thanks for playing Tycoon!</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ scale: 0.88, y: 24, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                className="relative w-full max-w-md rounded-[2rem] overflow-hidden border-2 border-slate-500/50 bg-gradient-to-b from-slate-900/95 via-slate-800/90 to-black/95 shadow-2xl shadow-slate-900/50 text-center"
              >
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.12),transparent)]" />
                <div className="relative z-10 p-8 sm:p-10">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    className="mb-5"
                  >
                    <Trophy className="w-16 h-16 sm:w-20 sm:h-20 mx-auto text-amber-400/90" />
                  </motion.div>
                  <motion.h1
                    initial={{ y: 8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.25 }}
                    className="text-2xl sm:text-3xl font-bold text-slate-200 mb-1"
                  >
                    Time&apos;s up
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 }}
                    className="text-xl font-semibold text-white mb-4"
                  >
                    {winner.username} <span className="text-amber-400">wins</span>
                  </motion.p>
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="mb-6 flex flex-col items-center gap-3"
                  >
                    <HeartHandshake className="w-12 h-12 text-cyan-400/80" />
                    <p className="text-slate-300">You still get a consolation prize.</p>
                  </motion.div>
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleClaimAndGoHome}
                    disabled={claimAndLeaveInProgress || endGamePending}
                    className="w-full py-4 px-6 rounded-2xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 text-white font-bold text-lg shadow-lg shadow-cyan-900/40 border border-cyan-400/30 transition-all disabled:cursor-wait"
                  >
                    {claimAndLeaveInProgress || endGamePending ? "Claiming…" : "Claim & go home"}
                  </motion.button>
                  <p className="text-sm text-slate-500 mt-6">Thanks for playing Tycoon!</p>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {showExitPrompt && winner && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4"
        >
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-3xl max-w-md w-full text-center border border-cyan-500/30 shadow-2xl"
          >
            <h2 className="text-2xl font-bold text-white mb-5">One last step</h2>
            <p className="text-lg text-gray-300 mb-6">
              {winner.user_id === me?.user_id
                ? "End the game on the blockchain to claim your rewards."
                : "End the game on the blockchain to collect your consolation prize."}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleFinalizeTimeUpAndLeave}
                disabled={endGamePending}
                className="px-8 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition disabled:opacity-50"
              >
                {endGamePending ? "Processing..." : "Yes, end game"}
              </button>
              <button
                onClick={() => setShowExitPrompt(false)}
                className="px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition"
              >
                Back
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      <Toaster
        position="top-center"
        reverseOrder={false}
        gutter={12}
        containerClassName="z-50"
        toastOptions={{
          duration: 3200,
          style: {
            background: "rgba(15, 23, 42, 0.95)",
            color: "#fff",
            border: "1px solid rgba(34, 211, 238, 0.3)",
            borderRadius: "12px",
            padding: "12px 20px",
            fontSize: "16px",
            fontWeight: "600",
            boxShadow: "0 10px 30px rgba(0, 255, 255, 0.15)",
            backdropFilter: "blur(10px)",
          },
          success: { icon: "✔", style: { borderColor: "#10b981" } },
          error: { icon: "✖", style: { borderColor: "#ef4444" } },
        }}
      />
    </div>
  );
};

export default AiBoard;