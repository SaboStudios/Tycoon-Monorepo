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
  compact?: boolean; // New optional prop for even tighter mode (when collapsed)
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
  compact = false,
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
    if (compact) {
      // In compact mode, tap directly starts trade if possible
      const canTrade = isNext && !player.in_jail && player !== myPlayer;
      if (canTrade) {
        startTrade(player);
      }
      return;
    }
    setSelectedPlayerId((prev) => (prev === player.user_id ? null : player.user_id));
  };

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
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
            whileTap={{ scale: 0.96 }}
            onClick={() => handlePlayerTap(p)}
            className={`
              relative rounded-xl border transition-all duration-300 cursor-pointer
              flex items-center justify-between gap-3 overflow-hidden
              ${compact ? "py-2.5 px-3" : "py-3.5 px-4"}
              ${isTurn
                ? "border-cyan-400/80 bg-cyan-900/50 shadow-lg shadow-cyan-500/40"
                : "border-purple-600/50 bg-purple-900/20"
              }
              ${p.in_jail ? "opacity-60" : ""}
              ${isSelected || (compact && canTrade) ? "ring-2 ring-pink-500/70" : ""}
            `}
          >
            {/* Pulsing background for current turn */}
            {isTurn && (
              <div className="absolute inset-0 bg-cyan-400/10 animate-pulse pointer-events-none rounded-xl" />
            )}

            <div className="relative z-10 flex items-center gap-3 min-w-0 flex-1">
              <span className={compact ? "text-2xl" : "text-3xl"}>{getPlayerSymbol(p.symbol)}</span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-bold truncate ${compact ? "text-sm" : "text-base"} text-cyan-100`}>
                    {displayName}
                  </span>
                  {isMe && (
                    <span className="px-1.5 py-0.5 bg-yellow-500/90 text-black text-xs font-black rounded-full">
                      YOU
                    </span>
                  )}
                  {isAI && <span className="text-gray-500 text-xs">🤖</span>}
                </div>

                {isTurn && !compact && (
                  <div className="text-xs text-cyan-300 font-medium mt-0.5 flex items-center gap-1">
                    <motion.div
                      animate={{ opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="w-1.5 h-1.5 bg-cyan-300 rounded-full"
                    />
                    Current Turn
                  </div>
                )}
                {isTurn && compact && (
                  <span className="text-xs text-cyan-300">● Turn</span>
                )}
              </div>
            </div>

            {p.balance > 0 && (
              <div className={`font-black drop-shadow-md ${compact ? "text-sm" : "text-lg"} ${balanceColor}`}>
                ${p.balance.toLocaleString()}
              </div>
            )}

            {/* Trade button - only in non-compact mode or on selection */}
            <AnimatePresence>
              {(isSelected || (compact && canTrade)) && !compact && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute inset-x-3 bottom-2 left-3 right-3"
                >
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      startTrade(p);
                      setSelectedPlayerId(null);
                    }}
                    className="
                      w-full py-2 text-sm font-bold rounded-lg
                      bg-gradient-to-r from-pink-600 to-purple-600
                      hover:from-pink-500 hover:to-purple-500
                      text-white shadow-lg
                    "
                  >
                    💱 TRADE
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
};

export default PlayerList;