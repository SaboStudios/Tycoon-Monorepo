import React from "react";
import { Property } from "@/types/game";
import { rentPrice, isMortgaged } from "@/utils/gameUtils";
import { motion } from "framer-motion";

interface PropertyCardProps {
  prop: Property;
  game_properties: any[];
  properties: Property[];
  onClick?: () => void;
}

export const PropertyCard: React.FC<PropertyCardProps> = ({
  prop,
  game_properties,
  properties,
  onClick,
}) => {
  const rent = rentPrice(prop.id, properties, game_properties);
  return (
    <motion.div
      whileHover={{ scale: onClick ? 1.05 : 1 }}
      onClick={onClick}
      className={`bg-black/60 border-2 border-cyan-600 rounded-lg p-3 ${onClick ? "cursor-pointer" : ""} shadow-md`}
    >
      {prop.color && (
        <div className="h-3 rounded" style={{ backgroundColor: prop.color }} />
      )}
      <div className="mt-2 text-sm font-bold text-cyan-200 truncate">{prop.name}</div>
      {rent > 0 && (
        <div className="text-xs text-green-400">Rent: ${rent}</div>
      )}
      {isMortgaged(prop.id, game_properties) && (
        <div className="text-red-500 text-xs mt-1 font-bold animate-pulse">MORTGAGED</div>
      )}
    </motion.div>
  );
};