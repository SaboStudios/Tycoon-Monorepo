import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Game, Player, Property } from "@/types/game";

interface IncomingTradesProps {
  showTrades: boolean;
  toggleTrades: () => void;
  incomingTrades: any[];
  properties: Property[];
  game: Game;
  handleTradeAction: (id: number, action: "accepted" | "declined" | "counter") => void;
  
}

export const IncomingTrades: React.FC<IncomingTradesProps> = ({
  showTrades,
  toggleTrades,
  incomingTrades,
  properties,
  game,
  handleTradeAction,

}) => {
  return (
    <div className="border-t-4 border-pink-600 pt-3">
      <button
        onClick={toggleTrades}
        className="w-full text-lg font-bold text-pink-300 flex justify-between items-center"
      >
        <span>TRADES {incomingTrades.length > 0 && `(${incomingTrades.length} pending)`}</span>
        <motion.span animate={{ rotate: showTrades ? 180 : 0 }} className="text-2xl text-cyan-400">
          ▼
        </motion.span>
      </button>

      <AnimatePresence>
        {showTrades && incomingTrades.length > 0 && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden mt-3 space-y-3"
          >
            {incomingTrades.map((trade: any) => {
              const from = game.players.find((p: Player) => p.user_id === trade.player_id);
              const offerProps = properties.filter((p) => trade.offer_properties?.includes(p.id));
              const requestProps = properties.filter((p) => trade.requested_properties?.includes(p.id));

              return (
                <motion.div
                  key={trade.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-gradient-to-br from-purple-900/60 to-cyan-900/40 border-2 border-cyan-500 rounded-xl p-4"
                >
                  <div className="font-bold text-cyan-300 mb-2 text-sm">
                    From {from?.username || "Player"}
                  </div>
                  <div className="text-xs space-y-1 mb-3">
                    <div className="text-green-400">
                      Gives: {offerProps.length ? offerProps.map((p) => p.name).join(", ") : "nothing"} 
                      {trade.offer_amount > 0 && ` + $${trade.offer_amount}`}
                    </div>
                    <div className="text-red-400">
                      Wants: {requestProps.length ? requestProps.map((p) => p.name).join(", ") : "nothing"} 
                      {trade.requested_amount > 0 && ` + $${trade.requested_amount}`}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => handleTradeAction(trade.id, "accepted")}
                      className="py-1.5 bg-green-600 rounded text-xs font-bold text-white hover:bg-green-500"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleTradeAction(trade.id, "declined")}
                      className="py-1.5 bg-red-600 rounded text-xs font-bold text-white hover:bg-red-500"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => handleTradeAction(trade.id, "counter")}
                      className="py-1.5 bg-yellow-600 rounded text-xs font-bold text-black hover:bg-yellow-500"
                    >
                      Counter
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};