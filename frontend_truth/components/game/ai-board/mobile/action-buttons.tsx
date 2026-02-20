import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiClient } from "@/lib/api";
import { Game, Player, Property } from "@/types/game";
import { toast } from "react-hot-toast";

interface ActionButtonsProps {
  isMyTurn: boolean;
  isRolling: boolean;
  roll: { die1: number; die2: number; total: number } | null;
  buyPrompted: boolean;
  justLandedProperty: Property | null;
  currentGame: Game;
  me: Player | null;
  currentPlayer: Player | undefined;
  fetchUpdatedGame: () => Promise<void>;
  setBuyPrompted: (value: boolean) => void;
  landedPositionThisTurn: React.MutableRefObject<number | null>;
  showToast: (message: string, type?: "success" | "error" | "default") => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  isMyTurn,
  isRolling,
  roll,
  buyPrompted,
  justLandedProperty,
  currentGame,
  me,
  currentPlayer,
  fetchUpdatedGame,
  setBuyPrompted,
  landedPositionThisTurn,
  showToast,
}) => {
  const END_TURN = async () => {
    if (!currentPlayer || !me) return;
    try {
      await apiClient.post("/game-players/end-turn", {
        user_id: currentPlayer.user_id,
        game_id: currentGame.id,
      });
      showToast("Turn ended", "success");
      await fetchUpdatedGame();
    } catch {
      showToast("Failed to end turn", "error");
    }
  };

  const BUY_PROPERTY = async () => {
    if (!currentPlayer?.position || !justLandedProperty?.price || !me) {
      showToast("Cannot buy right now", "error");
      return;
    }

    const playerBalance = currentPlayer.balance ?? 0;
    if (playerBalance < justLandedProperty.price) {
      showToast("Not enough money!", "error");
      return;
    }

    try {
      await apiClient.post("/game-properties/buy", {
        user_id: currentPlayer.user_id,
        game_id: currentGame.id,
        property_id: justLandedProperty.id,
      });

      showToast(`You bought ${justLandedProperty.name}!`, "success");
      setBuyPrompted(false);
      landedPositionThisTurn.current = null;
      await fetchUpdatedGame();
      setTimeout(END_TURN, 800);
    } catch {
      showToast("Purchase failed", "error");
    }
  };

  return (
    <div className="w-full max-w-[95vw] flex flex-col items-center p-4 gap-6">
      {/* Roll Button */}
      {isMyTurn && !roll && !isRolling && (
        <button
          onClick={() => {/* ROLL_DICE will be handled in parent */}}
          disabled={isRolling}
          className="w-[80vw] py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-lg rounded-full hover:from-green-600 hover:to-emerald-700 transform hover:scale-105 active:scale-95 transition-all disabled:opacity-50 shadow-xl"
        >
          {isRolling ? "Rolling..." : "Roll Dice"}
        </button>
      )}

      {/* Buy Prompt */}
      <AnimatePresence>
        {isMyTurn && buyPrompted && justLandedProperty && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 20 }}
            className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-md p-4 rounded-t-2xl shadow-2xl z-[60] flex flex-col items-center gap-4"
          >
            <h3 className="text-lg font-bold text-white">Buy {justLandedProperty.name}?</h3>
            <p className="text-sm text-gray-300">Price: ${justLandedProperty.price?.toLocaleString()}</p>
            <div className="flex gap-4 w-full justify-center">
              <button
                onClick={BUY_PROPERTY}
                className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-full hover:from-green-600 hover:to-emerald-700 transform hover:scale-105 active:scale-95 transition-all shadow-lg"
              >
                Buy
              </button>
              <button
                onClick={() => {
                  showToast("Skipped purchase");
                  setBuyPrompted(false);
                  landedPositionThisTurn.current = null;
                  setTimeout(END_TURN, 800);
                }}
                className="flex-1 py-3 bg-gray-600 text-white font-bold rounded-full hover:bg-gray-700 transform hover:scale-105 active:scale-95 transition-all shadow-lg"
              >
                Skip
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ActionButtons;