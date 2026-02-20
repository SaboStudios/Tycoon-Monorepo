"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Sparkles, Coins, AlertCircle, Trophy, HeartHandshake, Star } from "lucide-react";
import { Player } from "@/types/game";

interface VictoryModalProps {
  winner: Player | null;
  me: Player | null;
  onClaim: () => void;
  claiming: boolean;
  isOpen?: boolean;        // Added for explicit control
  onClose?: () => void;     // Optional close handler
  claimError?: string | null;
  onClearError?: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  winner,
  me,
  onClaim,
  claiming,
  isOpen = true,
  onClose,
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
        className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[9999] p-4 overflow-y-auto"
      >
        {/* Dynamic animated background */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-purple-950 via-indigo-950 to-amber-950/50"
          animate={{
            backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          style={{ backgroundSize: "200% 200%" }}
        />

        {/* Golden particle overlay */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-amber-300 rounded-full"
              initial={{ x: Math.random() * window.innerWidth, y: -10, opacity: 0 }}
              animate={{
                y: window.innerHeight + 10,
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 8 + Math.random() * 7,
                repeat: Infinity,
                delay: Math.random() * 5,
                ease: "linear",
              }}
            />
          ))}
        </div>

        <motion.div
          initial={{ y: 100, scale: 0.85, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 80, scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 16 }}
          className="
            relative w-full max-w-md sm:max-w-lg md:max-w-2xl
            p-8 sm:p-12 md:p-16
            rounded-3xl md:rounded-4xl
            border-4 border-amber-400/70
            bg-gradient-to-b from-amber-950/95 via-amber-900/90 to-black/95
            backdrop-blur-2xl shadow-2xl shadow-amber-700/70
            text-center overflow-hidden
          "
        >
          {/* Inner glow ring */}
          <motion.div
            className="absolute -inset-1 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 rounded-4xl blur-xl opacity-50"
            animate={{ rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          />

          <div className="relative z-10">
            {/* Main Icon */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 150, delay: 0.2 }}
              className="mb-10 relative inline-block"
            >
              {isWinner ? (
                <div className="relative">
                  <Crown className="w-36 h-36 sm:w-44 sm:h-44 mx-auto text-amber-200 drop-shadow-[0_0_60px_rgba(251,215,134,0.9)]" />
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <Star className="w-20 h-20 text-yellow-300/70" />
                  </motion.div>
                  <motion.div
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="absolute -inset-8"
                  >
                    <Sparkles className="w-full h-full text-amber-400/60" />
                  </motion.div>
                </div>
              ) : (
                <Trophy className="w-36 h-36 sm:w-44 sm:h-44 mx-auto text-amber-300 drop-shadow-[0_0_60px_rgba(251,191,36,0.9)]" />
              )}
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="
                text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight mb-6
                bg-clip-text text-transparent
                bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400
                drop-shadow-2xl
                leading-none
              "
              style={{ textShadow: "0 0 50px rgba(251,158,11,0.9)" }}
            >
              {isWinner ? "VICTORY!" : "GAME OVER"}
            </motion.h1>

            {/* Winner Name */}
            <motion.p
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7 }}
              className="text-3xl sm:text-4xl md:text-5xl font-bold text-amber-100 mb-8"
            >
              {winner.username} <span className="text-amber-300">is the Tycoon!</span>
            </motion.p>

            {/* Personal Message */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="text-xl sm:text-2xl md:text-3xl text-amber-100/90 mb-12 leading-relaxed px-4"
            >
              {isWinner ? (
                <>Congratulations, Champion! You've dominated the board and claimed victory!</>
              ) : (
                <>Great effort, {me?.username || "Player"}! The board was tough this time.</>
              )}
            </motion.p>

            {/* Winner Rewards Section */}
            {isWinner && (
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 }}
                className="mb-12 p-8 bg-black/60 rounded-3xl border-2 border-amber-500/50 max-w-lg mx-auto"
              >
                <div className="flex items-center justify-center gap-6 mb-4">
                  <Coins className="w-14 h-14 text-amber-400 drop-shadow-[0_0_30px_rgba(251,158,11,0.8)]" />
                  <div className="text-left">
                    <p className="text-2xl font-black text-amber-200">Victory Rewards</p>
                    <p className="text-lg text-amber-100/80 mt-2">
                      Stake refunded • Bonus tokens • Bragging rights
                    </p>
                  </div>
                </div>
                <p className="text-lg text-amber-300 font-medium mt-4">
                  Check your wallet & profile soon!
                </p>
              </motion.div>
            )}

            {/* Loser Encouragement */}
            {!isWinner && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 }}
                className="mb-12 flex flex-col items-center gap-5 text-amber-200/90"
              >
                <HeartHandshake className="w-16 h-16" />
                <p className="text-2xl font-medium">You gave it your all!</p>
                <p className="text-lg max-w-sm">Every great Tycoon started with a tough game.</p>
              </motion.div>
            )}

            {/* Claim Error */}
            <AnimatePresence>
              {claimError && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="mb-8 p-6 bg-red-900/70 border-2 border-red-500/60 rounded-2xl flex items-start gap-4 text-red-100 max-w-md mx-auto"
                >
                  <AlertCircle className="w-8 h-8 flex-shrink-0 mt-0.5" />
                  <div className="text-left">
                    <p className="font-bold text-xl">Claim Failed</p>
                    <p className="text-base mt-2">{claimError}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Button */}
            <motion.div className="mt-10">
              <motion.button
                whileHover={{ scale: 1.08, y: -6 }}
                whileTap={{ scale: 0.95 }}
                disabled={claiming && isWinner}
                onClick={isWinner ? handleClaimClick : () => window.location.href = "/"}
                className={`
                  relative px-16 py-7 md:px-20 md:py-9
                  text-2xl md:text-3xl font-black tracking-wide
                  rounded-3xl overflow-hidden
                  shadow-2xl shadow-amber-900/70
                  border-4 border-amber-300/40
                  transition-all duration-500
                  disabled:opacity-70 disabled:cursor-wait
                  ${
                    claiming && isWinner
                      ? "bg-gray-800/90"
                      : "bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-700 hover:from-amber-500 hover:via-yellow-400 hover:to-amber-600"
                  }
                `}
              >
                <span className="relative z-10 drop-shadow-lg">
                  {isWinner
                    ? claiming
                      ? "Claiming Your Crown..."
                      : "Claim Victory Rewards"
                    : "Return to Lobby"}
                </span>

                {/* Shine effect */}
                <motion.div
                  className="absolute inset-0 bg-white/20 -skew-x-12"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: "100%" }}
                  transition={{ duration: 0.8 }}
                />
              </motion.button>
            </motion.div>

            {/* Footer */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.4 }}
              className="mt-16 text-lg sm:text-xl text-amber-200/60 font-medium"
            >
              Thanks for playing <span className="text-amber-400 font-bold">Tycoon</span> — see you on the board!
            </motion.p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};