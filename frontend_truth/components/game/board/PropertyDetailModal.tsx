"use client";

import { motion, AnimatePresence } from "framer-motion";
import { GameProperty, Player, Property } from "@/types/game";

const PROPERTY_COLOR_CLASS: Record<string, string> = {
  brown: "bg-amber-800",
  lightblue: "bg-sky-400",
  pink: "bg-pink-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  yellow: "bg-yellow-400",
  green: "bg-green-500",
  darkblue: "bg-blue-800",
  gray: "bg-gray-600",
};

interface PropertyDetailModalProps {
  property: Property | null;
  gameProperty: GameProperty | undefined;
  players: Player[];
  me: Player | null;
  isMyTurn: boolean;
  getCurrentRent: (prop: Property, gp: GameProperty | undefined) => number;
  onClose: () => void;
  onDevelop: (id: number) => void;
  onDowngrade: (id: number) => void;
  onMortgage: (id: number) => void;
  onUnmortgage: (id: number) => void;
}

export default function PropertyDetailModal({
  property,
  gameProperty,
  players,
  isMyTurn,
  getCurrentRent,
  onClose,
  onDevelop,
  onDowngrade,
  onMortgage,
  onUnmortgage,
  me,
}: PropertyDetailModalProps) {
  if (!property) return null;

  const isOwnedByMe =
    gameProperty?.address?.toLowerCase() === me?.address?.toLowerCase();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl border-2 border-cyan-500/50 max-w-md w-full overflow-hidden relative"
        >
          {/* Animated background glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-pink-500/10 animate-pulse" />
          
          {/* Color bar */}
          <div className={`h-24 ${PROPERTY_COLOR_CLASS[property.color || ""] ?? "bg-gray-600"} relative overflow-hidden`}>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          </div>
          
          <div className="p-6 relative z-10">
            <motion.h2 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-cyan-300 to-purple-300 bg-clip-text text-transparent"
            >
              {property.name}
            </motion.h2>
            
            <p className="text-center text-gray-300 mb-6 text-lg">
              Price: <span className="font-bold text-yellow-400">${property.price}</span>
            </p>
            
            <div className="space-y-4 text-sm bg-black/30 rounded-xl p-4 border border-cyan-500/20">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Current Rent:</span>
                <span className="font-bold text-yellow-400 text-lg">
                  ${getCurrentRent(property, gameProperty)}
                </span>
              </div>
              {property.cost_of_house != null && property.cost_of_house > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Cost per house:</span>
                  <span className="font-bold text-emerald-400">
                    ${property.cost_of_house}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Owner:</span>
                <span className="font-medium text-cyan-300">
                  {gameProperty?.address
                    ? players.find(
                        (p) =>
                          p.address?.toLowerCase() === gameProperty.address?.toLowerCase()
                      )?.username || "Player"
                    : "Bank"}
                </span>
              </div>
              
              {gameProperty?.development != null && gameProperty.development > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Buildings:</span>
                  <span className="font-medium text-green-400">
                    {gameProperty.development === 5
                      ? "🏨 Hotel"
                      : `🏠 ${gameProperty.development} House${gameProperty.development > 1 ? "s" : ""}`}
                  </span>
                </div>
              )}
              
              {gameProperty?.mortgaged && (
                <div className="text-center mt-3 py-2 bg-red-900/30 border border-red-500/50 rounded-lg">
                  <span className="text-red-400 font-bold text-lg">⚠️ MORTGAGED</span>
                </div>
              )}
            </div>
            
            {isOwnedByMe && isMyTurn && gameProperty && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="grid grid-cols-2 gap-3 mt-6"
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { onDevelop(property.id); onClose(); }}
                  disabled={gameProperty.development === 5}
                  className="py-3 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:from-green-500 hover:to-emerald-500 transition shadow-lg shadow-green-500/30"
                >
                  {gameProperty.development === 4 ? "🏨 Build Hotel" : "🏠 Build House"}
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { onDowngrade(property.id); onClose(); }}
                  disabled={!gameProperty.development || gameProperty.development === 0}
                  className="py-3 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:from-orange-500 hover:to-red-500 transition shadow-lg shadow-orange-500/30"
                >
                  💰 Sell Building
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { 
                    gameProperty.mortgaged ? onUnmortgage(property.id) : onMortgage(property.id);
                    onClose();
                  }}
                  className="py-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl font-bold hover:from-blue-500 hover:to-indigo-500 transition shadow-lg shadow-blue-500/30 col-span-2"
                >
                  {gameProperty.mortgaged ? "🔓 Redeem Mortgage" : "🔒 Mortgage Property"}
                </motion.button>
              </motion.div>
            )}
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onClose}
              className="w-full mt-4 py-3 bg-gradient-to-r from-gray-700 to-gray-800 rounded-xl font-bold hover:from-gray-600 hover:to-gray-700 transition border border-gray-600"
            >
              Close
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
