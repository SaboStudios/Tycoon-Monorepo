"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Game, Player, Property, GameProperty } from "@/types/game";
import PlayerList from "./player-list";
import { MyEmpire } from "./my-empire";
import { TradeSection } from "./trade-section";
import { PropertyActionModal } from "../modals/property-action";
import { AiTradePopup } from "../modals/ai-trade";
import { AiResponsePopup } from "../modals/ai-response";
import { VictoryDefeatModal } from "../modals/VictoryDefeatModal";
import { TradeModal } from "../modals/trade";
import ClaimPropertyModal from "../dev";
import { usePlayerSidebar } from "./usePlayerSidebar";

interface GamePlayersProps {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  my_properties: Property[];
  me: Player | null;
}

export default function GamePlayers({
  game,
  properties,
  game_properties,
  my_properties,
  me,
}: GamePlayersProps) {
  const isDevMode = true;

  const {
    showEmpire,
    toggleEmpire,
    showTrade,
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
    showVictoryModal,
    myPosition,
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
    openTrades,
    tradeRequests,
    aiTradePopup,
    closeAiTradePopup,
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
    handleClaimProperty,
    handleFinalizeAndLeave,
    endGamePending,
    endGameReset,
  } = usePlayerSidebar({
    game,
    properties,
    game_properties,
    my_properties,
    me,
  });

  return (
    <aside className="w-80 h-full bg-gradient-to-b from-[#0a001a] via-[#15082a] to-[#1a0033] border-r-4 border-purple-600 shadow-2xl shadow-purple-900/60 flex flex-col relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-pink-500 via-cyan-400 to-purple-600 shadow-lg shadow-cyan-400/80 z-50" />

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

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-custom px-5 pb-8 pt-4">
        <div className="space-y-2">
          <section className="backdrop-blur-md bg-white/10 rounded-2xl border border-cyan-500/40 shadow-xl shadow-cyan-900/40 overflow-hidden">
            <button
              onClick={() => setShowPlayerList((prev) => !prev)}
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
                  <div className="space-y-2.5">
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

          <section className="backdrop-blur-sm bg-white/5 rounded-2xl p-4 border border-pink-500/30 shadow-xl shadow-pink-900/40">
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
        </div>
      </div>

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

      <AnimatePresence>
        <PropertyActionModal
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
          onDevelop={handleDevelopment}
          onDowngrade={handleDowngrade}
          onMortgage={handleMortgage}
          onUnmortgage={handleUnmortgage}
        />

        <AiTradePopup
          trade={aiTradePopup}
          properties={properties}
          onClose={closeAiTradePopup}
          onAccept={() => aiTradePopup && handleTradeAction(aiTradePopup.id, "accepted")}
          onDecline={() => aiTradePopup && handleTradeAction(aiTradePopup.id, "declined")}
          onCounter={() => aiTradePopup && handleTradeAction(aiTradePopup.id, "counter")}
        />

        <AiResponsePopup
          popup={aiResponsePopup}
          properties={properties}
          onClose={() => setAiResponsePopup(null)}
        />

        {showVictoryModal && winner && (
          <VictoryDefeatModal
            winner={winner}
            me={me}
            myPosition={myPosition}
            onGoHome={() => handleFinalizeAndLeave(true)}
          />
        )}

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
