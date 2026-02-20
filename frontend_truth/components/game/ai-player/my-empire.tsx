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
        onClick={toggleEmpire}
        className="w-full text-xl font-bold text-purple-300 flex justify-between items-center"
      >
        <span>MY EMPIRE</span>
        <motion.span
          animate={{ rotate: showEmpire ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className="text-3xl text-cyan-400"
        >
          ▼
        </motion.span>
      </button>

      <AnimatePresence>
        {showEmpire && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden mt-3 grid grid-cols-2 gap-3"
          >
            {my_properties.length > 0 ? (
              my_properties.map((prop, index) => (
                <motion.div
                  key={prop.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
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
              <div className="text-center text-sm font-medium text-gray-500 py-3 col-span-2">
                No properties yet..
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};