"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Sparkles, Coins, AlertCircle } from "lucide-react";
import { Player } from "@/types/game";

interface VictoryModalProps {
  winner: Player | null;
  me: Player | null;
  onClaim: () => void;
  claiming: boolean;
  claimError?: string | null;
  onClearError?: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  winner,
  me,
  onClaim,
  claiming,
  claimError = null,
  onClearError,
}) => {
  if (!winner || winner.user_id !== me?.user_id) return null;

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
        className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-[9999] p-4"
      >
        {/* Animated background glow - cyan/teal theme */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-cyan-950/40 via-black to-teal-950/40"
          animate={{
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.05, 1],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Pulsing radial glow */}
        <motion.div
          className="absolute inset-0 bg-gradient-radial from-cyan-500/20 via-transparent to-transparent"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeOut" }}
        />

        <motion.div
          initial={{ y: 100, scale: 0.85, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 80, scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 16 }}
          className="
            relative w-full max-w-md sm:max-w-lg md:max-w-xl
            p-10 sm:p-12 md:p-16
            rounded-3xl md:rounded-4xl
            border-4 border-cyan-500/70
            bg-gradient-to-b from-black/95 via-cyan-950/80 to-black/90
            backdrop-blur-2xl shadow-2xl shadow-cyan-600/60
            text-center overflow-hidden
          "
        >
          {/* Rotating subtle glow ring */}
          <motion.div
            className="absolute inset-0 bg-gradient-conic from-cyan-400/20 via-teal-500/10 to-transparent pointer-events-none"
            animate={{ rotate: 360 }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          />

          <div className="relative z-10">
            {/* Crown with cyan glow */}
            <motion.div
              initial={{ scale: 0.5, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 180, delay: 0.2 }}
              className="mb-8"
            >
              <Crown className="w-32 h-32 sm:w-40 sm:h-40 mx-auto text-cyan-300 drop-shadow-[0_0_60px_rgba(6,182,212,0.9)]" />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <Sparkles className="w-20 h-20 text-cyan-200/50" />
              </motion.div>
            </motion.div>

            <motion.h1
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="
                text-5xl sm:text-6xl md:text-7xl font-black tracking-tight mb-4
                bg-clip-text text-transparent
                bg-gradient-to-r from-cyan-200 via-cyan-400 to-teal-300
                drop-shadow-lg
              "
              style={{ textShadow: "0 0 50px rgba(6, 182, 212, 0.8)" }}
            >
              VICTORY!
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-2xl sm:text-3xl md:text-4xl font-bold text-cyan-100/90 mb-10"
            >
              Congratulations, {me?.username || "Tycoon"}!
            </motion.p>

            {/* Rewards Card - Clean cyan style */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="mb-12 p-8 bg-black/60 rounded-3xl border border-cyan-500/40 shadow-xl shadow-cyan-900/30"
            >
              <div className="flex items-center justify-center gap-6 mb-4">
                <Coins className="w-14 h-14 text-cyan-400 drop-shadow-[0_0_30px_rgba(6,182,212,0.8)]" />
                <div className="text-left">
                  <p className="text-xl font-bold text-cyan-200">Victory Rewards</p>
                  <p className="text-5xl font-black text-cyan-100 mt-2">
                    +1 TYC
                  </p>
                </div>
              </div>
              <p className="text-cyan-200/80 text-lg mt-4">
                Stake refunded • Empire secured • Legend earned
              </p>
            </motion.div>

            {/* Error Message */}
            <AnimatePresence>
              {claimError && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="mb-8 p-6 bg-red-900/50 border border-red-500/60 rounded-2xl flex items-start gap-4 text-red-100"
                >
                  <AlertCircle className="w-8 h-8 flex-shrink-0 mt-1" />
                  <div className="text-left">
                    <p className="font-bold text-xl">Claim Failed</p>
                    <p className="text-base mt-1">{claimError}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Claim Button - Cyan theme */}
            <motion.button
              whileHover={{ scale: 1.08, y: -5 }}
              whileTap={{ scale: 0.95 }}
              disabled={claiming}
              onClick={handleClaimClick}
              className={`
                relative px-14 py-7 md:px-20 md:py-9 text-2xl md:text-3xl font-black
                rounded-3xl shadow-2xl overflow-hidden
                border-4 border-cyan-400/60
                transition-all duration-400
                disabled:opacity-50 disabled:cursor-wait
                ${claiming
                  ? "bg-cyan-900/50 text-cyan-300"
                  : "bg-gradient-to-r from-cyan-600 via-cyan-500 to-teal-600 text-white hover:from-cyan-500 hover:via-cyan-400 hover:to-teal-500"
                }
              `}
            >
              <span className="relative z-10 drop-shadow-lg">
                {claiming ? "Claiming Rewards..." : "Claim Your Victory"}
              </span>
              <motion.div
                className="absolute inset-0 bg-white/20"
                initial={{ x: "-100%" }}
                whileHover={{ x: "100%" }}
                transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 1 }}
              />
            </motion.button>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="mt-12 text-lg text-cyan-300/70 font-light"
            >
              Thank you for playing{" "}
              <span className="font-bold text-cyan-200">Tycoon</span> • You are a legend.
            </motion.p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};