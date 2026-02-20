"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast, Toaster } from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { useEndAIGameAndClaim, useGetGameByCode } from "@/context/ContractProvider";
import { Game, GameProperty, Property, Player, PROPERTY_ACTION } from "@/types/game";
import { useGameTrades } from "@/hooks/useGameTrades";
import { isAIPlayer } from "@/utils/gameUtils";

import {
  BOARD_SQUARES,
  ROLL_ANIMATION_MS,
  MOVE_ANIMATION_MS_PER_SQUARE,
  JAIL_POSITION,
  MIN_SCALE,
  MAX_SCALE,
  BASE_WIDTH_REFERENCE,
  TOKEN_POSITIONS,
  MONOPOLY_STATS,
  getDiceValues,
} from "./constants";

import Board from "./board";
import DiceAnimation from "./dice-animation";
import GameLog from "./game-log";
import GameModals from "./game-modals";
import PlayerStatus from "./player-status";
import TradeAlertPill from "../../TradeAlertPill";
import MyBalanceBar from "./MyBalanceBar";
import BuyPromptModal from "./BuyPromptModal";
import PropertyDetailModal from "./PropertyDetailModal";
import PerksModal from "./PerksModal";
import { Sparkles } from "lucide-react";
import { GameDurationCountdown } from "../../GameDurationCountdown";
import RollResult from "../roll-result";
import { ApiResponse } from "@/types/api";

/** Convert dice total (2–12) to die1+die2 for display when we only have the total (e.g. from API). */
function totalToDice(total: number): { die1: number; die2: number; total: number } {
  const t = Math.max(2, Math.min(12, Math.round(total)));
  if (t === 2) return { die1: 1, die2: 1, total: 2 };
  if (t === 12) return { die1: 6, die2: 6, total: 12 };
  const die1 = Math.min(6, Math.max(1, Math.floor(t / 2)));
  return { die1, die2: t - die1, total: t };
}
import { getContractErrorMessage } from "@/lib/utils/contractErrors";
import { useMobilePropertyActions } from "@/hooks/useMobilePropertyActions";
import {
  useMobileAiLogic,
  useMobileAiBankruptcy,
} from "./useMobileAiLogic";

