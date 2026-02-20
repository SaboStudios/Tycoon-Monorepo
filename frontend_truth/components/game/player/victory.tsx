"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Sparkles, Coins, AlertCircle, Trophy, HeartHandshake } from "lucide-react";
import { Player } from "@/types/game";

interface VictoryModalProps {
  winner: Player | null;
  me: Player | null;
  onClaim: () => void;
  claiming: boolean;
  isOpen?: boolean;
  claimError?: string | null;
  onClearError?: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  winner,
  me,
  onClaim,
  claiming,
  isOpen = true,
  claimError = null,
  onClearError,
}) => {
  if (!winner || !isOpen) return null;

  const isWinner = me?.user_id === winner.user_id;

  const handleClaimClick = () => {
    onClearError?.();
    onClaim();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-[9999] p-4"
      >
        {/* Background glow */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-purple-950 to-amber-950"
          animate={{ opacity: [0.4, 0.65, 0.4], scale: [1, 1.04, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          initial={{ y: 100, scale: 0.82, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 60, scale: 0.85, opacity: 0 }}
          transition={{ type: "spring", stiffness: 110, damping: 14, delay: 0.1 }}
          className="
            relative w-full max-w-md sm:max-w-lg md:max-w-xl
            p-10 sm:p-12 md:p-16
            rounded-3xl md:rounded-4xl
            border-4 border-amber-500/60
            bg-gradient-to-b from-amber-950/95 via-amber-900/85 to-black/90
            backdrop-blur-xl shadow-2xl shadow-amber-600/60
            text-center overflow-hidden
          "
        >
          {/* Rotating glow effect */}
          <motion.div
            className="absolute inset-0 bg-gradient-radial from-amber-400/20 via-transparent to-transparent pointer-events-none"
            animate={{ rotate: 360 }}
            transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
          />

          <div className="relative z-10">
            {/* Icon */}
            <motion.div
              initial={{ scale: 0.5, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 160, delay: 0.2 }}
              className="mb-8 relative"
            >
              {isWinner ? (
                <>
                  <Crown className="w-32 h-32 sm:w-36 sm:h-36 mx-auto text-amber-300 drop-shadow-[0_0_45px_rgba(245,158,11,0.9)]" />
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <Sparkles className="w-16 h-16 text-amber-200/60" />
                  </motion.div>
                </>
              ) : (
                <Trophy className="w-32 h-32 sm:w-36 sm:h-36 mx-auto text-amber-400 drop-shadow-[0_0_45px_rgba(251,191,36,0.8)]" />
              )}
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ y: -40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="
                text-5xl sm:text-6xl md:text-7xl font-black tracking-tighter mb-4
                bg-clip-text text-transparent bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400
                animate-pulse leading-tight
              "
              style={{ textShadow: "0 0 40px rgba(245,158,11,0.8)" }}
            >
              {isWinner ? "VICTORY!" : "GAME OVER"}
            </motion.h1>

            {/* Winner announcement */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-2xl sm:text-3xl md:text-4xl font-bold text-amber-200/90 mb-6"
            >
              {winner.username} is the Tycoon!
            </motion.p>

            {/* Personal message */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-xl sm:text-2xl text-amber-100/90 mb-10"
            >
              {isWinner ? (
                <>Congratulations, {me?.username || "Champion"}! You conquered the board!</>
              ) : (
                <>Well played, {me?.username || "Player"}! Better luck next time.</>
              )}
            </motion.p>

            {/* Winner gets rewards */}
            {isWinner && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                className="mb-10 p-7 bg-black/50 rounded-2xl border border-amber-600/50 inline-block"
              >
                <div className="flex items-center justify-center gap-5">
                  <Coins className="w-12 h-12 text-amber-400 drop-shadow-[0_0_25px_rgba(245,158,11,0.8)]" />
                  <div className="text-left">
                    <p className="text-xl font-bold text-amber-300">Check Your Profile for Your Rewards</p>
                    <p className="text-base text-amber-200/80 mt-2">
                      Victory Bonus • Stake refunded
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Loser gets encouragement */}
            {!isWinner && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                className="mb-10 flex items-center justify-center gap-4 text-amber-200/80"
              >
                <HeartHandshake className="w-10 h-10" />
                <p className="text-xl">Great game! Practice makes perfect.</p>
              </motion.div>
            )}

            {/* Error message */}
            <AnimatePresence>
              {claimError && (
                <motion.div
                  initial={{ opacity: 0, y: -15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="mb-8 p-5 bg-red-900/60 border border-red-500/50 rounded-2xl flex items-start gap-4 text-red-100 max-w-lg mx-auto"
                >
                  <AlertCircle className="w-7 h-7 flex-shrink-0 mt-1" />
                  <div className="text-left">
                    <p className="font-bold text-lg">Claim failed</p>
                    <p className="text-base mt-1">{claimError}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action button */}
            <motion.button
              whileHover={{ scale: 1.07, y: -4 }}
              whileTap={{ scale: 0.96 }}
              disabled={claiming && isWinner}
              onClick={isWinner ? handleClaimClick : () => window.location.href = "/"}
              className={`
                px-12 py-6 md:px-16 md:py-8 text-xl md:text-2xl font-black
                rounded-2xl md:rounded-3xl
                shadow-2xl shadow-amber-900/50 border-2 border-amber-300/30
                transition-all duration-300 relative overflow-hidden group
                disabled:opacity-60 disabled:cursor-wait
                ${claiming && isWinner 
                  ? "bg-gray-800" 
                  : "bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-700 hover:from-amber-500 hover:via-yellow-500 hover:to-amber-600"
                }
              `}
            >
              <span className="relative z-10">
                {isWinner 
                  ? (claiming ? "Finalizing..." : "Return to Lobby")
                  : "Return to Lobby"
                }
              </span>
              <motion.div
                className="absolute inset-0 bg-white/15"
                initial={{ x: "-100%" }}
                whileHover={{ x: "100%" }}
                transition={{ duration: 0.7 }}
              />
            </motion.button>

            <p className="mt-12 text-base sm:text-lg text-amber-200/60 font-light">
              Thanks for playing <span className="text-amber-300 font-medium">Tycoon</span>
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};