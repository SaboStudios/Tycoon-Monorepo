import { GameProperty, Property } from "@/types/game";
import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

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

export default function TradeModal({
  open,
  title,
  onClose,
  onSubmit,
  my_properties,
  properties,
  game_properties,
  offerProperties,
  requestProperties,
  setOfferProperties,
  setRequestProperties,
  offerCash,
  requestCash,
  setOfferCash,
  setRequestCash,
  toggleSelect,
  targetPlayerAddress,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  my_properties: Property[];
  properties: Property[];
  game_properties: GameProperty[];
  offerProperties: number[];
  requestProperties: number[];
  setOfferProperties: React.Dispatch<React.SetStateAction<number[]>>;
  setRequestProperties: React.Dispatch<React.SetStateAction<number[]>>;
  offerCash: number;
  requestCash: number;
  setOfferCash: React.Dispatch<React.SetStateAction<number>>;
  setRequestCash: React.Dispatch<React.SetStateAction<number>>;
  toggleSelect: (id: number, arr: number[], setter: React.Dispatch<React.SetStateAction<number[]>>) => void;
  targetPlayerAddress?: string | null;
}) {
  if (!open) return null;

  const targetProps = useMemo(() => {
    if (!targetPlayerAddress) return [];
    return properties.filter((p) =>
      game_properties.some((gp) => gp.property_id === p.id && gp.address === targetPlayerAddress)
    );
  }, [properties, game_properties, targetPlayerAddress]);

  const totalOfferValue = useMemo(() => {
    const propsValue = offerProperties.reduce((sum, id) => {
      const prop = my_properties.find(p => p.id === id);
      return sum + (prop?.price || 0);
    }, 0);
    return propsValue + offerCash;
  }, [offerProperties, offerCash, my_properties]);

  const totalRequestValue = useMemo(() => {
    const propsValue = requestProperties.reduce((sum, id) => {
      const prop = targetProps.find(p => p.id === id);
      return sum + (prop?.price || 0);
    }, 0);
    return propsValue + requestCash;
  }, [requestProperties, requestCash, targetProps]);

  const PropertyCard = ({ prop, isSelected, onClick }: { prop: Property; isSelected: boolean; onClick: () => void }) => {
    const colorClass = PROPERTY_COLOR_CLASS[prop.color || ""] || "bg-gray-600";
    
    return (
      <motion.div
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        className={`relative p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col gap-2 overflow-hidden ${
          isSelected
            ? "border-green-400 bg-gradient-to-br from-green-900/60 to-emerald-900/40 shadow-xl shadow-green-500/50 ring-2 ring-green-400/50"
            : "border-gray-600 bg-gray-800/40 hover:border-gray-400 hover:bg-gray-700/40"
        }`}
      >
        {/* Animated glow effect when selected */}
        {isSelected && (
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-green-400/20 to-transparent"
          />
        )}
        
        {/* Color bar */}
        <div className={`h-8 rounded-t-lg -m-3 -mt-3 mb-2 ${colorClass} relative overflow-hidden`}>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
        </div>
        
        <div className={`text-xs font-bold text-center leading-tight relative z-10 ${
          isSelected ? "text-green-200" : "text-gray-300"
        }`}>
          {prop.name}
        </div>
        
        {isSelected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-1 right-1 w-5 h-5 bg-green-400 rounded-full flex items-center justify-center"
          >
            <span className="text-xs">✓</span>
          </motion.div>
        )}
      </motion.div>
    );
  };

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
          className="relative bg-gradient-to-br from-gray-900 via-purple-900/30 to-gray-900 rounded-3xl shadow-2xl border-2 border-cyan-500/50 max-w-5xl w-full max-h-[90vh] overflow-hidden"
        >
          {/* Animated background effects */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-pink-500/10 animate-pulse" />
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500" />
          
          {/* Close button */}
          <motion.button
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="absolute top-6 right-6 z-20 w-10 h-10 rounded-full bg-red-600/80 hover:bg-red-500 flex items-center justify-center text-white font-bold text-xl shadow-lg transition"
          >
            ✕
          </motion.button>

          {/* Header */}
          <div className="relative z-10 p-8 pb-6">
            <motion.h2
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl font-bold text-center bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-300 bg-clip-text text-transparent mb-2"
            >
              {title}
            </motion.h2>
            <div className="flex items-center justify-center gap-4 mt-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-cyan-500" />
              <span className="text-cyan-400 text-sm font-semibold">💰 NEGOTIATE DEAL</span>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent via-cyan-500/50 to-cyan-500" />
            </div>
          </div>

          {/* Trade content */}
          <div className="relative z-10 px-8 pb-8 overflow-y-auto max-h-[calc(90vh-200px)]">
            <div className="grid md:grid-cols-2 gap-8">
              {/* YOU GIVE Section */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-to-br from-green-900/30 to-emerald-900/20 rounded-2xl p-6 border-2 border-green-500/30"
              >
                <div className="flex items-center justify-center gap-3 mb-6">
                  <span className="text-3xl">📤</span>
                  <h3 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                    YOU GIVE
                  </h3>
                </div>
                
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {my_properties.length > 0 ? (
                    my_properties.map((p) => (
                      <PropertyCard
                        key={p.id}
                        prop={p}
                        isSelected={offerProperties.includes(p.id)}
                        onClick={() => toggleSelect(p.id, offerProperties, setOfferProperties)}
                      />
                    ))
                  ) : (
                    <div className="col-span-3 text-center text-gray-500 py-8">
                      No properties to offer
                    </div>
                  )}
                </div>
                
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-green-400 text-2xl">💵</div>
                  <input
                    type="number"
                    placeholder="Add Cash"
                    value={offerCash || ""}
                    onChange={(e) => setOfferCash(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full pl-12 pr-4 py-4 bg-black/60 border-2 border-green-500/50 rounded-xl text-green-400 font-bold text-xl text-center placeholder-green-700/50 focus:border-green-400 focus:ring-2 focus:ring-green-400/30 transition"
                  />
                </div>
                
                {totalOfferValue > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-4 text-center text-green-300 font-bold text-lg"
                  >
                    Total: ${totalOfferValue.toLocaleString()}
                  </motion.div>
                )}
              </motion.div>

              {/* YOU GET Section */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-red-900/30 to-pink-900/20 rounded-2xl p-6 border-2 border-red-500/30"
              >
                <div className="flex items-center justify-center gap-3 mb-6">
                  <span className="text-3xl">📥</span>
                  <h3 className="text-3xl font-bold bg-gradient-to-r from-red-400 to-pink-400 bg-clip-text text-transparent">
                    YOU GET
                  </h3>
                </div>
                
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {targetProps.length > 0 ? (
                    targetProps.map((p) => (
                      <PropertyCard
                        key={p.id}
                        prop={p}
                        isSelected={requestProperties.includes(p.id)}
                        onClick={() => toggleSelect(p.id, requestProperties, setRequestProperties)}
                      />
                    ))
                  ) : (
                    <div className="col-span-3 text-center text-gray-500 py-8">
                      No properties available
                    </div>
                  )}
                </div>
                
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-red-400 text-2xl">💵</div>
                  <input
                    type="number"
                    placeholder="Add Cash"
                    value={requestCash || ""}
                    onChange={(e) => setRequestCash(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full pl-12 pr-4 py-4 bg-black/60 border-2 border-red-500/50 rounded-xl text-red-400 font-bold text-xl text-center placeholder-red-700/50 focus:border-red-400 focus:ring-2 focus:ring-red-400/30 transition"
                  />
                </div>
                
                {totalRequestValue > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-4 text-center text-red-300 font-bold text-lg"
                  >
                    Total: ${totalRequestValue.toLocaleString()}
                  </motion.div>
                )}
              </motion.div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-center gap-6 mt-8">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="px-10 py-4 bg-gradient-to-r from-gray-700 to-gray-800 rounded-xl font-bold text-xl text-gray-200 hover:from-gray-600 hover:to-gray-700 transition shadow-lg border border-gray-600"
              >
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onSubmit}
                disabled={totalOfferValue === 0 && totalRequestValue === 0}
                className="px-12 py-4 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-xl font-bold text-xl text-white shadow-xl hover:shadow-cyan-500/50 transition disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  ✉️ SEND DEAL
                </span>
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: "100%" }}
                  transition={{ duration: 0.5 }}
                />
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}