"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast, Toaster } from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { Game, GameProperty, Property, Player } from "@/types/game";
import { useGameTrades } from "@/hooks/useGameTrades";
import {
  JAIL_POSITION,
  MIN_SCALE,
  MAX_SCALE,
  BASE_WIDTH_REFERENCE,
  TOKEN_POSITIONS,
  MONOPOLY_STATS,
  BUILD_PRIORITY,
} from "../../constants";
import Board from "./board";
import DiceAnimation from "./dice-animation";
import GameLog from "./game-log";
import GameModals from "./game-modals";
import TradeAlertPill from "../../TradeAlertPill";
import PlayerStatus from "./player-status";
import BoardPropertyDetailModal from "./BoardPropertyDetailModal";
import BoardPerksModal from "./BoardPerksModal";
import MyBalanceBar from "../../ai-board/mobile/MyBalanceBar";
import BuyPromptModal from "../../ai-board/mobile/BuyPromptModal";
import { Sparkles } from "lucide-react";
import CollectibleInventoryBar from "@/components/collectibles/collectibles-invetory-mobile";
import { GameDurationCountdown } from "../../GameDurationCountdown";
import { ApiResponse } from "@/types/api";
import { getContractErrorMessage } from "@/lib/utils/contractErrors";
import { BankruptcyModal } from "../../modals/bankruptcy";
import { CardModal } from "../../modals/cards";
import { useGameBoardLogic } from "../useGameBoardLogic";
import RollResult from "../roll-result";

