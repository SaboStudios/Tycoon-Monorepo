import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Property, GameProperty } from "@/types/game";
import { PropertyCard } from "./property-card";

interface MyEmpireProps {
  showEmpire: boolean;
  toggleEmpire: () => void;
  my_properties: Property[];
  properties: Property[];
  game_properties: GameProperty[];
  isNext: boolean;
  setSelectedProperty: (p: Property | null) => void;
}

export const MyEmpire: React.FC<MyEmpireProps> = ({
  showEmpire,
  toggleEmpire,
  my_properties,
  properties,
  game_properties,
  isNext,
  setSelectedProperty,
}) => {
  return (
    <div className="border-t-4 border-purple-600 pt-3">
      <button
        onClick={toggleEmpire}
        className="w-full text-lg font-bold text-purple-300 flex justify-between items-center"
      >
        <span>MY EMPIRE</span>
        <motion.span animate={{ rotate: showEmpire ? 180 : 0 }} className="text-2xl text-cyan-400">
          ▼
        </motion.span>
      </button>

      <AnimatePresence>
        {showEmpire && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden mt-2 grid grid-cols-2 gap-2"
          >
            {my_properties.map((prop, i) => (
              <motion.div
                key={prop.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <PropertyCard
                  prop={prop}
                  properties={properties}
                  game_properties={game_properties}
                  onClick={() => isNext && setSelectedProperty(prop)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};