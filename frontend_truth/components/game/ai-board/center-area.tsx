"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DiceAnimation from "./dice-animation";
import RollResult from "./roll-result";
import ActionLog from "./action-log";

import { Property, Player, Game } from "@/types/game";

const bgUrl = "./bb.jpg";

type CenterAreaProps = {
  isMyTurn: boolean;
  isAITurn: boolean;
  currentPlayer?: Player;
  playerCanRoll: boolean;
  isRolling: boolean;
  roll: { die1: number; die2: number; total: number } | null;
  buyPrompted: boolean;
  currentProperty: Property | null | undefined;
  currentPlayerBalance: number;
  buyScore: number | null;
  history: Game["history"];
  onRollDice: () => void;
  onBuyProperty: () => void;
  onSkipBuy: () => void;
  onDeclareBankruptcy: () => void;
  isPending: boolean;
  timerSlot?: React.ReactNode;
  /** When true, show "Time's Up" and hide Roll Dice (time-up by net worth). */
  gameTimeUp?: boolean;
  /** When true and it's my turn, show "Pay $50 to get out" (leave jail before rolling). */
  inJail?: boolean;
  /** After rolling from jail with no doubles, show Pay / Use card / Stay */
  jailChoiceRequired?: boolean;
  canPayToLeaveJail?: boolean;
  hasChanceJailCard?: boolean;
  hasCommunityChestJailCard?: boolean;
  onPayToLeaveJail?: () => void;
  onUseGetOutOfJailFree?: (cardType: "chance" | "community_chest") => void;
  onStayInJail?: () => void;
  /** When true, hide Roll Dice (turn end scheduled after buy/skip) */
  turnEndScheduled?: boolean;
  /** Untimed games: vote to end by net worth (AI: 1 vote enough) */
  isUntimed?: boolean;
  endByNetWorthStatus?: { vote_count: number; required_votes: number; voters: Array<{ user_id: number; username: string }> } | null;
  endByNetWorthLoading?: boolean;
  onVoteEndByNetWorth?: () => void;
  me?: { user_id?: number } | null;
};

