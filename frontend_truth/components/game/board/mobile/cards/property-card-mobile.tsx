import React from "react";
import { Property } from "@/types/game";

type Position = "bottom" | "left" | "top" | "right";

interface PropertyCardMobileProps {
  square: Property & { position: Position };
  owner: string | null;
  mortgaged?: boolean;
  development?: number; // 0 = no houses, 1–4 = houses, 5 = hotel
  isCurrentPlayerOwner?: boolean; // optional highlight for owned properties
}

const PropertyCardMobile: React.FC<PropertyCardMobileProps> = ({
  square,
  owner,
  mortgaged = false,
  development = 0,
  isCurrentPlayerOwner = false,
}) => {
  const { name, price, rent_site_only, color, position, icon } = square;

  // Orientation-aware classes
  const orientationClasses: Record<Position, string> = {
    bottom: "border-t-8",
    left: "border-l-8 rotate-90 origin-center",
    top: "border-b-8",
    right: "border-r-8 -rotate-90 origin-center",
  };

  const pricePositionClasses: Record<Position, string> = {
    bottom: "bottom-1 right-1",
    left: "bottom-[38%] right-1 rotate-90 origin-right",
    top: "top-1 right-1",
    right: "top-[30%] left-1 -rotate-90 origin-left",
  };

  const rentPositionClasses: Record<Position, string> = {
    bottom: "bottom-1 left-1",
    left: "top-[38%] left-1 rotate-90 origin-left",
    top: "top-1 left-1",
    right: "top-[55%] left-1 -rotate-90 origin-left",
  };

  const ownerPositionClasses: Record<Position, string> = {
    bottom: "top-1 left-1",
    left: "top-1 right-1 rotate-90",
    top: "bottom-1 right-1",
    right: "top-1 right-1 -rotate-90 origin-right",
  };

  const imageRotation: Record<Position, string> = {
    bottom: "",
    left: "-rotate-90",
    top: "",
    right: "rotate-90",
  };

  // Visual feedback for owned/mortgaged/development
  const cardBorder = mortgaged
    ? "border-gray-500 opacity-70"
    : color
    ? `border-[${color}]`
    : "border-gray-400";

  const cardBg = isCurrentPlayerOwner ? "bg-cyan-100/90" : "bg-white/95";

  return (
    <div
      className={`
        relative w-full h-full 
        ${cardBg} 
        text-[#0B191A] 
        rounded-md overflow-hidden 
        shadow-md 
        border-4 
        transition-all duration-300
        ${orientationClasses[position]}
        ${cardBorder}
        ${isCurrentPlayerOwner ? "ring-2 ring-cyan-500 ring-offset-1" : ""}
      `}
      style={{ borderColor: color || "#6B7280" }}
    >
      {/* Title / Name */}
      <div className="pt-2 px-2 text-center">
        <p className="text-[7px] sm:text-[8px] md:text-[9px] font-bold uppercase tracking-wide truncate">
          {name}
        </p>
      </div>

      {/* Price (top-right or rotated) */}
      {price !== undefined && price !== null && (
        <div
          className={`
            absolute text-[7px] sm:text-[8px] font-semibold 
            bg-white/90 px-1.5 py-0.5 rounded shadow-sm
            ${pricePositionClasses[position]}
          `}
        >
          ${price}
        </div>
      )}

      {/* Base Rent (bottom-left or rotated) */}
      {rent_site_only !== undefined && rent_site_only !== null && (
        <div
          className={`
            absolute text-[7px] sm:text-[8px] font-semibold 
            bg-white/90 px-1.5 py-0.5 rounded shadow-sm
            ${rentPositionClasses[position]}
          `}
        >
          ${rent_site_only}
        </div>
      )}

      {/* Owner / Status (bottom-right or rotated) */}
      <div
        className={`
          absolute text-[6px] sm:text-[7px] font-medium 
          px-1.5 py-0.5 rounded shadow-sm
          ${ownerPositionClasses[position]}
          ${
            owner
              ? mortgaged
                ? "bg-gray-700 text-gray-200"
                : "bg-amber-100 text-amber-800"
              : "bg-green-100 text-green-800"
          }
        `}
      >
        {mortgaged
          ? "MORTGAGED"
          : owner || "BANK"}
      </div>

      {/* Development indicator (houses/hotel) */}
      {development > 0 && (
        <div className="absolute top-1 left-1/2 -translate-x-1/2 flex gap-0.5">
          {Array.from({ length: development }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${
                development === 5 ? "bg-red-600" : "bg-green-600"
              } shadow-sm`}
            />
          ))}
        </div>
      )}

      {/* Optional icon (if provided) */}
      {icon && (
        <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
          <div className={`text-4xl sm:text-5xl transform ${imageRotation[position]}`}>
            {icon}
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyCardMobile;