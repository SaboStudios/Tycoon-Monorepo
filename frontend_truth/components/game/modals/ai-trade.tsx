import React from "react";
import { motion } from "framer-motion";
import { calculateFavorability } from "@/utils/gameUtils";

interface AiTradePopupProps {
  trade: any;
  properties: any[];
  onClose: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onCounter: () => void;
}

export const AiTradePopup: React.FC<AiTradePopupProps> = ({
  trade,
  properties,
  onClose,
  onAccept,
  onDecline,
  onCounter,
}) => {
  if (!trade) return null;

  const favorability = calculateFavorability(trade, properties);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.8, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-gradient-to-br from-cyan-900 via-purple-900 to-pink-900 rounded-3xl border-4 border-cyan-400 shadow-2xl shadow-cyan-600/60 overflow-hidden max-w-md w-full"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-3xl text-red-300 hover:text-red-200 transition z-20"
        >
          X
        </button>

        <div className="relative z-10 p-8">
          <h3 className="text-4xl font-bold text-cyan-300 text-center mb-6 drop-shadow-lg">
            🤖 AI Trade Offer!
          </h3>

          <div className="text-center mb-8 bg-black/50 backdrop-blur-md rounded-2xl py-6 px-8 border border-cyan-500/50">
            <p className="text-2xl text-white mb-2">This deal is</p>
            <span className={`text-5xl font-bold drop-shadow-2xl ${favorability >= 0 ? "text-green-400" : "text-red-400"}`}>
              {favorability >= 0 ? "+" : ""}{favorability}%
            </span>
            <p className="text-xl text-white mt-2">favorable for you</p>
            <p className="text-sm text-gray-300 mt-4">
              {favorability >= 30 ? "🟢 Amazing opportunity!" :
               favorability >= 0 ? "🟡 Decent deal" : "🔴 Think twice"}
            </p>
          </div>

          <div className="space-y-4 text-base mb-10">
            <div className="bg-gradient-to-r from-green-900/60 to-emerald-900/60 rounded-xl p-4 border border-green-500/50">
              <span className="font-bold text-green-300">AI Gives:</span>{" "}
              <span className="text-white">
                {properties.filter((p: any) => trade.offer_properties?.includes(p.id)).map((p: any) => p.name).join(", ") || "nothing"}{" "}
                {trade.offer_amount > 0 && `+ $${trade.offer_amount}`}
              </span>
            </div>
            <div className="bg-gradient-to-r from-red-900/60 to-pink-900/60 rounded-xl p-4 border border-red-500/50">
              <span className="font-bold text-red-300">AI Wants:</span>{" "}
              <span className="text-white">
                {properties.filter((p: any) => trade.requested_properties?.includes(p.id)).map((p: any) => p.name).join(", ") || "nothing"}{" "}
                {trade.requested_amount > 0 && `+ $${trade.requested_amount}`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <button onClick={() => { onAccept(); onClose(); }} className="py-4 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl font-bold text-white text-lg shadow-lg hover:shadow-green-500/60 transition">
              ACCEPT
            </button>
            <button onClick={() => { onDecline(); onClose(); }} className="py-4 bg-gradient-to-r from-red-600 to-pink-600 rounded-xl font-bold text-white text-lg shadow-lg hover:shadow-red-500/60 transition">
              DECLINE
            </button>
            <button onClick={() => { onCounter(); onClose(); }} className="py-4 bg-gradient-to-r from-yellow-600 to-orange-600 rounded-xl font-bold text-black text-lg shadow-lg hover:shadow-yellow-500/60 transition">
              COUNTER
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};