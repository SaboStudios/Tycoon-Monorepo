"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Trophy, Sparkles, HeartHandshake } from "lucide-react";
import { Player } from "@/types/game";

interface VictoryDefeatModalProps {
  winner: Player | null;
  me: Player | null;
  /** Loser's finishing position (1 = winner, 2 = 2nd, etc.). Shown when game ended by time. */
  myPosition?: number;
  /** Called when "Go home" is clicked. Can be async (e.g. finalize/claim). Then we redirect to /. */
  onGoHome?: () => void | Promise<void>;
}

/**
 * Shared victory/defeat modal for multiplayer (desktop and mobile).
 * Matches the mobile game-modals design: YOU WIN / Game over, Go home.
 */
const positionLabel = (pos: number) => {
  if (pos === 1) return "1st";
  if (pos === 2) return "2nd";
  if (pos === 3) return "3rd";
  return `${pos}th`;
};

export const VictoryDefeatModal: React.FC<VictoryDefeatModalProps> = ({
  winner,
  me,
  myPosition,
  onGoHome,
}) => {
  if (!winner) return null;

  const isWinner = winner.user_id === me?.user_id;

  const handleGoHome = async () => {
    await onGoHome?.();
    window.location.href = "/";
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[100] p-4 overflow-y-auto"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/90 via-violet-950/60 to-cyan-950/70" />

        {isWinner ? (
          <motion.div
            initial={{ scale: 0.88, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className="relative w-full max-w-md rounded-[2rem] overflow-hidden border-2 border-cyan-400/50 bg-gradient-to-b from-indigo-900/95 via-violet-900/90 to-slate-950/95 shadow-2xl shadow-cyan-900/30 text-center"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.18),transparent)]" />
            <div className="relative z-10 p-8 sm:p-10">
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                className="mb-6 relative"
              >
                <Crown className="w-20 h-20 sm:w-24 sm:h-24 mx-auto text-cyan-300 drop-shadow-[0_0_40px_rgba(34,211,238,0.7)]" />
                <motion.div
                  className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2"
                  animate={{ opacity: [0.4, 0.8, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Sparkles className="w-6 h-6 text-cyan-400/80" />
                </motion.div>
              </motion.div>
              <motion.h1
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-4xl sm:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-200 to-cyan-300 mb-2"
              >
                YOU WIN
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="text-lg text-slate-200 mb-2"
              >
                Congratulations — you&apos;re the Tycoon!
              </motion.p>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-cyan-200/90 text-base mb-6"
              >
                Well played — you earned this one.
              </motion.p>
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleGoHome}
                className="w-full py-4 px-6 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold text-lg shadow-lg shadow-cyan-900/40 border border-cyan-300/40 transition-all"
              >
                Go home
              </motion.button>
              <p className="text-sm text-slate-500 mt-6">Thanks for playing Tycoon!</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ scale: 0.88, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className="relative w-full max-w-md rounded-[2rem] overflow-hidden border-2 border-slate-500/50 bg-gradient-to-b from-slate-900/95 via-slate-800/90 to-black/95 shadow-2xl shadow-slate-900/50 text-center"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.12),transparent)]" />
            <div className="relative z-10 p-8 sm:p-10">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="mb-5"
              >
                <Trophy className="w-16 h-16 sm:w-20 sm:h-20 mx-auto text-amber-400/90" />
              </motion.div>
              <motion.h1
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="text-2xl sm:text-3xl font-bold text-slate-200 mb-1"
              >
                Game over
              </motion.h1>
              {typeof myPosition === "number" && myPosition > 1 && Number.isFinite(myPosition) && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-lg font-semibold text-cyan-300 mb-2"
                >
                  You finished {positionLabel(myPosition)}
                </motion.p>
              )}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="text-xl font-semibold text-white mb-4"
              >
                {winner.username} <span className="text-amber-400">wins</span>
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mb-6 flex flex-col items-center gap-3"
              >
                <HeartHandshake className="w-12 h-12 text-cyan-400/80" />
                <p className="text-slate-300">Better luck next time — you played well!</p>
              </motion.div>
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleGoHome}
                className="w-full py-4 px-6 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-lg shadow-lg shadow-cyan-900/40 border border-cyan-400/30 transition-all"
              >
                Go home
              </motion.button>
              <p className="text-sm text-slate-500 mt-6">Thanks for playing Tycoon!</p>
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
