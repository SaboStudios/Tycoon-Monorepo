// components/game/Board.tsx
import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import SpecialCard from "../../cards/special-card";
import CornerCard from "../../cards/corner-card";
import { getPlayerSymbol, getPlayerSymbolData } from "@/lib/types/symbol";
import { GameProperty, Property, Player } from "@/types/game";
import PropertyCard from "../../cards/property-card";

interface BoardProps {
  properties: Property[];
  players: Player[];
  currentGameProperties: GameProperty[];
  animatedPositions: Record<number, number>;
  currentPlayerId: number | null | undefined;
  onPropertyClick?: (propertyId: number) => void;
  /** Renders in the center of the board (e.g. timers + roll dice) */
  centerContent?: React.ReactNode;
}

const isTopRow = (square: Property) => square.grid_row === 1;
const isBottomRow = (square: Property) => square.grid_row === 11;
const isLeftColumn = (square: Property) => square.grid_col === 1;
const isRightColumn = (square: Property) => square.grid_col === 11;

const Board: React.FC<BoardProps> = ({
  properties,
  players,
  currentGameProperties,
  animatedPositions,
  currentPlayerId,
  onPropertyClick,
  centerContent,
}) => {
  const boardRef = useRef<HTMLDivElement>(null);

  const playersByPosition = React.useMemo(() => {
    const map = new Map<number, { players: Player[]; count: number }>();
    players.forEach((p) => {
      if (p.balance <= 0) return;
      const pos = animatedPositions[p.user_id] !== undefined ? animatedPositions[p.user_id] : (p.position ?? 0);
      if (!map.has(pos)) map.set(pos, { players: [], count: 0 });
      map.get(pos)!.players.push(p);
      map.get(pos)!.count += 1;
    });
    return map;
  }, [players, animatedPositions]);

  const propertyOwner = (id: number) => {
    const gp = currentGameProperties.find((gp) => gp.property_id === id);
    return gp ? players.find((p) => p.address === gp.address)?.username || null : null;
  };

  const developmentStage = (id: number) =>
    currentGameProperties.find((gp) => gp.property_id === id)?.development ?? 0;

  const isPropertyMortgaged = (id: number) =>
    currentGameProperties.find((gp) => gp.property_id === id)?.mortgaged === true;

  useEffect(() => {
    if (boardRef.current && currentPlayerId != null) {
      const currentPlayer = players.find(p => p.user_id === currentPlayerId);
      if (currentPlayer?.position != null) {
        const squareElement = boardRef.current.querySelector(`[data-position="${currentPlayer.position}"]`);
        if (squareElement) {
          squareElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
      }
    }
  }, [currentPlayerId, players]);

  // Token configuration optimized for mobile
  const getTokenConfig = (count: number) => {
    if (count === 1) return { size: 25, font: 20, gap: 4 };
    if (count === 2) return { size: 15, font: 15, gap: 2 };
    if (count === 3) return { size: 12, font: 10, gap: 1 };
    if (count === 4) return { size: 10, font: 8, gap: 1 };
    if (count <= 6) return { size: 9, font: 9, gap: 1 };
    return { size: 7, font: 7, gap: 1 }; // 7–8 players
  };

  return (
    <div ref={boardRef} className="w-full max-w-[95vw] max-h-[60vh] overflow-auto touch-pinch-zoom touch-pan-x touch-pan-y aspect-square relative shadow-2xl shadow-cyan-500/10 mt-4"
  
    >
      <div className="grid grid-cols-11 grid-rows-11 w-full h-full gap-[1px] box-border scale-90 sm:scale-100">
        {/* Center Area - z-20 so timers + roll dice show above surrounding squares */}
        <div className="col-start-2 col-span-9 row-start-2 row-span-9 bg-[#010F10] flex flex-col justify-center items-center p-3 relative overflow-hidden rounded-lg z-20"
          style={{
    backgroundImage: `url(/bb.jpg)`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
     }}
        >
          {centerContent}
        </div>

        {/* All Squares */}
        {properties.map((square) => {
          const { players: playersHere = [], count: playerCount = 0 } = playersByPosition.get(square.id) ?? {};
          const devLevel = developmentStage(square.id);
          const mortgaged = isPropertyMortgaged(square.id);
          const isClickable = square.type === "property";

          let devPositionClass = "";
          if (isTopRow(square)) devPositionClass = "bottom-1 left-1/2 -translate-x-1/2";
          else if (isBottomRow(square)) devPositionClass = "top-1 left-1/2 -translate-x-1/2";
          else if (isLeftColumn(square)) devPositionClass = "top-1/2 -translate-y-1/2 right-1";
          else if (isRightColumn(square)) devPositionClass = "top-1/2 -translate-y-1/2 left-1";

          const { size, font, gap } = getTokenConfig(playerCount);

          return (
            <motion.div
              key={square.id}
              data-position={square.id}
              style={{
                gridRowStart: square.grid_row,
                gridColumnStart: square.grid_col,
              }}
              className="w-full h-full p-[1px] relative box-border group hover:z-10 transition-transform duration-200"
              whileHover={{ scale: isClickable ? 1.5 : 1, zIndex: 50 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              onClick={() => isClickable && onPropertyClick?.(square.id)}
              
            >
              <div className={`w-full h-full transform group-hover:scale-150 ${isTopRow(square) ? 'origin-top group-hover:origin-bottom group-hover:translate-y-[50px]' : ''} group-hover:shadow-lg group-hover:shadow-cyan-500/50 transition-transform duration-200 rounded-sm overflow-hidden bg-black/20 p-0.5 relative ${isClickable ? 'cursor-pointer' : ''}`}>
                {square.type === "property" && <PropertyCard square={square} owner={propertyOwner(square.id)} />}
                {["community_chest", "chance", "luxury_tax", "income_tax"].includes(square.type) && <SpecialCard square={square} />}
                {square.type === "corner" && <CornerCard square={square} />}

                {/* Development Indicator */}
                {square.type === "property" && devLevel > 0 && (
                  <div className={`absolute ${devPositionClass} z-20 bg-yellow-500 text-black text-xs font-bold rounded-full w-7 h-7 flex items-center justify-center shadow-lg`}>
                    {devLevel === 5 ? "🏨" : devLevel}
                  </div>
                )}

                {/* Mortgaged Overlay */}
                {mortgaged && (
                  <>
                    <div className="absolute inset-0 bg-red-900/80 flex items-center justify-center z-30 pointer-events-none rounded-sm">
                      <span className="text-white text-xs font-bold rotate-12 tracking-wider drop-shadow-2xl px-2 py-1 bg-red-800/80 rounded">
                        MORTGAGED
                      </span>
                    </div>
                    <div className="absolute inset-0 bg-black/60 z-10 pointer-events-none rounded-sm" />
                  </>
                )}

                {/* Player Tokens - Enhanced Desktop-Style Layout */}
                {playerCount > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40 p-2">
                    <div
                      className="flex flex-wrap items-center justify-center gap-1"
                      style={{ gap: `${gap}px` }}
                    >
                      {playersHere.map((player, index) => {
                        const isCurrent = player.user_id === currentPlayerId;
                        const symbol = getPlayerSymbol(player.symbol)  || "🎲";
                        const tokenData = getPlayerSymbolData(player.symbol);
                        const tokenName = tokenData?.name || "Token";

                        return (
                          <motion.div
                            key={player.user_id}
                            className={`
                              flex items-center justify-center rounded-full
                              bg-transparent text-white font-bold shadow-2xl
                              ${isCurrent 
                                ? "ring-4 ring-cyan-400 ring-offset-2 ring-offset-transparent shadow-cyan-400/60" 
                                : "border-2 border-gray-400"
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
        })}
      </div>
    </div>
  );
};

export default Board;