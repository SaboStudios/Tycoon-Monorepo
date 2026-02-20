"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Game, Player } from "@/types/game";
import { getPlayerSymbol } from "@/lib/types/symbol";
import { useAccount } from "wagmi";

interface PlayerListProps {
  game: Game;
  sortedPlayers: Player[];
  isNext: boolean;
  startTrade: (player: Player) => void;
}

const getBalanceColor = (balance: number): string => {
  if (balance >= 1300) return "text-cyan-300";
  if (balance >= 1000) return "text-emerald-400";
  if (balance >= 750) return "text-yellow-400";
  if (balance >= 150) return "text-orange-400";
  return "text-red-500 animate-pulse";
};

const PlayerList: React.FC<PlayerListProps> = ({
  game,
  sortedPlayers,
  isNext,
  startTrade,
}) => {
  const { address: connectedAddress } = useAccount();
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);

  const myPlayer = sortedPlayers.find(
    (p) => p.address?.toLowerCase() === connectedAddress?.toLowerCase()
  );

  const currentTurnPlayer = sortedPlayers.find(
    (p) => p.user_id === game.next_player_id
  );

  const otherPlayers = sortedPlayers.filter(
    (p) => p !== myPlayer && p !== currentTurnPlayer
  );

  const reorderedPlayers = [
    ...(myPlayer ? [myPlayer] : []),
    ...(currentTurnPlayer && currentTurnPlayer !== myPlayer ? [currentTurnPlayer] : []),
    ...otherPlayers,
  ];

  const handlePlayerTap = (player: Player) => {
    setSelectedPlayerId((prev) => (prev === player.user_id ? null : player.user_id));
  };

  return (
    <div className="space-y-2"> {/* Tightened outer spacing */}
      {/* Top glowing bar – kept but smaller */}
      <div className="h-1 bg-gradient-to-r from-pink-500 via-cyan-400 to-purple-600 rounded-full shadow-lg shadow-cyan-400/60" />

      {/* Scrollable area – NO FIXED HEIGHT anymore */}
      <div className="max-h-[60vh] overflow-y-auto pr-2 scrollbar-custom">
        <div className="space-y-3 pb-2"> {/* ← Key fix: very small bottom padding */}
          {reorderedPlayers.map((p) => {
            const isMe = p.address?.toLowerCase() === connectedAddress?.toLowerCase();
            const isTurn = p.user_id === game.next_player_id;
            const canTrade = isNext && !p.in_jail && !isMe;
            const isSelected = selectedPlayerId === p.user_id;

            const displayName =
              p.username || p.address?.slice(0, 6) + "..." || "Player";
            const isAI =
              displayName.toLowerCase().includes("ai_") ||
              displayName.toLowerCase().includes("bot");

            const balanceColor = getBalanceColor(p.balance);

            return (
              <motion.div
                key={p.user_id}
                whileTap={{ scale: 0.97 }}
                onClick={() => handlePlayerTap(p)}
                className={`
                  relative p-4 rounded-2xl border-2 transition-all duration-300 
                  cursor-pointer overflow-hidden select-none
                  ${isTurn
                    ? "border-cyan-400 bg-cyan-900/60 shadow-2xl shadow-cyan-500/70"
                    : "border-purple-700/70 bg-purple-900/30 shadow-xl"
                  }
                  ${p.in_jail ? "opacity-70" : ""}
                  ${isSelected ? "ring-4 ring-pink-500 ring-offset-2 ring-offset-black/50" : ""}
                `}
              >
                {isTurn && (
                  <div className="absolute inset-0 bg-cyan-400/10 animate-pulse pointer-events-none rounded-2xl" />
                )}

                <div className="relative z-10 flex justify-between items-center gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-3xl drop-shadow-md flex-shrink-0">
                      {getPlayerSymbol(p.symbol)}
                    </span>

                    <div className="min-w-0">
                      <div className="font-bold text-cyan-100 text-base flex items-center gap-2 flex-wrap">
                        <span className="truncate max-w-[140px]">{displayName}</span>
                        {isMe && (
                          <span className="px-2 py-0.5 bg-yellow-500/90 text-black text-xs font-black rounded-full flex-shrink-0">
                            YOU
                          </span>
                        )}
                      </div>

                      {isTurn && (
                        <div className="text-xs text-cyan-300 font-medium mt-1 flex items-center gap-1">
                          <motion.div
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className="w-2 h-2 bg-cyan-300 rounded-full"
                          />
                          Current Turn
                        </div>
                      )}
                    </div>
                  </div>

                  {p.balance > 0 && (
                    <div className={`text-xl font-black ${balanceColor} drop-shadow-md`}>
                      ${p.balance.toLocaleString()}
                    </div>
                  )}
                </div>

                <AnimatePresence>
                  {isSelected && canTrade && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="mt-4" // ← Controls space between card content and TRADE button
                    >
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          startTrade(p);
                          setSelectedPlayerId(null);
                        }}
                        className="
                          w-full py-3 
                          bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600
                          hover:from-pink-500 hover:via-purple-500 hover:to-indigo-500
                          text-white font-bold rounded-xl text-base
                          shadow-xl shadow-purple-900/50 transition-all duration-300
                        "
                      >
                        💱 TRADE WITH {displayName.split(" ")[0].toUpperCase()}
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Custom Scrollbar – kept but optional */}
      <style jsx>{`
        .scrollbar-custom {
          scrollbar-width: thin;
          scrollbar-color: rgba(147, 51, 234, 0.4) rgba(30, 10, 58, 0.6);
        }
        .scrollbar-custom::-webkit-scrollbar {
          width: 6px;
        }
        .scrollbar-custom::-webkit-scrollbar-track {
          background: rgba(30, 10, 58, 0.6);
          border-radius: 4px;
        }
        .scrollbar-custom::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #a855f7, #ec4899);
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};

export default PlayerList;