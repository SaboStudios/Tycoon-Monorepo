import React from "react";
import { motion } from "framer-motion";
import { Property } from "@/types/game";

interface PropertyActionModalProps {
  property: Property | null;
  onClose: () => void;
  onDevelop: (id: number) => void;
  onDowngrade: (id: number) => void;
  onMortgage: (id: number) => void;
  onUnmortgage: (id: number) => void;
}

export const PropertyActionModal: React.FC<PropertyActionModalProps> = ({
  property,
  onClose,
  onDevelop,
  onDowngrade,
  onMortgage,
  onUnmortgage,
}) => {
  if (!property) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-gradient-to-br from-purple-900 via-black to-cyan-900 rounded-2xl border-4 border-cyan-400 shadow-2xl shadow-cyan-500/50 p-8 max-w-sm w-full"
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-pink-500/10 to-cyan-400/10 rounded-2xl" />
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-3xl text-red-400 hover:text-red-300 transition"
        >
          X
        </button>
        <h3 className="text-3xl font-bold text-cyan-300 text-center mb-6 relative z-10">{property.name}</h3>
        {property.cost_of_house != null && property.cost_of_house > 0 && (
          <p className="text-center text-emerald-300 font-semibold mb-4 relative z-10">Cost per house: ${property.cost_of_house}</p>
        )}
        <div className="grid grid-cols-2 gap-4 relative z-10">
          <button onClick={() => { onDevelop(property.id); onClose(); }} className="py-4 bg-gradient-to-r from-green-600 to-emerald-700 rounded-xl font-bold text-white shadow-lg hover:shadow-green-500/50">BUILD</button>
          <button onClick={() => { onDowngrade(property.id); onClose(); }} className="py-4 bg-gradient-to-r from-orange-600 to-red-700 rounded-xl font-bold text-white shadow-lg hover:shadow-orange-500/50">SELL</button>
          <button onClick={() => { onMortgage(property.id); onClose(); }} className="py-4 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl font-bold text-white shadow-lg hover:shadow-blue-500/50">MORTGAGE</button>
          <button onClick={() => { onUnmortgage(property.id); onClose(); }} className="py-4 bg-gradient-to-r from-purple-600 to-pink-700 rounded-xl font-bold text-white shadow-lg hover:shadow-purple-500/50">REDEEM</button>
        </div>
      </motion.div>
    </motion.div>
  );
};