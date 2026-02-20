"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Skull, Coins, ArrowRight, Home } from "lucide-react";

interface BankruptcyModalProps {
  isOpen: boolean;
  onConfirmBankruptcy: () => void;
  onReturnHome: () => void;
  confirming?: boolean;
  tokensAwarded?: number; // e.g., 0.5 for consolation
}

export const BankruptcyModal: React.FC<BankruptcyModalProps> = ({
  isOpen,
  onConfirmBankruptcy,
  onReturnHome,
  confirming = false,
  tokensAwarded = 0,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/95 backdrop-blur-lg flex items-center justify-center z-[9999] p-4"
      >
        {/* Dark red pulsing background glow */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-red-950 via-black to-purple-950"
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          initial={{ y: 120, scale: 0.85, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 80, scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 16 }}
          className="
            relative w-full max-w-md sm:max-w-lg
            p-10 sm:p-12
            rounded-3xl
            border-4 border-red-600/70
            bg-gradient-to-b from-red-950/95 via-black/90 to-black/95
            backdrop-blur-2xl shadow-2xl shadow-red-900/70
            text-center overflow-hidden
          "
        >
          {/* Rotating danger glow */}
          <motion.div
            className="absolute inset-0 bg-gradient-radial from-red-600/20 via-transparent to-transparent pointer-events-none"
            animate={{ rotate: -360 }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          />

          <div className="relative z-10">
            {/* Icon */}
            <motion.div
              initial={{ scale: 0, rotate: 180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 140, delay: 0.2 }}
              className="mb-8"
            >
              <Skull className="w-32 h-32 mx-auto text-red-400 drop-shadow-[0_0_50px_rgba(239,68,68,0.9)]" />
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <AlertTriangle className="w-20 h-20 text-red-300/60" />
              </motion.div>
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ y: -40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="
                text-5xl sm:text-6xl font-black tracking-tight mb-4
                bg-clip-text text-transparent bg-gradient-to-r from-red-300 via-orange-400 to-red-500
                drop-shadow-2xl
              "
              style={{ textShadow: "0 0 40px rgba(239,68,68,0.8)" }}
            >
              BANKRUPT!
            </motion.h1>

            {/* Message */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-xl sm:text-2xl text-red-200/90 mb-6 leading-relaxed"
            >
              You've run out of money and can no longer continue.
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-lg text-red-100/80 mb-10 max-w-sm mx-auto"
            >
              All your properties have been returned to the bank or transferred to your creditor.
            </motion.p>

            {/* Consolation prize */}
            {tokensAwarded > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                className="mb-10 p-6 bg-black/60 rounded-2xl border border-orange-600/40 inline-block"
              >
                <div className="flex items-center justify-center gap-4">
                  <Coins className="w-10 h-10 text-orange-400 drop-shadow-lg" />
                  <div className="text-left">
                    <p className="text-lg font-bold text-orange-300">Consolation Prize</p>
                    <p className="text-2xl font-black text-orange-200 mt-1">
                      +{tokensAwarded} Tokens
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-5 justify-center mt-12">
              {/* Declare Bankruptcy (final confirmation) */}
              <motion.button
                whileHover={{ scale: 1.07 }}
                whileTap={{ scale: 0.96 }}
                disabled={confirming}
                onClick={onConfirmBankruptcy}
                className="
                  px-10 py-5 text-xl font-bold rounded-2xl
                  bg-gradient-to-r from-red-700 to-red-800
                  hover:from-red-600 hover:to-red-700
                  border-2 border-red-400/50
                  shadow-2xl shadow-red-900/60
                  disabled:opacity-70 disabled:cursor-wait
                  flex items-center justify-center gap-3
                "
              >
                <AlertTriangle className="w-7 h-7" />
                <span>{confirming ? "Declaring..." : "Declare Bankruptcy"}</span>
              </motion.button>

              {/* Or just go home early */}
              <motion.button
                whileHover={{ scale: 1.07 }}
                whileTap={{ scale: 0.96 }}
                onClick={onReturnHome}
                className="
                  px-10 py-5 text-xl font-bold rounded-2xl
                  bg-gradient-to-r from-gray-700 to-gray-800
                  hover:from-gray-600 hover:to-gray-700
                  border-2 border-gray-500/50
                  shadow-2xl shadow-black/60
                  flex items-center justify-center gap-3
                "
              >
                <Home className="w-7 h-7" />
                <span>Return to Lobby</span>
              </motion.button>
            </div>

            <p className="mt-12 text-base text-red-300/60 font-light">
              Better luck in your next game!
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};