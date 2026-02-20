"use client";

import { Player } from "@/types/game";

interface RollDiceSectionProps {
  isMyTurn: boolean;
  isRolling: boolean;
  isRaisingFunds: boolean;
  showInsolvencyModal: boolean;
  me: Player | null;
  roll: { die1: number; die2: number; total: number } | null;
  onRollDice: () => void;
  onDeclareBankruptcy: () => void;
}

export default function RollDiceSection({
  isMyTurn,
  isRolling,
  isRaisingFunds,
  showInsolvencyModal,
  me,
  roll,
  onRollDice,
  onDeclareBankruptcy,
}: RollDiceSectionProps) {
  if (!isMyTurn || isRolling || isRaisingFunds || showInsolvencyModal) return null;

  return (
    <>
      {me && me.balance >= 0 && !roll && (
        <div className="flex justify-center items-center w-full mb-8">
          <button
            onClick={onRollDice}
            className="
              py-2.5 px-10
              bg-gradient-to-r from-cyan-500 to-cyan-600 
              hover:from-cyan-400 hover:to-cyan-500 
              active:from-cyan-600 active:to-cyan-700 
              text-white font-bold text-base tracking-wide rounded-full 
              shadow-lg shadow-cyan-500/40 border border-cyan-300/30 
              transition-all duration-300 
              hover:scale-105 hover:shadow-xl hover:shadow-cyan-400/60 
              active:scale-95
            "
          >
            Roll Dice
          </button>
        </div>
      )}

      {me && me.balance < 0 && (
        <div className="w-full max-w-md mx-auto mb-8 text-center">
          <div className="text-red-400 text-xl font-bold mb-4 animate-pulse">
            BANKRUPT — Balance: ${Math.abs(me.balance).toLocaleString()}
          </div>
          <button
            onClick={onDeclareBankruptcy}
            className="w-full py-4 px-8 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-800 text-white font-black text-2xl tracking-wide rounded-full shadow-2xl shadow-red-900/50 border-4 border-red-400 transition-all duration-300 hover:scale-105 active:scale-95 animate-pulse"
          >
            DECLARE BANKRUPTCY
          </button>
          <p className="text-gray-400 text-sm mt-4">
            You cannot continue with a negative balance.
          </p>
        </div>
      )}
    </>
  );
}
