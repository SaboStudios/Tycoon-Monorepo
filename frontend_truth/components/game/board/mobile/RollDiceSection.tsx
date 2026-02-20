"use client";

import { Player } from "@/types/game";

interface RollDiceSectionProps {
  isMyTurn: boolean;
  isRolling: boolean;
  isRaisingFunds: boolean;
  showInsolvencyModal: boolean;
  hasNegativeBalance: boolean;
  /** Seconds left to roll (90s timer); null when not applicable */
  turnTimeLeft?: number | null;
  onRollDice: () => void;
  onDeclareBankruptcy: () => void;
}

export default function RollDiceSection({
  isMyTurn,
  isRolling,
  isRaisingFunds,
  showInsolvencyModal,
  hasNegativeBalance,
  turnTimeLeft,
  onRollDice,
  onDeclareBankruptcy,
}: RollDiceSectionProps) {
  if (!isMyTurn || isRolling || isRaisingFunds || showInsolvencyModal) return null;

  return (
    <div className="w-full max-w-xs mx-auto mb-8 flex flex-col gap-4 items-center">
      {turnTimeLeft != null && turnTimeLeft > 0 && (
        <div className={`font-mono font-bold ${turnTimeLeft <= 10 ? "text-red-400 animate-pulse" : "text-cyan-200"}`}>
          Roll in {Math.floor(turnTimeLeft / 60)}:{(turnTimeLeft % 60).toString().padStart(2, "0")}
        </div>
      )}
      {hasNegativeBalance ? (
        <button
          onClick={onDeclareBankruptcy}
          className="w-full py-4 px-8 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 active:from-red-800 active:to-rose-900 text-white font-bold text-lg tracking-wide rounded-full shadow-md shadow-red-500/40 border border-white/20 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-red-500/40 active:scale-95"
        >
          Declare Bankruptcy
        </button>
      ) : (
        <div className="flex justify-center items-center w-full">
          <button
            onClick={onRollDice}
            className="py-2.5 px-10 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 active:from-cyan-600 active:to-cyan-700 text-white font-bold text-base tracking-wide rounded-full shadow-lg shadow-cyan-500/40 border border-cyan-300/30 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-cyan-400/60 active:scale-95"
          >
            Roll Dice
          </button>
        </div>
      )}
    </div>
  );
}
