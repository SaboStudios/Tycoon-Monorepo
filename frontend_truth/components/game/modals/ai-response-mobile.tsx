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

  const offeredProps = properties
    .filter((p: any) => popup.trade?.offer_properties?.includes(p.id))
    .map((p: any) => p.name);

  const requestedProps = properties
    .filter((p: any) => popup.trade?.requested_properties?.includes(p.id))
    .map((p: any) => p.name);

  const hasOfferedProps = offeredProps.length > 0;
  const hasOfferedCash = popup.trade?.offer_amount > 0;
  const hasRequestedProps = requestedProps.length > 0;
  const hasRequestedCash = popup.trade?.requested_amount > 0;

  const isAccepted = popup.decision === "accepted";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-end justify-center z-[9999]"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
          className="
            relative w-full max-w-lg 
            bg-gradient-to-b from-indigo-950 via-purple-950 to-black 
            rounded-t-3xl border-t-4 border-x-4 border-cyan-500/70
            shadow-2xl shadow-cyan-900/50 overflow-hidden
          "
        >
          {/* Drag handle */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-14 h-1.5 bg-cyan-400/60 rounded-full" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-3xl text-red-400 hover:text-red-300 transition-colors z-10"
            aria-label="Close"
          >
            ×
          </button>

          <div className="pt-16 pb-28 px-6 sm:px-8 md:px-10">
            <h3 className="text-3xl sm:text-4xl font-black text-cyan-300 text-center mb-8 tracking-tight drop-shadow-lg">
              AI Decision
            </h3>

            <div className="bg-black/50 rounded-2xl py-6 px-6 border border-cyan-500/40 mb-8 text-center">
              <p className="text-lg text-cyan-200/90 mb-3">Favorability rating:</p>
              <div
                className={`text-5xl sm:text-6xl font-black drop-shadow-2xl ${
                  popup.favorability >= 0 ? "text-emerald-400" : "text-rose-500"
                }`}
              >
                {popup.favorability >= 0 ? "+" : ""}
                {popup.favorability}%
              </div>
            </div>

            <div className="text-center mb-10">
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className={`text-4xl sm:text-5xl font-black mb-5 drop-shadow-lg ${
                  isAccepted ? "text-emerald-400" : "text-rose-500"
                }`}
              >
                {isAccepted ? "ACCEPTED ✅" : "DECLINED ❌"}
              </motion.div>

              <p className="text-xl sm:text-2xl italic text-gray-200/90 leading-relaxed px-2">
                "{popup.remark}"
              </p>
            </div>

            <div className="space-y-6">
              {/* Offered section - only shown if something was offered */}
              {(hasOfferedProps || hasOfferedCash) && (
                <div className="bg-gradient-to-r from-emerald-950/70 to-teal-950/70 rounded-2xl p-5 border border-emerald-500/40">
                  <p className="font-bold text-emerald-300 text-xl mb-3">You Offered:</p>
                  <p className="text-base text-white/90 break-words">
                    {hasOfferedProps && offeredProps.join(", ")}
                    {hasOfferedProps && hasOfferedCash && " + "}
                    {hasOfferedCash && <span className="text-emerald-300 font-semibold">${popup.trade.offer_amount}</span>}
                  </p>
                </div>
              )}

              {/* Requested section - only shown if something was requested */}
              {(hasRequestedProps || hasRequestedCash) && (
                <div className="bg-gradient-to-r from-rose-950/70 to-pink-950/70 rounded-2xl p-5 border border-rose-500/40">
                  <p className="font-bold text-rose-300 text-xl mb-3">You Requested:</p>
                  <p className="text-base text-white/90 break-words">
                    {hasRequestedProps && requestedProps.join(", ")}
                    {hasRequestedProps && hasRequestedCash && " + "}
                    {hasRequestedCash && <span className="text-rose-300 font-semibold">${popup.trade.requested_amount}</span>}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/95 to-transparent pt-12 pb-6 px-6">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onClose}
              className="
                w-full py-5 
                bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600
                hover:from-cyan-500 hover:via-blue-500 hover:to-indigo-500
                rounded-2xl font-black text-white text-xl shadow-xl shadow-cyan-900/50
                transition-all duration-300 border border-cyan-400/40
              "
            >
              GOT IT
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};