const MobileGameLayout = ({
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
  const [currentGame, setCurrentGame] = useState<Game>(game);
  const [players, setPlayers] = useState<Player[]>(game?.players ?? []);
  const [currentGameProperties, setCurrentGameProperties] = useState<GameProperty[]>(game_properties);

  // Sync from parent when game is refetched (e.g. after finish-by-time) so winner effect sees FINISHED.
  useEffect(() => {
    setCurrentGame(game);
    if (game?.players?.length) setPlayers(game.players);
  }, [game?.id, game?.status, game?.winner_id, game?.players?.length]);

  const [roll, setRoll] = useState<{ die1: number; die2: number; total: number } | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [pendingRoll, setPendingRoll] = useState(0);
  const [actionLock, setActionLock] = useState<"ROLL" | "END" | null>(null);
  const [buyPrompted, setBuyPrompted] = useState(false);
  const [animatedPositions, setAnimatedPositions] = useState<Record<number, number>>({});
  const [hasMovementFinished, setHasMovementFinished] = useState(false);
  const [strategyRanThisTurn, setStrategyRanThisTurn] = useState(false);

  const [showInsolvencyModal, setShowInsolvencyModal] = useState(false);
  const [insolvencyDebt, setInsolvencyDebt] = useState(0);
  const [isRaisingFunds, setIsRaisingFunds] = useState(false);
  const [showPerksModal, setShowPerksModal] = useState(false);
  const [isSpecialMove, setIsSpecialMove] = useState(false);

  const [winner, setWinner] = useState<Player | null>(null);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [endGameCandidate, setEndGameCandidate] = useState<{
    winner: Player | null;
    position: number;
    balance: bigint;
    validWin?: boolean; // true if winner has >= 20 turns, false otherwise
  }>({ winner: null, position: 0, balance: BigInt(0), validWin: true });

  const [showCardModal, setShowCardModal] = useState(false);
  const [cardData, setCardData] = useState<{
    type: "chance" | "community";
    text: string;
    effect?: string;
    isGood: boolean;
  } | null>(null);
  const [cardPlayerName, setCardPlayerName] = useState("");

  const [showBankruptcyModal, setShowBankruptcyModal] = useState(false);
  const [jailChoiceRequired, setJailChoiceRequired] = useState(false);
  const [gameTimeUp, setGameTimeUp] = useState(false);
  const timeUpHandledRef = useRef(false);
  const [turnEndScheduled, setTurnEndScheduled] = useState(false);
  const [endByNetWorthStatus, setEndByNetWorthStatus] = useState<{ vote_count: number; required_votes: number; voters: Array<{ user_id: number; username: string }> } | null>(null);
  const [endByNetWorthLoading, setEndByNetWorthLoading] = useState(false);
  const [showEndByNetWorthConfirm, setShowEndByNetWorthConfirm] = useState(false);

  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedGameProperty, setSelectedGameProperty] = useState<GameProperty | undefined>(undefined);

  const [boardScale, setBoardScale] = useState(1);
  const [boardTransformOrigin, setBoardTransformOrigin] = useState("50% 50%");
  const [isFollowingMyMove, setIsFollowingMyMove] = useState(false);
  const [defaultScale, setDefaultScale] = useState(1.45);

  const [bellFlash, setBellFlash] = useState(false);
  const prevIncomingTradeCount = useRef(0);
  const tradeToastShownThisTurn = useRef(false);
  const lastTurnForTradeToast = useRef<number | null>(null);

  const {
    tradeRequests = [],
    refreshTrades,
  } = useGameTrades({
    gameId: game?.id,
    myUserId: me?.user_id,
    players: game?.players ?? [],
  });

 const durationMinutes = Number(game.duration ?? 0); // converts string → number, null/undefined → 0
const endTime =
  new Date(game.created_at).getTime() +
  durationMinutes * 60 * 1000;

  const myIncomingTrades = useMemo(() => {
    if (!me) return [];
    return tradeRequests.filter(
      (t) => t.target_player_id === me.user_id && t.status === "pending"
    );
  }, [tradeRequests, me]);

  useEffect(() => {
    const currentCount = myIncomingTrades.length;
    const previousCount = prevIncomingTradeCount.current;

    if (currentCount > previousCount && previousCount >= 0 && !tradeToastShownThisTurn.current) {
      tradeToastShownThisTurn.current = true;
      setBellFlash(true);
      setTimeout(() => setBellFlash(false), 800);
    }

    prevIncomingTradeCount.current = currentCount;
  }, [myIncomingTrades]);



  useEffect(() => {
    const calculateScale = () => {
      const width = window.innerWidth;
      let scale = (width / BASE_WIDTH_REFERENCE) * 1.48;
      scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
      setDefaultScale(scale);
    };

    calculateScale();
    window.addEventListener("resize", calculateScale);
    return () => window.removeEventListener("resize", calculateScale);
  }, []);

  const currentPlayerId = currentGame.next_player_id;
  const currentPlayer = players.find((p) => p.user_id === currentPlayerId);
  const isMyTurn = me?.user_id === currentPlayerId;
  const isAITurn = !!currentPlayer && isAIPlayer(currentPlayer);

  // Reset "shown this turn" when turn changes so we show at most one purple toast per turn
  useEffect(() => {
    if (lastTurnForTradeToast.current !== currentPlayerId) {
      lastTurnForTradeToast.current = currentPlayerId ?? null;
      tradeToastShownThisTurn.current = false;
    }
  }, [currentPlayerId]);

  const landedPositionThisTurn = useRef<number | null>(null);
  const turnEndInProgress = useRef(false);
  const lastToastMessage = useRef<string | null>(null);
  const rolledForPlayerId = useRef<number | null>(null);

  const justLandedProperty = useMemo(() => {
    if (landedPositionThisTurn.current === null) return null;
    return properties.find((p) => p.id === landedPositionThisTurn.current) ?? null;
  }, [landedPositionThisTurn.current, properties]);

  const { data: contractGame } = useGetGameByCode(game.code);
  const onChainGameId = contractGame?.id;

  const {
    write: endGame,
    isPending: endGamePending,
    reset: endGameReset,
  } = useEndAIGameAndClaim(
    onChainGameId ?? BigInt(0),
    endGameCandidate.position,
    BigInt(endGameCandidate.balance),
    // Use validWin: if winner has < 20 turns, pass false to prevent spam, but still show them as winner
    endGameCandidate.winner ? (endGameCandidate.validWin !== false) : false
  );

  const activeToasts = useRef<Set<string>>(new Set());

  // Show toasts only for successful property purchases and the purple trade notification (toast.custom)
  const showToast = useCallback((message: string, type: "success" | "error" | "default" = "default") => {
    if (type === "success" && (message.startsWith("You bought") || message.startsWith("AI bought") || (message.includes("bought") && message.endsWith("!")))) {
      toast.success(message);
    }
  }, []);

  const FETCH_THROTTLE_MS = 2200;
  const lastFetchTimeRef = useRef(0);
  const pendingFetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUpdatedGame = useCallback(async (retryDelay = 2000) => {
    const doFetch = async () => {
      lastFetchTimeRef.current = Date.now();
      try {
        const gameRes = await apiClient.get<ApiResponse<Game>>(`/games/code/${game.code}`);
        if (gameRes?.data?.success && gameRes.data.data) {
          setCurrentGame(gameRes.data.data);
          setPlayers(gameRes.data.data.players);
        }
        const propertiesRes = await apiClient.get<ApiResponse<GameProperty[]>>(`/game-properties/game/${game.id}`);
        if (propertiesRes?.data?.success && propertiesRes.data.data) {
          setCurrentGameProperties(propertiesRes.data.data);
        }
        try {
          await refreshTrades?.();
        } catch {
          // Non-critical
        }
      } catch (err: any) {
        if (err?.response?.status === 429 || err?.message?.toLowerCase().includes("too many")) {
          const msg = err?.response?.data?.message || err?.message || "Too many requests — wait a moment";
          toast(msg, { duration: 2500, icon: "⏳" });
          setTimeout(() => fetchUpdatedGame(retryDelay * 1.5), retryDelay);
          return;
        }
        console.error("Sync failed:", err);
      }
    };

    const now = Date.now();
    const elapsed = now - lastFetchTimeRef.current;
    if (elapsed > 0 && elapsed < FETCH_THROTTLE_MS) {
      const wait = FETCH_THROTTLE_MS - elapsed;
      if (pendingFetchTimeoutRef.current) clearTimeout(pendingFetchTimeoutRef.current);
      pendingFetchTimeoutRef.current = setTimeout(() => {
        pendingFetchTimeoutRef.current = null;
        doFetch();
      }, wait);
      return;
    }

    if (pendingFetchTimeoutRef.current) {
      clearTimeout(pendingFetchTimeoutRef.current);
      pendingFetchTimeoutRef.current = null;
    }
    await doFetch();
  }, [game.code, game.id, refreshTrades]);

  useEffect(() => {
    const interval = setInterval(fetchUpdatedGame, 20000);
    return () => {
      clearInterval(interval);
      if (pendingFetchTimeoutRef.current) clearTimeout(pendingFetchTimeoutRef.current);
    };
  }, [fetchUpdatedGame]);

  const lockAction = useCallback((type: "ROLL" | "END") => {
    if (actionLock) return false;
    setActionLock(type);
    return true;
  }, [actionLock]);

  const unlockAction = useCallback(() => setActionLock(null), []);

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
    setIsRaisingFunds(false);
    setTurnEndScheduled(false);
  }, [currentPlayerId]);

  useEffect(() => {
    if (!isMyTurn) setTurnEndScheduled(false);
  }, [isMyTurn]);

  useEffect(() => {
    if (!isMyTurn || !roll || !hasMovementFinished) {
      setBoardScale(defaultScale);
      setBoardTransformOrigin("50% 50%");
      setIsFollowingMyMove(false);
      return;
    }

    const myPos = animatedPositions[me!.user_id] ?? me?.position ?? 0;
    const coord = TOKEN_POSITIONS[myPos] || { x: 50, y: 50 };

    setBoardScale(defaultScale * 1.8);
    setBoardTransformOrigin(`${coord.x}% ${coord.y}%`);
    setIsFollowingMyMove(true);
  }, [isMyTurn, roll, hasMovementFinished, me, animatedPositions, defaultScale]);

  useEffect(() => {
    if (isAITurn) {
      setBoardScale(defaultScale);
      setBoardTransformOrigin("50% 50%");
    }
  }, [isAITurn, defaultScale]);

  const END_TURN = useCallback(async (timedOut?: boolean) => {
    if (!currentPlayerId || turnEndInProgress.current || !lockAction("END")) return;
    turnEndInProgress.current = true;

    try {
      await apiClient.post("/game-players/end-turn", {
        user_id: currentPlayerId,
        game_id: currentGame.id,
        ...(timedOut === true && { timed_out: true }),
      });
      showToast(timedOut ? "Time's up! Turn ended." : "Turn ended", timedOut ? "default" : "success");
      await fetchUpdatedGame();
    } catch (err) {
      toast.error(getContractErrorMessage(err, "Failed to end turn"));
    } finally {
      unlockAction();
      turnEndInProgress.current = false;
    }
  }, [currentPlayerId, currentGame.id, fetchUpdatedGame, lockAction, unlockAction, showToast]);

  const handleGameTimeUp = useCallback(async () => {
    if (timeUpHandledRef.current || currentGame.status !== "RUNNING") return;
    timeUpHandledRef.current = true;
    setGameTimeUp(true);
    try {
      // Backend finishes the game (assigns winner) before we show the modal.
      const res = await apiClient.post<{
        success?: boolean;
        data?: { winner_id: number; game?: { players?: Player[] }; valid_win?: boolean; winner_turn_count?: number };
      }>(`/games/${currentGame.id}/finish-by-time`);
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
  }, [currentGame.id, currentGame.status, me, players, onFinishGameByTime]);

  const playerCanRoll = Boolean(isMyTurn && currentPlayer && (currentPlayer.balance ?? 0) > 0 && !gameTimeUp);
  // Per-turn roll timer removed: no countdown or auto-end turn.

  const triggerLandingLogic = useCallback((newPosition: number, isSpecial = false) => {
    if (landedPositionThisTurn.current !== null) return;

    landedPositionThisTurn.current = newPosition;
    setIsSpecialMove(isSpecial);
    setHasMovementFinished(true);
  }, []);

  const endTurnAfterSpecialMove = useCallback(() => {
    setTurnEndScheduled(true);
    setBuyPrompted(false);
    landedPositionThisTurn.current = null;
    setIsSpecialMove(false);
    setTimeout(END_TURN, 800);
  }, [END_TURN]);

  const BUY_PROPERTY = useCallback(async () => {
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
        game_id: currentGame.id,
        property_id: justLandedProperty.id,
      });

      showToast(`You bought ${justLandedProperty.name}!`, "success");
      setTurnEndScheduled(true);
      setBuyPrompted(false);
      landedPositionThisTurn.current = null;
      await fetchUpdatedGame();
      setTimeout(END_TURN, 800);
    } catch (err) {
      toast.error(getContractErrorMessage(err, "Purchase failed"));
    }
  }, [currentPlayer, justLandedProperty, actionLock, END_TURN, showToast, currentGame.id, fetchUpdatedGame]);

  const ROLL_DICE = useCallback(async (forAI = false) => {
    if (isRolling || actionLock || !lockAction("ROLL")) return;

    const playerId = forAI ? currentPlayerId! : me!.user_id;
    const player = players.find((p) => p.user_id === playerId);
    if (!player) {
      unlockAction();
      return;
    }

    const isInJail = Boolean(player.in_jail) && Number(player.position) === JAIL_POSITION;

    if (isInJail) {
      landedPositionThisTurn.current = null;
      setIsRolling(true);
      showToast(`${player.username} is in jail — attempting to roll out...`, "default");

      const value = getDiceValues();
      if (!value || value.die1 !== value.die2) {
        setTimeout(async () => {
          try {
            const res = await apiClient.post<{ data?: { still_in_jail?: boolean; rolled?: number } }>(
              "/game-players/change-position",
              {
                user_id: playerId,
                game_id: currentGame.id,
                position: player.position,
                rolled: value?.total ?? 0,
                is_double: false,
              }
            );
            const data = (res?.data ?? res) as { still_in_jail?: boolean; rolled?: number } | undefined;
            await fetchUpdatedGame();
            if (data?.still_in_jail) {
              if (!forAI) {
                setRoll(value);
                setJailChoiceRequired(true);
              } else {
                await apiClient.post("/game-players/stay-in-jail", { user_id: playerId, game_id: currentGame.id });
                await fetchUpdatedGame();
              }
            } else {
              showToast("No doubles — still in jail", "error");
              setTimeout(END_TURN, 1000);
            }
          } catch (err) {
            toast.error(getContractErrorMessage(err, "Jail roll failed"));
            END_TURN();
          } finally {
            setIsRolling(false);
            unlockAction();
          }
        }, 800);
        return;
      }

      // Doubles - escape jail: animate first, then call API and set landing only after success
      setRoll(value);
      const currentPos = player.position ?? 0;
      const totalMove = value.total;
      const newPos = (currentPos + totalMove) % BOARD_SQUARES;

      if (totalMove > 0) {
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

      setTimeout(async () => {
        try {
          await apiClient.post("/game-players/change-position", {
            user_id: playerId,
            game_id: currentGame.id,
            position: newPos,
            rolled: totalMove,
            is_double: true,
          });
          landedPositionThisTurn.current = newPos;
          setHasMovementFinished(true);
          await fetchUpdatedGame();
          showToast(`${player.username} rolled doubles and escaped jail!`, "success");
        } catch (err) {
          toast.error(getContractErrorMessage(err, "Escape failed"));
        } finally {
          setIsRolling(false);
          unlockAction();
        }
      }, 800);
      return;
    }

    setIsRolling(true);
    setRoll(null);
    setHasMovementFinished(false);
    setAnimatedPositions({}); // Clear previous animations

    setTimeout(async () => {
      const value = getDiceValues();
      if (!value) {
        showToast("DOUBLES! Roll again!", "success");
        setIsRolling(false);
        unlockAction();
        return;
      }

      setRoll(value);

      const currentPos = player.position ?? 0;
      const totalMove = value.total + pendingRoll;
      let newPos = (currentPos + totalMove) % BOARD_SQUARES;

      // Animate movement for BOTH human and AI
      if (totalMove > 0) {
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

      setHasMovementFinished(true);

      try {
        await apiClient.post("/game-players/change-position", {
          user_id: playerId,
          game_id: currentGame.id,
          position: newPos,
          rolled: value.total + pendingRoll,
          is_double: value.die1 === value.die2,
        });

        setPendingRoll(0);
        landedPositionThisTurn.current = newPos;
        await fetchUpdatedGame();

        showToast(
          `${player.username} rolled ${value.die1} + ${value.die2} = ${value.total}!`,
          "success"
        );

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
    isRolling,
    actionLock,
    lockAction,
    unlockAction,
    currentPlayerId,
    me,
    players,
    pendingRoll,
    currentGame.id,
    fetchUpdatedGame,
    showToast,
    END_TURN
  ]);

  const isUntimed = !currentGame?.duration || Number(currentGame.duration) === 0;

  const fetchEndByNetWorthStatus = useCallback(async () => {
    if (!currentGame?.id || !isUntimed) return;
    try {
      const res = await apiClient.post<ApiResponse>("/game-players/end-by-networth-status", { game_id: currentGame.id });
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
  }, [currentGame?.id, isUntimed]);

  const voteEndByNetWorth = useCallback(async () => {
    if (!me?.user_id || !currentGame?.id || !isUntimed) return;
    setEndByNetWorthLoading(true);
    try {
      const res = await apiClient.post<ApiResponse>("/game-players/vote-end-by-networth", {
        game_id: currentGame.id,
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
          await fetchUpdatedGame();
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
  }, [currentGame?.id, me?.user_id, isUntimed, fetchUpdatedGame, onFinishGameByTime]);

  useEffect(() => {
    if (!isUntimed || !currentGame?.id) {
      setEndByNetWorthStatus(null);
      return;
    }
    fetchEndByNetWorthStatus();
  }, [currentGame?.id, isUntimed, fetchEndByNetWorthStatus, currentGame?.history?.length]);

  // When any player lands on Chance/CC, show card popup for everyone
  // COMMENTED OUT: Card modal disabled
  // const prevHistoryLength = useRef(currentGame?.history?.length ?? 0);
  // useEffect(() => {
  //   const history = currentGame?.history ?? [];
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
  //         : (newEntry as { comment?: string })?.comment ?? "";
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
  //     if (!cardText) {
  //       console.warn("Card modal: Empty card text extracted from comment:", comment);
  //       continue; // Empty card text, skip
  //     }
      
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

  //     console.log("Card modal: Setting card data:", { type, text: cardText, effect, isGood, playerName: displayName });
  //     setCardData({ type, text: cardText, effect, isGood });
  //     setCardPlayerName(displayName);
  //     setShowCardModal(true);

  //     // Extended timer to account for two-stage animation:
  //     // Stage 1: "drew" message (7 seconds) + Stage 2: card content (8 seconds) = 15 seconds total
  //     const timer = setTimeout(() => setShowCardModal(false), 15000);
  //     return () => clearTimeout(timer);
  //   }
  // }, [currentGame?.history]);

  useMobileAiLogic({
    game,
    properties,
    game_properties,
    me,
    currentGame,
    currentGameProperties,
    players,
    isAITurn,
    currentPlayer,
    strategyRanThisTurn,
    setStrategyRanThisTurn,
    justLandedProperty,
    isRolling,
    roll,
    actionLock,
    hasMovementFinished,
    fetchUpdatedGame,
    showToast,
    ROLL_DICE,
    END_TURN,
    landedPositionRef: landedPositionThisTurn,
  });

  useMobileAiBankruptcy({
    game,
    currentGame,
    currentGameProperties,
    players,
    isAITurn,
    currentPlayer,
    fetchUpdatedGame,
    setIsRaisingFunds,
    properties,
  });

  useEffect(() => {
    if (!me) return;

    if (me.balance < 0) {
      // Player is bankrupt — show bankruptcy button instead of roll
    }
  }, [me?.balance]);

  // Only show winner when the backend has marked the game FINISHED (not when we merely have 1 player at start — e.g. AI joins failed).
  useEffect(() => {
    if (!currentGame || currentGame.status !== "FINISHED" || currentGame.winner_id == null) return;

    const winnerPlayer = players.find((p) => p.user_id === currentGame.winner_id) ?? (me?.user_id === currentGame.winner_id ? me : null);
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
  }, [currentGame?.status, currentGame?.winner_id, players, me]);

  useEffect(() => {
    if (actionLock || isRolling || buyPrompted || !roll || isRaisingFunds || showInsolvencyModal) return;
    const timer = setTimeout(END_TURN, 2000);
    return () => clearTimeout(timer);
  }, [actionLock, isRolling, buyPrompted, roll, isRaisingFunds, showInsolvencyModal, END_TURN]);

  /** Roll to show: local roll when set, or current player's roll from API (so we see AI roll). */
  const displayRoll = useMemo((): { die1: number; die2: number; total: number } | null => {
    if (roll) return roll;
    const otherRolled = currentPlayer?.rolled;
    if (otherRolled != null && Number(otherRolled) >= 2 && Number(otherRolled) <= 12) {
      return totalToDice(Number(otherRolled));
    }
    return null;
  }, [roll, currentPlayer?.rolled]);

  const getCurrentRent = (prop: Property, gp: GameProperty | undefined): number => {
    if (!gp || !gp.address) return prop.rent_site_only || 0;
    if (gp.mortgaged) return 0;
    if (gp.development === 5) return prop.rent_hotel || 0;
    if (gp.development && gp.development > 0) {
      switch (gp.development) {
        case 1: return prop.rent_one_house || 0;
        case 2: return prop.rent_two_houses || 0;
        case 3: return prop.rent_three_houses || 0;
        case 4: return prop.rent_four_houses || 0;
        default: return prop.rent_site_only || 0;
      }
    }

    const groupEntry = Object.entries(MONOPOLY_STATS.colorGroups).find(([_, ids]) => ids.includes(prop.id));
    if (groupEntry) {
      const [groupName] = groupEntry;
      if (groupName !== "railroad" && groupName !== "utility") {
        const groupIds = MONOPOLY_STATS.colorGroups[groupName as keyof typeof MONOPOLY_STATS.colorGroups];
        const ownedInGroup = currentGameProperties.filter(g => groupIds.includes(g.property_id) && g.address === gp.address).length;
        if (ownedInGroup === groupIds.length) return (prop.rent_site_only || 0) * 2;
      }
    }

    return prop.rent_site_only || 0;
  };

  const handlePropertyClick = (propertyId: number) => {
    const prop = properties.find(p => p.id === propertyId);
    const gp = currentGameProperties.find(g => g.property_id === propertyId);
    if (prop) {
      setSelectedProperty(prop);
      setSelectedGameProperty(gp);
    }
  };

  const { handleBuild, handleSellBuilding, handleMortgageToggle, handleSellToBank } = useMobilePropertyActions(
    currentGame.id,
    me?.user_id,
    isMyTurn,
    fetchUpdatedGame,
    showToast
  );

  const declareBankruptcy = async () => {
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

  // Buy prompt logic
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

    const isOwned = currentGameProperties.some(gp => gp.property_id === pos);
    const action = PROPERTY_ACTION(pos);
    const isBuyableType = !!action && ["land", "railway", "utility"].includes(action);

    const canBuy = !isOwned && isBuyableType;

    setBuyPrompted(canBuy);

    if (canBuy && (currentPlayer?.balance ?? 0) < square.price!) {
      showToast(`Not enough money to buy ${square.name}`, "error");
    }
  }, [
    roll,
    landedPositionThisTurn.current,
    hasMovementFinished,
    properties,
    currentGameProperties,
    currentPlayer,
    showToast,
  ]);

  return (
    <div className="w-full min-h-screen bg-black text-white flex flex-col items-center justify-start relative overflow-hidden">

      {/* Player Status + Trade notification bell */}
      <div className="w-full max-w-2xl mx-auto px-4 mt-4 flex items-center justify-between gap-3 flex-wrap">
        <PlayerStatus currentPlayer={currentPlayer} isAITurn={isAITurn} buyPrompted={buyPrompted} />
        <TradeAlertPill
          incomingCount={myIncomingTrades.length}
          onViewTrades={onViewTrades}
          newTradePulse={bellFlash}
        />
      </div>

      {/* Board */}
      <div className="flex-1 w-full flex items-center justify-center overflow-hidden mt-4">
        <motion.div
          animate={{ scale: boardScale }}
          style={{ transformOrigin: boardTransformOrigin }}
          transition={{ type: "spring", stiffness: 120, damping: 30 }}
          className="origin-center"
        >
          <Board
            properties={properties}
            players={players}
            currentGameProperties={currentGameProperties}
            animatedPositions={animatedPositions}
            currentPlayerId={currentPlayerId}
            onPropertyClick={handlePropertyClick}
            centerContent={
              <div className="flex flex-col items-center justify-center gap-3 text-center min-h-[80px] px-4 py-3 z-30 relative w-full">
                {/* Roll result — show for current player (me or AI) so everyone sees what was rolled */}
                {displayRoll && !isRolling && (
                  <RollResult roll={displayRoll} compact />
                )}
                {/* Username is playing — on top, above time */}
                {isAITurn && !gameTimeUp && (
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-base font-bold text-cyan-400">
                      {currentPlayer?.username ?? "AI"} is playing…
                    </span>
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-cyan-400/50 border-t-cyan-400" />
                  </div>
                )}
                {currentGame?.duration && Number(currentGame.duration) > 0 && (
                  <GameDurationCountdown game={currentGame} compact onTimeUp={handleGameTimeUp} />
                )}
                {gameTimeUp && (
                  <div className="font-mono font-bold rounded-xl px-6 py-3 bg-amber-500/20 border-2 border-amber-400/60 text-amber-300 text-lg">
                    Time&apos;s Up!
                  </div>
                )}
                {/* Untimed: vote to end game by net worth — moved to top-left corner $ button */}
                {!gameTimeUp && isMyTurn && !turnEndScheduled && !isRolling && !isRaisingFunds && !showInsolvencyModal && (
                  (currentPlayer?.balance ?? 0) < 0 ? (
                    <button
                      onClick={declareBankruptcy}
                      className="py-2 px-6 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-800 text-white font-bold text-sm rounded-full shadow-md border border-white/20"
                    >
                      Declare Bankruptcy
                    </button>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      {jailChoiceRequired ? (
                        <>
                          <p className="text-cyan-200 text-xs font-medium">No doubles. Pay $50, use a card, or stay.</p>
                          <div className="flex flex-wrap justify-center gap-2">
                            {(me?.balance ?? 0) >= 50 && (
                              <button
                                onClick={async () => {
                                  try {
                                    await apiClient.post("/game-players/pay-to-leave-jail", { game_id: currentGame.id, user_id: me!.user_id });
                                    setJailChoiceRequired(false);
                                    toast.success("Paid $50. You may now roll.");
                                    await fetchUpdatedGame();
                                  } catch (err) {
                                    toast.error(getContractErrorMessage(err, "Pay jail fine failed"));
                                  }
                                }}
                                className="py-2 px-4 rounded-lg text-sm font-medium bg-amber-600/80 text-white border border-amber-500"
                              >
                                Pay $50
                              </button>
                            )}
                            {(me?.chance_jail_card ?? 0) >= 1 && (
                              <button
                                onClick={async () => {
                                  try {
                                    await apiClient.post("/game-players/use-get-out-of-jail-free", { game_id: currentGame.id, user_id: me!.user_id, card_type: "chance" });
                                    setJailChoiceRequired(false);
                                    toast.success("Used Chance card. You may now roll.");
                                    await fetchUpdatedGame();
                                  } catch (err) {
                                    toast.error(getContractErrorMessage(err, "Use card failed"));
                                  }
                                }}
                                className="py-2 px-4 rounded-lg text-sm font-medium bg-orange-600/80 text-white border border-orange-500"
                              >
                                Chance Card
                              </button>
                            )}
                            {(me?.community_chest_jail_card ?? 0) >= 1 && (
                              <button
                                onClick={async () => {
                                  try {
                                    await apiClient.post("/game-players/use-get-out-of-jail-free", { game_id: currentGame.id, user_id: me!.user_id, card_type: "community_chest" });
                                    setJailChoiceRequired(false);
                                    toast.success("Used CC card. You may now roll.");
                                    await fetchUpdatedGame();
                                  } catch (err) {
                                    toast.error(getContractErrorMessage(err, "Use card failed"));
                                  }
                                }}
                                className="py-2 px-4 rounded-lg text-sm font-medium bg-blue-600/80 text-white border border-blue-500"
                              >
                                CC Card
                              </button>
                            )}
                            <button
                              onClick={async () => {
                                try {
                                  await apiClient.post("/game-players/stay-in-jail", { user_id: me!.user_id, game_id: currentGame.id });
                                  setJailChoiceRequired(false);
                                  await fetchUpdatedGame();
                                  END_TURN();
                                } catch (err) {
                                  toast.error(getContractErrorMessage(err, "Stay in jail failed"));
                                }
                              }}
                              className="py-2 px-4 rounded-lg text-sm font-medium bg-gray-600 text-white border border-gray-500"
                            >
                              Stay
                            </button>
                          </div>
                        </>
                      ) : me && Number(me.position) === JAIL_POSITION && Boolean(me.in_jail) ? (
                        <div className="flex flex-wrap justify-center gap-2">
                          {(me.balance ?? 0) >= 50 && (
                            <button
                              onClick={async () => {
                                try {
                                  await apiClient.post("/game-players/pay-to-leave-jail", { game_id: currentGame.id, user_id: me.user_id });
                                  toast.success("Paid $50. You may now roll.");
                                  await fetchUpdatedGame();
                                } catch (err) {
                                  toast.error(getContractErrorMessage(err, "Pay jail fine failed"));
                                }
                              }}
                              className="py-2 px-4 rounded-lg text-sm font-medium bg-amber-600/80 text-white border border-amber-500"
                            >
                              Pay $50
                            </button>
                          )}
                          {(me.chance_jail_card ?? 0) >= 1 && (
                            <button
                              onClick={async () => {
                                try {
                                  await apiClient.post("/game-players/use-get-out-of-jail-free", { game_id: currentGame.id, user_id: me.user_id, card_type: "chance" });
                                  toast.success("Used Chance card. You may now roll.");
                                  await fetchUpdatedGame();
                                } catch (err) {
                                  toast.error(getContractErrorMessage(err, "Use card failed"));
                                }
                              }}
                              className="py-2 px-4 rounded-lg text-sm font-medium bg-orange-600/80 text-white border border-orange-500"
                            >
                              Chance Card
                            </button>
                          )}
                          {(me.community_chest_jail_card ?? 0) >= 1 && (
                            <button
                              onClick={async () => {
                                try {
                                  await apiClient.post("/game-players/use-get-out-of-jail-free", { game_id: currentGame.id, user_id: me.user_id, card_type: "community_chest" });
                                  toast.success("Used CC card. You may now roll.");
                                  await fetchUpdatedGame();
                                } catch (err) {
                                  toast.error(getContractErrorMessage(err, "Use card failed"));
                                }
                              }}
                              className="py-2 px-4 rounded-lg text-sm font-medium bg-blue-600/80 text-white border border-blue-500"
                            >
                              CC Card
                            </button>
                          )}
                          <button
                            onClick={() => ROLL_DICE(false)}
                            className="py-2.5 px-6 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-bold text-sm rounded-full border border-cyan-300/30"
                          >
                            Roll Dice
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => ROLL_DICE(false)}
                          className="py-2.5 px-8 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-bold text-sm rounded-full shadow-lg border border-cyan-300/30"
                        >
                          Roll Dice
                        </button>
                      )}
                    </div>
                  )
                )}
              </div>
            }
          />
        </motion.div>
      </div>

      <DiceAnimation
        isRolling={isRolling && !(currentPlayer?.in_jail && currentPlayer.position === JAIL_POSITION)}
        roll={displayRoll ?? roll}
      />

      {/* Balance bar above action log — extra pb so log is fully visible above bottom nav */}
      <div className="w-full max-w-2xl mx-auto px-4 mt-6 mb-4">
        <MyBalanceBar me={me} bottomBar />
      </div>
      <div className="w-full max-w-2xl mx-auto px-4 pb-40">
        <GameLog history={currentGame.history} />
      </div>
      <BuyPromptModal
        visible={!!(isMyTurn && buyPrompted && justLandedProperty)}
        property={justLandedProperty ?? null}
        onBuy={BUY_PROPERTY}
        onSkip={() => {
          showToast("Skipped purchase", "default");
          setTurnEndScheduled(true);
          setBuyPrompted(false);
          landedPositionThisTurn.current = null;
          setTimeout(END_TURN, 800);
        }}
      />

      <PropertyDetailModal
        property={selectedProperty}
        gameProperty={selectedGameProperty}
        players={players}
        me={me}
        isMyTurn={isMyTurn}
        getCurrentRent={getCurrentRent}
        onClose={() => setSelectedProperty(null)}
        onBuild={handleBuild}
        onSellBuilding={handleSellBuilding}
        onMortgageToggle={handleMortgageToggle}
        onSellToBank={handleSellToBank}
      />

      <button
        onClick={() => setShowPerksModal(true)}
        className="fixed bottom-20 right-6 z-40 w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 shadow-2xl shadow-cyan-500/50 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
      >
        <Sparkles className="w-8 h-8 text-black" />
      </button>

      <PerksModal
        open={showPerksModal}
        onClose={() => setShowPerksModal(false)}
        game={game}
        game_properties={game_properties}
        isMyTurn={isMyTurn}
        onRollDice={ROLL_DICE}
        onEndTurn={END_TURN}
        onTriggerSpecialLanding={triggerLandingLogic}
        onEndTurnAfterSpecial={endTurnAfterSpecialMove}
      />

      {/* End game by net worth — corner button (top-left) */}
      {isUntimed && endByNetWorthStatus != null && !showEndByNetWorthConfirm && (
        <button
          onClick={() => {
            if (endByNetWorthStatus.voters?.some((v) => v.user_id === me?.user_id)) return;
            if (!endByNetWorthLoading) setShowEndByNetWorthConfirm(true);
          }}
          disabled={endByNetWorthLoading || (endByNetWorthStatus.voters?.some((v) => v.user_id === me?.user_id) ?? false)}
          className="fixed top-4 left-4 z-50 flex items-center justify-center w-9 h-9 rounded-full bg-red-600/90 border border-red-400/60 text-white hover:bg-red-500 hover:border-red-300 transition-colors disabled:opacity-50 disabled:pointer-events-none"
          title={endByNetWorthStatus.voters?.some((v) => v.user_id === me?.user_id) ? `Voted ${endByNetWorthStatus.vote_count}/${endByNetWorthStatus.required_votes}` : `End game by net worth · ${endByNetWorthStatus.vote_count}/${endByNetWorthStatus.required_votes}`}
          aria-label="Vote to end game by net worth"
        >
          <span className="text-lg font-bold leading-none">×</span>
        </button>
      )}

      {/* End game by net worth — confirm modal (with X to close) */}
      <AnimatePresence>
        {showEndByNetWorthConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowEndByNetWorthConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-gradient-to-b from-slate-800 to-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-900/30 p-6 max-w-sm w-full"
            >
              <button
                type="button"
                onClick={() => setShowEndByNetWorthConfirm(false)}
                className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-cyan-300 hover:text-cyan-100 hover:bg-cyan-500/20 transition-colors"
                aria-label="Close"
              >
                <span className="text-xl leading-none">×</span>
              </button>
              <p className="text-lg font-semibold text-cyan-100 mb-1 pr-8">End game by net worth?</p>
              <p className="text-sm text-cyan-200/80 mb-6">The game will end and the player with the highest net worth will win.</p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowEndByNetWorthConfirm(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-cyan-200 hover:text-cyan-100 border border-cyan-500/40 hover:bg-cyan-500/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    voteEndByNetWorth();
                    setShowEndByNetWorthConfirm(false);
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-cyan-600/90 text-white hover:bg-cyan-500 border border-cyan-400/50 transition-colors"
                >
                  Yes, vote to end
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <GameModals
        winner={winner}
        showExitPrompt={showExitPrompt}
        setShowExitPrompt={setShowExitPrompt}
        showInsolvencyModal={showInsolvencyModal}
        insolvencyDebt={insolvencyDebt}
        isRaisingFunds={isRaisingFunds}
        showBankruptcyModal={showBankruptcyModal}
        showCardModal={showCardModal}
        cardData={cardData}
        cardPlayerName={cardPlayerName}
        setShowCardModal={setShowCardModal}
        me={me}
        players={players}
        currentGame={currentGame}
        isGuest={isGuest}
        isPending={endGamePending}
        endGame={endGame}
        reset={endGameReset}
        onFinishGameByTime={onFinishGameByTime}
        setShowInsolvencyModal={setShowInsolvencyModal}
        setIsRaisingFunds={setIsRaisingFunds}
        setShowBankruptcyModal={setShowBankruptcyModal}
        fetchUpdatedGame={fetchUpdatedGame}
        showToast={showToast}
      />

      <Toaster
        position="top-center"
        reverseOrder={false}
        gutter={8}
        containerClassName="z-50"
        toastOptions={{
          duration: 2000,
          style: {
            background: "#010F10",
            color: "#e0f7fa",
            border: "1px solid rgba(34, 211, 238, 0.25)",
            borderRadius: "6px",
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: "500",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          },
          success: {
            icon: "✓",
            duration: 2000,
            style: {
              borderColor: "rgba(34, 211, 238, 0.7)",
              background: "rgba(6, 78, 99, 0.35)",
              boxShadow: "0 4px 16px rgba(0, 240, 255, 0.2)",
              color: "#a5f3fc",
            },
          },
          error: { icon: "!", duration: 2500 },
          loading: { duration: Infinity },
        }}
      />
    </div>
  );
};

export default MobileGameLayout;