const MobileGameLayout = ({
  game,
  properties,
  game_properties,
  me,
  myAddress,
  onGameUpdated,
  onFinishByTime,
  onViewTrades,
}: {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  me: Player | null;
  myAddress?: string;
  onGameUpdated?: () => void;
  onFinishByTime?: () => void | Promise<void>;
  onViewTrades?: () => void;
}) => {
  const logic = useGameBoardLogic({
    game,
    properties,
    game_properties,
    me,
    onGameUpdated,
    myAddress,
  });

  const {
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
    cardPlayerName,
    selectedProperty,
    setSelectedProperty,
    showBankruptcyModal,
    setShowBankruptcyModal,
    showExitPrompt,
    setShowExitPrompt,
    turnTimeLeft,
    voteStatuses,
    votingLoading,
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
    handleRollDice,
    handleBuyProperty,
    handleSkipBuy,
    handleBankruptcy,
    handleDevelopment,
    handleDowngrade,
    handleMortgage,
    handleUnmortgage,
    getCurrentRent,
    ROLL_DICE,
    END_TURN,
    triggerLandingLogic,
    endTurnAfterSpecialMove,
    touchActivity,
    timeoutPopupPlayer,
    dismissTimeoutPopup,
    showVotedOutModal,
    setShowVotedOutModal,
    fetchUpdatedGame,
    showToast,
    voteToRemove,
    fetchVoteStatus,
    exitHook,
    isUntimed,
    endByNetWorthStatus,
    voteEndByNetWorth,
    endByNetWorthLoading,
    turnEndScheduled,
    jailChoiceRequired,
    meInJail,
    canPayToLeaveJail,
    hasChanceJailCard,
    hasCommunityChestJailCard,
    payToLeaveJail,
    useGetOutOfJailFree,
    stayInJail,
  } = logic;

  const selectedGameProperty = useMemo(
    () => (selectedProperty ? game_properties.find((gp) => gp.property_id === selectedProperty.id) : undefined),
    [selectedProperty, game_properties]
  );

  const [boardScale, setBoardScale] = useState(1);
  const [boardTransformOrigin, setBoardTransformOrigin] = useState("50% 50%");
  const [isFollowingMyMove, setIsFollowingMyMove] = useState(false);
  const [defaultScale, setDefaultScale] = useState(1.45);
  const [bellFlash, setBellFlash] = useState(false);
  const [showInsolvencyModal, setShowInsolvencyModal] = useState(false);
  const [insolvencyDebt, setInsolvencyDebt] = useState(0);
  const [isRaisingFunds, setIsRaisingFunds] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [showVictoryModal, setShowVictoryModal] = useState(false);
  const [showEndByNetWorthConfirm, setShowEndByNetWorthConfirm] = useState(false);
  const [gameTimeUp, setGameTimeUp] = useState(false);
  const [endGameCandidate, setEndGameCandidate] = useState<{ winner: Player | null; position: number; balance: bigint }>({
    winner: null,
    position: 0,
    balance: BigInt(0),
  });

  const prevIncomingTradeCount = useRef(0);
  const tradeToastShownThisTurn = useRef(false);
  const lastTurnForTradeToast = useRef<number | null>(null);
  const timeUpHandledRef = useRef(false);
  const { tradeRequests = [], refreshTrades } = useGameTrades({
    gameId: game?.id,
    myUserId: me?.user_id,
    players: game?.players ?? [],
  });

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

  // Reset "shown this turn" when turn changes so we show at most one purple toast per turn
  useEffect(() => {
    if (lastTurnForTradeToast.current !== currentPlayerId) {
      lastTurnForTradeToast.current = currentPlayerId ?? null;
      tradeToastShownThisTurn.current = false;
    }
  }, [currentPlayerId]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isRolling) {
        fetchUpdatedGame();
        refreshTrades?.();
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [fetchUpdatedGame, isRolling, refreshTrades]);

  // Keep board at scale 1 so full board always fits on screen (no zoom-in that cuts off half)
  useEffect(() => {
    setBoardScale(1);
    setBoardTransformOrigin("50% 50%");
  }, []);

  const getPlayerOwnedProperties = useCallback((playerAddress: string | undefined) => {
    if (!playerAddress) return [];
    return game_properties
      .filter(gp => gp.address?.toLowerCase() === playerAddress.toLowerCase())
      .map(gp => ({
        gp,
        prop: properties.find(p => p.id === gp.property_id)!,
      }))
      .filter(item => !!item.prop);
  }, [game_properties, properties]);

  const getCompleteMonopolies = useCallback((playerAddress: string | undefined) => {
    if (!playerAddress) return [];
    const owned = getPlayerOwnedProperties(playerAddress);
    const monopolies: string[] = [];

    Object.entries(MONOPOLY_STATS.colorGroups).forEach(([groupName, ids]) => {
      if (groupName === "railroad" || groupName === "utility") return;
      const ownedInGroup = owned.filter(o => ids.includes(o.prop.id));
      if (ownedInGroup.length === ids.length && ownedInGroup.every(o => !o.gp.mortgaged)) {
        monopolies.push(groupName);
      }
    });

    return monopolies.sort((a, b) => BUILD_PRIORITY.indexOf(a) - BUILD_PRIORITY.indexOf(b));
  }, [getPlayerOwnedProperties]);

  const handlePropertyTransfer = async (propertyId: number, newPlayerId: number) => {
    try {
      const res = await apiClient.put<ApiResponse>(`/game-properties/${propertyId}`, {
        game_id: game.id,
        player_id: newPlayerId,
      });
      return res.data?.success ?? false;
    } catch (err) {
      console.error("Transfer failed", err);
      return false;
    }
  };

  const handleDeleteGameProperty = async (id: number) => {
    try {
      const res = await apiClient.delete<ApiResponse>(`/game-properties/${id}`, {
        data: { game_id: game.id },
      });
      return res.data?.success ?? false;
    } catch (err) {
      console.error("Delete failed", err);
      return false;
    }
  };

  const getGamePlayerId = useCallback((walletAddress: string | undefined): number | null => {
    if (!walletAddress) return null;
    const ownedProp = game_properties.find(gp => gp.address?.toLowerCase() === walletAddress.toLowerCase());
    return ownedProp?.player_id ?? null;
  }, [game_properties]);

  const handleFinalizeAndLeave = async () => {
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
    } catch (err: any) {
      toast.error(
        getContractErrorMessage(err, "Something went wrong — try again later"),
        { id: toastId, duration: 8000 }
      );
    } finally {
      exitHook?.reset?.();
    }
  };

  const handleGameTimeUp = useCallback(async () => {
    if (timeUpHandledRef.current || game?.status !== "RUNNING") return;
    timeUpHandledRef.current = true;
    setGameTimeUp(true);
    try {
      await apiClient.post(`/games/${game.id}/finish-by-time`);
      await onFinishByTime?.();
    } catch (e: any) {
      console.error("Finish by time failed:", e);
      timeUpHandledRef.current = false;
      setGameTimeUp(false);
      const msg = e?.response?.data?.error || e?.response?.data?.message || e?.message || "Could not end game. Please try again.";
      toast.error(msg);
    }
  }, [game?.id, game?.status, onFinishByTime]);

  useEffect(() => {
    if (!game || game.status !== "FINISHED" || !me) return;

    setGameTimeUp(true);

    let theWinner: Player | null = null;

    if (game.winner_id != null) {
      theWinner = game.players.find((p) => p.user_id === game.winner_id) ?? null;
    }
    if (!theWinner) {
      const activePlayers = game.players.filter((player) => {
        if ((player.balance ?? 0) > 0) return true;
        return game_properties.some(
          (gp) => gp.address?.toLowerCase() === player.address?.toLowerCase() &&
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
  }, [game?.players, game?.winner_id, game_properties, game?.status, me, winner]);

  const onPropertyClick = useCallback((propertyId: number) => {
    touchActivity();
    const prop = properties.find(p => p.id === propertyId);
    if (prop) setSelectedProperty(prop);
  }, [properties, touchActivity]);

  const onDevelopOrDowngrade = useCallback(() => {
    touchActivity();
    if (selectedProperty) {
      handleDevelopment(selectedProperty.id);
      setSelectedProperty(null);
    }
  }, [selectedProperty, handleDevelopment, touchActivity]);

  const onMortgageToggle = useCallback(() => {
    touchActivity();
    if (selectedProperty && selectedGameProperty != null) {
      if (selectedGameProperty.mortgaged) {
        handleUnmortgage(selectedProperty.id);
      } else {
        handleMortgage(selectedProperty.id);
      }
      setSelectedProperty(null);
    }
  }, [selectedProperty, selectedGameProperty, handleMortgage, handleUnmortgage, touchActivity]);

  const handleSellProperty = async () => {
    if (!selectedGameProperty || !me || !isMyTurn) {
      showToast("Not your turn or invalid property", "error");
      return;
    }

    if ((selectedGameProperty.development ?? 0) > 0) {
      showToast("Cannot sell property with buildings!", "error");
      return;
    }

    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/sell", {
        game_id: game.id,
        user_id: me.user_id,
        property_id: selectedGameProperty.property_id,
      });

      if (res.data?.success) {
        showToast("Property sold back to bank!", "success");
        await fetchUpdatedGame();
        setSelectedProperty(null);
      } else {
        showToast(res.data?.message || "Sell failed", "error");
      }
    } catch (err: any) {
      showToast(err?.response?.data?.message || "Failed to sell property", "error");
    }
  };

  const computedTokenPositions = useMemo(() => {
    const playerPositions: Record<number, { x: number; y: number }> = {};

    players.forEach((p) => {
      const pos = animatedPositions[p.user_id] ?? p.position ?? 0;
      const playersHere = players.filter(
        p2 => (animatedPositions[p2.user_id] ?? p2.position) === pos
      );

      const sorted = [...playersHere].sort((a, b) => {
        if (a.user_id === me?.user_id) return 1;
        if (b.user_id === me?.user_id) return -1;
        return 0;
      });

      const index = sorted.findIndex(s => s.user_id === p.user_id);
      const base = TOKEN_POSITIONS[pos];

      if (playersHere.length > 1) {
        const isBottom = pos >= 0 && pos <= 9;
        const isLeft = pos >= 10 && pos <= 19;
        const isTop = pos >= 20 && pos <= 29;
        const isRight = pos >= 30 && pos <= 39;

        const offset = index * 3 - (playersHere.length - 1) * 1.5;

        if (isBottom || isTop) {
          playerPositions[p.user_id] = { x: base.x + offset, y: base.y };
        } else if (isLeft || isRight) {
          playerPositions[p.user_id] = { x: base.x, y: base.y + offset };
        } else {
          playerPositions[p.user_id] = base;
        }
      } else {
        playerPositions[p.user_id] = { x: 50, y: 50 };
      }
    });

    return playerPositions;
  }, [players, animatedPositions, me]);

  const hasNegativeBalance = (me?.balance ?? 0) <= 0;
  const isSoloPlayer = players.length === 1 && players[0].user_id === me?.user_id;

  const voteablePlayersList = useMemo(() => {
    const otherPlayers = players.filter((p) => p.user_id !== me?.user_id);
    return players
      .filter((p) => {
        if (p.user_id === me?.user_id) return false;
        const strikes = p.consecutive_timeouts ?? 0;
        if (otherPlayers.length === 1) return strikes >= 3;
        const isCurrentPlayer = p.user_id === currentPlayerId;
        const timeElapsed = turnTimeLeft != null && turnTimeLeft <= 0;
        return strikes > 0 || (isCurrentPlayer && timeElapsed);
      })
      .filter((p) => p.user_id !== me?.user_id);
  }, [players, me?.user_id, currentPlayerId, turnTimeLeft]);

  const canVoteOutTimeoutPlayer =
    timeoutPopupPlayer &&
    timeoutPopupPlayer.user_id !== me?.user_id &&
    voteablePlayersList.some((p) => p.user_id === timeoutPopupPlayer.user_id);

  return (
    <div className="w-full min-h-screen bg-[#010F10] text-white flex flex-col items-center justify-start relative overflow-x-hidden overflow-y-auto">
      {/* Timeout popup: "X timed out. Vote them out?" */}
      <AnimatePresence>
        {timeoutPopupPlayer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => dismissTimeoutPopup()}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-800 border border-cyan-500/50 rounded-xl p-6 max-w-sm w-full shadow-2xl"
            >
              <p className="text-lg font-semibold text-cyan-100 mb-1">
                {timeoutPopupPlayer.username} timed out
              </p>
              <p className="text-sm text-slate-400 mb-4">
                {canVoteOutTimeoutPlayer
                  ? "Do you want to vote them out?"
                  : "You can vote them out after 3 timeouts (2-player game)."}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => dismissTimeoutPopup()}
                  className="px-4 py-2 rounded-lg bg-slate-600 text-slate-200 hover:bg-slate-500 transition"
                >
                  Dismiss
                </button>
                {canVoteOutTimeoutPlayer && (
                  <button
                    onClick={() => {
                      voteToRemove(timeoutPopupPlayer.user_id);
                      dismissTimeoutPopup();
                    }}
                    disabled={votingLoading[timeoutPopupPlayer.user_id]}
                    className="px-4 py-2 rounded-lg bg-cyan-700 text-cyan-100 hover:bg-cyan-600 transition disabled:opacity-60"
                  >
                    {votingLoading[timeoutPopupPlayer.user_id] ? "Voting..." : `Vote ${timeoutPopupPlayer.username} Out`}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voted out: modal to inform and choose Continue watching or Leave — high z-index so it appears above nav and other modals on mobile */}
      <AnimatePresence>
        {showVotedOutModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            aria-modal="true"
            role="dialog"
            aria-labelledby="voted-out-title"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-slate-800 border border-cyan-500/50 rounded-xl p-6 max-w-sm w-full shadow-2xl"
            >
              <p id="voted-out-title" className="text-lg font-semibold text-cyan-100 mb-1">You were voted out</p>
              <p className="text-sm text-slate-400 mb-6">You can continue watching the game or leave.</p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowVotedOutModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-600 text-slate-200 hover:bg-slate-500 transition"
                >
                  Continue watching
                </button>
                <button
                  onClick={() => { window.location.href = "/"; }}
                  className="px-4 py-2 rounded-lg bg-cyan-700 text-cyan-100 hover:bg-cyan-600 transition"
                >
                  Leave
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* End game by net worth — corner button (opens confirm modal) */}
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
        {showEndByNetWorthConfirm && voteEndByNetWorth && (
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

      <button
        onClick={fetchUpdatedGame}
        className="fixed top-4 right-4 z-50 bg-blue-500 text-white text-xs px-2 py-1 rounded-full hover:bg-blue-600 transition"
      >
        Refresh
      </button>

      {/* Trade notification bell only at top */}
      <div className="w-full max-w-2xl mx-auto px-4 mt-4 flex items-center justify-end gap-3 flex-wrap flex-shrink-0 min-h-[44px]">
        <TradeAlertPill
          incomingCount={myIncomingTrades.length}
          onViewTrades={onViewTrades}
          newTradePulse={bellFlash}
        />
      </div>

      {/* Spacer to bring board lower (~100px) */}
      <div className="w-full h-[100px] flex-shrink-0" aria-hidden />

      {/* Whose turn — directly above the board */}
      <div className="w-full max-w-2xl mx-auto px-4 flex justify-center flex-shrink-0">
        <PlayerStatus currentPlayer={currentPlayer} isAITurn={!isMyTurn} buyPrompted={buyPrompted} />
      </div>

      {/* Board — same size as AI mobile board (max-w 95vw, max-h 60vh, aspect-square) */}
      <div className="w-full flex items-center justify-center flex-shrink-0 mt-2">
        <motion.div
          animate={{ scale: boardScale }}
          style={{ transformOrigin: boardTransformOrigin }}
          transition={{ type: "spring", stiffness: 120, damping: 30 }}
          className="origin-center"
        >
          <Board
            properties={properties}
            players={players}
            currentGameProperties={game_properties}
            animatedPositions={animatedPositions}
            currentPlayerId={currentPlayerId}
            onPropertyClick={onPropertyClick}
            centerContent={
              <div className="flex flex-col items-center justify-center gap-3 text-center min-h-[80px] px-4 py-3 z-30 relative w-full bg-transparent">
                {/* Roll result — show for current player (me or opponent) so everyone sees what was rolled */}
                {displayRoll && !isRolling && (
                  <RollResult roll={displayRoll} compact />
                )}
                {/* Time's Up — show when game ended by time */}
                {gameTimeUp && (
                  <div className="font-mono font-bold rounded-xl px-6 py-3 bg-amber-500/20 border-2 border-amber-400/60 text-amber-300 text-lg">
                    Time&apos;s Up!
                  </div>
                )}
                {/* Username is playing — on top, above time (hidden when Time's Up) */}
                {!gameTimeUp && !isMyTurn && (
                  <div className="flex flex-col items-center gap-2 bg-transparent">
                    <span className="text-base font-bold text-cyan-400 bg-transparent">
                      {currentPlayer?.username ?? "Player"} is playing…
                    </span>
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-cyan-400/50 border-t-cyan-400 bg-transparent" />
                  </div>
                )}
                {game?.duration && Number(game.duration) > 0 && (
                  <GameDurationCountdown game={game} compact onTimeUp={handleGameTimeUp} />
                )}
                {turnTimeLeft != null && (
                  <div className={`font-mono font-bold rounded-lg px-3 py-1.5 bg-black/90 text-sm ${(turnTimeLeft ?? 120) <= 10 ? "text-red-400 animate-pulse" : "text-cyan-300"}`}>
                    {displayRoll
                      ? isMyTurn
                        ? `Complete in ${Math.floor((turnTimeLeft ?? 120) / 60)}:${((turnTimeLeft ?? 120) % 60).toString().padStart(2, "0")}`
                        : `${currentPlayer?.username ?? "Player"} has ${Math.floor((turnTimeLeft ?? 120) / 60)}:${((turnTimeLeft ?? 120) % 60).toString().padStart(2, "0")} to wrap up`
                      : isMyTurn
                        ? `Roll in ${Math.floor((turnTimeLeft ?? 120) / 60)}:${((turnTimeLeft ?? 120) % 60).toString().padStart(2, "0")}`
                        : `${currentPlayer?.username ?? "Player"} has ${Math.floor((turnTimeLeft ?? 120) / 60)}:${((turnTimeLeft ?? 120) % 60).toString().padStart(2, "0")} to roll`}
                  </div>
                )}
                {/* Vote to remove timed-out players */}
                {voteablePlayersList.length > 0 && (
                  <div className="flex flex-col gap-2 w-full max-w-[260px]">
                    {voteablePlayersList.map((p) => {
                      const status = voteStatuses[p.user_id];
                      const isLoading = votingLoading[p.user_id];
                      const hasVoted = status?.voters?.some((v) => v.user_id === me?.user_id) ?? false;
                      const voteRatio = status ? ` ${status.vote_count}/${status.required_votes}` : "";
                      return (
                        <div key={p.user_id} className="flex justify-center">
                          <button
                            onClick={() => voteToRemove(p.user_id)}
                            disabled={isLoading || hasVoted}
                            className={`text-xs font-medium rounded-lg px-3 py-1.5 border shrink-0 ${
                              hasVoted ? "bg-emerald-900/60 text-emerald-200 border-emerald-500/50" : "bg-cyan-900/70 text-cyan-100 border-cyan-500/50 hover:bg-cyan-800/80"
                            }`}
                          >
                            {hasVoted ? `✓ Voted${voteRatio}` : isLoading ? "..." : `Vote ${p.username} Out${voteRatio}`}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Untimed: vote to end game by net worth — moved to top-left corner $ button */}
                {/* Jail: no doubles — choose Pay $50 / Use card / Stay */}
                {!gameTimeUp && isMyTurn && jailChoiceRequired && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {payToLeaveJail && (
                      <button
                        onClick={payToLeaveJail}
                        disabled={!canPayToLeaveJail}
                        className={`py-2 px-4 rounded-lg text-sm font-medium border ${canPayToLeaveJail ? "bg-amber-600/80 text-white border-amber-500" : "bg-gray-600 text-gray-400 border-gray-500"}`}
                      >
                        Pay $50
                      </button>
                    )}
                    {useGetOutOfJailFree && hasChanceJailCard && (
                      <button onClick={() => useGetOutOfJailFree("chance")} className="py-2 px-4 rounded-lg text-sm font-medium bg-orange-600/80 text-white border border-orange-500">
                        Chance Card
                      </button>
                    )}
                    {useGetOutOfJailFree && hasCommunityChestJailCard && (
                      <button onClick={() => useGetOutOfJailFree("community_chest")} className="py-2 px-4 rounded-lg text-sm font-medium bg-blue-600/80 text-white border border-blue-500">
                        CC Card
                      </button>
                    )}
                    {stayInJail && (
                      <button onClick={stayInJail} className="py-2 px-4 rounded-lg text-sm font-medium bg-gray-600 text-white border border-gray-500">
                        Stay
                      </button>
                    )}
                  </div>
                )}
                {/* Jail: in jail, before rolling — Pay / Use card / Roll */}
                {!gameTimeUp && isMyTurn && !turnEndScheduled && meInJail && !jailChoiceRequired && !roll && !isRolling && !isRaisingFunds && !showInsolvencyModal && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {payToLeaveJail && (
                      <button
                        onClick={payToLeaveJail}
                        disabled={!canPayToLeaveJail}
                        className={`py-2 px-4 rounded-lg text-sm font-medium border ${canPayToLeaveJail ? "bg-amber-600/80 text-white border-amber-500" : "bg-gray-600 text-gray-400 border-gray-500"}`}
                      >
                        Pay $50
                      </button>
                    )}
                    {useGetOutOfJailFree && hasChanceJailCard && (
                      <button onClick={() => useGetOutOfJailFree("chance")} className="py-2 px-4 rounded-lg text-sm font-medium bg-orange-600/80 text-white border border-orange-500">
                        Chance Card
                      </button>
                    )}
                    {useGetOutOfJailFree && hasCommunityChestJailCard && (
                      <button onClick={() => useGetOutOfJailFree("community_chest")} className="py-2 px-4 rounded-lg text-sm font-medium bg-blue-600/80 text-white border border-blue-500">
                        CC Card
                      </button>
                    )}
                    <button
                      onClick={() => ROLL_DICE()}
                      className="py-2.5 px-6 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-bold text-sm rounded-full border border-cyan-300/30"
                    >
                      Roll Dice
                    </button>
                  </div>
                )}
                {!gameTimeUp && isMyTurn && !turnEndScheduled && !isRolling && !isRaisingFunds && !showInsolvencyModal && !meInJail && !jailChoiceRequired && (
                  hasNegativeBalance ? (
                    <button
                      onClick={handleBankruptcy}
                      className="py-2 px-6 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-bold text-sm rounded-full shadow-md border border-white/20"
                    >
                      Declare Bankruptcy
                    </button>
                  ) : (
                    <button
                      onClick={() => ROLL_DICE()}
                      className="py-2.5 px-8 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-bold text-sm rounded-full shadow-lg border border-cyan-300/30"
                    >
                      Roll Dice
                    </button>
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

      {/* Balance bar above action log */}
      <div className="w-full max-w-2xl mx-auto px-4 mt-4 mb-2">
        <MyBalanceBar me={me} bottomBar />
      </div>
      <div className="w-full max-w-2xl mx-auto px-4 pb-24">
        <GameLog history={game.history} />
      </div>

      <BuyPromptModal
        visible={!!(isMyTurn && buyPrompted && justLandedProperty)}
        property={justLandedProperty ?? null}
        onBuy={handleBuyProperty}
        onSkip={handleSkipBuy}
      />

      <BoardPropertyDetailModal
        property={selectedProperty}
        gameProperty={selectedGameProperty}
        players={players}
        me={me}
        isMyTurn={isMyTurn}
        getCurrentRent={getCurrentRent}
        onClose={() => setSelectedProperty(null)}
        onDevelop={onDevelopOrDowngrade}
        onDowngrade={onDevelopOrDowngrade}
        onMortgageToggle={onMortgageToggle}
        onSellProperty={() => { touchActivity(); handleSellProperty(); }}
      />

      <button
        onClick={() => setShowPerksModal(true)}
        className="fixed bottom-20 right-6 z-40 w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 shadow-2xl shadow-cyan-500/50 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
      >
        <Sparkles className="w-8 h-8 text-black" />
      </button>

      <BoardPerksModal
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

      <GameModals
        winner={winner}
        myPosition={(() => {
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
        })()}
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
        currentGame={game}
        isPending={true}
        setShowInsolvencyModal={setShowInsolvencyModal}
        setIsRaisingFunds={setIsRaisingFunds}
        setShowBankruptcyModal={setShowBankruptcyModal}
        fetchUpdatedGame={fetchUpdatedGame}
        showToast={showToast}
      />

      {/* <CardModal
        isOpen={showCardModal}
        onClose={() => setShowCardModal(false)}
        card={cardData}
        playerName={cardPlayerName}
      /> */}

      <BankruptcyModal
        isOpen={showBankruptcyModal}
        tokensAwarded={0.5}
        onConfirmBankruptcy={handleBankruptcy}
        onReturnHome={() => window.location.href = "/"}
      />

      <Toaster
        position="top-center"
        reverseOrder={false}
        gutter={12}
        containerClassName="z-[100]"
        toastOptions={{
          duration: 3000,
          style: {
            background: "rgba(15, 23, 42, 0.95)",
            color: "#fff",
            border: "1px solid rgba(34, 211, 238, 0.3)",
            borderRadius: "12px",
            padding: "8px 16px",
            fontSize: "14px",
            fontWeight: "600",
            boxShadow: "0 10px 30px rgba(0, 255, 255, 0.15)",
            backdropFilter: "blur(10px)",
          },
          success: {
            icon: "✓",
            style: {
              borderColor: "rgba(34, 211, 238, 0.7)",
              background: "rgba(6, 78, 99, 0.4)",
              boxShadow: "0 10px 30px rgba(0, 240, 255, 0.25)",
            },
          },
          error: { icon: "", style: { borderColor: "#ef4444" } },
        }}
      />
    </div>
  );
};

export default MobileGameLayout;