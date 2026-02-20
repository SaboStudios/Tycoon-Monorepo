import React from "react";
import { motion } from "framer-motion";
import { Game, Player } from "@/types/game";
import { getPlayerSymbol } from "@/lib/types/symbol";
import { useAccount } from "wagmi";

interface PlayerListProps {
  game: Game;
  me: Player | null;
  address: string | undefined;
  isNext: boolean;
  startTrade: (player: Player) => void;
}

// Dynamic balance color (same as desktop)
const getBalanceColor = (balance: number): string => {
  if (balance >= 1300) return "text-cyan-300";
  if (balance >= 1000) return "text-emerald-400";
  if (balance >= 750) return "text-yellow-400";
  if (balance >= 150) return "text-orange-400";
  return "text-red-500 animate-pulse";
};

export const PlayerList: React.FC<PlayerListProps> = ({
  game,
  me,
  address,
  isNext,
  startTrade,
}) => {
  const sorted = [...(game?.players ?? [])].sort(
    (a, b) => (a.turn_order ?? 99) - (b.turn_order ?? 99)
  );

  const { address: connectedAddress } = useAccount();

  return (
    <div className="space-y-4">
      {/* Top glowing bar */}
      <div className="h-1 bg-gradient-to-r from-pink-500 via-cyan-400 to-purple-600 rounded-full shadow-lg shadow-cyan-400/60" />

      <motion.h2
        animate={{
          textShadow: ["0 0 12px #0ff", "0 0 24px #0ff", "0 0 12px #0ff"],
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="text-2xl font-black text-cyan-300 text-center tracking-wider drop-shadow-2xl"
      >
        PLAYERS
      </motion.h2>

      <div className="space-y-3">
        {sorted.map((p) => {
          const isMe = p.address?.toLowerCase() === connectedAddress?.toLowerCase();
          const isTurn = p.user_id === game.next_player_id;
          const canTrade = isNext && !p.in_jail && !isMe;
          const displayName = p.username || p.address?.slice(0, 6) + "..." || "Player";
          const isAI = displayName.toLowerCase().includes("ai") || displayName.toLowerCase().includes("bot");

          const balanceColor = getBalanceColor(p.balance);

          return (
            <motion.div
              key={p.user_id}
              whileTap={{ scale: 0.98 }}
              whileHover={{ scale: 1.02 }}
              className={`
                relative p-4 rounded-2xl border-3 transition-all duration-300 overflow-hidden
                ${isTurn
                  ? "border-cyan-400 bg-cyan-900/60 shadow-2xl shadow-cyan-500/70"
                  : "border-purple-700/70 bg-purple-900/30 shadow-xl"
                }
                ${p.in_jail ? "opacity-70" : ""}
              `}
            >
              {/* Pulsing glow for current turn */}
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
                      <span className="truncate">{displayName}</span>
                      {isMe && (
                        <span className="px-2 py-0.5 bg-yellow-500/90 text-black text-xs font-black rounded-full flex-shrink-0">
                          YOU
                        </span>
                      )}
                      {isAI && <span className="text-lg">🤖</span>}
                      {p.in_jail && (
                        <span className="text-red-400 text-xs font-bold flex-shrink-0">
                          [JAIL]
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

                <div className={`text-xl font-black ${balanceColor} drop-shadow-md`}>
                  ${p.balance.toLocaleString()}
                </div>
              </div>

              {/* Trade Button - premium style */}
              {canTrade && (
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={() => startTrade(p)}
                  className="
                    mt-4 w-full py-3 
                    bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600
                    hover:from-pink-500 hover:via-purple-500 hover:to-indigo-500
                    text-white font-bold rounded-xl text-base
                    shadow-xl shadow-purple-900/50
                    transition-all duration-300
                  "
                >
                  💱 TRADE WITH {displayName.split(" ")[0].toUpperCase()}
                </motion.button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};