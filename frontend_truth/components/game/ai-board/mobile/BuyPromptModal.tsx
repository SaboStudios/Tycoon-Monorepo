"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Property } from "@/types/game";

interface BuyPromptModalProps {
  visible: boolean;
  property: Property | null;
  onBuy: () => void;
  onSkip: () => void;
}

export default function BuyPromptModal({
  visible,
  property,
  onBuy,
  onSkip,
}: BuyPromptModalProps) {
  if (!visible || !property) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 bg-gray-900/95 backdrop-blur-lg p-6 rounded-t-3xl shadow-2xl z-[100] border-t border-cyan-500/30"
      >
        <div className="max-w-md mx-auto text-center">
          <h3 className="text-2xl font-bold text-white mb-2">
            Buy {property.name}?
          </h3>
          <p className="text-lg text-gray-300 mb-6">
            Price: ${property.price?.toLocaleString()}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={onBuy}
              className="py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-xl rounded-2xl shadow-lg hover:scale-105 transition"
            >
              Buy
            </button>
            <button
              onClick={onSkip}
              className="py-4 bg-gray-700 text-white font-bold text-xl rounded-2xl shadow-lg hover:scale-105 transition"
            >
              Skip
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
