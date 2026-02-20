import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Property } from "@/types/game";
import { PropertyCard } from "./property-card";

interface MyEmpireProps {
  showEmpire: boolean;
  toggleEmpire: () => void;
  my_properties: Property[];
  properties: Property[];
  game_properties: any[];
  setSelectedProperty: (prop: Property | null) => void;
}

export const MyEmpire: React.FC<MyEmpireProps> = ({
  showEmpire,
  toggleEmpire,
  my_properties,
  properties,
  game_properties,
  setSelectedProperty,
}) => {
  return (
    <div className="border-t-4 border-purple-600 pt-4">
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleEmpire();
        }}
        className="w-full text-xl font-bold text-purple-300 flex justify-between items-center hover:bg-white/5 px-3 py-4 rounded-lg transition-colors"
      >
        <span>MY EMPIRE{my_properties.length > 0 ? ` (${my_properties.length})` : ""}</span>
        <motion.span animate={{ rotate: showEmpire ? 180 : 0 }} className="text-3xl text-cyan-400">
          ▼
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {showEmpire && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.4 }, opacity: { duration: 0.25 } }}
            className="overflow-hidden mt-3"
          >
            {/* Give lots of vertical space – use viewport units */}
            <div className="max-h-[75vh] overflow-y-auto pr-3 scrollbar-thin scrollbar-thumb-purple-600/70 scrollbar-track-transparent/40">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pb-10 pt-2">
                {my_properties.length > 0 ? (
                  my_properties.map((prop, index) => (
                    <motion.div
                      key={prop.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                    >
                      <PropertyCard
                        prop={prop}
                        properties={properties}
                        game_properties={game_properties}
                        onClick={() => setSelectedProperty(prop)}
                      />
                    </motion.div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-12 text-gray-400">
                    No properties owned yet...
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};