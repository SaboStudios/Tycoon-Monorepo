"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AiResponsePopupProps {
  popup: any | null;
  properties: any[];
  onClose: () => void;
}

export const AiResponsePopup: React.FC<AiResponsePopupProps> = ({ popup, properties, onClose }) => {
  if (!popup) return null;

  // Extract trade data safely
  const trade = popup.trade || {};
  const favorability = popup.favorability ?? 0;
  const decision = popup.decision;
  const remark = popup.remark || "No comment.";

  const offeredPropNames = properties
    .filter((p) => trade.offer_properties?.includes(p.id))
    .map((p) => p.name);

  const requestedPropNames = properties
    .filter((p) => trade.requested_properties?.includes(p.id))
    .map((p) => p.name);

  const hasOfferedProps = offeredPropNames.length > 0;
  const hasOfferedCash = trade.offer_amount > 0;
  const hasRequestedProps = requestedPropNames.length > 0;
  const hasRequestedCash = trade.requested_amount > 0;

  const isAccepted = decision === "accepted";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/85 backdrop-blur-lg flex items-center justify-center z-[9999] p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.85, y: 40 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.85, y: 40 }}
          transition={{ type: "spring", damping: 22, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="
            relative w-full max-w-md sm:max-w-lg
            bg-gradient-to-br from-indigo-950 via-purple-950 to-black
            rounded-3xl border-4 border-cyan-500/60
            shadow-2xl shadow-cyan-900/60 overflow-hidden
          "
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-4xl text-red-400 hover:text-red-300 transition-colors z-10"
            aria-label="Close"
          >
            ×
          </button>

          <div className="p-8 sm:p-10">
            {/* Header */}
            <h3 className="text-4xl sm:text-5xl font-black text-cyan-300 text-center mb-8 tracking-tight drop-shadow-lg">
              AI Response
            </h3>

            {/* Favorability */}
            <div className="bg-black/60 rounded-2xl py-6 px-8 border border-cyan-500/40 mb-8 text-center">
              <p className="text-xl text-cyan-200/90 mb-3">Favorability</p>
              <div
                className={`text-5xl sm:text-6xl font-black drop-shadow-2xl ${
                  favorability >= 0 ? "text-emerald-400" : "text-rose-500"
                }`}
              >
                {favorability >= 0 ? "+" : ""}
                {favorability}%
              </div>
            </div>

            {/* Decision + Remark */}
            <div className="text-center mb-10">
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.4 }}
                className={`text-4xl sm:text-5xl font-black mb-6 drop-shadow-lg ${
                  isAccepted ? "text-emerald-400" : "text-rose-500"
                }`}
              >
                {isAccepted ? "ACCEPTED ✓" : "DECLINED ✗"}
              </motion.div>

              <p className="text-xl sm:text-2xl italic text-gray-200/90 leading-relaxed max-w-prose mx-auto">
                "{remark}"
              </p>
            </div>

            {/* Trade summary - only show sections with content */}
            <div className="space-y-6">
              {(hasOfferedProps || hasOfferedCash) && (
                <div className="bg-gradient-to-r from-emerald-950/70 to-teal-950/70 rounded-2xl p-6 border border-emerald-500/40">
                  <p className="font-bold text-emerald-300 text-xl mb-3">You Offered:</p>
                  <p className="text-base text-white/95">
                    {hasOfferedProps && offeredPropNames.join(", ")}
                    {hasOfferedProps && hasOfferedCash && " + "}
                    {hasOfferedCash && <span className="font-semibold text-emerald-300">${trade.offer_amount}</span>}
                  </p>
                </div>
              )}

              {(hasRequestedProps || hasRequestedCash) && (
                <div className="bg-gradient-to-r from-rose-950/70 to-pink-950/70 rounded-2xl p-6 border border-rose-500/40">
                  <p className="font-bold text-rose-300 text-xl mb-3">You Requested:</p>
                  <p className="text-base text-white/95">
                    {hasRequestedProps && requestedPropNames.join(", ")}
                    {hasRequestedProps && hasRequestedCash && " + "}
                    {hasRequestedCash && <span className="font-semibold text-rose-300">${trade.requested_amount}</span>}
                  </p>
                </div>
              )}
            </div>

            {/* Action button */}
            <div className="mt-10 text-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                className="
                  px-12 py-5 sm:px-16 sm:py-6
                  bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600
                  hover:from-cyan-500 hover:via-blue-500 hover:to-indigo-500
                  rounded-2xl font-bold text-white text-xl sm:text-2xl
                  shadow-xl shadow-cyan-900/50 border border-cyan-400/40
                  transition-all duration-300
                "
              >
                GOT IT
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};