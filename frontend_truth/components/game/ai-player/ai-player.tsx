"use client";

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Game, Player, Property, GameProperty } from "@/types/game";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import PlayerList from "./player-list";
import { MyEmpire } from "./my-empire";
import { TradeSection } from "./trade-section";
import { PropertyActionModal } from "../modals/property-action";
import { AiResponsePopup } from "../modals/ai-response";
import { TradeModal } from "../modals/trade";
import ClaimPropertyModal from "../dev";
import { useAiPlayerLogic } from "./useAiPlayerLogic";
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
  /** When true, expand trades section and scroll into view (e.g. after clicking bell on board). */
  focusTrades?: boolean;
  onViewedTrades?: () => void;
  /** Guest players: backend already claimed on-chain; skip wallet claim. */
  isGuest?: boolean;
}

export default function GamePlayers({
  game,
  properties,
  game_properties,
  my_properties,
  me,
  currentPlayer,
  isAITurn,
  focusTrades = false,
  onViewedTrades,
  isGuest = false,
}: GamePlayersProps) {
  const isDevMode = false;

  const [showEmpire, setShowEmpire] = useState(false);
  const [showTrade, setShowTrade] = useState(false);
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [showPlayerList, setShowPlayerList] = useState(true);

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

  const toggleEmpire = useCallback(() => setShowEmpire((p) => !p), []);
  const toggleTrade = useCallback(() => setShowTrade((p) => !p), []);

  // When parent asks to focus trades (e.g. bell on board), expand section and scroll into view
  useEffect(() => {
    if (!focusTrades) return;
    setShowTrade(true);
    onViewedTrades?.();
    const el = document.getElementById("ai-desktop-trades-section");
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [focusTrades, onViewedTrades]);

useEffect(() => {
  if (!isAITurn || !currentPlayer || currentPlayer.balance >= 0) return;

  const handleAiLiquidationAndPossibleBankruptcy = async () => {
    toast(`${currentPlayer.username} cannot pay — attempting to raise funds...`);

    const raisedFromHouses = await aiSellHouses(Infinity);
    const raisedFromMortgages = await aiMortgageProperties(Infinity);
    const totalRaised = raisedFromHouses + raisedFromMortgages;

    // Refresh player data after liquidation attempts
    // (balance might have changed)
    // Note: In a real app you'd refetch game state here, but we'll assume balance is updated via polling

    if (currentPlayer.balance >= 0) {
      toast.success(`${currentPlayer.username} raised $${totalRaised} and survived! 💪`);
      return;
    }

    toast(`${currentPlayer.username} still cannot pay — bankrupt!`);

    try {
      // === NEW: Explicitly end the AI's turn BEFORE removal ===
      try {
        await apiClient.post("/game-players/end-turn", {
          user_id: currentPlayer.user_id,
          game_id: game.id,
        });
        // No toast needed — keeps flow clean
      } catch (err) {
        console.warn("Failed to end AI turn before bankruptcy", err);
        // Continue anyway — bankruptcy is more important
      }

      // Transfer or return properties
      const landedGameProperty = game_properties.find(
        gp => gp.property_id === currentPlayer.position
      );

      const creditorAddress =
        landedGameProperty?.address && landedGameProperty.address !== "bank"
          ? landedGameProperty.address
          : null;

      const creditorPlayer = creditorAddress
        ? game.players.find(
            p => p.address?.toLowerCase() === creditorAddress.toLowerCase()
          )
        : null;

      const aiProperties = game_properties.filter(
        gp => gp.address === currentPlayer.address
      );

      let successCount = 0;

      if (creditorPlayer && !isAIPlayer(creditorPlayer)) {
        const creditorRealPlayerId = getGamePlayerId(creditorPlayer.address);

        if (!creditorRealPlayerId) {
          toast.error(`Cannot transfer: ${creditorPlayer.username} has no valid player_id`);
          for (const prop of aiProperties) {
            await handleDeleteGameProperty(prop.id);
            successCount++;
          }
        } else {
          toast(`Transferring properties to ${creditorPlayer.username}...`);
          for (const prop of aiProperties) {
            try {
              await handlePropertyTransfer(prop.id, creditorRealPlayerId, "");
              successCount++;
            } catch (err) {
              console.error(`Transfer failed for property ${prop.id}`, err);
            }
          }
          toast.success(
            `${successCount}/${aiProperties.length} properties transferred to ${creditorPlayer.username}!`
          );
        }
      } else {
        toast(`Returning properties to bank...`);
        for (const prop of aiProperties) {
          try {
            await handleDeleteGameProperty(prop.id);
            successCount++;
          } catch (err) {
            console.error(`Delete failed for property ${prop.id}`, err);
          }
        }
        toast.success(`${successCount}/${aiProperties.length} properties returned to bank.`);
      }

      // Now remove the AI player
          await apiClient.post("/game-players/end-turn", {
              user_id: currentPlayer.user_id,
              game_id: game.id,
            });

      await apiClient.post("/game-players/leave", {
        address: currentPlayer.address,
        code: game.code,
        reason: "bankruptcy",
      });

      toast.success(`${currentPlayer.username} has been eliminated.`, { duration: 6000 });
    } catch (err: any) {
      console.error("Bankruptcy handling failed:", err);
      toast.error(getContractErrorMessage(err, "AI bankruptcy process failed"));
    }
  };

  handleAiLiquidationAndPossibleBankruptcy();
}, [isAITurn, currentPlayer?.balance, currentPlayer, game_properties, game.id, game.code, game.players]);
 

// Only show winner when backend has marked the game FINISHED (same as mobile).
  // Do not set winner when e.g. only 1 player is loaded (AI not joined yet).
  useEffect(() => {
    if (!game || game.status !== "FINISHED" || game.winner_id == null) return;

    const winnerPlayer = game.players.find((p) => p.user_id === game.winner_id!) ?? (me?.user_id === game.winner_id ? me : null);
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
  }, [game?.status, game?.winner_id, game?.players, me]);

  const handleFinalizeAndLeave = async () => {
    const toastId = toast.loading(
      winner?.user_id === me?.user_id
        ? "Claiming your prize..."
        : "Finalizing game..."
    );

    try {
      if (!isGuest && endGameHook.write) await endGameHook.write();

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

  

  return (
    <aside className="w-80 h-full bg-gradient-to-b from-[#0a001a] via-[#15082a] to-[#1a0033] border-r-4 border-purple-600 shadow-2xl shadow-purple-900/60 flex flex-col relative overflow-hidden">
      {/* Top Neon Glow Bar */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-pink-500 via-cyan-400 to-purple-600 shadow-lg shadow-cyan-400/80 z-50" />

      {/* Floating Header with Glass Effect */}
      <div className="relative z-10 p-5 pb-3 flex-shrink-0 backdrop-blur-xl bg-black/20 border-b border-purple-500/30">
        <motion.h2
          animate={{
            textShadow: [
              "0 0 15px #06b6d4",
              "0 0 30px #06b6d4",
              "0 0 15px #06b6d4",
            ],
          }}
          transition={{ duration: 3, repeat: Infinity }}
          className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-400 text-center tracking-wider drop-shadow-2xl"
        >
          PLAYERS
        </motion.h2>
        <div className="text-center mt-2 text-sm text-purple-300 opacity-80">
          Game Code: <span className="font-mono font-bold text-cyan-300">{game.code}</span>
        </div>
      </div>

      {/* Scrollable Content with Custom Scrollbar */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-custom px-5 pb-8 pt-4">
  <div className="space-y-2">
    {/* Player List Section */}
      {/* Collapsible Player List Section - Slim & Efficient */}
    <section className="backdrop-blur-md bg-white/10 rounded-2xl border border-cyan-500/40 shadow-xl shadow-cyan-900/40 overflow-hidden">
      <button
        onClick={() => setShowPlayerList(prev => !prev)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/10 transition-all duration-200"
      >
        <h3 className="text-lg font-bold text-cyan-300 tracking-wide">
          Active Players
        </h3>
        <motion.div
          animate={{ rotate: showPlayerList ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="text-cyan-300"
        >
          ▼
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {showPlayerList && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="px-4 pb-4"
          >
            <div className="space-y-2.5"> {/* Tighter spacing */}
              <PlayerList
                game={game}
                sortedPlayers={sortedPlayers}
                startTrade={startTrade}
                isNext={isNext}
                compact={true}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>

    {/* My Empire Section */}
    <section className="backdrop-blur-sm bg-white/5 rounded-2xl p-4 border border-purple-500/30 shadow-xl shadow-purple-900/40">
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
    <section id="ai-desktop-trades-section" className="backdrop-blur-sm bg-white/5 rounded-2xl p-4 border border-pink-500/30 shadow-xl shadow-pink-900/40">
      <TradeSection
        showTrade={showTrade}
        toggleTrade={toggleTrade}
        openTrades={openTrades}
        tradeRequests={tradeRequests}
        properties={properties}
        game={game}
        handleTradeAction={handleTradeAction}
      />
    </section>

    {/* Dev Mode Button */}
    {isDevMode && (
      <motion.button
        whileHover={{ scale: 1.05, boxShadow: "0 0 25px rgba(168, 85, 247, 0.6)" }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setClaimModalOpen(true)}
        className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 rounded-2xl text-white font-bold text-lg tracking-wide shadow-2xl shadow-purple-800/60 hover:shadow-pink-800/70 transition-all duration-300 border border-purple-400/50"
      >
        ⚙️ DEV: Claim Property
      </motion.button>
    )}
  </div>
</div>

      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .scrollbar-custom {
          scrollbar-width: thin;
          scrollbar-color: rgba(168, 85, 247, 0.5) rgba(20, 5, 40, 0.7);
        }

        .scrollbar-custom::-webkit-scrollbar {
          width: 8px;
        }

        .scrollbar-custom::-webkit-scrollbar-track {
          background: rgba(20, 5, 40, 0.7);
          border-radius: 8px;
        }

        .scrollbar-custom::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #c084fc, #ec4899);
          border-radius: 8px;
          box-shadow: 0 0 10px rgba(236, 72, 153, 0.6);
        }

        .scrollbar-custom::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #d8b4fe, #f43f5e);
          box-shadow: 0 0 15px rgba(244, 63, 94, 0.8);
        }
      `}</style>

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
            game.players.find(p => p.user_id === counterModal.trade?.target_player_id)?.address
          }
        />

        <ClaimPropertyModal
          open={claimModalOpen && isDevMode}
          game_properties={game_properties}
          properties={properties}
          me={me}
          game={game}
          onClose={() => setClaimModalOpen(false)}
          onClaim={handleClaimProperty}
          onDelete={handleDeleteGameProperty}
          onTransfer={handlePropertyTransfer}
        />
      </AnimatePresence>
    </aside>
  );
}