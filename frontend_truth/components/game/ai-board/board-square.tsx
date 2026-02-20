import { motion } from "framer-motion";
import PropertyCard from "../cards/property-card";
import SpecialCard from "../cards/special-card";
import CornerCard from "../cards/corner-card";
import { Property, Player } from "@/types/game";
import { getPlayerSymbol, getPlayerSymbolData } from "@/lib/types/symbol";

type BoardSquareProps = {
  square: Property;
  playersHere: Player[];
  currentPlayerId: number;
  owner: string | null;
  devLevel: number;
  mortgaged: boolean;
  onClick?: () => void;
};

const isTopRow = (square: Property) => square.grid_row === 1;
const isBottomRow = (square: Property) => square.grid_row === 11;
const isLeftColumn = (square: Property) => square.grid_col === 1;
const isRightColumn = (square: Property) => square.grid_col === 11;

export default function BoardSquare({
  square,
  playersHere,
  currentPlayerId,
  owner,
  devLevel,
  mortgaged,
  onClick,
}: BoardSquareProps) {
  const playerCount = playersHere.length;
  const isClickableProperty = square.type === "property" && onClick;

  // Token size configuration - matches the reference Board.tsx style
  const getTokenConfig = () => {
    if (playerCount === 1) return { size: 30, font: 36, gap: 1 };
    if (playerCount === 2) return { size: 26, font: 28, gap: 2 };
    if (playerCount === 3) return { size: 20, font: 24, gap: 2 };
    if (playerCount === 4) return { size: 18, font: 20, gap: 1 };
    if (playerCount <= 6) return { size: 14, font: 18, gap: 1 };
    return { size: 14, font: 16, gap: 1 };
  };

  const { size, font, gap } = getTokenConfig();

  // Development indicator positioning
  let devPositionClass = "";
  if (isTopRow(square)) devPositionClass = "bottom-2 left-1/2 -translate-x-1/2";
  else if (isBottomRow(square)) devPositionClass = "top-2 left-1/2 -translate-x-1/2";
  else if (isLeftColumn(square)) devPositionClass = "top-1/2 -translate-y-1/2 right-2";
  else if (isRightColumn(square)) devPositionClass = "top-1/2 -translate-y-1/2 left-2";

  return (
    <motion.div
      style={{
        gridRowStart: square.grid_row,
        gridColumnStart: square.grid_col,
      }}
      className={`w-full h-full p-[2px] relative box-border group hover:z-50 transition-all duration-200 ${
        isClickableProperty ? "cursor-pointer" : ""
      }`}
      whileHover={{ scale: isClickableProperty ? 1.8 : 1, zIndex: 50 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      onClick={isClickableProperty ? onClick : undefined}
    >
      <div
        className={`
          w-full h-full relative overflow-hidden rounded-md bg-black/30
          transform group-hover:scale-200
          ${isTopRow(square) ? "origin-top group-hover:origin-bottom group-hover:translate-y-[120px]" : ""}
          ${!isTopRow(square) && !isBottomRow(square) ? "group-hover:translate-x-0" : ""}
          group-hover:shadow-2xl group-hover:shadow-cyan-500/60
          transition-all duration-300
        `}
      >
        {/* Card Content */}
        {square.type === "property" && <PropertyCard square={square} owner={owner} />}
        {["community_chest", "chance", "luxury_tax", "income_tax"].includes(square.type) && (
          <SpecialCard square={square} />
        )}
        {square.type === "corner" && <CornerCard square={square} />}

        {/* Development Indicator - Centered on edge */}
        {square.type === "property" && devLevel > 0 && (
          <div
            className={`absolute ${devPositionClass} z-30 bg-yellow-500 text-black text-sm font-bold rounded-full w-10 h-10 flex items-center justify-center shadow-2xl`}
          >
            {devLevel === 5 ? "🏨" : devLevel}
          </div>
        )}

        {/* Mortgaged Overlay - Matches reference style */}
        {mortgaged && (
          <>
            <div className="absolute inset-0 bg-black/60 z-20 pointer-events-none rounded-md" />
            <div className="absolute inset-0 bg-red-900/80 flex items-center justify-center z-30 pointer-events-none">
              <span className="text-white text-lg font-bold rotate-12 tracking-widest drop-shadow-2xl px-4 py-2 bg-red-800/80 rounded-lg">
                MORTGAGED
              </span>
            </div>
          </>
        )}

        {/* Player Tokens - Enhanced desktop-style */}
        {playerCount > 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40 p-4">
            <div
              className="flex flex-wrap items-center justify-center"
              style={{ gap: `${gap}px` }}
            >
              {playersHere.map((player, index) => {
                const isCurrent = player.user_id === currentPlayerId;
                const symbol = getPlayerSymbol(player.symbol ?? "hat") || "🎲";
                const tokenData = getPlayerSymbolData(player.symbol ?? "hat");
                const tokenName = tokenData?.name || "Token";

                return (
                  <motion.div
                    key={player.user_id}
                    className={`
                      flex items-center justify-center rounded-full
                      bg-transparent text-white font-bold shadow-2xl
                      ${isCurrent
                        ? "ring-4 ring-cyan-400 ring-offset-4 ring-offset-transparent shadow-cyan-400/70"
                        : "border-2 border-gray-300"
                      }
                    `}
                    style={{
                      width: `${size}px`,
                      height: `${size}px`,
                      fontSize: `${font}px`,
                      minWidth: `${size}px`,
                      minHeight: `${size}px`,
                    }}
                    title={`${player.username} • ${tokenName} ($${player.balance})`}
                    initial={{ scale: 0, rotate: -180, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 25,
                      delay: index * 0.06,
                    }}
                    whileHover={{ scale: 1.3 }}
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