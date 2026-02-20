import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Property } from "@/types/game";

interface TradeSectionProps {
  showTrade: boolean;
  toggleTrade: () => void;
  openTrades: any[];        // Your outgoing/active trades
  tradeRequests: any[];     // Incoming trade requests
  properties: Property[];
  game: any;
  handleTradeAction: (id: number, action: "accepted" | "declined" | "counter") => void;
}

export const TradeSection: React.FC<TradeSectionProps> = ({
  showTrade,
  toggleTrade,
  openTrades,
  tradeRequests,
  properties,
  game,
  handleTradeAction,
}) => {
  const renderTradeItem = (trade: any, isIncoming: boolean) => {
    const offeredProps = properties.filter((p) =>
      trade.offer_properties?.includes(p.id)
    );
    const requestedProps = properties.filter((p) =>
      trade.requested_properties?.includes(p.id)
    );
    const player = game.players.find((pl: any) =>
      isIncoming ? pl.user_id === trade.player_id : pl.user_id === trade.target_player_id
    );

    return (
      <div key={trade.id} className="bg-black/40 border border-cyan-800 rounded-lg p-4 text-sm shadow-md">
        <div className="font-medium text-cyan-200 mb-2">
          {isIncoming ? "From" : "To"} <span className="text-white">{player?.username || "Unknown Player"}</span>
        </div>
        <div className="text-xs space-y-1.5 mb-3">
          <div className="text-green-400">
            <strong>{isIncoming ? "Offers" : "You offer"}:</strong>{" "}
            {offeredProps.length > 0
              ? offeredProps.map((p) => p.name).join(", ")
              : "nothing"}
            {trade.offer_amount > 0 && ` + $${trade.offer_amount}`}
          </div>
          <div className="text-red-400">
            <strong>{isIncoming ? "Wants" : "They want"}:</strong>{" "}
            {requestedProps.length > 0
              ? requestedProps.map((p) => p.name).join(", ")
              : "nothing"}
            {trade.requested_amount > 0 && ` + $${trade.requested_amount}`}
          </div>
        </div>

        {isIncoming && (
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleTradeAction(trade.id, "accepted")}
              className="py-2 bg-green-600 hover:bg-green-500 rounded font-bold text-white text-xs transition"
            >
              ACCEPT
            </button>
            <button
              onClick={() => handleTradeAction(trade.id, "declined")}
              className="py-2 bg-red-600 hover:bg-red-500 rounded font-bold text-white text-xs transition"
            >
              DECLINE
            </button>
            <button
              onClick={() => handleTradeAction(trade.id, "counter")}
              className="py-2 bg-yellow-600 hover:bg-yellow-500 rounded font-bold text-black text-xs transition"
            >
              COUNTER
            </button>
          </div>
        )}

        {!isIncoming && (
          <div className="mt-3">
            <span
              className={`inline-block px-3 py-1 rounded text-xs font-bold ${
                trade.status === "accepted"
                  ? "bg-green-900/70 text-green-300"
                  : trade.status === "declined"
                  ? "bg-red-900/70 text-red-300"
                  : "bg-yellow-900/70 text-yellow-300"
              }`}
            >
              {trade.status.toUpperCase()}
            </span>
          </div>
        )}
      </div>
    );
  };

  const handleDeclineAllIncoming = () => {
    if (tradeRequests.length === 0) return;
    if (!confirm(`Decline ALL ${tradeRequests.length} incoming trade request(s)? This cannot be undone.`)) return;

    tradeRequests.forEach((trade) => {
      handleTradeAction(trade.id, "declined");
    });
  };

  const handleCancelAllOutgoing = () => {
    if (openTrades.length === 0) return;
    if (!confirm("Cancel ALL your active trade offers? This cannot be undone.")) return;

    openTrades.forEach((trade) => {
      handleTradeAction(trade.id, "declined");
    });
  };

  return (
    <div className="border-t-4 border-pink-600 pt-5">
      <button
        onClick={toggleTrade}
        className="w-full flex justify-between items-center text-xl font-bold text-pink-300 hover:text-pink-200 transition"
      >
        <span>
          TRADES
          {tradeRequests.length > 0 && (
            <span className="ml-2 text-cyan-400 font-bold">
              ({tradeRequests.length} incoming)
            </span>
          )}
        </span>
        <motion.span
          animate={{ rotate: showTrade ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="text-3xl text-cyan-400"
        >
          ▼
        </motion.span>
      </button>

      <AnimatePresence>
        {showTrade && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="overflow-hidden mt-4"
          >
            <div className="max-h-96 overflow-y-auto pr-1 pb-8 space-y-6 scrollbar-thin scrollbar-thumb-cyan-700 scrollbar-track-transparent">
              {/* Incoming Trade Requests */}
              {tradeRequests.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-lg font-bold text-cyan-400 flex items-center gap-2">
                      <span>📥</span> INCOMING REQUESTS
                    </h4>
                    <button
                      onClick={handleDeclineAllIncoming}
                      className="px-4 py-2 bg-red-800/80 hover:bg-red-700 text-xs font-bold rounded border border-red-600/50 text-red-200 transition shadow-md"
                    >
                      Decline All
                    </button>
                  </div>
                  <div className="space-y-3">
                    {tradeRequests.map((trade) => renderTradeItem(trade, true))}
                  </div>
                </div>
              )}

              {/* Your Outgoing Trades */}
              {openTrades.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-lg font-bold text-cyan-400 flex items-center gap-2">
                      <span>📤</span> MY ACTIVE TRADES
                    </h4>
                    <button
                      onClick={handleCancelAllOutgoing}
                      className="px-4 py-2 bg-orange-800/80 hover:bg-orange-700 text-xs font-bold rounded border border-orange-600/50 text-orange-200 transition shadow-md"
                    >
                      Cancel All
                    </button>
                  </div>
                  <div className="space-y-3">
                    {openTrades.map((trade) => renderTradeItem(trade, false))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {openTrades.length === 0 && tradeRequests.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-6xl mb-4">💱</div>
                  <p className="text-lg font-medium">No active trades</p>
                  <p className="text-sm mt-2">Send an offer or wait for incoming requests</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};