export default function CenterArea({
  isMyTurn,
  isAITurn,
  currentPlayer,
  playerCanRoll,
  isRolling,
  roll,
  buyPrompted,
  currentProperty,
  currentPlayerBalance,
  buyScore,
  history,
  onRollDice,
  onBuyProperty,
  onSkipBuy,
  onDeclareBankruptcy,
  isPending,
  timerSlot,
  gameTimeUp = false,
  inJail = false,
  jailChoiceRequired = false,
  canPayToLeaveJail = false,
  hasChanceJailCard = false,
  hasCommunityChestJailCard = false,
  onPayToLeaveJail,
  onUseGetOutOfJailFree,
  onStayInJail,
  turnEndScheduled = false,
  isUntimed = false,
  endByNetWorthStatus = null,
  endByNetWorthLoading = false,
  onVoteEndByNetWorth,
  me,
}: CenterAreaProps) {
  const [showEndByNetWorthConfirm, setShowEndByNetWorthConfirm] = useState(false);

  return (
    <>
      {/* End game by net worth — corner button (top-left) */}
      {isUntimed && endByNetWorthStatus != null && !showEndByNetWorthConfirm && onVoteEndByNetWorth && (
        <button
          onClick={() => {
            if (endByNetWorthStatus.voters?.some((v) => v.user_id === me?.user_id)) return;
            if (!endByNetWorthLoading) setShowEndByNetWorthConfirm(true);
          }}
          disabled={endByNetWorthLoading || (endByNetWorthStatus.voters?.some((v) => v.user_id === me?.user_id) ?? false)}
          className="fixed top-4 left-4 lg:top-[116px] z-50 flex items-center justify-center w-10 h-10 rounded-full bg-red-600/90 border border-red-400/60 text-white hover:bg-red-500 hover:border-red-300 transition-colors disabled:opacity-50 disabled:pointer-events-none"
          title={endByNetWorthStatus.voters?.some((v) => v.user_id === me?.user_id) ? `Voted ${endByNetWorthStatus.vote_count}/${endByNetWorthStatus.required_votes}` : `End game by net worth · ${endByNetWorthStatus.vote_count}/${endByNetWorthStatus.required_votes}`}
          aria-label="Vote to end game by net worth"
        >
          <span className="text-xl font-bold leading-none">×</span>
        </button>
      )}

    <div className="col-start-2 col-span-9 row-start-2 row-span-9 bg-[#010F10] flex flex-col justify-center items-center p-4 relative overflow-hidden"
       style={{
    backgroundImage: `url(/bb.jpg)`,
    backgroundSize: 'cover',    // ← usually good to add
    backgroundPosition: 'center',
  }}
     >
      {/* Dice Animation */}
      <DiceAnimation isRolling={isRolling} roll={roll} />

      {/* Roll Result */}
      {roll && !isRolling && <RollResult roll={roll} />}

      {/* Game Title */}
      <h1 className="text-3xl lg:text-5xl font-bold text-[#F0F7F7] font-orbitron text-center mb-2 z-10">
        Tycoon
      </h1>

      {/* AI Turn: "Username is playing" — on top, above time */}
      {isAITurn && (
        <div className="text-center mb-4 z-10">
          <motion.h2
            className="text-xl font-bold text-cyan-400"
            animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.05, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            {currentPlayer?.username} is playing…
          </motion.h2>
        </div>
      )}

      {/* Game timer (countdown) in center */}
      {timerSlot && <div className="flex justify-center mb-4 z-10">{timerSlot}</div>}

      {/* Time's Up (net worth) — hide roll dice */}
      {gameTimeUp && (
        <div className="text-center mb-4 z-10 font-mono font-bold rounded-xl px-6 py-3 bg-amber-500/20 border-2 border-amber-400/60 text-amber-300 text-lg">
          Time&apos;s Up!
        </div>
      )}

      {/* Jail: rolled from jail, no doubles — choose Pay $50 / Use card / Stay */}
      {!gameTimeUp && isMyTurn && jailChoiceRequired && (
        <div className="flex flex-col items-center gap-3 mb-3">
          <p className="text-cyan-200 text-sm font-medium">No doubles. Pay $50, use a card, or stay in jail.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {onPayToLeaveJail && (
              <button
                onClick={onPayToLeaveJail}
                disabled={!canPayToLeaveJail}
                className={`px-4 py-2 rounded-lg font-medium border ${canPayToLeaveJail ? "bg-amber-600/80 text-white border-amber-500" : "bg-gray-600 text-gray-400 border-gray-500"}`}
              >
                Pay $50
              </button>
            )}
            {onUseGetOutOfJailFree && hasChanceJailCard && (
              <button onClick={() => onUseGetOutOfJailFree("chance")} className="px-4 py-2 rounded-lg font-medium bg-orange-600/80 text-white border border-orange-500">
                Use Chance Card
              </button>
            )}
            {onUseGetOutOfJailFree && hasCommunityChestJailCard && (
              <button onClick={() => onUseGetOutOfJailFree("community_chest")} className="px-4 py-2 rounded-lg font-medium bg-blue-600/80 text-white border border-blue-500">
                Use Community Chest Card
              </button>
            )}
            {onStayInJail && (
              <button onClick={onStayInJail} className="px-4 py-2 rounded-lg font-medium bg-gray-600 text-white border border-gray-500">
                Stay in Jail
              </button>
            )}
          </div>
        </div>
      )}

      {/* Jail: in jail, before rolling — Pay / Use card / Roll */}
      {!gameTimeUp && isMyTurn && !turnEndScheduled && inJail && !jailChoiceRequired && !roll && !isRolling && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {onPayToLeaveJail && (
            <button
              onClick={onPayToLeaveJail}
              disabled={!canPayToLeaveJail}
              className={`px-4 py-2 rounded-lg font-medium border ${canPayToLeaveJail ? "bg-amber-600/80 text-white border-amber-500" : "bg-gray-600 text-gray-400 border-gray-500"}`}
            >
              Pay $50
            </button>
          )}
          {onUseGetOutOfJailFree && hasChanceJailCard && (
            <button onClick={() => onUseGetOutOfJailFree("chance")} className="px-4 py-2 rounded-lg font-medium bg-orange-600/80 text-white border border-orange-500">
              Chance Card
            </button>
          )}
          {onUseGetOutOfJailFree && hasCommunityChestJailCard && (
            <button onClick={() => onUseGetOutOfJailFree("community_chest")} className="px-4 py-2 rounded-lg font-medium bg-blue-600/80 text-white border border-blue-500">
              CC Card
            </button>
          )}
          <button
            onClick={onRollDice}
            className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-bold text-xl rounded-full hover:from-cyan-600 hover:to-cyan-700 transform hover:scale-110 active:scale-95 transition-all shadow-xl shadow-cyan-500/30"
          >
            Roll Dice
          </button>
        </div>
      )}

      {/* Untimed: vote to end game by net worth — moved to top-left corner $ button */}
      <AnimatePresence>
        {showEndByNetWorthConfirm && onVoteEndByNetWorth && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowEndByNetWorthConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-gradient-to-b from-slate-800 to-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-900/30 p-6 max-w-sm w-full"
            >
              <button
                type="button"
                onClick={() => setShowEndByNetWorthConfirm(false)}
                className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-cyan-300 hover:text-cyan-100 hover:bg-cyan-500/20 transition-colors"
                aria-label="Close"
              >
                <span className="text-xl leading-none">×</span>
              </button>
              <p className="text-lg font-semibold text-cyan-100 mb-1 pr-8">End game by net worth?</p>
              <p className="text-sm text-cyan-200/80 mb-6">The game will end and the player with the highest net worth will win.</p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowEndByNetWorthConfirm(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-cyan-200 hover:text-cyan-100 border border-cyan-500/40 hover:bg-cyan-500/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onVoteEndByNetWorth();
                    setShowEndByNetWorthConfirm(false);
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-cyan-600/90 text-white hover:bg-cyan-500 border border-cyan-400/50 transition-colors"
                >
                  Yes, vote to end
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Player's Turn: Roll or Bankruptcy (when not in jail choice flow) */}
      {!gameTimeUp && isMyTurn && !turnEndScheduled && !roll && !isRolling && !inJail && !jailChoiceRequired && (
        playerCanRoll ? (
          <button
            onClick={onRollDice}
            className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-bold text-xl rounded-full hover:from-cyan-600 hover:to-cyan-700 transform hover:scale-110 active:scale-95 transition-all shadow-xl shadow-cyan-500/30"
          >
            Roll Dice
          </button>
        ) : (
          <button
            onClick={onDeclareBankruptcy}
            disabled={isPending}
            className="px-12 py-6 bg-gradient-to-r from-red-700 to-red-900 text-white text-2xl font-bold rounded-2xl shadow-2xl hover:shadow-red-500/50 hover:scale-105 transition-all duration-300 border-4 border-red-500/50 disabled:opacity-70"
          >
            {isPending ? "Ending Game..." : "💔 Declare Bankruptcy"}
          </button>
        )
      )}

      {/* Buy Property Prompt */}
      {isMyTurn && buyPrompted && currentProperty && (
        <div className="flex gap-4 flex-wrap justify-center mt-4">
          <button
            onClick={onBuyProperty}
            disabled={currentProperty.price != null && currentPlayerBalance < currentProperty.price}
            className={`px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-bold rounded-full hover:from-cyan-600 hover:to-cyan-700 transform hover:scale-110 active:scale-95 transition-all shadow-lg ${
              currentProperty.price != null && currentPlayerBalance < currentProperty.price
                ? "opacity-50 cursor-not-allowed"
                : ""
            }`}
          >
            Buy for ${currentProperty.price}
          </button>
          <button
            onClick={onSkipBuy}
            className="px-6 py-3 bg-gray-600 text-white font-bold rounded-full hover:bg-gray-700 transform hover:scale-105 active:scale-95 transition-all shadow-lg"
          >
            Skip
          </button>
        </div>
      )}

      {/* AI Turn: Spinner + subtitle (below Roll Dice area) */}
      {isAITurn && (
        <div className="mt-5 text-center z-10">
          <div className="flex justify-center mt-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-cyan-400"></div>
          </div>
          <p className="text-cyan-200 text-sm italic mt-3">
            Smart AI • Decides automatically
          </p>
        </div>
      )}

      {/* Action Log at the bottom */}
      <ActionLog history={history} />
    </div>
    </>
  );
}