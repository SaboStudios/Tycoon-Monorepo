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
      <div key={trade.id} className="bg-black/40 border border-cyan-800 rounded-lg p-3 text-sm">
        <div className="font-medium text-cyan-200 mb-1">
          {isIncoming ? "From" : "To"} {player?.username || "Player"}
        </div>
        <div className="text-xs space-y-1 mb-2">
          <div className="text-green-400">
            {isIncoming ? "Gives" : "Offer"}:{" "}
            {offeredProps.length ? offeredProps.map((p) => p.name).join(", ") : "nothing"}{" "}
            {trade.offer_amount > 0 && `+ $${trade.offer_amount}`}
          </div>
          <div className="text-red-400">
            {isIncoming ? "Wants" : "Want"}:{" "}
            {requestedProps.length ? requestedProps.map((p) => p.name).join(", ") : "nothing"}{" "}
            {trade.requested_amount > 0 && `+ $${trade.requested_amount}`}
          </div>
        </div>
        {isIncoming && (
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => handleTradeAction(trade.id, "accepted")}
              className="py-1.5 bg-green-600 rounded text-xs font-bold text-white hover:bg-green-500"
            >
              ACCEPT
            </button>
            <button
              onClick={() => handleTradeAction(trade.id, "declined")}
              className="py-1.5 bg-red-600 rounded text-xs font-bold text-white hover:bg-red-500"
            >
              DECLINE
            </button>
            <button
              onClick={() => handleTradeAction(trade.id, "counter")}
              className="py-1.5 bg-yellow-600 rounded text-xs font-bold text-black hover:bg-yellow-500"
            >
              COUNTER
            </button>
          </div>
        )}
        {!isIncoming && (
          <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${
            trade.status === 'accepted' ? 'bg-green-900/50 text-green-300' :
            trade.status === 'declined' ? 'bg-red-900/50 text-red-300' :
            'bg-yellow-900/50 text-yellow-300'
          }`}>
            {trade.status.toUpperCase()}
          </span>
        )}
      </div>
    );
  };

  const handleClearAllOutgoing = () => {
    if (openTrades.length === 0) return;
    if (!confirm("Decline and cancel ALL your active trade offers? This cannot be undone.")) return;

    openTrades.forEach((trade) => {
      handleTradeAction(trade.id, "declined");
    });
  };

  const handleDeclineAllIncoming = () => {
    if (tradeRequests.length === 0) return;
    if (!confirm(`Decline ALL ${tradeRequests.length} incoming trade request(s)?`)) return;

    tradeRequests.forEach((trade) => {
      handleTradeAction(trade.id, "declined");
    });
  };

  return (
    <div className="border-t-4 border-pink-600 pt-4">
      <button
        onClick={toggleTrade}
        className="w-full text-xl font-bold text-pink-300 flex justify-between items-center"
      >
        <span>
          TRADES{" "}
          {tradeRequests.length > 0 && (
            <span className="text-cyan-400">({tradeRequests.length} incoming)</span>
          )}
        </span>
        <motion.span animate={{ rotate: showTrade ? 180 : 0 }} className="text-3xl text-cyan-400">
          ▼
        </motion.span>
      </button>

      <AnimatePresence>
        {showTrade && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden mt-3 space-y-6"
          >
            {/* Incoming Requests */}
            {tradeRequests.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-lg font-bold text-cyan-400 flex items-center gap-2">
                    <span>📥</span> INCOMING REQUESTS
                  </h4>
                  <button
                    onClick={handleDeclineAllIncoming}
                    className="px-3 py-1.5 bg-red-800/70 hover:bg-red-700 text-xs font-semibold rounded border border-red-600/50 text-red-200 transition"
                  >
                    Decline All
                  </button>
                </div>
                <div className="space-y-2">
                  {tradeRequests.map((t) => renderTradeItem(t, true))}
                </div>
              </div>
            )}

            {/* Your Active Outgoing Trades */}
            {openTrades.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-lg font-bold text-cyan-400 flex items-center gap-2">
                    <span>📤</span> MY ACTIVE TRADES
                  </h4>
                  <button
                    onClick={handleClearAllOutgoing}
                    className="px-3 py-1.5 bg-orange-800/70 hover:bg-orange-700 text-xs font-semibold rounded border border-orange-600/50 text-orange-200 transition"
                  >
                    Cancel All
                  </button>
                </div>
                <div className="space-y-2">
                  {openTrades.map((t) => renderTradeItem(t, false))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {openTrades.length === 0 && tradeRequests.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <div className="text-5xl mb-3">💱</div>
                <p className="text-lg">No active trades</p>
                <p className="text-sm mt-1">Make an offer or wait for incoming requests</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};