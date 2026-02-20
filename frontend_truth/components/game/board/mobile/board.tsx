// components/game/Board.tsx
import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import PropertyCardMobile from "../../cards/property-card-mobile";
import SpecialCard from "../../cards/special-card";
import CornerCard from "../../cards/corner-card";
import { getPlayerSymbol } from "@/lib/types/symbol";
import { GameProperty, Property, Player } from "@/types/game";

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
    const map = new Map<number, Player[]>();
    players.forEach((p) => {
      if (p.balance <= 0) return;
      const pos = animatedPositions[p.user_id] !== undefined ? animatedPositions[p.user_id] : (p.position ?? 0);
      if (!map.has(pos)) map.set(pos, []);
      map.get(pos)!.push(p);
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

  return (
    <div ref={boardRef} className="w-full max-w-[95vw] max-h-[60vh] overflow-auto touch-pinch-zoom touch-pan-x touch-pan-y aspect-square relative shadow-2xl shadow-cyan-500/10">
      <div className="grid grid-cols-11 grid-rows-11 w-full h-full min-w-0 gap-[1px] box-border scale-90 sm:scale-100">
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
          const playersHere = playersByPosition.get(square.id) ?? [];
          const devLevel = developmentStage(square.id);
          const mortgaged = isPropertyMortgaged(square.id);

          let devPositionClass = "";
          if (isTopRow(square)) devPositionClass = "bottom-1 left-1/2 -translate-x-1/2";
          else if (isBottomRow(square)) devPositionClass = "top-1 left-1/2 -translate-x-1/2";
          else if (isLeftColumn(square)) devPositionClass = "top-1/2 -translate-y-1/2 right-1";
          else if (isRightColumn(square)) devPositionClass = "top-1/2 -translate-y-1/2 left-1";
          else devPositionClass = "top-0.5 right-0.5";

          // Determine if this square should be clickable (only regular properties)
          const isClickable = square.type === "property";

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
              onClick={() => isClickable && onPropertyClick?.(square.id)} // ← CLICK HANDLER
            >
              <div className={`w-full h-full transform group-hover:scale-150 ${isTopRow(square) ? 'origin-top group-hover:origin-bottom group-hover:translate-y-[50px]' : ''} group-hover:shadow-lg group-hover:shadow-cyan-500/50 transition-transform duration-200 rounded-sm overflow-hidden bg-black/20 p-0.5 relative ${isClickable ? 'cursor-pointer' : ''}`}>
                {square.type === "property" && <PropertyCardMobile square={square} owner={propertyOwner(square.id)} />}
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

                {/* Player Tokens */}
                <div className="absolute bottom-0.5 left-0.5 flex flex-col gap-1 z-40 pointer-events-none">
                  {playersHere.map((p) => {
                    const isCurrentPlayer = p.user_id === currentPlayerId;
                    return (
                      <motion.span
                        key={p.user_id}
                        title={`${p.username} ($${p.balance})`}
                        className={`text-xl border-2 rounded-full ${isCurrentPlayer ? 'border-cyan-300 shadow-lg shadow-cyan-400/50' : 'border-gray-600'}`}
                        initial={{ scale: 1 }}
                        animate={{
                          y: isCurrentPlayer ? [0, -4, 0] : [0, -2, 0],
                          scale: isCurrentPlayer ? [1, 1.1, 1] : 1,
                        }}
                        transition={{
                          y: { duration: isCurrentPlayer ? 1.2 : 2, repeat: Infinity, ease: "easeInOut" },
                          scale: { duration: isCurrentPlayer ? 1.2 : 0, repeat: Infinity },
                        }}
                        whileHover={{ scale: 1.2, y: -2 }}
                      >
                        {getPlayerSymbol(p.symbol)}
                      </motion.span>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default Board;