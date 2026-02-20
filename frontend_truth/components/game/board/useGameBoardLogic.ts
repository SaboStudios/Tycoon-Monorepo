"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import {
  Game,
  GameProperty,
  Property,
  Player,
  PROPERTY_ACTION,
} from "@/types/game";
import { ApiResponse } from "@/types/api";
import { apiClient } from "@/lib/api";
import { socketService } from "@/lib/socket";
import { useExitGame, useGetGameByCode } from "@/context/ContractProvider";
import {
  BOARD_SQUARES,
  ROLL_ANIMATION_MS,
  MOVE_ANIMATION_MS_PER_SQUARE,
  JAIL_POSITION,
  getDiceValues,
  MONOPOLY_STATS,
} from "../constants";
import { usePropertyActions } from "@/hooks/usePropertyActions";
import { getContractErrorMessage } from "@/lib/utils/contractErrors";

/** Convert dice total (2–12) to die1+die2 for display when we only have the total (e.g. opponent's roll from API). */
function totalToDice(total: number): { die1: number; die2: number; total: number } {
  const t = Math.max(2, Math.min(12, Math.round(total)));
  if (t === 2) return { die1: 1, die2: 1, total: 2 };
  if (t === 12) return { die1: 6, die2: 6, total: 12 };
  const die1 = Math.min(6, Math.max(1, Math.floor(t / 2)));
  return { die1, die2: t - die1, total: t };
}

export interface UseGameBoardLogicProps {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  me: Player | null;
  /** Called after successfully removing an inactive player so parent can refetch game */
  onGameUpdated?: () => void;
  /** Optional: for voted-out detection by address (e.g. mobile when user id may lag) */
  myAddress?: string;
}

