"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Game, Player, Property, GameProperty } from "@/types/game";
import toast from "react-hot-toast";
import PlayerList from "./player-list";
import { MyEmpire } from "./my-empire";
import { TradeSection } from "./trade-section";
import { PropertyActionModal } from "../../modals/property-action";
import { AiResponsePopup } from "../../modals/ai-response";
import { VictoryModal } from "../../modals/victory";
import { TradeModal } from "../../modals/trade-mobile";
import { useAiPlayerLogic } from "../useAiPlayerLogic";
import { isAIPlayer } from "@/utils/gameUtils";
import { getContractErrorMessage } from "@/lib/utils/contractErrors";

interface GamePlayersProps {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  my_properties: Property[];
  me: Player | null;
  currentPlayer: Player | null;
  roll: { die1: number; die2: number; total: number } | null;
  isAITurn: boolean;
  /** When true, open the trades section (e.g. after tapping "View trades" on the board). */
  focusTrades?: boolean;
  onViewedTrades?: () => void;
}

export default function MobileGamePlayers({
  game,
  properties,
  game_properties,
  my_properties,
  me,
  currentPlayer,
  isAITurn,
  focusTrades = false,
  onViewedTrades,
}: GamePlayersProps) {
  const [sectionOpen, setSectionOpen] = useState({
    players: false,
    empire: false,
    trades: false,
  });
  const [showEmpire, setShowEmpire] = useState(true);

  const logic = useAiPlayerLogic({
    game,
    properties,
    game_properties,
    my_properties,
    me,
    currentPlayer,
    isAITurn,
  });

  const {
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
    endGameHook,
    openTrades,
    tradeRequests,
    closeAiTradePopup,
    refreshTrades,
    resetTradeFields,
    toggleSelect,
    startTrade,
    sortedPlayers,
    isNext,
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
  } = logic;

  const totalActiveTrades = openTrades.length + tradeRequests.length;
  const toggleEmpire = useCallback(() => setShowEmpire((p) => !p), []);
  const toggleTrade = useCallback(() => setSectionOpen((prev) => ({ ...prev, trades: !prev.trades })), []);
  const tradesSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!me || game.players.length !== 2) return;

    const aiPlayer = game.players.find(p => isAIPlayer(p));
    const humanPlayer = me;

    if ((!aiPlayer) && humanPlayer.balance > 0) {
      const turnCount = humanPlayer.turn_count ?? 0;
      const validWin = turnCount >= 20;
      setWinner(humanPlayer);
      setEndGameCandidate({
        winner: humanPlayer,
        position: humanPlayer.position ?? 0,
        balance: BigInt(humanPlayer.balance),
        validWin,
      });
    }
  }, [game.players, me]);

  const handleFinalizeAndLeave = async () => {
    const toastId = toast.loading(
      winner?.user_id === me?.user_id
        ? "Claiming your prize..."
        : "Finalizing game..."
    );

    try {
      if (endGameHook.write) await endGameHook.write();

      toast.success(
        winner?.user_id === me?.user_id
          ? "Prize claimed! 🎉"
          : "Game completed — thanks for playing!",
        { id: toastId, duration: 5000 }
      );

      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    } catch (err: any) {
      toast.error(
        getContractErrorMessage(err, "Something went wrong — try again later"),
        { id: toastId, duration: 8000 }
      );
    } finally {
      if (endGameHook.reset) endGameHook.reset();
    }
  };

  // When parent asks to focus trades (e.g. notification bell), open trades section and scroll into view
  // Only opens trades; Players and My Empire remain independent per user's choice.
  useEffect(() => {
    if (!focusTrades) return;
    setSectionOpen((prev) => ({ ...prev, trades: true }));
    onViewedTrades?.();
    const t = setTimeout(() => {
      requestAnimationFrame(() => {
        tradesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }, 80);
    return () => clearTimeout(t);
  }, [focusTrades, onViewedTrades]);

  return (
    <div className="w-full h-screen bg-gradient-to-b from-[#0a001a] via-[#15082a] to-[#1a0033] text-white flex flex-col overflow-hidden">
      {/* Top Neon Glow Bar */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-pink-500 via-cyan-400 to-purple-600 shadow-lg shadow-cyan-400/70 z-50" />

      {/* Header */}
      <div className="relative z-10 px-5 pt-6 pb-4 shrink-0 backdrop-blur-xl bg-black/30 border-b border-purple-500/40">
        <motion.h2
          animate={{
            textShadow: ["0 0 10px #06b6d4", "0 0 20px #06b6d4", "0 0 10px #06b6d4"],
          }}
          transition={{ duration: 3, repeat: Infinity }}
          className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-400 text-center tracking-wider"
        >
          PLAYERS
        </motion.h2>
        <div className="mt-3 text-center text-lg text-purple-200 opacity-80">
          Game Code: <span className="font-mono font-bold text-cyan-300 text-xl">{game.code}</span>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-20 scrollbar-thin">
        <div className="space-y-6 py-6">

          {/* Players Section */}
          <section className="bg-black/30 backdrop-blur-sm rounded-2xl border border-purple-500/30 shadow-xl overflow-hidden">
            <button
              onClick={() => setSectionOpen(prev => ({ ...prev, players: !prev.players }))}
              className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
            >
              <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-400">
                PLAYERS
              </h3>
              <motion.div
                animate={{ rotate: sectionOpen.players ? 180 : 0 }}
                transition={{ duration: 0.3 }}
                className="text-cyan-300"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </motion.div>
            </button>

            <AnimatePresence initial={false}>
              {sectionOpen.players && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-8">
                    <PlayerList
                      game={game}
                      sortedPlayers={sortedPlayers}
                      startTrade={startTrade}
                      isNext={isNext}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* My Empire Section */}
          <section className="bg-black/40 backdrop-blur-md rounded-2xl border border-cyan-500/40 shadow-2xl shadow-cyan-900/50 overflow-hidden">
            <MyEmpire
              showEmpire={showEmpire}
              toggleEmpire={toggleEmpire}
              my_properties={my_properties}
              properties={properties}
              game_properties={game_properties}
              setSelectedProperty={setSelectedProperty}
            />
          </section>

          {/* Active Trades Section */}
          <section ref={tradesSectionRef} className="bg-black/30 backdrop-blur-sm rounded-2xl border border-pink-500/30 shadow-xl overflow-hidden">
            <button
              onClick={() => setSectionOpen(prev => ({ ...prev, trades: !prev.trades }))}
              className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-white/5 transition-colors relative"
            >
              <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-red-400">
                ACTIVE TRADES {totalActiveTrades > 0 && `(${totalActiveTrades})`}
              </h3>
              {totalActiveTrades > 0 && (
                <div className="absolute -top-2 -right-2 w-9 h-9 bg-red-600 rounded-full flex items-center justify-center text-sm font-bold animate-pulse shadow-lg">
                  {totalActiveTrades}
                </div>
              )}
              <motion.div
                animate={{ rotate: sectionOpen.trades ? 180 : 0 }}
                transition={{ duration: 0.3 }}
                className="text-pink-300"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </motion.div>
            </button>

            <AnimatePresence initial={false}>
              {sectionOpen.trades && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-8">
                    <TradeSection
                      showTrade={true}
                      toggleTrade={toggleTrade}
                      openTrades={openTrades}
                      tradeRequests={tradeRequests}
                      properties={properties}
                      game={game}
                      handleTradeAction={handleTradeAction}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

        </div>
      </div>

      {/* All Modals */}
      <AnimatePresence>
        <PropertyActionModal
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
          onDevelop={handleDevelopment}
          onDowngrade={handleDowngrade}
          onMortgage={handleMortgage}
          onUnmortgage={handleUnmortgage}
        />

        <AiResponsePopup
          popup={aiResponsePopup}
          properties={properties}
          onClose={() => setAiResponsePopup(null)}
        />

        <VictoryModal
          winner={winner}
          me={me}
          onClaim={handleFinalizeAndLeave}
          claiming={endGameHook.isPending}
        />

        <TradeModal
          open={tradeModal.open}
          title={`Trade with ${tradeModal.target?.username || "Player"}`}
          onClose={() => {
            setTradeModal({ open: false, target: null });
            resetTradeFields();
          }}
          onSubmit={handleCreateTrade}
          my_properties={my_properties}
          properties={properties}
          game_properties={game_properties}
          offerProperties={offerProperties}
          requestProperties={requestProperties}
          setOfferProperties={setOfferProperties}
          setRequestProperties={setRequestProperties}
          offerCash={offerCash}
          requestCash={requestCash}
          setOfferCash={setOfferCash}
          setRequestCash={setRequestCash}
          toggleSelect={toggleSelect}
          targetPlayerAddress={tradeModal.target?.address}
        />

        <TradeModal
          open={counterModal.open}
          title="Counter Offer"
          onClose={() => {
            setCounterModal({ open: false, trade: null });
            resetTradeFields();
          }}
          onSubmit={submitCounterTrade}
          my_properties={my_properties}
          properties={properties}
          game_properties={game_properties}
          offerProperties={offerProperties}
          requestProperties={requestProperties}
          setOfferProperties={setOfferProperties}
          setRequestProperties={setRequestProperties}
          offerCash={offerCash}
          requestCash={requestCash}
          setOfferCash={setOfferCash}
          setRequestCash={setRequestCash}
          toggleSelect={toggleSelect}
          targetPlayerAddress={
            game.players.find((p) => p.user_id === counterModal.trade?.target_player_id)?.address
          }
        />
      </AnimatePresence>

      {/* Custom Scrollbar */}
      <style jsx>{`
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: rgba(168, 85, 247, 0.6);
          border-radius: 3px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: rgba(168, 85, 247, 0.9);
        }
      `}</style>
    </div>
  );
}