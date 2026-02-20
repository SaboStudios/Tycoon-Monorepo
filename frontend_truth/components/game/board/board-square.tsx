import { motion } from "framer-motion";
import PropertyCard from "../cards/property-card";
import SpecialCard from "../cards/special-card";
import CornerCard from "../cards/corner-card";
import { Property, Player } from "@/types/game";
import { getPlayerSymbol, getPlayerSymbolData } from "@/lib/types/symbol";

type BoardSquareProps = {
  square: Property;
  playersHere: Player[];
  playerCount: number; // ← Added from Board component
  currentPlayerId: number;
  owner: string | null;
  devLevel: number;
  mortgaged: boolean;
  onClick?: () => void;
};

export default function BoardSquare({
  square,
  playersHere,
  playerCount,
  currentPlayerId,
  owner,
  devLevel,
  mortgaged,
  onClick,
}: BoardSquareProps) {
  const isTopHalf = square.grid_row === 1;
  const isClickableProperty = square.type === "property" && onClick;

  // Dynamic token sizing and layout based on player count
  const getTokenConfig = (count: number) => {
    if (count === 1) return { size: 60, font: 36, layout: "single" };
    if (count === 2) return { size: 48, font: 28, layout: "row" };
    if (count === 3) return { size: 42, font: 24, layout: "triangle" };
    if (count === 4) return { size: 38, font: 22, layout: "grid-2x2" };
    if (count <= 6) return { size: 34, font: 20, layout: "grid-3x2" };
    return { size: 30, font: 18, layout: "grid-4x2" }; // 7–8 players
  };

  const { size, font, layout } = getTokenConfig(playerCount);

  const getPositionClass = (index: number, count: number) => {
    if (count === 1) return "";
    if (count === 2) return index === 0 ? "-translate-x-4" : "translate-x-4";
    if (count === 3) {
      return index === 0
        ? "-translate-x-6 translate-y-2"
        : index === 1
        ? "translate-x-6 translate-y-2"
        : "-translate-y-8";
    }
    if (count === 4) {
      const positions = ["-translate-x-4 -translate-y-4", "translate-x-4 -translate-y-4", "-translate-x-4 translate-y-4", "translate-x-4 translate-y-4"];
      return positions[index] || "";
    }
    // For 5–8: use flex-wrap grid with centered alignment (no manual positioning needed)
    return "";
  };

  return (
    <motion.div
      style={{
        gridRowStart: square.grid_row,
        gridColumnStart: square.grid_col,
      }}
      className={`w-full h-full p-[2px] relative box-border group hover:z-10 transition-transform duration-200 ${
        isClickableProperty ? "cursor-pointer" : ""
      }`}
      whileHover={{ scale: 1.75, zIndex: 50 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      onClick={isClickableProperty ? onClick : undefined}
    >
      <div
        className={`w-full h-full transform group-hover:scale-200 ${
          isTopHalf ? "origin-top group-hover:origin-bottom group-hover:translate-y-[100px]" : ""
        } group-hover:shadow-lg group-hover:shadow-cyan-500/50 transition-transform duration-200 rounded-md overflow-hidden bg-black/20 p-1 relative`}
      >
        {/* Card content */}
        {square.type === "property" && <PropertyCard square={square} owner={owner} />}
        {["community_chest", "chance", "luxury_tax", "income_tax"].includes(square.type) && (
          <SpecialCard square={square} />
        )}
        {square.type === "corner" && <CornerCard square={square} />}

        {/* Development indicator */}
        {square.type === "property" && devLevel > 0 && (
          <div className="absolute top-1 right-1 bg-yellow-500 text-black text-xs font-bold rounded px-1 z-20 flex items-center gap-0.5">
            {devLevel === 5 ? "🏨" : `🏠 ${devLevel}`}
          </div>
        )}

        {/* Mortgaged Overlay */}
        {mortgaged && (
          <>
            <div className="absolute inset-0 bg-black/60 z-10 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-red-600/70 to-transparent z-20 pointer-events-none" />
            <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
              <span className="text-red-300 text-2xl font-black tracking-wider drop-shadow-2xl rotate-[-30deg] scale-150">
                MORTGAGED
              </span>
            </div>
          </>
        )}

        {/* Player Tokens */}
        {playerCount > 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-3">
            <div
              className={`
                relative flex flex-wrap items-center justify-center gap-1
                ${layout === "grid-3x2" || layout === "grid-4x2" ? "max-w-full" : ""}
              `}
              style={{
                width: layout.includes("grid") ? "100%" : "auto",
                height: layout.includes("grid") ? "100%" : "auto",
              }}
            >
              {playersHere.map((player, index) => {
                const isCurrent = player.user_id === currentPlayerId;
                const symbol = getPlayerSymbol(player.symbol ?? "hat") || "🎲";
                const tokenData = getPlayerSymbolData(player.symbol ?? "hat");
                const tokenName = tokenData?.name || "Classic Token";

                return (
                  <motion.div
                    key={player.user_id}
                    className={`
                      flex items-center justify-center rounded-full
                      bg-transparent text-white font-bold shadow-2xl backdrop-blur-sm
                      ${isCurrent ? "ring-4 ring-cyan-400 ring-offset-2 ring-offset-transparent" : "border-2 border-white/50"}
                      ${getPositionClass(index, playerCount)}
                    `}
                    style={{
                      width: `${size}px`,
                      height: `${size}px`,
                      fontSize: `${font}px`,
                      minWidth: `${size}px`,
                      minHeight: `${size}px`,
                    }}
                    title={`${player.username} • ${tokenName}`}
                    initial={{ scale: 0, rotate: -180, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 25,
                      delay: index * 0.05,
                    }}
                    whileHover={{ scale: 1.2, zIndex: 10 }}
                  >
                    {symbol}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}