export function useGameBoardLogic({
  game,
  properties,
  game_properties,
  me,
  onGameUpdated,
  myAddress,
}: UseGameBoardLogicProps) {
  const [players, setPlayers] = useState<Player[]>(game?.players ?? []);
  const [roll, setRoll] = useState<{ die1: number; die2: number; total: number } | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [pendingRoll, setPendingRoll] = useState(0);
  const [actionLock, setActionLock] = useState<"ROLL" | "END" | null>(null);
  const [buyPrompted, setBuyPrompted] = useState(false);
  const [animatedPositions, setAnimatedPositions] = useState<Record<number, number>>({});
  const [hasMovementFinished, setHasMovementFinished] = useState(false);
  const [showPerksModal, setShowPerksModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardData, setCardData] = useState<{
    type: "chance" | "community";
    text: string;
    effect?: string;
    isGood: boolean;
  } | null>(null);
  const [cardPlayerName, setCardPlayerName] = useState("");
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showBankruptcyModal, setShowBankruptcyModal] = useState(false);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [turnTimeLeft, setTurnTimeLeft] = useState<number | null>(null);
  const [voteStatuses, setVoteStatuses] = useState<Record<number, { vote_count: number; required_votes: number; voters: Array<{ user_id: number; username: string }> }>>({});
  const [votingLoading, setVotingLoading] = useState<Record<number, boolean>>({});
  /** Vote-to-end-by-networth (untimed games): vote_count, required_votes, voters */
  const [endByNetWorthStatus, setEndByNetWorthStatus] = useState<{ vote_count: number; required_votes: number; voters: Array<{ user_id: number; username: string }> } | null>(null);
  const [endByNetWorthLoading, setEndByNetWorthLoading] = useState(false);
  /** When set, show popup "X timed out. Vote them out?" (set after record-timeout succeeds) */
  const [timeoutPopupPlayer, setTimeoutPopupPlayer] = useState<Player | null>(null);
  /** When true, current user was voted out — show "Go home" / "Continue watching" */
  const [showVotedOutModal, setShowVotedOutModal] = useState(false);
  /** When true, player rolled from jail without doubles — show Pay $50 / Use card / Stay */
  const [jailChoiceRequired, setJailChoiceRequired] = useState(false);
  /** When true, hide Roll Dice (turn end scheduled after buy/skip) */
  const [turnEndScheduled, setTurnEndScheduled] = useState(false);

  const landedPositionThisTurn = useRef<number | null>(null);
  const [landedPosition, setLandedPosition] = useState<number | null>(null);
  const turnEndInProgress = useRef(false);
  const lastToastMessage = useRef<string | null>(null);
  const recordTimeoutCalledForTurn = useRef<number | null>(null);
  const timeLeftFrozenAtRollRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const prevHistoryLength = useRef(game?.history?.length ?? 0);

  const INACTIVITY_SECONDS = 30;
  const TURN_TOTAL_SECONDS = 120;

  const { data: contractGame } = useGetGameByCode(game.code);
  const onChainGameId = contractGame?.id;
  const exitHook = useExitGame(onChainGameId ?? BigInt(0));

  const currentPlayerId = game.next_player_id ?? -1;
  const currentPlayer = players.find((p) => p.user_id === currentPlayerId);
  const isMyTurn = me?.user_id === currentPlayerId;
  const isNext = !!me && game.next_player_id === me.user_id;
  const playerCanRoll = Boolean(isMyTurn && currentPlayer && (currentPlayer.balance ?? 0) > 0);

  const currentProperty = useMemo(() => {
    return currentPlayer?.position
      ? properties.find((p) => p.id === currentPlayer.position) ?? null
      : null;
  }, [currentPlayer?.position, properties]);

  const justLandedProperty = useMemo(() => {
    if (landedPosition == null) return null;
    return properties.find((p) => p.id === landedPosition) ?? null;
  }, [landedPosition, properties]);

  // Only the purple trade notification (toast.custom) is shown; all other toasts suppressed
  // Show toasts only for successful property purchases and the purple trade notification (toast.custom)
  const showToast = useCallback((message: string, type: "success" | "error" | "default" = "default") => {
    if (type === "success" && (message.startsWith("You bought") || (message.includes("bought") && message.endsWith("!")))) {
      toast.success(message);
    }
  }, []);

  useEffect(() => {
    if (game?.players) setPlayers(game.players);
  }, [game?.players]);

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

  useEffect(() => {
    setRoll(null);
    setBuyPrompted(false);
    setIsRolling(false);
    setPendingRoll(0);
    landedPositionThisTurn.current = null;
    setLandedPosition(null);
    turnEndInProgress.current = false;
    lastToastMessage.current = null;
    setAnimatedPositions({});
    setHasMovementFinished(false);
    setTurnTimeLeft(null);
    timeLeftFrozenAtRollRef.current = null;
    lastActivityRef.current = Date.now();
  }, [currentPlayerId]);

  // When any player lands on Chance/CC, show transparent card popup for everyone
  // COMMENTED OUT: Card modal disabled
  // useEffect(() => {
  //   const history = game?.history ?? [];
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
  //     if (!cardText) continue; // Empty card text, skip
      
  //     const type = typeStr.toLowerCase().includes("chance") ? "chance" : "community";

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
  //     setCardPlayerName(playerName.trim() || "Player");
  //     setShowCardModal(true);

  //     const timer = setTimeout(() => setShowCardModal(false), 15000);
  //     return () => clearTimeout(timer);
  //   }
  // }, [game?.history]);

  const touchActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const lockAction = useCallback((type: "ROLL" | "END") => {
    if (actionLock) return false;
    setActionLock(type);
    return true;
  }, [actionLock]);

  const unlockAction = useCallback(() => setActionLock(null), []);

  const END_TURN = useCallback(async (timedOut?: boolean) => {
    if (currentPlayerId === -1 || turnEndInProgress.current || !lockAction("END")) return;
    setJailChoiceRequired(false);
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

  const fetchUpdatedGame = useCallback(async () => {
    try {
      const res = await apiClient.get<ApiResponse>(`/games/code/${game.code}`);
      if (res?.data?.success && res.data.data?.players) {
        const updatedPlayers = res.data.data.players;
        setPlayers(updatedPlayers);
        // If we're in the game but no longer in the players list, we were voted out (e.g. missed socket)
        const wasRemovedByUserId = me?.user_id && !updatedPlayers.some((p: Player) => p.user_id === me.user_id);
        const wasRemovedByAddress = myAddress && !updatedPlayers.some((p: Player) => String(p.address || "").toLowerCase() === myAddress.toLowerCase());
        if (wasRemovedByUserId || wasRemovedByAddress) {
          setShowVotedOutModal(true);
        }
      }
    } catch (err) {
      console.error("Sync failed:", err);
    }
  }, [game.code, me?.user_id, myAddress]);

  useEffect(() => {
    if (!isMyTurn) setTurnEndScheduled(false);
  }, [isMyTurn]);

  // Timer for current player — show to ALL players. Stops counting when they roll (2 min total, wrap up trades in remaining time).
  const isTwoPlayer = players.length === 2;
  const hasRolled = isMyTurn && roll != null && hasMovementFinished;
  useEffect(() => {
    if (!currentPlayer?.turn_start) {
      setTurnTimeLeft(null);
      return;
    }
    const raw = currentPlayer.turn_start;
    const turnStartSec = typeof raw === "number" ? raw : parseInt(String(raw), 10);
    if (Number.isNaN(turnStartSec)) {
      setTurnTimeLeft(null);
      return;
    }
    const tick = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const elapsed = nowSec - turnStartSec;
      const liveRemaining = Math.max(0, TURN_TOTAL_SECONDS - elapsed);

      // Freeze displayed time when player rolls — stops counting immediately
      if (hasRolled) {
        if (timeLeftFrozenAtRollRef.current === null) {
          timeLeftFrozenAtRollRef.current = liveRemaining;
        }
        setTurnTimeLeft(timeLeftFrozenAtRollRef.current);
      } else {
        setTurnTimeLeft(liveRemaining);
      }

      if (liveRemaining <= 0) {
        if (isTwoPlayer) {
          END_TURN(true);
        } else {
          if (
            me?.user_id &&
            recordTimeoutCalledForTurn.current !== turnStartSec
          ) {
            recordTimeoutCalledForTurn.current = turnStartSec;
            const timedOutPlayer = currentPlayer;
            apiClient
              .post<ApiResponse>("/game-players/record-timeout", {
                game_id: game.id,
                user_id: me.user_id,
                target_user_id: currentPlayer.user_id,
              })
              .then(() => {
                fetchUpdatedGame();
                if (timedOutPlayer) setTimeoutPopupPlayer(timedOutPlayer);
              })
              .catch((err) => console.warn("record-timeout failed:", err));
          }
        }
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [currentPlayer?.turn_start, currentPlayer?.user_id, isTwoPlayer, me?.user_id, game.id, END_TURN, fetchUpdatedGame, hasRolled]);

  // 30s inactivity after roll → auto-end turn
  useEffect(() => {
    if (!isMyTurn || !hasRolled || actionLock || isRolling) return;
    const check = () => {
      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs >= INACTIVITY_SECONDS * 1000) END_TURN();
    };
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, [isMyTurn, hasRolled, actionLock, isRolling, END_TURN]);

  const BUY_PROPERTY = useCallback(async () => {
    touchActivity();
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
      await apiClient.post<ApiResponse>("/game-properties/buy", {
        user_id: currentPlayer.user_id,
        game_id: game.id,
        property_id: justLandedProperty.id,
      });
      showToast(`You bought ${justLandedProperty.name}!`, "success");
      setTurnEndScheduled(true);
      setBuyPrompted(false);
      landedPositionThisTurn.current = null;
      setLandedPosition(null);
      if (!(roll?.die1 === roll?.die2)) {
        setTimeout(END_TURN, 800);
      }
    } catch (err) {
      const message = getContractErrorMessage(err, "Purchase failed");
      toast.error(message);
    }
  }, [currentPlayer, justLandedProperty, actionLock, END_TURN, showToast, game.id, roll, touchActivity]);

  const triggerLandingLogic = useCallback((newPosition: number, isSpecial = false) => {
    if (landedPositionThisTurn.current !== null) return;
    landedPositionThisTurn.current = newPosition;
    setLandedPosition(newPosition);
    setRoll({ die1: 0, die2: 0, total: 0 });
    setHasMovementFinished(true);
    setTimeout(() => {
      const square = properties.find((p) => p.id === newPosition);
      if (square?.price != null) {
        const isOwned = game_properties.some((gp) => gp.property_id === newPosition);
        if (!isOwned && ["land", "railway", "utility"].includes(PROPERTY_ACTION(newPosition) || "")) {
          setBuyPrompted(true);
          // Landed position visible on board — no toast
        }
      }
    }, 100);
  }, [properties, game_properties]);

  const endTurnAfterSpecialMove = useCallback(() => {
    setTurnEndScheduled(true);
    setBuyPrompted(false);
    landedPositionThisTurn.current = null;
    setLandedPosition(null);
    setTimeout(END_TURN, 800);
  }, [END_TURN]);

  // Show buy prompt when player lands on a buyable property (mirrors mobile board logic)
  useEffect(() => {
    if (!roll || landedPositionThisTurn.current === null || !hasMovementFinished) {
      setBuyPrompted(false);
      return;
    }
    const pos = landedPositionThisTurn.current;
    const square = properties.find((p) => p.id === pos);
    if (!square || square.price == null) {
      setBuyPrompted(false);
      return;
    }
    const isOwned = game_properties.some((gp) => gp.property_id === pos);
    const action = PROPERTY_ACTION(pos);
    const isBuyableType = !!action && ["land", "railway", "utility"].includes(action);
    const canBuy = !isOwned && isBuyableType;
    setBuyPrompted(canBuy);
  }, [roll, hasMovementFinished, properties, game_properties]);

  const ROLL_DICE = useCallback(async () => {
    if (isRolling || actionLock || !lockAction("ROLL")) return;
    touchActivity();
    const playerId = me!.user_id;
    const player = players.find((p) => p.user_id === playerId);
    if (!player) {
      unlockAction();
      return;
    }
    const isInJail = Boolean(player.in_jail) && Number(player.position) === JAIL_POSITION;

    if (isInJail) {
      setIsRolling(true);
      const value = getDiceValues();
      if (!value || value.die1 !== value.die2) {
        setTimeout(async () => {
          try {
            const res = await apiClient.post<{ data?: { success?: boolean; still_in_jail?: boolean; rolled?: number } }>(
              "/game-players/change-position",
              {
                user_id: playerId,
                game_id: game.id,
                position: player.position,
                rolled: value?.total ?? 0,
                is_double: false,
              }
            );
            const data = res?.data as { success?: boolean; still_in_jail?: boolean; rolled?: number } | undefined;
            await fetchUpdatedGame();
            if (data?.still_in_jail) {
              const total = data.rolled ?? value?.total ?? 0;
              setRoll(totalToDice(total));
              setJailChoiceRequired(true);
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
      setRoll(value);
      const totalMove = value.total;
      const newPos = (player.position + totalMove) % BOARD_SQUARES;
      setTimeout(async () => {
        try {
          await apiClient.post("/game-players/change-position", {
            user_id: playerId,
            game_id: game.id,
            position: newPos,
            rolled: totalMove,
            is_double: true,
          });
          landedPositionThisTurn.current = newPos;
          setLandedPosition(newPos);
          await fetchUpdatedGame();
          // Escaped jail — state visible
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
    setTimeout(async () => {
      const value = getDiceValues();
      if (!value) {
        // Doubles visible — no toast
        setIsRolling(false);
        unlockAction();
        return;
      }
      setRoll(value);
      const currentPos = player.position ?? 0;
      const totalMove = value.total + pendingRoll;
      const newPos = (currentPos + totalMove) % BOARD_SQUARES;

      if (totalMove > 0) {
        const movePath: number[] = [];
        for (let i = 1; i <= totalMove; i++) {
          movePath.push((currentPos + i) % BOARD_SQUARES);
        }
        for (let i = 0; i < movePath.length; i++) {
          await new Promise((r) => setTimeout(r, MOVE_ANIMATION_MS_PER_SQUARE));
          setAnimatedPositions((prev) => ({ ...prev, [playerId]: movePath[i] }));
        }
      }
      landedPositionThisTurn.current = newPos;
      setLandedPosition(newPos);
      setHasMovementFinished(true);

      try {
        await apiClient.post("/game-players/change-position", {
          user_id: playerId,
          game_id: game.id,
          position: newPos,
          rolled: value.total + pendingRoll,
          is_double: value.die1 === value.die2,
        });
        setPendingRoll(0);
        await fetchUpdatedGame();
        // Roll visible on board — no toast
      } catch (err) {
        console.error("Move failed:", err);
        toast.error(getContractErrorMessage(err, "Move failed"));
        END_TURN();
      } finally {
        setIsRolling(false);
        unlockAction();
      }
    }, ROLL_ANIMATION_MS);
  }, [isRolling, actionLock, lockAction, unlockAction, me, players, pendingRoll, game.id, fetchUpdatedGame, showToast, END_TURN, touchActivity]);

  const payToLeaveJail = useCallback(async () => {
    if (!me?.user_id || !game?.id || actionLock) return;
    if (!lockAction("ROLL")) return;
    touchActivity();
    try {
      await apiClient.post("/game-players/pay-to-leave-jail", { user_id: me.user_id, game_id: game.id });
      setJailChoiceRequired(false);
      await fetchUpdatedGame();
      showToast("Paid $50. You may now roll.", "success");
    } catch (err) {
      toast.error(getContractErrorMessage(err, "Pay to leave jail failed"));
    } finally {
      unlockAction();
    }
  }, [me?.user_id, game?.id, actionLock, lockAction, unlockAction, fetchUpdatedGame, showToast, touchActivity]);

  const useGetOutOfJailFree = useCallback(
    async (cardType: "chance" | "community_chest") => {
      if (!me?.user_id || !game?.id || actionLock) return;
      if (!lockAction("ROLL")) return;
      touchActivity();
      try {
        await apiClient.post("/game-players/use-get-out-of-jail-free", {
          user_id: me.user_id,
          game_id: game.id,
          card_type: cardType,
        });
        setJailChoiceRequired(false);
        await fetchUpdatedGame();
        showToast("Used Get Out of Jail Free. You may now roll.", "success");
      } catch (err) {
        toast.error(getContractErrorMessage(err, "Use card failed"));
      } finally {
        unlockAction();
      }
    },
    [me?.user_id, game?.id, actionLock, lockAction, unlockAction, fetchUpdatedGame, showToast, touchActivity]
  );

  const stayInJail = useCallback(async () => {
    if (!me?.user_id || !game?.id || actionLock) return;
    if (!lockAction("END")) return;
    touchActivity();
    try {
      await apiClient.post("/game-players/stay-in-jail", { user_id: me.user_id, game_id: game.id });
      setJailChoiceRequired(false);
      await fetchUpdatedGame();
      END_TURN();
    } catch (err) {
      toast.error(getContractErrorMessage(err, "Stay in jail failed"));
      unlockAction();
    }
  }, [me?.user_id, game?.id, actionLock, lockAction, unlockAction, fetchUpdatedGame, END_TURN, touchActivity]);

  useEffect(() => {
    if (!roll || !hasMovementFinished || buyPrompted || actionLock || isRolling) return;
    const timer = setTimeout(END_TURN, 1500);
    return () => clearTimeout(timer);
  }, [roll, hasMovementFinished, buyPrompted, actionLock, isRolling, END_TURN]);

  const playersByPosition = useMemo(() => {
    const map = new Map<number, Player[]>();
    players.forEach((p) => {
      const pos = animatedPositions[p.user_id] !== undefined ? animatedPositions[p.user_id] : (p.position ?? 0);
      if (!map.has(pos)) map.set(pos, []);
      map.get(pos)!.push(p);
    });
    return map;
  }, [players, animatedPositions]);

  /** Roll to show in center: our roll when we rolled, or current player's roll when it's their turn (so everyone sees opponents' rolls). */
  const displayRoll = useMemo((): { die1: number; die2: number; total: number } | null => {
    if (isMyTurn) return roll;
    const otherRolled = currentPlayer?.rolled;
    if (otherRolled != null && Number(otherRolled) >= 2 && Number(otherRolled) <= 12) {
      return totalToDice(Number(otherRolled));
    }
    return null;
  }, [isMyTurn, roll, currentPlayer?.rolled]);

  const propertyOwner = useCallback((id: number) => {
    const gp = game_properties.find((g) => g.property_id === id);
    return gp ? players.find((p) => p.address === gp.address)?.username ?? null : null;
  }, [game_properties, players]);

  const developmentStage = useCallback((id: number) => {
    return game_properties.find((g) => g.property_id === id)?.development ?? 0;
  }, [game_properties]);

  const isPropertyMortgaged = useCallback((id: number) => {
    return game_properties.find((g) => g.property_id === id)?.mortgaged === true;
  }, [game_properties]);

  const handlePropertyClick = useCallback((square: Property) => {
    touchActivity();
    setSelectedProperty(square);
  }, [touchActivity]);

  const handleSkipBuy = useCallback(() => {
    touchActivity();
    setTurnEndScheduled(true);
    setBuyPrompted(false);
    landedPositionThisTurn.current = null;
    setLandedPosition(null);
    setTimeout(END_TURN, 900);
  }, [END_TURN, touchActivity]);

  const handleBankruptcy = useCallback(async () => {
    if (!me || !game?.id || !game?.code) {
      showToast("Cannot declare bankruptcy right now", "error");
      return;
    }
    showToast("Declaring bankruptcy...", "error");
    let creditorPlayerId: number | null = null;
    if (justLandedProperty) {
      const landedGameProp = game_properties.find((gp) => gp.property_id === justLandedProperty.id);
      if (landedGameProp?.address && landedGameProp.address !== "bank") {
        const owner = players.find(
          (p) => p.address?.toLowerCase() === landedGameProp.address?.toLowerCase() && p.user_id !== me.user_id
        );
        if (owner) creditorPlayerId = owner.user_id;
      }
    }
    try {
      // Backend handles on-chain exit when we call POST /game-players/leave — no wallet signature needed
      const myOwnedProperties = game_properties.filter(
        (gp) => gp.address?.toLowerCase() === me.address?.toLowerCase()
      );
      if (myOwnedProperties.length === 0) {
        showToast("You have no properties to transfer.", "default");
      } else if (creditorPlayerId) {
        showToast("Transferring all properties to the player who bankrupted you...", "error");
        let successCount = 0;
        for (const gp of myOwnedProperties) {
          try {
            await apiClient.put(`/game-properties/${gp.id}`, { game_id: game.id, player_id: creditorPlayerId });
            successCount++;
          } catch (err) {
            console.error(`Failed to transfer ${gp.property_id}`, err);
          }
        }
        toast.success(`${successCount}/${myOwnedProperties.length} properties transferred!`);
      } else {
        showToast("Returning all properties to the bank...", "error");
        let successCount = 0;
        for (const gp of myOwnedProperties) {
          try {
            await apiClient.delete(`/game-properties/${gp.id}`, { data: { game_id: game.id } });
            successCount++;
          } catch (err) {
            console.error(`Failed to return ${gp.property_id}`, err);
          }
        }
        toast.success(`${successCount}/${myOwnedProperties.length} properties returned to bank.`);
      }
      await END_TURN();
      await apiClient.post("/game-players/leave", { address: me.address, code: game.code, reason: "bankruptcy" });
      await fetchUpdatedGame();
      showToast("You have declared bankruptcy and left the game.", "error");
      setShowExitPrompt(true);
    } catch (err: unknown) {
      console.error("Bankruptcy process failed:", err);
      const message = getContractErrorMessage(err, "Bankruptcy failed — but you are eliminated.");
      toast.error(message);
      try {
        await END_TURN();
      } catch {
        /* noop */
      }
      setTimeout(() => {
        window.location.href = "/";
      }, 3000);
    } finally {
      setShowBankruptcyModal(false);
      setBuyPrompted(false);
      landedPositionThisTurn.current = null;
      setLandedPosition(null);
    }
  }, [me, game, justLandedProperty, game_properties, players, showToast, fetchUpdatedGame, END_TURN]);

  const { handleDevelopment, handleDowngrade, handleMortgage, handleUnmortgage } = usePropertyActions(
    game.id,
    me?.user_id,
    isNext
  );

  const getCurrentRent = useCallback((prop: Property, gp: GameProperty | undefined): number => {
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

    const groupEntry = Object.entries(MONOPOLY_STATS.colorGroups).find(([_, ids]) =>
      ids.includes(prop.id)
    );

    if (groupEntry) {
      const [groupName] = groupEntry;
      if (groupName !== "railroad" && groupName !== "utility") {
        const groupIds = MONOPOLY_STATS.colorGroups[groupName as keyof typeof MONOPOLY_STATS.colorGroups];
        const ownedInGroup = game_properties.filter(
          g => groupIds.includes(g.property_id) && g.address === gp.address
        ).length;
        if (ownedInGroup === groupIds.length) return (prop.rent_site_only || 0) * 2;
      }
    }

    return prop.rent_site_only || 0;
  }, [game_properties]);

  // Get vote status for a target player
  const fetchVoteStatus = useCallback(
    async (targetUserId: number) => {
      if (!game?.id) return;
      try {
        const res = await apiClient.post<ApiResponse>("/game-players/vote-status", {
          game_id: game.id,
          target_user_id: targetUserId,
        });
        const data = res?.data?.data;
        if (res?.data?.success && data) {
          setVoteStatuses((prev) => ({
            ...prev,
            [targetUserId]: data,
          }));
        }
      } catch (err) {
        console.error("Failed to fetch vote status:", err);
      }
    },
    [game?.id]
  );

  // Vote to remove a player
  const voteToRemove = useCallback(
    async (targetUserId: number) => {
      touchActivity();
      if (!me?.user_id || !game?.id) return;
      setVotingLoading((prev) => ({ ...prev, [targetUserId]: true }));
      try {
        const res = await apiClient.post<ApiResponse>("/game-players/vote-to-remove", {
          game_id: game.id,
          user_id: me.user_id,
          target_user_id: targetUserId,
        });
        if (res?.data?.success) {
          const data = res.data.data;
          setVoteStatuses((prev) => ({
            ...prev,
            [targetUserId]: {
              vote_count: data.vote_count,
              required_votes: data.required_votes,
              voters: [], // Will be updated by fetchVoteStatus
            },
          }));
          if (data.removed) {
            showToast(`${players.find((p) => p.user_id === targetUserId)?.username || "Player"} has been removed`, "success");
            await fetchUpdatedGame();
            onGameUpdated?.();
          } else {
            showToast(`Vote recorded. ${data.vote_count}/${data.required_votes} votes.`, "default");
            await fetchVoteStatus(targetUserId);
          }
        }
      } catch (err: unknown) {
        const msg = getContractErrorMessage(err, "Failed to vote");
        toast.error(msg);
      } finally {
        setVotingLoading((prev) => ({ ...prev, [targetUserId]: false }));
      }
    },
    [game?.id, me?.user_id, players, fetchUpdatedGame, fetchVoteStatus, onGameUpdated, showToast, touchActivity]
  );

  // Legacy removeInactive (kept for backward compatibility, but now uses voting)
  const removeInactive = useCallback(
    async (targetUserId: number) => {
      // Redirect to voting system
      await voteToRemove(targetUserId);
    },
    [voteToRemove]
  );

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
    touchActivity();
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
          showToast("Game ended by net worth — all players voted", "success");
          await fetchUpdatedGame();
          onGameUpdated?.();
        } else {
          showToast(`${data.vote_count}/${data.required_votes} voted to end by net worth`, "default");
        }
      }
    } catch (err: unknown) {
      toast.error(getContractErrorMessage(err, "Failed to vote"));
    } finally {
      setEndByNetWorthLoading(false);
    }
  }, [game?.id, me?.user_id, isUntimed, fetchUpdatedGame, onGameUpdated, showToast, touchActivity]);

  // Fetch end-by-networth status when untimed (votes clear when anyone rolls, so refetch when game/history updates)
  useEffect(() => {
    if (!isUntimed || !game?.id) {
      setEndByNetWorthStatus(null);
      return;
    }
    fetchEndByNetWorthStatus();
  }, [game?.id, isUntimed, fetchEndByNetWorthStatus, game?.history?.length]);

  // Listen for other players voting to end by net worth
  useEffect(() => {
    if (!isUntimed) return;
    const handleEndByNetWorthVote = (data: { vote_count: number; required_votes: number; voters: Array<{ user_id: number; username: string }> }) => {
      setEndByNetWorthStatus({
        vote_count: data.vote_count,
        required_votes: data.required_votes,
        voters: data.voters ?? [],
      });
    };
    socketService.onEndByNetWorthVote(handleEndByNetWorthVote);
    return () => {
      socketService.removeListener("end-by-networth-vote", handleEndByNetWorthVote);
    };
  }, [isUntimed]);

  // Fetch vote statuses for voteable players
  useEffect(() => {
    if (!game?.id || !me?.user_id) return;
    const otherPlayers = players.filter((p) => p.user_id !== me.user_id);
    const voteablePlayers = players.filter((p) => {
      if (p.user_id === me.user_id) return false;
      const strikes = p.consecutive_timeouts ?? 0;
      // With 2 players: need 3+ consecutive timeouts
      // With more players: can vote after any timeout (strikes > 0)
      if (otherPlayers.length === 1) {
        return strikes >= 3;
      }
      return strikes > 0;
    });
    voteablePlayers.forEach((p) => {
      fetchVoteStatus(p.user_id);
    });
  }, [game?.id, me?.user_id, players, fetchVoteStatus]);

  // Listen for vote-cast socket events to update vote statuses in real-time
  useEffect(() => {
    if (!game?.id || !game?.code) return;
    const handleVoteCast = (data: { target_user_id: number; voter_user_id: number; vote_count: number; required_votes: number; removed: boolean }) => {
      if (data.removed) {
        if (data.target_user_id === me?.user_id) setShowVotedOutModal(true);
        fetchUpdatedGame();
        onGameUpdated?.();
      } else {
        // Update vote status for this target
        setVoteStatuses((prev) => ({
          ...prev,
          [data.target_user_id]: {
            vote_count: data.vote_count,
            required_votes: data.required_votes,
            voters: [], // Will be refreshed by fetchVoteStatus
          },
        }));
        // Refresh vote status to get voter list
        fetchVoteStatus(data.target_user_id);
      }
    };
    socketService.onVoteCast(handleVoteCast);
    return () => {
      socketService.removeListener("vote-cast", handleVoteCast);
    };
  }, [game?.id, game?.code, me?.user_id, fetchUpdatedGame, fetchVoteStatus, onGameUpdated]);

  const mePlayer = useMemo(() => (me ? players.find((p) => p.user_id === me.user_id) : null), [me, players]);
  const meInJail = Boolean(isMyTurn && mePlayer?.in_jail && Number(mePlayer?.position) === JAIL_POSITION);
  const canPayToLeaveJail = meInJail && (currentPlayer?.balance ?? 0) >= 50;
  const hasChanceJailCard = (mePlayer?.chance_jail_card ?? 0) >= 1;
  const hasCommunityChestJailCard = (mePlayer?.community_chest_jail_card ?? 0) >= 1;

  return {
    players,
    roll,
    displayRoll,
    isRolling,
    buyPrompted,
    animatedPositions,
    hasMovementFinished,
    showPerksModal,
    setShowPerksModal,
    showCardModal,
    setShowCardModal,
    cardData,
    setCardData,
    cardPlayerName,
    setCardPlayerName,
    selectedProperty,
    setSelectedProperty,
    showBankruptcyModal,
    setShowBankruptcyModal,
    showExitPrompt,
    setShowExitPrompt,
    currentPlayerId,
    currentPlayer,
    isMyTurn,
    playerCanRoll,
    currentProperty,
    justLandedProperty,
    playersByPosition,
    propertyOwner,
    developmentStage,
    isPropertyMortgaged,
    handleRollDice: () => ROLL_DICE(),
    handleBuyProperty: () => BUY_PROPERTY(),
    handleSkipBuy,
    handleBankruptcy,
    handleDevelopment,
    handleDowngrade,
    handleMortgage,
    handleUnmortgage,
    handlePropertyClick,
    getCurrentRent,
    ROLL_DICE,
    END_TURN,
    triggerLandingLogic,
    endTurnAfterSpecialMove,
    exitHook,
    turnTimeLeft,
    removeInactive,
    voteToRemove,
    voteStatuses,
    votingLoading,
    fetchVoteStatus,
    isUntimed,
    endByNetWorthStatus,
    voteEndByNetWorth,
    endByNetWorthLoading,
    turnEndScheduled,
    touchActivity,
    timeoutPopupPlayer,
    dismissTimeoutPopup: () => setTimeoutPopupPlayer(null),
    showVotedOutModal,
    setShowVotedOutModal,
    fetchUpdatedGame,
    showToast,
    jailChoiceRequired,
    meInJail,
    canPayToLeaveJail,
    hasChanceJailCard,
    hasCommunityChestJailCard,
    payToLeaveJail,
    useGetOutOfJailFree,
    stayInJail,
  };
}
