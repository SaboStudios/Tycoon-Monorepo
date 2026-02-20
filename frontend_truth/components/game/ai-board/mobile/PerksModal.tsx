"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import CollectibleInventoryBar from "@/components/collectibles/collectibles-invetory-mobile";
import { Game, GameProperty } from "@/types/game";

interface PerksModalProps {
  open: boolean;
  onClose: () => void;
  game: Game;
  game_properties: GameProperty[];
  isMyTurn: boolean;
  onRollDice: (forAI?: boolean) => void;
  onEndTurn: () => void;
  onTriggerSpecialLanding: (position: number, isSpecial?: boolean) => void;
  onEndTurnAfterSpecial: () => void;
}

export default function PerksModal({
  open,
  onClose,
  game,
  game_properties,
  isMyTurn,
  onRollDice,
  onEndTurn,
  onTriggerSpecialLanding,
  onEndTurnAfterSpecial,
}: PerksModalProps) {
  if (!open) return null;

  return (
    <AnimatePresence>
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 z-[100]"
        />
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed inset-x-0 bottom-0 top-16 z-[100] bg-[#0A1C1E] rounded-t-3xl border-t border-cyan-500/50 overflow-hidden shadow-2xl flex flex-col"
        >
          <div className="p-6 border-b border-cyan-900/50 flex items-center justify-between">
            <h2 className="text-3xl font-bold flex items-center gap-4">
              <Sparkles className="w-10 h-10 text-[#00F0FF]" />
              My Perks
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-2"
            >
              <X className="w-8 h-8" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-8">
            <CollectibleInventoryBar
              game={game}
              game_properties={game_properties}
              isMyTurn={isMyTurn}
              ROLL_DICE={onRollDice}
              END_TURN={onEndTurn}
              triggerSpecialLanding={onTriggerSpecialLanding}
              endTurnAfterSpecial={onEndTurnAfterSpecial}
            />
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  );
}
