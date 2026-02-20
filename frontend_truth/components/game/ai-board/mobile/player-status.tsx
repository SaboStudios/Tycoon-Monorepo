// components/game/PlayerStatus.tsx
import React from "react";
import { motion } from "framer-motion";
import { Player } from "@/types/game";

interface PlayerStatusProps {
  currentPlayer: Player | undefined;
  isAITurn: boolean; // Strictly boolean
  buyPrompted: boolean;
}

const PlayerStatus: React.FC<PlayerStatusProps> = ({ currentPlayer, isAITurn, buyPrompted }) => {
  if (!currentPlayer) return null;

  return (
    <div className="w-full text-center mt-4 px-4">
      {isAITurn && (
        <div className="mt-2">
          <motion.h2
            className="text-lg font-bold text-pink-300 mb-2"
            animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.05, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            {currentPlayer.username} is playing…
          </motion.h2>
          {buyPrompted && (
            <p className="text-sm text-yellow-300 font-bold">
              AI is deciding whether to buy...
            </p>
          )}
          <div className="flex justify-center mt-3">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-400"></div>
          </div>
          <p className="text-pink-200 text-xs italic mt-2">
            {currentPlayer.username} • Decides automatically
          </p>
        </div>
      )}

      {!isAITurn && (
        <h2 className="text-xl font-bold text-cyan-300">
          Your Turn!
        </h2>
      )}
    </div>
  );
};

export default PlayerStatus;