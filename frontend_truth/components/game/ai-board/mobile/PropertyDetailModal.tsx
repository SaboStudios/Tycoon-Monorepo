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
  onBuild: (propertyId: number) => void;
  onSellBuilding: (propertyId: number) => void;
  onMortgageToggle: (propertyId: number, isMortgaged: boolean) => void;
  onSellToBank: (propertyId: number) => void;
}

export default function PropertyDetailModal({
  property,
  gameProperty,
  players,
  me,
  isMyTurn,
  getCurrentRent,
  onClose,
  onBuild,
  onSellBuilding,
  onMortgageToggle,
  onSellToBank,
}: PropertyDetailModalProps) {
  if (!property) return null;

  const isOwner =
    gameProperty?.address?.toLowerCase() === me?.address?.toLowerCase();
  const canManage = isOwner && isMyTurn && gameProperty;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-900 rounded-2xl shadow-2xl border border-cyan-500/50 max-w-sm w-full overflow-hidden"
        >
          <div
            className={`h-20 ${PROPERTY_COLOR_CLASS[property.color || ""] ?? "bg-gray-600"}`}
          />
          <div className="p-6">
            <h2 className="text-2xl font-bold text-center mb-4">{property.name}</h2>
            <p className="text-center text-gray-300 mb-6">
              Price: ${property.price}
            </p>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span>Current Rent:</span>
                <span className="font-bold text-yellow-400">
                  ${getCurrentRent(property, gameProperty)}
                </span>
              </div>
              {property.cost_of_house != null && property.cost_of_house > 0 && (
                <div className="flex justify-between">
                  <span>Cost per house:</span>
                  <span className="font-bold text-emerald-400">
                    ${property.cost_of_house}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Owner:</span>
                <span className="font-medium">
                  {gameProperty?.address
                    ? players.find(
                        (p) =>
                          p.address?.toLowerCase() ===
                          gameProperty.address?.toLowerCase()
                      )?.username || "Player"
                    : "Bank"}
                </span>
              </div>
              {gameProperty?.development != null &&
                gameProperty.development > 0 && (
                  <div className="flex justify-between">
                    <span>Buildings:</span>
                    <span>
                      {gameProperty.development === 5
                        ? "Hotel"
                        : `${gameProperty.development} House(s)`}
                    </span>
                  </div>
                )}
              {gameProperty?.mortgaged && (
                <div className="text-red-400 font-bold text-center mt-3">
                  MORTGAGED
                </div>
              )}
            </div>

            {canManage && (
              <div className="grid grid-cols-2 gap-4 mt-8">
                <button
                  onClick={() => onBuild(gameProperty.property_id)}
                  disabled={gameProperty.development === 5}
                  className="py-3 bg-green-600 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-500 transition"
                >
                  {gameProperty.development === 4
                    ? "Build Hotel"
                    : "Build House"}
                </button>
                <button
                  onClick={() => onSellBuilding(gameProperty.property_id)}
                  disabled={
                    !gameProperty.development || gameProperty.development === 0
                  }
                  className="py-3 bg-orange-600 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-orange-500 transition"
                >
                  Sell House/Hotel
                </button>
                <button
                  onClick={() =>
                    onMortgageToggle(
                      gameProperty.property_id,
                      !!gameProperty.mortgaged
                    )
                  }
                  className="py-3 bg-red-600 rounded-xl font-bold hover:bg-red-500 transition"
                >
                  {gameProperty.mortgaged ? "Redeem" : "Mortgage"}
                </button>
                <button
                  onClick={() => onSellToBank(gameProperty.property_id)}
                  disabled={(gameProperty.development ?? 0) > 0}
                  className="py-3 bg-purple-600 rounded-xl font-bold disabled:opacity-50 hover:bg-purple-500 transition"
                >
                  Sell Property
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full mt-6 py-3 bg-gray-700 rounded-xl font-bold hover:bg-gray-600 transition"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
