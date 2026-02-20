import React from "react";
import { motion } from "framer-motion";
import { Property, GameProperty } from "@/types/game";

interface PropertyCardProps {
  prop: Property;
  properties: Property[];
  game_properties: GameProperty[];
  onClick?: () => void;
}

const rentPrice = (id: number, properties: Property[], game_properties: GameProperty[]) => {
  const p = properties.find((x) => x.id === id);
  if (!p) return 0;
  const dev = game_properties.find((gp) => gp.property_id === id)?.development ?? 0;
  const rents = [
    p.rent_site_only,
    p.rent_one_house,
    p.rent_two_houses,
    p.rent_three_houses,
    p.rent_four_houses,
    p.rent_hotel,
  ];
  return rents[dev] ?? 0;
};

const isMortgaged = (id: number, game_properties: GameProperty[]) =>
  game_properties.find((gp) => gp.property_id === id)?.mortgaged ?? false;

export const PropertyCard: React.FC<PropertyCardProps> = ({
  prop,
  properties,
  game_properties,
  onClick,
}) => {
  const rent = rentPrice(prop.id, properties, game_properties);
  return (
    <motion.div
      whileHover={{ scale: onClick ? 1.05 : 1 }}
      onClick={onClick}
      className="bg-black/60 border-2 border-cyan-600 rounded-lg p-2 shadow-md"
    >
      {prop.color && <div className="h-2 rounded" style={{ backgroundColor: prop.color }} />}
      <div className="mt-1 text-xs font-bold text-cyan-200 truncate">{prop.name}</div>
      {rent > 0 && (
        <div className="text-xxs text-green-400">Rent: ${rent}</div>
      )}
      {isMortgaged(prop.id, game_properties) && (
        <div className="text-red-500 text-xxs mt-1 font-bold animate-pulse">MORTGAGED</div>
      )}
    </motion.div>
  );
};